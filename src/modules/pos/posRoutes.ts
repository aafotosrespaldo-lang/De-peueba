/**
 * DIRECTAURANTE POS CORE v0.1 - Express API Routes
 * Exposes RESTful endpoints conforming to Directaurante's backend conventions.
 */

import { Router, Request, Response } from 'express';
import { PosService } from './posService';
import { deliveryRouter } from '../delivery/deliveryRoutes';
import { KdsService } from '../kds/kdsService';
import { CashService } from '../cash/cashService';
import { PrintService } from '../directprint/printService';
import { ImportService } from '../directimport/importService';
import { PluginRegistry } from '../../core/pluginRegistry';
import { AuditService } from '../../core/audit';
import { eventBus } from '../../core/eventBus';
import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import { OrderItemStatus } from '../../core/types';
import { inventoryRouter } from '../inventory/inventoryRoutes';
import { recipeRoutes } from '../recipes/recipeRoutes';
import { purchaseRoutes } from '../purchases/purchaseRoutes';
import { staffRouter } from '../staff/staffRoutes';

export const apiRouter = Router();

// Mount Inventory Module
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/pos/inventory', inventoryRouter);

// Mount Recipes Module
apiRouter.use('/recipes', recipeRoutes);
apiRouter.use('/pos/recipes', recipeRoutes);

// Mount Purchases Module
apiRouter.use('/purchases', purchaseRoutes);
apiRouter.use('/pos/purchases', purchaseRoutes);

// Mount Staff & Roles Module (FASE 10)
apiRouter.use('/staff', staffRouter);
apiRouter.use('/pos/staff', staffRouter);

// Mount CRM, Loyalty & Promotions Module (FASE 11)
import { crmRouter } from '../crm/crmRoutes';
apiRouter.use('/', crmRouter);
apiRouter.use('/pos', crmRouter);

// Mount Consolidated Finance Module (FASE 12 / F12.1)
import { financeRouter } from '../finance/financeRoutes';
apiRouter.use('/finance', financeRouter);
apiRouter.use('/pos/finance', financeRouter);

// Mount Native Solutions & Entitlements Registry (FASE 13)
import { solutionRouter } from '../solutions/solutionRoutes';
apiRouter.use('/solutions', solutionRouter);
apiRouter.use('/pos/solutions', solutionRouter);
apiRouter.use('/master/solutions', solutionRouter);

// Mount Directaurante Core Delivery Module (FASE 14 / F14.1)
apiRouter.use('/delivery', deliveryRouter);
apiRouter.use('/pos/delivery', deliveryRouter);

// ==========================================
// SYSTEM & PLUGINS
// ==========================================

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    module: 'Directaurante POS Core',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/plugins', (_req: Request, res: Response) => {
  const plugins = PluginRegistry.getRestaurantPlugins(DEFAULT_RESTAURANT_ID);
  res.json({ plugins });
});

apiRouter.post('/plugins/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled, actor } = req.body;
  const updated = PluginRegistry.togglePlugin(id, Boolean(enabled), DEFAULT_RESTAURANT_ID, actor || 'Admin');
  res.json({ success: true, plugin: updated });
});

// ==========================================
// POS TABLES & SESSIONS
// ==========================================

apiRouter.get('/pos/tables', (_req: Request, res: Response) => {
  const tables = PosService.getTables(DEFAULT_RESTAURANT_ID);
  res.json({ tables });
});

