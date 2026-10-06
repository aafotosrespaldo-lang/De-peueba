/**
 * DIRECTAURANTE POS CORE v0.1 - Cash Management Service
 * Single source of truth delegate to FinanceService for drawer operations.
 */

import { DEFAULT_RESTAURANT_ID } from '../../core/database';
import { CashShift, CashMovement } from '../../core/types';
import { FinanceService } from '../finance/financeService';

export class CashService {
  /**
   * Get currently active cash shift or null if closed
   */
  public static getCurrentShift(restaurant_id: string = DEFAULT_RESTAURANT_ID): {
    shift: CashShift | null;
    movements: CashMovement[];
    totals: { sales_cents: number; expenses_cents: number; withdrawals_cents: number; net_cash_cents: number };
  } {
    return FinanceService.getCurrentCashSession(restaurant_id);
  }

  /**
   * Open a new cash shift
   */
  public static openShift(
    initial_float_cents: number,
    opened_by: string = 'Cajero',
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    user_id?: string
  ): CashShift {
    return FinanceService.openCashSession({
      initial_float_cents,
      opened_by,
      notes,
      restaurant_id,
      user_id,
    });
  }

  /**
   * Record operational cash movement (e.g. expense, withdrawal, adjustment)
   */
  public static recordMovement(
    type: CashMovement['type'],
    amount_cents: number,
    description: string,
    performed_by: string = 'Cajero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    user_id?: string
  ): CashMovement {
    return FinanceService.recordCashDrawerMovement(
      type,
      amount_cents,
      description,
      performed_by,
      user_id,
      restaurant_id
    );
  }

  /**
   * Close active cash shift with blind count reconciliation
   */
  public static closeShift(
    actual_cash_cents: number,
    closed_by: string = 'Cajero',
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    user_id?: string
  ): CashShift {
    const result = FinanceService.closeCashSession({
      actual_cash_cents,
      closed_by,
      notes,
      restaurant_id,
      user_id,
    });
    return result.session;
  }
}
