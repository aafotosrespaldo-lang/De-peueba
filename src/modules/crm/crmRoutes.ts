/**
 * DIRECTAURANTE POS CORE v0.1 - Customers, CRM, Loyalty & Promotions Express Routes (FASE 11)
 */

import { Router, Request, Response } from 'express';
import { CrmService } from './crmService';
import { DEFAULT_RESTAURANT_ID } from '../../core/database';

export const crmRouter = Router();

// ==========================================
// 1. CUSTOMERS DIRECTORY & CRM
// ==========================================

// GET /api/customers - List customers
crmRouter.get('/customers', (req: Request, res: Response) => {
  try {
    const search = req.query.search as string;
    const segment = req.query.segment as any;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;

    const customers = CrmService.listCustomers({ search, segment, is_active: isActive });
    res.json({ success: true, customers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/customers/:id - Single customer
crmRouter.get('/customers/:id', (req: Request, res: Response) => {
  try {
    const customer = CrmService.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado.' });
    }
    res.json({ success: true, customer });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/customers - Create customer
crmRouter.post('/customers', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const customer = CrmService.createCustomer(req.body, actor);
    res.status(201).json({ success: true, customer });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/customers/:id - Update customer
crmRouter.put('/customers/:id', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const customer = CrmService.updateCustomer(req.params.id, req.body, actor);
    res.json({ success: true, customer });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/customers/:id/orders - Order history for customer
crmRouter.get('/customers/:id/orders', (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurant_id as string;
    const orders = CrmService.getCustomerOrders(req.params.id, restaurantId);
    res.json({ success: true, orders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/customers/:id/metrics - Customer metrics & KPIs
crmRouter.get('/customers/:id/metrics', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const metrics = CrmService.getCustomerMetrics(req.params.id, restaurantId);
    res.json({ success: true, metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/customers/:id/addresses - Add or edit customer address
crmRouter.post('/customers/:id/addresses', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const address = CrmService.addOrUpdateAddress(req.params.id, req.body, actor);
    res.status(201).json({ success: true, address });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/customers/:id/addresses/:address_id - Remove address
crmRouter.delete('/customers/:id/addresses/:address_id', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || 'System Admin';
    const success = CrmService.deleteAddress(req.params.id, req.params.address_id, actor);
    res.json({ success });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. LOYALTY PROGRAM (PUNTOS Y RECOMPENSAS)
// ==========================================

// GET /api/loyalty/account/:customer_id
crmRouter.get('/loyalty/account/:customer_id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const account = CrmService.getLoyaltyAccount(req.params.customer_id, restaurantId);
    res.json({ success: true, account });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/loyalty/transactions/:customer_id
crmRouter.get('/loyalty/transactions/:customer_id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const transactions = CrmService.getLoyaltyTransactions(req.params.customer_id, restaurantId);
    res.json({ success: true, transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/loyalty/rewards
crmRouter.get('/loyalty/rewards', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const rewards = CrmService.listRewards(restaurantId);
    res.json({ success: true, rewards });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/loyalty/rewards
crmRouter.post('/loyalty/rewards', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const reward = CrmService.createReward(req.body, actor);
    res.status(201).json({ success: true, reward });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/loyalty/redeem - Redeem points for reward
crmRouter.post('/loyalty/redeem', (req: Request, res: Response) => {
  try {
    const { customer_id, reward_id, restaurant_id } = req.body;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const result = CrmService.redeemReward(
      customer_id,
      reward_id,
      actor,
      restaurant_id || DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/loyalty/adjust - Manual points adjustment
crmRouter.post('/loyalty/adjust', (req: Request, res: Response) => {
  try {
    const { customer_id, points, reason, restaurant_id } = req.body;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const transaction = CrmService.adjustPoints(
      customer_id,
      Number(points),
      reason,
      actor,
      restaurant_id || DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, transaction });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/loyalty/orders/:order_id/earn - Earn points on paid order
crmRouter.post('/loyalty/orders/:order_id/earn', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System';
    const transaction = CrmService.earnPointsForOrder(req.params.order_id, actor);
    res.json({ success: true, transaction });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/loyalty/orders/:order_id/reverse - Reverse points on cancel/refund
crmRouter.post('/loyalty/orders/:order_id/reverse', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const reason = req.body.reason || 'Cancelación de orden';
    const transaction = CrmService.reversePointsForOrder(req.params.order_id, reason, actor);
    res.json({ success: true, transaction });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. PROMOTIONS & COUPONS
// ==========================================

// GET /api/promotions
crmRouter.get('/promotions', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const onlyActive = req.query.active === 'true';
    const promotions = CrmService.listPromotions(restaurantId, onlyActive);
    res.json({ success: true, promotions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/promotions/:id
crmRouter.get('/promotions/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const promotion = CrmService.getPromotion(req.params.id, restaurantId);
    if (!promotion) {
      return res.status(404).json({ success: false, error: 'Promoción no encontrada.' });
    }
    res.json({ success: true, promotion });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/promotions
crmRouter.post('/promotions', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const promotion = CrmService.createPromotion(req.body, actor);
    res.status(201).json({ success: true, promotion });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/promotions/:id
crmRouter.put('/promotions/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const promotion = CrmService.updatePromotion(req.params.id, req.body, actor, restaurantId);
    res.json({ success: true, promotion });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/promotions/:id
crmRouter.delete('/promotions/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || 'System Admin';
    const success = CrmService.deletePromotion(req.params.id, actor, restaurantId);
    res.json({ success });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/promotions/validate
crmRouter.post('/promotions/validate', (req: Request, res: Response) => {
  try {
    const { code, subtotal_cents, customer_id, restaurant_id } = req.body;
    const result = CrmService.validatePromotionOrCoupon(
      code,
      Number(subtotal_cents),
      customer_id,
      restaurant_id || DEFAULT_RESTAURANT_ID
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/promotions/apply-to-order
crmRouter.post('/promotions/apply-to-order', (req: Request, res: Response) => {
  try {
    const { order_id, code } = req.body;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const result = CrmService.applyPromotionToOrder(order_id, code, actor);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. CRM SUMMARY & METRICS
// ==========================================

// GET /api/crm/summary
crmRouter.get('/crm/summary', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const summary = CrmService.getCrmSummary(restaurantId);
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
