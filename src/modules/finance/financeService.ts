/**
 * DIRECTAURANTE POS CORE v0.1 - Financial Consolidation Service (F12 / F12.1)
 * Single unified financial ledger and operations engine:
 * 1. Payments: Centralized payment processing, partial settlements, idempotency, refunds/reversals.
 * 2. Cash Sessions: Strict physical drawer control, blind reconciliation, closed session protection.
 * 3. Expenses: Categorized operational expenses affecting drawer when paid in cash.
 * 4. Financial Ledger: Unified immutable stream of FinancialMovement events.
 * 5. Operating P&L: Pure operational P&L reusing F7 COGS, F11 discounts, and F12 operating expenses.
 * 6. Settlements: Isolated Restaurant and Driver settlements (separate from customer payments).
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
  CashShift,
  CashMovement,
  Expense,
  ExpenseCategory,
  FinancialMovement,
  FinancialMovementType,
  FinancialDirection,
  RestaurantSettlement,
  DriverSettlement,
  OperatingPnL,
  ZCutReport,
  AuditLog,
} from '../../core/types';
import { eventBus } from '../../core/eventBus';
import { AuditService } from '../../core/audit';
import { StaffService } from '../staff/staffService';
import { RecipeService } from '../recipes/recipeService';

export interface RecordPaymentInput {
  table_id_or_session_id: string;
  amount_cents: number;
  method: PaymentMethod;
  guest_subaccount_id?: string;
  cashier?: string;
  user_id?: string;
  reference?: string;
  idempotency_key?: string;
  restaurant_id?: string;
}

export interface RefundPaymentInput {
  payment_id: string;
  amount_cents?: number; // Defaults to full remaining payment amount
  reason: string;
  actor?: string;
  user_id?: string;
  restaurant_id?: string;
}

export interface CreateExpenseDTO {
  category: ExpenseCategory;
  amount_cents: number;
  currency?: string;
  payment_method: PaymentMethod;
  vendor?: string;
  reference?: string;
  description: string;
  created_by?: string;
  user_id?: string;
  restaurant_id?: string;
}

export interface CashSessionOpenDTO {
  initial_float_cents: number;
  opened_by?: string;
  user_id?: string;
  notes?: string;
  restaurant_id?: string;
}

export interface CashSessionCloseDTO {
  actual_cash_cents: number;
  closed_by?: string;
  user_id?: string;
  notes?: string;
  restaurant_id?: string;
}

export interface FinancialMovementFilter {
  restaurant_id?: string;
  type?: FinancialMovementType;
  direction?: FinancialDirection;
  payment_method?: PaymentMethod;
  reference_type?: string;
  cash_session_id?: string;
  start_date?: string;
  end_date?: string;
}

export class FinanceService {
  /**
   * Helper: Resolves and validates operating restaurant_id
   */
  public static resolveRestaurantId(user_id?: string, provided_restaurant_id?: string): string {
    if (provided_restaurant_id && provided_restaurant_id.trim() !== '') {
      return provided_restaurant_id;
    }
    if (user_id) {
      const member = db.get('restaurant_members').find((m) => m.user_id === user_id && m.is_active);
      if (member) return member.restaurant_id;
    }
    return DEFAULT_RESTAURANT_ID;
  }

  /**
   * Helper: Validates RBAC permissions if user_id is provided
   */
  private static enforcePermission(user_id: string | undefined, restaurant_id: string, permission: any): void {
    if (!user_id) return; // Allow internal system execution or guest flows where authorized
    const auth = StaffService.authorize(user_id, restaurant_id, permission);
    if (!auth.authorized) {
      throw new Error(`Acceso denegado: Se requiere el permiso '${permission}'. Motivo: ${auth.reason}`);
    }
  }

  // ==========================================
  // 1. PAYMENTS ENGINE & IDEMPOTENCY
  // ==========================================

  /**
   * Record payment for a table session or subaccount.
   * STRICT P0 RULE: If method === 'cash', a valid open CashSession IS REQUIRED.
   * Atomically registers Payment, CashMovement (if cash), and FinancialMovement.
   */
  public static recordPayment(input: RecordPaymentInput): { payment: Payment; idempotency_replayed: boolean } {
    const restaurant_id = this.resolveRestaurantId(input.user_id, input.restaurant_id);

    if (input.user_id) {
      this.enforcePermission(input.user_id, restaurant_id, 'payments.create');
    }

    if (input.amount_cents <= 0) {
      throw new Error('El monto del pago debe ser mayor a $0.00 MXN.');
    }

    // IDEMPOTENCY CHECK
    if (input.idempotency_key && input.idempotency_key.trim() !== '') {
      const existingPayment = db
        .get('payments')
        .find((p) => p.restaurant_id === restaurant_id && p.idempotency_key === input.idempotency_key);
      if (existingPayment) {
        return { payment: existingPayment, idempotency_replayed: true };
      }
    }

    // RESOLVE TABLE SESSION
    const tables = db.get('tables');
    const table = tables.find(
      (t) => (t.id === input.table_id_or_session_id || t.number === input.table_id_or_session_id) && t.restaurant_id === restaurant_id
    );

    let session: any = null;
    if (table) {
      session = db.get('table_sessions').find((s) => s.id === table.active_session_id && s.restaurant_id === restaurant_id);
    }
    if (!session) {
      session = db.get('table_sessions').find((s) => s.id === input.table_id_or_session_id && s.restaurant_id === restaurant_id);
    }

    if (!session || session.status === 'closed') {
      throw new Error('No existe una sesión de servicio activa para registrar este pago.');
    }

    // STRICT P0 CHECK: CASH PAYMENTS REQUIRE AN ACTIVE OPEN CASH SESSION
    let activeCashSession: CashShift | null = null;
    if (input.method === 'cash') {
      activeCashSession =
        db.get('cash_shifts').find((s) => s.restaurant_id === restaurant_id && s.status === 'open') || null;

      if (!activeCashSession) {
        throw new Error(
          'Pago rechazado: Para procesar cobros en efectivo se requiere un turno de caja abierto en este restaurante.'
        );
      }
    }

    const sessionOrders = db.get('orders').filter((o) => o.table_session_id === session.id);
    const now = new Date().toISOString();
    const cashierName = input.cashier || (input.user_id ? 'Usuario ' + input.user_id : 'Cajero');

    const payment: Payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      restaurant_id,
      table_session_id: session.id,
      table_id: session.table_id,
      order_id: sessionOrders[0]?.id,
      guest_subaccount_id: input.guest_subaccount_id,
      amount_cents: input.amount_cents,
      method: input.method,
      payment_status: 'completed',
      created_at: now,
      cashier: cashierName,
      user_id: input.user_id,
      reference: input.reference,
      idempotency_key: input.idempotency_key,
    };

    db.get('payments').push(payment);

    // ATOMIC CASH REGISTER IMPACT
    if (input.method === 'cash' && activeCashSession) {
      const cashMovement: CashMovement = {
        id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        shift_id: activeCashSession.id,
        restaurant_id,
        type: 'sale',
        amount_cents: input.amount_cents,
        description: `Cobro en efectivo para Sesión ${session.id} (Mesa ${session.table_id})${
          input.guest_subaccount_id ? ` [Comensal ${input.guest_subaccount_id}]` : ''
        }`,
        performed_by: cashierName,
        user_id: input.user_id,
        timestamp: now,
        reference_order_id: payment.order_id,
      };
      db.get('cash_movements').push(cashMovement);
      activeCashSession.expected_cash_cents += input.amount_cents;
    }

    // ATOMIC FINANCIAL LEDGER RECORD
    const finMovement: FinancialMovement = {
      id: `fin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      restaurant_id,
      type: 'sale',
      direction: 'in',
      amount_cents: input.amount_cents,
      currency: 'MXN',
      payment_method: input.method,
      reference_type: 'payment',
      reference_id: payment.id,
      cash_session_id: activeCashSession ? activeCashSession.id : undefined,
      description: `Venta cobrada vía ${input.method} en Mesa ${session.table_id}`,
      idempotency_key: input.idempotency_key,
      created_by: cashierName,
      user_id: input.user_id,
      created_at: now,
    };
    db.get('financial_movements').push(finMovement);

    session.updated_at = now;
    db.save();

    AuditService.log(
      'payment_created',
      'payment',
      payment.id,
      cashierName,
      null,
      payment,
      `Cobro exitoso de $${(input.amount_cents / 100).toFixed(2)} vía ${input.method}.`,
      restaurant_id
    );

    eventBus.publish('PAYMENT_CREATED', restaurant_id, cashierName, payment);

    return { payment, idempotency_replayed: false };
  }

  /**
   * Refund or reverse a previous payment.
   * Updates Payment status, generates compensatory FinancialMovement and CashMovement (if cash).
   */
  public static refundPayment(input: RefundPaymentInput): Payment {
    const restaurant_id = this.resolveRestaurantId(input.user_id, input.restaurant_id);

    if (input.user_id) {
      this.enforcePermission(input.user_id, restaurant_id, 'payments.refund');
    }

    const payment = db.get('payments').find((p) => p.id === input.payment_id && p.restaurant_id === restaurant_id);
    if (!payment) {
      throw new Error(`Pago con ID '${input.payment_id}' no encontrado.`);
    }

    if (payment.payment_status === 'refunded' || payment.payment_status === 'cancelled') {
      throw new Error('Este pago ya ha sido completamente reembolsado o cancelado.');
    }

    const currentRefunded = payment.refunded_amount_cents || 0;
    const maxRefundable = payment.amount_cents - currentRefunded;
    const refundAmount = input.amount_cents && input.amount_cents > 0 ? input.amount_cents : maxRefundable;

    if (refundAmount > maxRefundable) {
      throw new Error(
        `El monto a reembolsar ($${(refundAmount / 100).toFixed(2)}) excede el saldo restante del pago ($${(
          maxRefundable / 100
        ).toFixed(2)}).`
      );
    }

    const now = new Date().toISOString();
    const actor = input.actor || (input.user_id ? 'Usuario ' + input.user_id : 'Encargado');

    const newTotalRefunded = currentRefunded + refundAmount;
    payment.refunded_amount_cents = newTotalRefunded;
    payment.refund_reason = input.reason;
    payment.refunded_at = now;
    payment.payment_status = newTotalRefunded >= payment.amount_cents ? 'refunded' : 'partially_refunded';

    // If original payment was in cash, deduct from current open drawer if exists
    let activeCashShift: CashShift | null = null;
    if (payment.method === 'cash') {
      activeCashShift = db.get('cash_shifts').find((s) => s.restaurant_id === restaurant_id && s.status === 'open') || null;
      if (activeCashShift) {
        db.get('cash_movements').push({
          id: `mov_ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          shift_id: activeCashShift.id,
          restaurant_id,
          type: 'refund',
          amount_cents: refundAmount,
          description: `Reembolso de pago ${payment.id}: ${input.reason}`,
          performed_by: actor,
          user_id: input.user_id,
          timestamp: now,
          reference_order_id: payment.order_id,
        });
        activeCashShift.expected_cash_cents -= refundAmount;
      }
    }

    // Ledger compensation entry
    const finMovement: FinancialMovement = {
      id: `fin_ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      restaurant_id,
      type: 'refund',
      direction: 'out',
      amount_cents: refundAmount,
      currency: 'MXN',
      payment_method: payment.method,
      reference_type: 'payment',
      reference_id: payment.id,
      cash_session_id: activeCashShift?.id,
      description: `Reembolso por $${(refundAmount / 100).toFixed(2)}: ${input.reason}`,
      created_by: actor,
      user_id: input.user_id,
      created_at: now,
    };
    db.get('financial_movements').push(finMovement);

    db.save();

    AuditService.log(
      'payment_refunded',
      'payment',
      payment.id,
      actor,
      null,
      payment,
      `Reembolso procesado por $${(refundAmount / 100).toFixed(2)}. Motivo: ${input.reason}`,
      restaurant_id
    );

    eventBus.publish('PAYMENT_REFUNDED', restaurant_id, actor, { payment, refundAmount, reason: input.reason });
    return payment;
  }

  public static listPayments(restaurant_id: string = DEFAULT_RESTAURANT_ID, filters?: { table_session_id?: string }): Payment[] {
    let payments = db.get('payments').filter((p) => p.restaurant_id === restaurant_id);
    if (filters?.table_session_id) {
      payments = payments.filter((p) => p.table_session_id === filters.table_session_id);
    }
    return payments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // ==========================================
  // 2. CASH DRAWER SESSIONS (CASHSESSION / SHIFT)
  // ==========================================

  public static getCurrentCashSession(restaurant_id: string = DEFAULT_RESTAURANT_ID): {
    shift: CashShift | null;
    session: CashShift | null;
    movements: CashMovement[];
    totals: { sales_cents: number; expenses_cents: number; withdrawals_cents: number; net_cash_cents: number };
  } {
    const shifts = db.get('cash_shifts');
    const shift = shifts.find((s) => s.restaurant_id === restaurant_id && s.status === 'open') || null;

    if (!shift) {
      return {
        shift: null,
        session: null,
        movements: [],
        totals: { sales_cents: 0, expenses_cents: 0, withdrawals_cents: 0, net_cash_cents: 0 },
      };
    }

    const allMovements = db.get('cash_movements').filter((m) => m.shift_id === shift.id);
    let sales_cents = 0;
    let expenses_cents = 0;
    let withdrawals_cents = 0;

    for (const mov of allMovements) {
      if (mov.type === 'sale') sales_cents += mov.amount_cents;
      else if (mov.type === 'expense') expenses_cents += mov.amount_cents;
      else if (mov.type === 'withdrawal' || mov.type === 'refund') withdrawals_cents += mov.amount_cents;
    }

    const net_cash_cents = shift.initial_float_cents + sales_cents - expenses_cents - withdrawals_cents;

    return {
      shift,
      session: shift,
      movements: allMovements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      totals: {
        sales_cents,
        expenses_cents,
        withdrawals_cents,
        net_cash_cents,
      },
    };
  }

  public static openCashSession(dto: CashSessionOpenDTO): CashShift {
    const restaurant_id = this.resolveRestaurantId(dto.user_id, dto.restaurant_id);

    if (dto.user_id) {
      this.enforcePermission(dto.user_id, restaurant_id, 'cash.open');
    }

    const existingOpen = db.get('cash_shifts').find((s) => s.restaurant_id === restaurant_id && s.status === 'open');
    if (existingOpen) {
      throw new Error('Ya existe un turno o sesión de caja abierta en este restaurante.');
    }

    const now = new Date().toISOString();
    const openedBy = dto.opened_by || (dto.user_id ? 'Usuario ' + dto.user_id : 'Cajero');

    const session: CashShift = {
      id: `shift_${Date.now()}`,
      restaurant_id,
      opened_by: openedBy,
      user_id: dto.user_id,
      opened_at: now,
      initial_float_cents: dto.initial_float_cents,
      opening_amount_cents: dto.initial_float_cents,
      status: 'open',
      expected_cash_cents: dto.initial_float_cents,
      notes: dto.notes,
    };

    db.get('cash_shifts').push(session);

    // Initial drawer movement
    const movement: CashMovement = {
      id: `mov_init_${Date.now()}`,
      shift_id: session.id,
      restaurant_id,
      type: 'opening_float',
      amount_cents: dto.initial_float_cents,
      description: 'Fondo de apertura de turno de caja',
      performed_by: openedBy,
      user_id: dto.user_id,
      timestamp: now,
    };
    db.get('cash_movements').push(movement);

    // Initial financial movement
    const finMovement: FinancialMovement = {
      id: `fin_open_${Date.now()}`,
      restaurant_id,
      type: 'opening',
      direction: 'in',
      amount_cents: dto.initial_float_cents,
      currency: 'MXN',
      payment_method: 'cash',
      reference_type: 'cash_session',
      reference_id: session.id,
      cash_session_id: session.id,
      description: 'Apertura de turno: Fondo inicial en gaveta',
      created_by: openedBy,
      user_id: dto.user_id,
      created_at: now,
    };
    db.get('financial_movements').push(finMovement);

    db.save();

    AuditService.log(
      'cash_shift_opened',
      'cash_shift',
      session.id,
      openedBy,
      null,
      session,
      `Caja abierta con fondo inicial de $${(dto.initial_float_cents / 100).toFixed(2)}.`,
      restaurant_id
    );

    eventBus.publish('SHIFT_OPENED', restaurant_id, openedBy, session);
    return session;
  }

  public static closeCashSession(dto: CashSessionCloseDTO): { session: CashShift; z_cut: ZCutReport } {
    const restaurant_id = this.resolveRestaurantId(dto.user_id, dto.restaurant_id);

    if (dto.user_id) {
      this.enforcePermission(dto.user_id, restaurant_id, 'cash.close');
    }

    const session = db.get('cash_shifts').find((s) => s.restaurant_id === restaurant_id && s.status === 'open');
    if (!session) {
      throw new Error('No hay una sesión de caja abierta para cerrar.');
    }

    const now = new Date().toISOString();
    const closedBy = dto.closed_by || (dto.user_id ? 'Usuario ' + dto.user_id : 'Cajero');
    const difference_cents = dto.actual_cash_cents - session.expected_cash_cents;

    session.status = 'closed';
    session.closed_by = closedBy;
    session.closed_at = now;
    session.actual_cash_cents = dto.actual_cash_cents;
    session.counted_cash_cents = dto.actual_cash_cents;
    session.difference_cents = difference_cents;
    if (dto.notes) {
      session.notes = session.notes ? `${session.notes} | Cierre: ${dto.notes}` : dto.notes;
    }

    // Ledger closing movement
    const finMovement: FinancialMovement = {
      id: `fin_close_${Date.now()}`,
      restaurant_id,
      type: 'closing',
      direction: 'out',
      amount_cents: dto.actual_cash_cents,
      currency: 'MXN',
      payment_method: 'cash',
      reference_type: 'cash_session',
      reference_id: session.id,
      cash_session_id: session.id,
      description: `Cierre y arqueo de caja. Contado: $${(dto.actual_cash_cents / 100).toFixed(2)}, Dif: $${(
        difference_cents / 100
      ).toFixed(2)}`,
      created_by: closedBy,
      user_id: dto.user_id,
      created_at: now,
    };
    db.get('financial_movements').push(finMovement);

    // Build Z-Cut Report
    const movements = db.get('cash_movements').filter((m) => m.shift_id === session.id);
    const sessionPayments = db
      .get('payments')
      .filter((p) => p.restaurant_id === restaurant_id && p.created_at >= session.opened_at && p.created_at <= now);

    const salesByMethod: Record<PaymentMethod, number> = {
      cash: 0,
      card: 0,
      transfer: 0,
      digital: 0,
      other: 0,
    };

    sessionPayments.forEach((p) => {
      if (p.payment_status === 'completed' || p.payment_status === 'partially_refunded') {
        const netAmount = p.amount_cents - (p.refunded_amount_cents || 0);
        salesByMethod[p.method] = (salesByMethod[p.method] || 0) + netAmount;
      }
    });

    const totalSales = Object.values(salesByMethod).reduce((a, b) => a + b, 0);
    const totalExpenses = movements.filter((m) => m.type === 'expense').reduce((sum, m) => sum + m.amount_cents, 0);
    const totalWithdrawals = movements.filter((m) => m.type === 'withdrawal').reduce((sum, m) => sum + m.amount_cents, 0);
    const totalDeposits = movements.filter((m) => m.type === 'deposit').reduce((sum, m) => sum + m.amount_cents, 0);
    const totalRefunds = movements.filter((m) => m.type === 'refund').reduce((sum, m) => sum + m.amount_cents, 0);

    const z_cut: ZCutReport = {
      id: `zcut_${session.id}`,
      restaurant_id,
      shift_id: session.id,
      opened_at: session.opened_at,
      closed_at: now,
      opened_by: session.opened_by,
      closed_by: closedBy,
      initial_float_cents: session.initial_float_cents,
      sales_by_method: salesByMethod,
      total_sales_cents: totalSales,
      total_expenses_cents: totalExpenses,
      total_withdrawals_cents: totalWithdrawals,
      total_deposits_cents: totalDeposits,
      total_refunds_cents: totalRefunds,
      expected_cash_cents: session.expected_cash_cents,
      counted_cash_cents: dto.actual_cash_cents,
      difference_cents,
      movements_count: movements.length,
      generated_at: now,
    };

    db.save();

    AuditService.log(
      'cash_shift_closed',
      'cash_shift',
      session.id,
      closedBy,
      null,
      session,
      `Caja cerrada. Esperado: $${(session.expected_cash_cents / 100).toFixed(2)}, Contado: $${(
        dto.actual_cash_cents / 100
      ).toFixed(2)}, Dif: $${(difference_cents / 100).toFixed(2)}.`,
      restaurant_id
    );

    eventBus.publish('SHIFT_CLOSED', restaurant_id, closedBy, session);
    return { session, z_cut };
  }

  public static recordCashDrawerMovement(
    type: CashMovement['type'],
    amount_cents: number,
    description: string,
    performed_by: string = 'Cajero',
    user_id?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): CashMovement {
    const targetRestaurantId = this.resolveRestaurantId(user_id, restaurant_id);

    if (user_id) {
      this.enforcePermission(user_id, targetRestaurantId, 'cash.adjust');
    }

    const currentShift = db
      .get('cash_shifts')
      .find((s) => s.restaurant_id === targetRestaurantId && s.status === 'open');

    if (!currentShift) {
      throw new Error('No hay una sesión de caja abierta para registrar movimientos de efectivo.');
    }

    const now = new Date().toISOString();
    const movement: CashMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shift_id: currentShift.id,
      restaurant_id: targetRestaurantId,
      type,
      amount_cents,
      description,
      performed_by,
      user_id,
      timestamp: now,
    };

    db.get('cash_movements').push(movement);

    if (type === 'sale' || type === 'deposit' || type === 'opening_float') {
      currentShift.expected_cash_cents += amount_cents;
    } else {
      currentShift.expected_cash_cents -= amount_cents;
    }

    const finMovement: FinancialMovement = {
      id: `fin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      restaurant_id: targetRestaurantId,
      type: type === 'expense' ? 'expense' : type === 'withdrawal' ? 'withdrawal' : 'deposit',
      direction: type === 'deposit' || type === 'opening_float' || type === 'sale' ? 'in' : 'out',
      amount_cents,
      currency: 'MXN',
      payment_method: 'cash',
      reference_type: 'cash_session',
      reference_id: movement.id,
      cash_session_id: currentShift.id,
      description: `Ajuste en caja (${type}): ${description}`,
      created_by: performed_by,
      user_id,
      created_at: now,
    };
    db.get('financial_movements').push(finMovement);

    db.save();

    AuditService.log(
      'cash_adjustment',
      'cash_shift',
      currentShift.id,
      performed_by,
      null,
      movement,
      `Movimiento ${type} por $${(amount_cents / 100).toFixed(2)}: ${description}`,
      targetRestaurantId
    );

    return movement;
  }

  // ==========================================
  // 3. OPERATING EXPENSES (GASTOS OPERATIVOS)
  // ==========================================

  public static createExpense(dto: CreateExpenseDTO): Expense {
    const restaurant_id = this.resolveRestaurantId(dto.user_id, dto.restaurant_id);

    if (dto.user_id) {
      this.enforcePermission(dto.user_id, restaurant_id, 'expenses.create');
    }

    if (dto.amount_cents <= 0) {
      throw new Error('El importe del gasto debe ser mayor a $0.00 MXN.');
    }

    const validCategories: ExpenseCategory[] = [
      'utilities',
      'rent',
      'supplies',
      'maintenance',
      'marketing',
      'transport',
      'services',
      'payroll',
      'other',
    ];
    if (!validCategories.includes(dto.category)) {
      throw new Error(`Categoría de gasto inválida: '${dto.category}'.`);
    }

    const now = new Date().toISOString();
    const createdBy = dto.created_by || (dto.user_id ? 'Usuario ' + dto.user_id : 'Encargado');

    // If paid in cash, drawer session is required and impacted
    let activeCashSession: CashShift | null = null;
    if (dto.payment_method === 'cash') {
      activeCashSession = db.get('cash_shifts').find((s) => s.restaurant_id === restaurant_id && s.status === 'open') || null;
      if (!activeCashSession) {
        throw new Error(
          'Para pagar un gasto en efectivo de caja chica debe existir un turno de caja abierto en este restaurante.'
        );
      }
    }

    const expense: Expense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id,
      category: dto.category,
      amount_cents: dto.amount_cents,
      currency: dto.currency || 'MXN',
      payment_method: dto.payment_method,
      vendor: dto.vendor,
      reference: dto.reference,
      description: dto.description,
      status: 'paid',
      cash_session_id: activeCashSession ? activeCashSession.id : undefined,
      created_by: createdBy,
      user_id: dto.user_id,
      created_at: now,
      updated_at: now,
    };

    db.get('expenses').push(expense);

    // Physical drawer impact if cash
    if (dto.payment_method === 'cash' && activeCashSession) {
      const cashMovement: CashMovement = {
        id: `mov_exp_${Date.now()}`,
        shift_id: activeCashSession.id,
        restaurant_id,
        type: 'expense',
        amount_cents: dto.amount_cents,
        description: `Gasto [${dto.category}]: ${dto.description}${dto.vendor ? ` (${dto.vendor})` : ''}`,
        performed_by: createdBy,
        user_id: dto.user_id,
        timestamp: now,
        reference_expense_id: expense.id,
      };
      db.get('cash_movements').push(cashMovement);
      activeCashSession.expected_cash_cents -= dto.amount_cents;
    }

    // Ledger entry
    const finMovement: FinancialMovement = {
      id: `fin_exp_${Date.now()}`,
      restaurant_id,
      type: 'expense',
      direction: 'out',
      amount_cents: dto.amount_cents,
      currency: dto.currency || 'MXN',
      payment_method: dto.payment_method,
      reference_type: 'expense',
      reference_id: expense.id,
      cash_session_id: activeCashSession ? activeCashSession.id : undefined,
      description: `Gasto operativo [${dto.category}]: ${dto.description}`,
      created_by: createdBy,
      user_id: dto.user_id,
      created_at: now,
    };
    db.get('financial_movements').push(finMovement);

    db.save();

    AuditService.log(
      'expense_created',
      'cash_shift',
      expense.id,
      createdBy,
      null,
      expense,
      `Gasto registrado por $${(dto.amount_cents / 100).toFixed(2)} (${dto.category}) vía ${dto.payment_method}.`,
      restaurant_id
    );

    eventBus.publish('EXPENSE_CREATED', restaurant_id, createdBy, expense);
    return expense;
  }

  public static listExpenses(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: { category?: ExpenseCategory; payment_method?: PaymentMethod }
  ): Expense[] {
    let list = db.get('expenses').filter((e) => e.restaurant_id === restaurant_id);
    if (filters?.category) {
      list = list.filter((e) => e.category === filters.category);
    }
    if (filters?.payment_method) {
      list = list.filter((e) => e.payment_method === filters.payment_method);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // ==========================================
  // 4. UNIFIED FINANCIAL LEDGER
  // ==========================================

  public static getFinancialLedger(filters: FinancialMovementFilter): FinancialMovement[] {
    const restaurant_id = filters.restaurant_id || DEFAULT_RESTAURANT_ID;
    let movements = db.get('financial_movements').filter((m) => m.restaurant_id === restaurant_id);

    if (filters.type) movements = movements.filter((m) => m.type === filters.type);
    if (filters.direction) movements = movements.filter((m) => m.direction === filters.direction);
    if (filters.payment_method) movements = movements.filter((m) => m.payment_method === filters.payment_method);
    if (filters.reference_type) movements = movements.filter((m) => m.reference_type === filters.reference_type);
    if (filters.cash_session_id) movements = movements.filter((m) => m.cash_session_id === filters.cash_session_id);
    if (filters.start_date) movements = movements.filter((m) => m.created_at >= filters.start_date!);
    if (filters.end_date) movements = movements.filter((m) => m.created_at <= filters.end_date!);

    return movements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // ==========================================
  // 5. OPERATIONAL P&L ENGINE (REUSING F7 COGS)
  // ==========================================

  /**
   * Calculates Real Operating P&L:
   * Ventas brutas − descuentos (F11) − reembolsos = Ventas netas
   * Ventas netas − COGS (Reutilizando F7) = Utilidad bruta
   * Utilidad bruta − Gastos operativos (F12) = Resultado operativo
   */
  public static calculateOperatingPnL(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    start_date?: string,
    end_date?: string
  ): OperatingPnL {
    const now = new Date().toISOString();
    const period_start = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const period_end = end_date || now;

    // 1. REVENUE (PAYMENTS)
    const payments = db
      .get('payments')
      .filter((p) => p.restaurant_id === restaurant_id && p.created_at >= period_start && p.created_at <= period_end);

    let gross_sales_cents = 0;
    let refunds_cents = 0;

    payments.forEach((p) => {
      gross_sales_cents += p.amount_cents;
      refunds_cents += p.refunded_amount_cents || 0;
    });

    // 2. DISCOUNTS (F11 Promotions)
    const redemptions = db
      .get('promotion_redemptions')
      .filter(
        (r) => r.restaurant_id === restaurant_id && r.redeemed_at >= period_start && r.redeemed_at <= period_end
      );
    const discounts_cents = redemptions.reduce((sum, r) => sum + r.discount_applied_cents, 0);

    const net_sales_cents = Math.max(0, gross_sales_cents - discounts_cents - refunds_cents);

    // 3. COGS: REUSING F7 RECIPE SERVICE STRICTLY
    // For all orders completed in period, calculate exact ingredient consumption cost via RecipeService
    const sessionIds = Array.from(new Set(payments.map((p) => p.table_session_id)));
    const orders = db.get('orders').filter((o) => sessionIds.includes(o.table_session_id));
    const orderItems = db.get('order_items').filter((oi) => orders.some((o) => o.id === oi.order_id) && oi.preparation_status !== 'cancelled');

    let cogs_cents = 0;
    const recipes = db.get('recipes').filter((r) => r.restaurant_id === restaurant_id && r.is_active);

    orderItems.forEach((item) => {
      const recipe = recipes.find((r) => r.product_id === item.product_id);
      if (recipe) {
        try {
          const costCalc = RecipeService.calculateRecipeCost(recipe, restaurant_id);
          cogs_cents += costCalc.cogs_cents * item.quantity;
        } catch {
          // Fallback if recipe calculation error
        }
      }
    });

    const gross_profit_cents = net_sales_cents - cogs_cents;
    const gross_margin_percent =
      net_sales_cents > 0 ? Math.round((gross_profit_cents / net_sales_cents) * 1000) / 10 : 0;

    // 4. OPERATING EXPENSES (F12)
    const expenses = db
      .get('expenses')
      .filter((e) => e.restaurant_id === restaurant_id && e.created_at >= period_start && e.created_at <= period_end && e.status === 'paid');

    const expensesByCategory: Record<ExpenseCategory, number> = {
      utilities: 0,
      rent: 0,
      supplies: 0,
      maintenance: 0,
      marketing: 0,
      transport: 0,
      services: 0,
      payroll: 0,
      other: 0,
    };

    let operating_expenses_cents = 0;
    expenses.forEach((e) => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount_cents;
      operating_expenses_cents += e.amount_cents;
    });

    const operating_result_cents = gross_profit_cents - operating_expenses_cents;
    const operating_margin_percent =
      net_sales_cents > 0 ? Math.round((operating_result_cents / net_sales_cents) * 1000) / 10 : 0;

    return {
      restaurant_id,
      period_start,
      period_end,
      currency: 'MXN',
      gross_sales_cents,
      discounts_cents,
      refunds_cents,
      net_sales_cents,
      cogs_cents,
      gross_profit_cents,
      gross_margin_percent,
      operating_expenses_cents,
      expenses_by_category: expensesByCategory,
      operating_result_cents,
      operating_margin_percent,
      orders_count: orders.length,
      payments_count: payments.length,
    };
  }

  // ==========================================
  // 6. SETTLEMENTS (SEPARATE DOMAINS)
  // ==========================================

  public static listRestaurantSettlements(restaurant_id: string = DEFAULT_RESTAURANT_ID): RestaurantSettlement[] {
    return db.get('restaurant_settlements').filter((s) => s.restaurant_id === restaurant_id);
  }

  public static createRestaurantSettlement(
    data: Omit<RestaurantSettlement, 'id' | 'created_at'>,
    user_id?: string
  ): RestaurantSettlement {
    const restaurant_id = this.resolveRestaurantId(user_id, data.restaurant_id);
    if (user_id) {
      this.enforcePermission(user_id, restaurant_id, 'settlements.manage');
    }

    const now = new Date().toISOString();
    const settlement: RestaurantSettlement = {
      ...data,
      id: `set_rest_${Date.now()}`,
      restaurant_id,
      created_at: now,
    };

    db.get('restaurant_settlements').push(settlement);

    // Ledger settlement movement
    const finMovement: FinancialMovement = {
      id: `fin_set_${Date.now()}`,
      restaurant_id,
      type: 'settlement',
      direction: 'in',
      amount_cents: settlement.net_payout_cents,
      currency: 'MXN',
      payment_method: 'transfer',
      reference_type: 'settlement',
      reference_id: settlement.id,
      description: `Liquidación canal ${settlement.channel}: $${(settlement.net_payout_cents / 100).toFixed(2)}`,
      created_by: settlement.created_by,
      user_id,
      created_at: now,
    };
    db.get('financial_movements').push(finMovement);

    db.save();
    return settlement;
  }

  public static listDriverSettlements(restaurant_id: string = DEFAULT_RESTAURANT_ID): DriverSettlement[] {
    return db.get('driver_settlements').filter((s) => s.restaurant_id === restaurant_id);
  }

  public static createDriverSettlement(
    data: Omit<DriverSettlement, 'id' | 'created_at'>,
    user_id?: string
  ): DriverSettlement {
    const restaurant_id = this.resolveRestaurantId(user_id, data.restaurant_id);
    if (user_id) {
      this.enforcePermission(user_id, restaurant_id, 'settlements.manage');
    }

    const now = new Date().toISOString();
    const settlement: DriverSettlement = {
      ...data,
      id: `set_drv_${Date.now()}`,
      restaurant_id,
      created_at: now,
    };

    db.get('driver_settlements').push(settlement);

    // Ledger driver settlement
    const finMovement: FinancialMovement = {
      id: `fin_drv_${Date.now()}`,
      restaurant_id,
      type: 'settlement',
      direction: settlement.balance_due_cents >= 0 ? 'in' : 'out',
      amount_cents: Math.abs(settlement.balance_due_cents),
      currency: 'MXN',
      payment_method: 'cash',
      reference_type: 'settlement',
      reference_id: settlement.id,
      description: `Corte de repartidor ${settlement.driver_name} (${settlement.status})`,
      created_by: settlement.created_by,
      user_id,
      created_at: now,
    };
    db.get('financial_movements').push(finMovement);

    db.save();
    return settlement;
  }
}
