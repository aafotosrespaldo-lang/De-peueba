/**
 * DIRECTAURANTE POS CORE v0.1 - Inventory & Kardex API Routes
 * Exposes RESTful endpoints conforming to Directaurante Core backend architecture.
 */

import { Router, Request, Response } from 'express';
import { InventoryService } from './inventoryService';
import { DEFAULT_RESTAURANT_ID } from '../../core/database';

export const inventoryRouter = Router();

// ==========================================
// INVENTORY ITEMS
// ==========================================

// GET /api/inventory/items or GET /api/inventory
inventoryRouter.get('/items', (req: Request, res: Response) => {
  try {
    const { category, search, status } = req.query;
    const items = InventoryService.getItems(DEFAULT_RESTAURANT_ID, {
      category: category as string,
      search: search as string,
      status: status as any,
    });
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/items/:id
inventoryRouter.get('/items/:id', (req: Request, res: Response) => {
  try {
    const item = InventoryService.getItemById(req.params.id, DEFAULT_RESTAURANT_ID);
    if (!item) {
      return res.status(404).json({ error: `Insumo ${req.params.id} no encontrado.` });
    }
    const stockInfo = InventoryService.getStock(req.params.id, DEFAULT_RESTAURANT_ID);
    res.json({ item, stock: stockInfo });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/inventory/items (create or update item)
inventoryRouter.post('/items', (req: Request, res: Response) => {
  try {
    const { item, actor } = req.body;
    if (!item || !item.name || !item.sku || !item.base_unit) {
      return res.status(400).json({ error: 'name, sku y base_unit son campos requeridos.' });
    }
    const saved = InventoryService.createOrUpdateItem(item, actor || 'Admin', DEFAULT_RESTAURANT_ID);
    res.json({ success: true, item: saved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// KÁRDEX & MOVEMENTS
// ==========================================

// GET /api/inventory/items/:id/kardex
inventoryRouter.get('/items/:id/kardex', (req: Request, res: Response) => {
  try {
    const { start_date, end_date, movement_type } = req.query;
    const kardex = InventoryService.getKardex(req.params.id, DEFAULT_RESTAURANT_ID, {
      start_date: start_date as string,
      end_date: end_date as string,
      movement_type: movement_type as string,
    });
    res.json(kardex);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/inventory/movements (Atomic movement with idempotency and non-negative stock validation)
inventoryRouter.post('/movements', (req: Request, res: Response) => {
  try {
    const {
      inventory_item_id,
      movement_type,
      quantity,
      reason,
      reference_type,
      reference_id,
      actor,
      cost_cents_per_unit,
    } = req.body;

    if (!inventory_item_id || !movement_type || quantity === undefined) {
      return res.status(400).json({
        error: 'inventory_item_id, movement_type y quantity son obligatorios.',
      });
    }

    const movement = InventoryService.registerMovement({
      restaurant_id: DEFAULT_RESTAURANT_ID,
      inventory_item_id,
      movement_type,
      quantity: Number(quantity),
      reason: reason || 'Movimiento de inventario',
      reference_type: reference_type || 'manual_adjustment',
      reference_id,
      actor: actor || 'Operador',
      cost_cents_per_unit: cost_cents_per_unit ? Number(cost_cents_per_unit) : undefined,
    });

    res.json({ success: true, movement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/inventory/adjustments (Convenience endpoint for manual entries, exits or waste)
inventoryRouter.post('/adjustments', (req: Request, res: Response) => {
  try {
    const { inventory_item_id, type, quantity, reason, actor } = req.body;
    if (!inventory_item_id || !type || !quantity) {
      return res.status(400).json({
        error: 'inventory_item_id, type (adjustment_in | adjustment_out | waste) y quantity son obligatorios.',
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        error: 'Todo ajuste de inventario exige un motivo explícito.',
      });
    }

    const movement = InventoryService.registerMovement({
      restaurant_id: DEFAULT_RESTAURANT_ID,
      inventory_item_id,
      movement_type: type,
      quantity: Number(quantity),
      reason,
      reference_type: type === 'waste' ? 'waste' : 'manual_adjustment',
      reference_id: `ADJ-${Date.now()}`,
      actor: actor || 'Operador',
    });

    res.json({ success: true, movement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// PHYSICAL INVENTORY COUNTS
// ==========================================

// POST /api/inventory/counts (Periodic physical count comparison & adjustment)
inventoryRouter.post('/counts', (req: Request, res: Response) => {
  try {
    const { performed_by, notes, counts } = req.body;
    if (!counts || !Array.isArray(counts) || counts.length === 0) {
      return res.status(400).json({ error: 'Se requiere una lista de conteos físicos (counts).' });
    }

    const result = InventoryService.applyPhysicalCount({
      restaurant_id: DEFAULT_RESTAURANT_ID,
      performed_by: performed_by || 'Encargado de Inventario',
      notes,
      counts,
    });

    res.json({ success: true, count: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// ALERTS & OPERATIONAL SUMMARY
// ==========================================

// GET /api/inventory/alerts
inventoryRouter.get('/alerts', (_req: Request, res: Response) => {
  try {
    const alerts = InventoryService.getAlerts(DEFAULT_RESTAURANT_ID);
    res.json({ alerts, count: alerts.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/summary
inventoryRouter.get('/summary', (_req: Request, res: Response) => {
  try {
    const summary = InventoryService.getSummary(DEFAULT_RESTAURANT_ID);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// EXPORT CAPABILITY (CSV)
// ==========================================

// GET /api/inventory/export/kardex/:id
inventoryRouter.get('/export/kardex/:id', (req: Request, res: Response) => {
  try {
    const csv = InventoryService.exportKardexCsv(req.params.id, DEFAULT_RESTAURANT_ID);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kardex_${req.params.id}.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/inventory/export/items
inventoryRouter.get('/export/items', (_req: Request, res: Response) => {
  try {
    const csv = InventoryService.exportInventoryCsv(DEFAULT_RESTAURANT_ID);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inventario_${DEFAULT_RESTAURANT_ID}.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