apiRouter.get('/pos/tables/:id', (req: Request, res: Response) => {
  try {
    const details = PosService.getTableDetails(req.params.id, DEFAULT_RESTAURANT_ID);
    res.json(details);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/open', (req: Request, res: Response) => {
  try {
    const { waiter_name, initial_guests } = req.body;
    const result = PosService.openTable(req.params.id, waiter_name, initial_guests, DEFAULT_RESTAURANT_ID);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/seats', (req: Request, res: Response) => {
  try {
    const { display_name, allergy_ids, notes, actor } = req.body;
    if (!display_name) {
      return res.status(400).json({ error: 'El nombre del comensal es obligatorio.' });
    }
    const seat = PosService.addGuestSubaccount(
      req.params.id,
      display_name,
      allergy_ids || [],
      notes,
      actor || 'Mesero',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, seat });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/tickets', (req: Request, res: Response) => {
  try {
    const { waiter_name, notes } = req.body;
    const ticket = PosService.createOrderTicket(
      req.params.id,
      waiter_name || 'Mesero',
      notes,
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// PRODUCTS & ALLERGIES
// ==========================================

apiRouter.get('/pos/products', (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  let products = db.get('products').filter((p) => p.restaurant_id === DEFAULT_RESTAURANT_ID);
  if (category) {
    products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }
  res.json({ products });
});

apiRouter.get('/pos/allergies', (_req: Request, res: Response) => {
  const allergies = db.get('allergies');
  const ingredients = db.get('ingredients');
  res.json({ allergies, ingredients });
});

apiRouter.post('/pos/allergies/check', (req: Request, res: Response) => {
  const { guest_subaccount_id, product_id } = req.body;
  const result = PosService.checkAllergies(guest_subaccount_id, product_id);
  res.json(result);
});

// ==========================================
// ORDER ITEMS (ASSIGNED TO SUBACCOUNT)
// ==========================================

apiRouter.post('/pos/tables/:id/items', (req: Request, res: Response) => {
  try {
    const {
      guest_subaccount_id,
      product_id,
      quantity,
      notes,
      override_allergy,
      actor,
      order_ticket_id,
      modifiers,
    } = req.body;

    if (!guest_subaccount_id || !product_id) {
      return res.status(400).json({ error: 'guest_subaccount_id y product_id son obligatorios.' });
    }

    const item = PosService.addItemToSubaccount(
      req.params.id,
      guest_subaccount_id,
      product_id,
      Number(quantity) || 1,
      notes,
      Boolean(override_allergy),
      actor || 'Mesero',
      DEFAULT_RESTAURANT_ID,
      order_ticket_id,
      modifiers || []
    );

    res.json({ success: true, item });
  } catch (err: any) {
    if (err.is_allergy_warning) {
      return res.status(409).json({
        error: err.message,
        is_allergy_warning: true,
        conflicts: err.allergy_conflict,
      });
    }
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/pos/items/:itemId/status', (req: Request, res: Response) => {
  try {
    const { status, actor, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'El estado es requerido.' });
    }
    const updated = PosService.updateItemStatus(
      req.params.itemId,
      status as OrderItemStatus,
      actor || 'Operador',
      notes,
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/items/:itemId/acknowledge', (req: Request, res: Response) => {
  try {
    const { actor } = req.body;
    const item = PosService.acknowledgeItem(req.params.itemId, actor || 'Cocina', DEFAULT_RESTAURANT_ID);
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/pos/items/:itemId/reassign', (req: Request, res: Response) => {
  try {
    const { new_subaccount_id, actor } = req.body;
    if (!new_subaccount_id) {
      return res.status(400).json({ error: 'new_subaccount_id es requerido.' });
    }
    const item = PosService.reassignItemSubaccount(
      req.params.itemId,
      new_subaccount_id,
      actor || 'Mesero',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/pos/items/:itemId', (req: Request, res: Response) => {
  try {
    const { reason, actor } = req.body || {};
    const item = PosService.removeOrderItem(
      req.params.itemId,
      reason || 'Cancelado por mesero',
      actor || 'Mesero',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/orders', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || req.body.server_id || 'Cajero POS';
    const order = PosService.createDirectPostOrder({
      ...req.body,
      restaurant_id: restaurantId,
      server_id: actor,
    });
    res.status(201).json({ success: true, order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/pos/orders/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const orders = db.get('orders');
    const order = orders.find((o) => o.id === req.params.id && o.restaurant_id === restaurantId);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }
    const items = db.get('order_items').filter((i) => i.order_id === order.id);
    res.json({ success: true, order: { ...order, items } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/pos/orders/:id/status', (req: Request, res: Response) => {
  try {
    const { status, actor, reason, restaurant_id } = req.body;
    const restaurantId = (req.query.restaurant_id as string) || restaurant_id || DEFAULT_RESTAURANT_ID;
    if (!status) {
      return res.status(400).json({ error: 'El estado es requerido.' });
    }
    const updated = PosService.updateOrderStatus(
      req.params.id,
      status,
      actor || 'Operador',
      reason,
      restaurantId
    );
    res.json({ success: true, order: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/orders/:id/cancel', (req: Request, res: Response) => {
  try {
    const { reason, actor, restaurant_id } = req.body;
    const restaurantId = (req.query.restaurant_id as string) || restaurant_id || DEFAULT_RESTAURANT_ID;
    const cancelled = PosService.cancelOrder(
      req.params.id,
      reason || 'Cancelación solicitada',
      actor || 'Operador',
      restaurantId
    );
    res.json({ success: true, order: cancelled });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// BILLS & SETTLEMENTS
// ==========================================

apiRouter.get('/pos/tables/:id/bill', (req: Request, res: Response) => {
  try {
    const bill = PosService.calculateTableBill(req.params.id, DEFAULT_RESTAURANT_ID);
    res.json({ bill });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/pay', (req: Request, res: Response) => {
  try {
    const { amount_cents, method, guest_subaccount_id, cashier, reference } = req.body;
    if (!amount_cents || !method) {
      return res.status(400).json({ error: 'amount_cents y method son obligatorios.' });
    }
    const payment = PosService.recordPayment(
      req.params.id,
      Number(amount_cents),
      method,
      guest_subaccount_id,
      cashier || 'Cajero',
      reference,
      DEFAULT_RESTAURANT_ID
    );
    const updatedBill = PosService.calculateTableBill(req.params.id, DEFAULT_RESTAURANT_ID);
    res.json({ success: true, payment, updated_bill: updatedBill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/tables/:id/close', (req: Request, res: Response) => {
  try {
    const { actor } = req.body;
    const result = PosService.closeTable(req.params.id, actor || 'Cajero', DEFAULT_RESTAURANT_ID);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// KDS (KITCHEN DISPLAY SYSTEM)
// ==========================================

apiRouter.get('/pos/kds', (req: Request, res: Response) => {
  const station = req.query.station as string | undefined;
  const includeCompleted = req.query.include_completed === 'true';
  const items = KdsService.getActiveStationItems(station, DEFAULT_RESTAURANT_ID, includeCompleted);
  res.json({ items });
});

apiRouter.get('/pos/kds/items', (req: Request, res: Response) => {
  const station = req.query.station as string | undefined;
  const includeCompleted = req.query.include_completed === 'true';
  const items = KdsService.getActiveStationItems(station, DEFAULT_RESTAURANT_ID, includeCompleted);
  res.json({ items });
});

apiRouter.get('/pos/kds/tickets', (req: Request, res: Response) => {
  const station = req.query.station as string | undefined;
  const includeCompleted = req.query.include_completed === 'true';
  const tickets = KdsService.getActiveTickets(station, DEFAULT_RESTAURANT_ID, includeCompleted);
  res.json({ tickets });
});

apiRouter.get('/pos/kds/summary', (req: Request, res: Response) => {
  const station = req.query.station as string | undefined;
  const summary = KdsService.getProductionSummary(station, DEFAULT_RESTAURANT_ID);
  res.json({ summary });
});

apiRouter.post('/pos/kds/tickets/:orderId/prepare', (req: Request, res: Response) => {
  try {
    const { station, actor } = req.body;
    const items = KdsService.startPreparingTicket(
      req.params.orderId,
      station,
      actor || 'Cocina',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/kds/tickets/:orderId/ready', (req: Request, res: Response) => {
  try {
    const { station, actor } = req.body;
    const items = KdsService.markTicketReady(
      req.params.orderId,
      station,
      actor || 'Cocina',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/kds/tickets/:orderId/deliver', (req: Request, res: Response) => {
  try {
    const { station, actor } = req.body;
    const items = KdsService.deliverTicket(
      req.params.orderId,
      station,
      actor || 'Mesero',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/kds/tickets/:orderId/recall', (req: Request, res: Response) => {
  try {
    const { station, actor } = req.body;
    const items = KdsService.recallTicket(
      req.params.orderId,
      station,
      actor || 'Cocina',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, items });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/kds/items/:itemId/recall', (req: Request, res: Response) => {
  try {
    const { actor } = req.body;
    const item = KdsService.recallItem(
      req.params.itemId,
      actor || 'Cocina',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// CASH SHIFTS & MOVEMENTS
// ==========================================

apiRouter.get('/cash/current', (_req: Request, res: Response) => {
  const current = CashService.getCurrentShift(DEFAULT_RESTAURANT_ID);
  res.json(current);
});

apiRouter.post('/cash/open', (req: Request, res: Response) => {
  try {
    const { initial_float_cents, opened_by, notes } = req.body;
    const shift = CashService.openShift(Number(initial_float_cents) || 0, opened_by || 'Cajero', notes, DEFAULT_RESTAURANT_ID);
    res.json({ success: true, shift });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/cash/movement', (req: Request, res: Response) => {
  try {
    const { type, amount_cents, description, performed_by } = req.body;
    const movement = CashService.recordMovement(
      type,
      Number(amount_cents) || 0,
      description,
      performed_by || 'Cajero',
      DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, movement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/cash/close', (req: Request, res: Response) => {
  try {
    const { actual_cash_cents, closed_by, notes } = req.body;
    const shift = CashService.closeShift(Number(actual_cash_cents) || 0, closed_by || 'Cajero', notes, DEFAULT_RESTAURANT_ID);
    res.json({ success: true, shift });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// AUDIT & DOMAIN EVENTS
// ==========================================

apiRouter.get('/audit/logs', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const logs = AuditService.getLogs(DEFAULT_RESTAURANT_ID, limit);
  res.json({ logs });
});

apiRouter.get('/events/history', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const events = eventBus.getHistory(DEFAULT_RESTAURANT_ID, limit);
  res.json({ events });
});

// ==========================================
// DIRECTPRINT PREPARATION
// ==========================================

apiRouter.get('/print/printers', (req: Request, res: Response) => {
  const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
  const printers = PrintService.getPrinters(restaurantId);
  const rules = PrintService.getRoutingRules(restaurantId);
  res.json({ printers, rules });
});

apiRouter.post('/print/printers', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const printer = PrintService.createPrinter(req.body, restaurantId);
    res.status(201).json({ success: true, printer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/print/printers/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const printer = PrintService.updatePrinter(req.params.id, req.body, restaurantId);
    res.json({ success: true, printer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/print/printers/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const deleted = PrintService.deletePrinter(req.params.id, restaurantId);
    res.json({ success: deleted });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/print/ticket-preview', (req: Request, res: Response) => {
  const { station, table_number, waiter, items } = req.body;
  const ticket = PrintService.generateEscPosTicket(station || 'kitchen', table_number || 'Mesa 1', waiter || 'Mesero', items || []);
  res.json(ticket);
});

apiRouter.get('/print/jobs', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const print_jobs = PrintService.listPrintJobs(restaurantId, {
      status: req.query.status as string,
      printer_id: req.query.printer_id as string,
      station: req.query.station as string,
    });
    res.json({ success: true, print_jobs, jobs: print_jobs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/print/jobs', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || 'System';
    const restaurantId = (req.query.restaurant_id as string) || req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const print_job = PrintService.createPrintJob({ ...req.body, actor }, restaurantId);
    res.status(201).json({ success: true, print_job, job: print_job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/print/jobs/:id/status', (req: Request, res: Response) => {
  try {
    const { status, error_message, restaurant_id } = req.body;
    const restaurantId = (req.query.restaurant_id as string) || restaurant_id || DEFAULT_RESTAURANT_ID;
    const print_job = PrintService.updatePrintJobStatus(req.params.id, status, error_message, restaurantId);
    res.json({ success: true, print_job, job: print_job });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/print/agent/download', (_req: Request, res: Response) => {
  const script = `@echo off
echo ========================================================
echo   DIRECTPRINT AGENT - SERVICIO LOCAL DE IMPRESION
echo ========================================================
echo Iniciando agente de impresion para Windows...
echo Conectando al Core de Directaurante...
echo.
node -e "
const { DirectPrintAgent } = require('./src/modules/directprint/directPrintAgent');
const agent = new DirectPrintAgent({
  coreUrl: 'http://localhost:3000',
  restaurantId: 'rest_carlos_01'
});
agent.start();
"
pause`;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="start-directprint-agent.bat"');
  res.send(script);
});

// ==========================================
// DIRECTIMPORT PREPARATION
// ==========================================

apiRouter.post('/import/preview', (req: Request, res: Response) => {
  const { source_pos, file_name, rows } = req.body;
  const preview = ImportService.createPreview(source_pos || 'SoftRestaurant', file_name || 'menu_export.csv', rows || [], DEFAULT_RESTAURANT_ID);
  res.json(preview);
});

apiRouter.post('/import/execute', (req: Request, res: Response) => {
  try {
    const { job_id, candidates, actor } = req.body;
    const result = ImportService.executeImport(job_id, candidates, actor || 'Admin', DEFAULT_RESTAURANT_ID);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// TEST SCENARIO LOADER (CRITERIO DE TERMINADA)
// ==========================================

apiRouter.post('/pos/load-canonical-scenario', (_req: Request, res: Response) => {
  try {
    db.resetToDefault();
    const table1 = db.get('tables').find((t) => t.number === 'Mesa 1');
    if (!table1) throw new Error('Mesa 1 no encontrada');

    const openResult = PosService.openTable(
      table1.id,
      'Mesero Carlos R.',
      [
        { name: 'Carlos' },
        { name: 'Ana', allergy_ids: ['alg_cacahuate'] }, // Ana has severe peanut allergy
        { name: 'Luis' },
        { name: 'María' },
      ],
      DEFAULT_RESTAURANT_ID
    );

    const subaccounts = openResult.subaccounts;
    const s1 = subaccounts.find((s) => s.seat_number === '1.1')!;
    const s2 = subaccounts.find((s) => s.seat_number === '1.2')!;
    const s3 = subaccounts.find((s) => s.seat_number === '1.3')!;
    const s4 = subaccounts.find((s) => s.seat_number === '1.4')!;

    // 1.1: Boneless BBQ ($140) + Cerveza ($45)
    PosService.addItemToSubaccount(table1.id, s1.id, 'prod_boneless_bbq', 1, undefined, false, 'Mesero Carlos R.');
    PosService.addItemToSubaccount(table1.id, s1.id, 'prod_cerveza', 1, undefined, false, 'Mesero Carlos R.');

    // 1.2: Hamburguesa ($150)
    PosService.addItemToSubaccount(table1.id, s2.id, 'prod_hamburguesa', 1, 'Término medio', false, 'Mesero Carlos R.');

    // 1.3: Burritos x2 ($220) + Michelada ($90)
    PosService.addItemToSubaccount(table1.id, s3.id, 'prod_burritos', 2, 'Con salsa aparte', false, 'Mesero Carlos R.');
    PosService.addItemToSubaccount(table1.id, s3.id, 'prod_michelada', 1, 'Escarchado con limón y sal', false, 'Mesero Carlos R.');

    // 1.4: Ensalada ($135)
    PosService.addItemToSubaccount(table1.id, s4.id, 'prod_ensalada', 1, 'Aderezo César aparte', false, 'Mesero Carlos R.');

    // Set sample states for KDS demonstration:
    const allItems = db.get('order_items').filter((i) => i.order_id === openResult.order.id);
    const boneless = allItems.find((i) => i.product_id === 'prod_boneless_bbq');
    if (boneless) {
      PosService.updateItemStatus(boneless.id, 'preparing', 'Cocinero Marcos', 'En freidora caliente');
    }
    const cerveza = allItems.find((i) => i.product_id === 'prod_cerveza');
    if (cerveza) {
      PosService.updateItemStatus(cerveza.id, 'preparing', 'Bartender Sofia', 'Preparando en barra');
      PosService.updateItemStatus(cerveza.id, 'ready', 'Bartender Sofia', 'Servida y lista en barra');
    }

    const bill = PosService.calculateTableBill(table1.id, DEFAULT_RESTAURANT_ID);

    res.json({
      success: true,
      message: 'Escenario canónico cargado con éxito en Mesa 1 con 4 comensales.',
      table: table1,
      subaccounts,
      items: allItems,
      bill,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
