/**
 * DIRECTAURANTE POS CORE v0.1 - Financial REST API Routes
 * Endpoints for Payments, Cash, Expenses, Financial Ledger, P&L, and Settlements.
 */

import { Router, Request, Response } from 'express';
import { FinanceService } from './financeService';
import { PosService } from '../pos/posService';
import { PrintService } from '../directprint/printService';
import { DEFAULT_RESTAURANT_ID } from '../../core/database';

export const financeRouter = Router();

// Helper to extract restaurant_id & user_id from headers/query/body
function getAuthContext(req: Request) {
  const user_id = (req.headers['x-user-id'] as string) || (req.body?.user_id as string) || undefined;
  const restaurant_id =
    (req.headers['x-restaurant-id'] as string) ||
    (req.query?.restaurant_id as string) ||
    (req.body?.restaurant_id as string) ||
    DEFAULT_RESTAURANT_ID;
  return { user_id, restaurant_id };
}

// ==========================================
// PAYMENTS
// ==========================================

financeRouter.get('/payments', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = getAuthContext(req);
    const table_session_id = req.query.table_session_id as string | undefined;
    const payments = FinanceService.listPayments(restaurant_id, { table_session_id });
    res.json({ success: true, payments });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.post('/payments', (req: Request, res: Response) => {
  try {
    const { user_id, restaurant_id } = getAuthContext(req);
    const {
      table_id_or_session_id,
      amount_cents,
      method,
      guest_subaccount_id,
      cashier,
      reference,
      idempotency_key,
    } = req.body;

    if (!table_id_or_session_id || !amount_cents || !method) {
      return res.status(400).json({ error: 'table_id_or_session_id, amount_cents y method son obligatorios.' });
    }

    const result = FinanceService.recordPayment({
      table_id_or_session_id,
      amount_cents: Number(amount_cents),
      method,
      guest_subaccount_id,
      cashier,
      user_id,
      reference,
      idempotency_key: idempotency_key || (req.headers['idempotency-key'] as string),
      restaurant_id,
    });

    const updatedBill = PosService.calculateTableBill(table_id_or_session_id, restaurant_id);
    res.json({ success: true, payment: result.payment, idempotency_replayed: result.idempotency_replayed, updated_bill: updatedBill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.post('/payments/:id/refund', (req: Request, res: Response) => {
  try {
    const { user_id, restaurant_id } = getAuthContext(req);
    const { amount_cents, reason, actor } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'El motivo (reason) del reembolso es obligatorio.' });
    }

    const payment = FinanceService.refundPayment({
      payment_id: req.params.id,
      amount_cents: amount_cents ? Number(amount_cents) : undefined,
      reason,
      actor,
      user_id,
      restaurant_id,
    });

    res.json({ success: true, payment });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// CASH SESSIONS / DRAWER
// ==========================================

financeRouter.get('/cash/current', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = getAuthContext(req);
    const current = FinanceService.getCurrentCashSession(restaurant_id);
    res.json(current);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.post('/cash/open', (req: Request, res: Response) => {
  try {
    const { user_id, restaurant_id } = getAuthContext(req);
    const { initial_float_cents, opened_by, notes } = req.body;

    const session = FinanceService.openCashSession({
      initial_float_cents: Number(initial_float_cents) || 0,
      opened_by,
      user_id,
      notes,
      restaurant_id,
    });

    res.json({ success: true, session, shift: session });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.post('/cash/close', (req: Request, res: Response) => {
  try {
    const { user_id, restaurant_id } = getAuthContext(req);
    const { actual_cash_cents, closed_by, notes } = req.body;

    const result = FinanceService.closeCashSession({
      actual_cash_cents: Number(actual_cash_cents) || 0,
      closed_by,
      user_id,
      notes,
      restaurant_id,
    });

    res.json({ success: true, session: result.session, shift: result.session, z_cut: result.z_cut });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.post('/cash/movement', (req: Request, res: Response) => {
  try {
    const { user_id, restaurant_id } = getAuthContext(req);
    const { type, amount_cents, description, performed_by } = req.body;

    const movement = FinanceService.recordCashDrawerMovement(
      type,
      Number(amount_cents) || 0,
      description || 'Movimiento de caja',
      performed_by || 'Cajero',
      user_id,
      restaurant_id
    );

    res.json({ success: true, movement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// EXPENSES
// ==========================================

financeRouter.get('/expenses', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = getAuthContext(req);
    const category = req.query.category as any;
    const payment_method = req.query.payment_method as any;
    const expenses = FinanceService.listExpenses(restaurant_id, { category, payment_method });
    res.json({ success: true, expenses });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.post('/expenses', (req: Request, res: Response) => {
  try {
    const { user_id, restaurant_id } = getAuthContext(req);
    const { category, amount_cents, payment_method, vendor, reference, description, created_by } = req.body;

    if (!category || !amount_cents || !payment_method || !description) {
      return res.status(400).json({ error: 'category, amount_cents, payment_method y description son obligatorios.' });
    }

    const expense = FinanceService.createExpense({
      category,
      amount_cents: Number(amount_cents),
      payment_method,
      vendor,
      reference,
      description,
      created_by,
      user_id,
      restaurant_id,
    });

    res.json({ success: true, expense });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// FINANCIAL LEDGER
// ==========================================

financeRouter.get('/ledger', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = getAuthContext(req);
    const movements = FinanceService.getFinancialLedger({
      restaurant_id,
      type: req.query.type as any,
      direction: req.query.direction as any,
      payment_method: req.query.payment_method as any,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
    });

    res.json({ success: true, movements, count: movements.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// OPERATING P&L
// ==========================================

financeRouter.get('/pnl', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = getAuthContext(req);
    const start_date = req.query.start_date as string | undefined;
    const end_date = req.query.end_date as string | undefined;

    const pnl = FinanceService.calculateOperatingPnL(restaurant_id, start_date, end_date);
    res.json({ success: true, pnl });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// SETTLEMENTS (SEPARATE FROM PAYMENTS)
// ==========================================

financeRouter.get('/settlements/restaurant', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = getAuthContext(req);
    const settlements = FinanceService.listRestaurantSettlements(restaurant_id);
    res.json({ success: true, settlements });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.post('/settlements/restaurant', (req: Request, res: Response) => {
  try {
    const { user_id, restaurant_id } = getAuthContext(req);
    const settlement = FinanceService.createRestaurantSettlement(
      {
        ...req.body,
        restaurant_id,
      },
      user_id
    );
    res.json({ success: true, settlement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.get('/settlements/driver', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = getAuthContext(req);
    const settlements = FinanceService.listDriverSettlements(restaurant_id);
    res.json({ success: true, settlements });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.post('/settlements/driver', (req: Request, res: Response) => {
  try {
    const { user_id, restaurant_id } = getAuthContext(req);
    const settlement = FinanceService.createDriverSettlement(
      {
        ...req.body,
        restaurant_id,
      },
      user_id
    );
    res.json({ success: true, settlement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// DIRECTPRINT FINANCIAL TICKETS (READ-ONLY)
// ==========================================

financeRouter.get('/print/precheck/:tableId', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = getAuthContext(req);
    const bill = PosService.calculateTableBill(req.params.tableId, restaurant_id);
    const ticket = PrintService.generatePreCheckTicket(bill);
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

financeRouter.get('/print/receipt/:paymentId', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = getAuthContext(req);
    const payments = FinanceService.listPayments(restaurant_id);
    const payment = payments.find((p) => p.id === req.params.paymentId);
    if (!payment) return res.status(404).json({ error: 'Pago no encontrado' });

    const ticket = PrintService.generateFinancialReceipt(payment);
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
