/**
 * DIRECTAURANTE POS CORE v0.1 - Purchases & Suppliers Express API Routes (FASE 8)
 */

import { Router, Request, Response } from 'express';
import { PurchaseService } from './purchaseService';
import { DEFAULT_RESTAURANT_ID } from '../../core/database';
import { PurchaseOrderStatus } from '../../core/types';

export const purchaseRoutes = Router();

// ==========================================
// SUPPLIERS
// ==========================================

purchaseRoutes.get('/suppliers', (req: Request, res: Response) => {
  try {
    const restaurant_id = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const search = req.query.search as string;
    const is_active = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;

    const suppliers = PurchaseService.getSuppliers(restaurant_id, { search, is_active });
    res.json({ suppliers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

purchaseRoutes.get('/suppliers/:id', (req: Request, res: Response) => {
  try {
    const restaurant_id = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const supplier = PurchaseService.getSupplierById(req.params.id, restaurant_id);
    if (!supplier) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json({ supplier });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

purchaseRoutes.post('/suppliers', (req: Request, res: Response) => {
  try {
    const restaurant_id = req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const supplier = PurchaseService.createSupplier(req.body, actor, restaurant_id);
    res.status(201).json({ supplier });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

purchaseRoutes.put('/suppliers/:id', (req: Request, res: Response) => {
  try {
    const restaurant_id = req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const supplier = PurchaseService.updateSupplier(req.params.id, req.body, actor, restaurant_id);
    res.json({ supplier });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

purchaseRoutes.delete('/suppliers/:id', (req: Request, res: Response) => {
  try {
    const restaurant_id = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.query.actor as string) || 'Administrador';
    const success = PurchaseService.deleteSupplier(req.params.id, actor, restaurant_id);
    res.json({ success });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

purchaseRoutes.post('/suppliers/:id/products', (req: Request, res: Response) => {
  try {
    const restaurant_id = req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const supplier = PurchaseService.linkSupplierProduct(req.params.id, req.body.product, actor, restaurant_id);
    res.json({ supplier });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// PURCHASE ORDERS
// ==========================================

purchaseRoutes.get('/orders', (req: Request, res: Response) => {
  try {
    const restaurant_id = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const status = req.query.status as PurchaseOrderStatus;
    const supplier_id = req.query.supplier_id as string;
    const search = req.query.search as string;

    const orders = PurchaseService.getPurchaseOrders(restaurant_id, { status, supplier_id, search });
    res.json({ orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

purchaseRoutes.get('/orders/:id', (req: Request, res: Response) => {
  try {
    const restaurant_id = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const order = PurchaseService.getPurchaseOrderById(req.params.id, restaurant_id);
    if (!order) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }
    res.json({ order });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

purchaseRoutes.post('/orders', (req: Request, res: Response) => {
  try {
    const restaurant_id = req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const order = PurchaseService.createPurchaseOrder(req.body, actor, restaurant_id);
    res.status(201).json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

purchaseRoutes.put('/orders/:id', (req: Request, res: Response) => {
  try {
    const restaurant_id = req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const order = PurchaseService.updatePurchaseOrder(req.params.id, req.body, actor, restaurant_id);
    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

purchaseRoutes.patch('/orders/:id/status', (req: Request, res: Response) => {
  try {
    const restaurant_id = req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const { status } = req.body;
    const order = PurchaseService.updateOrderStatus(req.params.id, status, actor, restaurant_id);
    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

purchaseRoutes.post('/orders/:id/receive', (req: Request, res: Response) => {
  try {
    const restaurant_id = req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Almacenista';
    const result = PurchaseService.receivePurchaseOrder(req.params.id, req.body, actor, restaurant_id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

purchaseRoutes.post('/orders/:id/cancel', (req: Request, res: Response) => {
  try {
    const restaurant_id = req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Administrador';
    const reason = req.body.reason || 'Cancelado por usuario';
    const order = PurchaseService.cancelPurchaseOrder(req.params.id, reason, actor, restaurant_id);
    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

purchaseRoutes.post('/orders/:id/return', (req: Request, res: Response) => {
  try {
    const restaurant_id = req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = req.body.actor || 'Almacenista';
    const movement = PurchaseService.returnToSupplier(req.params.id, {
      ...req.body,
      actor,
      restaurant_id,
    });
    res.json({ movement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// PRICE HISTORY & SUMMARY
// ==========================================

purchaseRoutes.get('/price-history', (req: Request, res: Response) => {
  try {
    const restaurant_id = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const inventory_item_id = req.query.inventory_item_id as string;
    const price_history = PurchaseService.getPriceHistory(inventory_item_id, restaurant_id);
    res.json({ price_history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

purchaseRoutes.get('/summary', (req: Request, res: Response) => {
  try {
    const restaurant_id = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const summary = PurchaseService.getSummary(restaurant_id);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
