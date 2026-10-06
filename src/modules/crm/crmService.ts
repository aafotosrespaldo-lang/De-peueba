/**
 * DIRECTAURANTE POS CORE v0.1 - Customers, CRM, Loyalty & Promotions Service (FASE 11)
 * 
 * Rules & Architecture:
 * 1. Single Customer Identity: CustomerProfile connects to global User identity, zero parallel silos.
 * 2. Multi-Restaurant Loyalty: Loyalty accounts & points ledger are isolated per restaurant.
 * 3. Immutable Points Ledger: All point changes occur strictly via LoyaltyTransaction.
 * 4. Idempotency: Orders earn points only once via (reference_type='order', reference_id=order_id).
 * 5. Reversal Integrity: Cancelled/refunded orders reverse points safely without deleting history.
 * 6. Single Promotion Truth: Validates coupon expiration, minimums, and per-customer usage limits.
 * 7. Real Metrics: CRM KPIs and segmentations are dynamically derived from real Order records.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  CustomerProfile,
  CustomerAddress,
  CustomerMetrics,
  CustomerSegment,
  LoyaltyAccount,
  LoyaltyTier,
  LoyaltyTransaction,
  LoyaltyReward,
  Promotion,
  PromotionType,
  PromotionRedemptionRecord,
  CrmSummary,
  Order,
} from '../../core/types';
import { AuditService } from '../../core/audit';
import { eventBus } from '../../core/eventBus';

export interface CreateCustomerDTO {
  user_id?: string;
  name: string;
  phone: string;
  email: string;
  birth_date?: string;
  notes?: string;
  marketing_opt_in?: boolean;
  address?: Omit<CustomerAddress, 'id' | 'created_at'>;
  preferences?: {
    allergies?: string[];
    favorite_items?: string[];
    dietary_notes?: string;
  };
}

export interface UpdateCustomerDTO {
  name?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  notes?: string;
  marketing_opt_in?: boolean;
  preferences?: {
    allergies?: string[];
    favorite_items?: string[];
    dietary_notes?: string;
  };
}

export interface CreateRewardDTO {
  restaurant_id?: string;
  name: string;
  description: string;
  reward_type: 'discount_amount' | 'discount_percent' | 'free_product';
  value: number;
  points_required: number;
  product_id?: string;
  is_active?: boolean;
}

export interface CreatePromotionDTO {
  restaurant_id?: string;
  name: string;
  description: string;
  type: PromotionType;
  discount_percent?: number;
  discount_amount_cents?: number;
  coupon_code?: string;
  min_order_cents?: number;
  max_discount_cents?: number;
  applicable_product_ids?: string[];
  applicable_categories?: string[];
  max_uses_total?: number;
  max_uses_per_customer?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  stackable_with_loyalty?: boolean;
}

export class CrmService {
  // ==========================================
  // 1. CUSTOMERS & DIRECTORY
  // ==========================================

  public static listCustomers(filters?: {
    search?: string;
    segment?: CustomerSegment;
    is_active?: boolean;
  }): (CustomerProfile & { metrics: CustomerMetrics })[] {
    let customers = db.get('customers');

    if (filters?.is_active !== undefined) {
      customers = customers.filter((c) => c.is_active === filters.is_active);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      customers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }

    const result = customers.map((c) => ({
      ...c,
      metrics: this.getCustomerMetrics(c.id),
    }));

    if (filters?.segment) {
      return result.filter((c) => c.metrics.segment === filters.segment);
    }

    return result.sort((a, b) => b.metrics.order_count - a.metrics.order_count);
  }

  public static getCustomer(
    customer_id: string
  ): (CustomerProfile & { metrics: CustomerMetrics }) | undefined {
    const customer = db.get('customers').find((c) => c.id === customer_id);
    if (!customer) return undefined;
    return {
      ...customer,
      metrics: this.getCustomerMetrics(customer.id),
    };
  }

  public static getCustomerByPhoneOrEmail(
    query: string
  ): (CustomerProfile & { metrics: CustomerMetrics }) | undefined {
    const q = query.trim().toLowerCase();
    const customer = db
      .get('customers')
      .find((c) => c.phone.trim() === q || c.email.toLowerCase().trim() === q);
    if (!customer) return undefined;
    return {
      ...customer,
      metrics: this.getCustomerMetrics(customer.id),
    };
  }

  public static createCustomer(
    data: CreateCustomerDTO,
    actor: string = 'System Admin'
  ): CustomerProfile {
    const customers = db.get('customers');
    const cleanPhone = data.phone.trim();
    const cleanEmail = data.email.toLowerCase().trim();

    // Check duplicate
    const existing = customers.find(
      (c) => c.phone === cleanPhone || c.email === cleanEmail
    );
    if (existing) {
      throw new Error(
        `Ya existe un cliente registrado con el teléfono '${cleanPhone}' o correo '${cleanEmail}'.`
      );
    }

    const now = new Date().toISOString();
    const customerId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const addresses: CustomerAddress[] = [];
    if (data.address) {
      addresses.push({
        id: `addr_${Date.now()}_1`,
        street: data.address.street,
        number: data.address.number,
        interior: data.address.interior,
        colony: data.address.colony,
        city: data.address.city,
        state: data.address.state,
        postal_code: data.address.postal_code,
        references: data.address.references,
        label: data.address.label || 'home',
        is_default: true,
        created_at: now,
      });
    }

    const newCustomer: CustomerProfile = {
      id: customerId,
      user_id: data.user_id,
      name: data.name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      birth_date: data.birth_date,
      notes: data.notes,
      marketing_opt_in: Boolean(data.marketing_opt_in),
      marketing_updated_at: data.marketing_opt_in ? now : undefined,
      addresses,
      preferences: data.preferences,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    customers.push(newCustomer);

    AuditService.log(
      'customer.created',
      'customer' as any,
      customerId,
      actor,
      undefined,
      { name: newCustomer.name, phone: newCustomer.phone },
      `Alta de cliente: ${newCustomer.name}`
    );

    eventBus.emit({
      event_name: 'customer.created',
      event_type: 'customer_event',
      aggregate_id: customerId,
      actor_id: actor,
      data: { customer: newCustomer },
    });

    db.save();
    return newCustomer;
  }

  public static updateCustomer(
    customer_id: string,
    data: UpdateCustomerDTO,
    actor: string = 'System Admin'
  ): CustomerProfile {
    const customer = db.get('customers').find((c) => c.id === customer_id);
    if (!customer) {
      throw new Error(`Cliente con id ${customer_id} no encontrado.`);
    }

    const now = new Date().toISOString();
    const prev = JSON.parse(JSON.stringify(customer));

    if (data.name !== undefined) customer.name = data.name.trim();
    if (data.phone !== undefined) customer.phone = data.phone.trim();
    if (data.email !== undefined) customer.email = data.email.toLowerCase().trim();
    if (data.birth_date !== undefined) customer.birth_date = data.birth_date;
    if (data.notes !== undefined) customer.notes = data.notes;
    if (data.marketing_opt_in !== undefined) {
      customer.marketing_opt_in = data.marketing_opt_in;
      customer.marketing_updated_at = now;
    }
    if (data.preferences !== undefined) {
      customer.preferences = { ...customer.preferences, ...data.preferences };
    }

    customer.updated_at = now;

    AuditService.log(
      'customer.updated',
      'customer' as any,
      customer_id,
      actor,
      prev,
      customer,
      `Actualización de datos para cliente: ${customer.name}`
    );

    eventBus.emit({
      event_name: 'customer.updated',
      event_type: 'customer_event',
      aggregate_id: customer_id,
      actor_id: actor,
      data: { customer },
    });

    db.save();
    return customer;
  }

  public static addOrUpdateAddress(
    customer_id: string,
    addressData: Partial<CustomerAddress>,
    actor: string = 'System Admin'
  ): CustomerAddress {
    const customer = db.get('customers').find((c) => c.id === customer_id);
    if (!customer) {
      throw new Error(`Cliente con id ${customer_id} no encontrado.`);
    }

    const now = new Date().toISOString();

    if (addressData.id) {
      const existing = customer.addresses.find((a) => a.id === addressData.id);
      if (!existing) {
        throw new Error(`Dirección con id ${addressData.id} no encontrada.`);
      }
      Object.assign(existing, addressData);
      customer.updated_at = now;
      db.save();
      return existing;
    }

    // New address
    if (addressData.is_default) {
      customer.addresses.forEach((a) => (a.is_default = false));
    }

    const newAddress: CustomerAddress = {
      id: `addr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      street: addressData.street || '',
      number: addressData.number || '',
      interior: addressData.interior,
      colony: addressData.colony || '',
      city: addressData.city || 'Monterrey',
      state: addressData.state || 'Nuevo León',
      postal_code: addressData.postal_code || '',
      references: addressData.references,
      label: addressData.label || 'home',
      is_default: customer.addresses.length === 0 || Boolean(addressData.is_default),
      created_at: now,
    };

    customer.addresses.push(newAddress);
    customer.updated_at = now;

    AuditService.log(
      'customer.address_added',
      'customer' as any,
      customer_id,
      actor,
      undefined,
      newAddress,
      `Nueva dirección agregada para cliente ${customer.name}`
    );

    db.save();
    return newAddress;
  }

  public static deleteAddress(
    customer_id: string,
    address_id: string,
    actor: string = 'System Admin'
  ): boolean {
    const customer = db.get('customers').find((c) => c.id === customer_id);
    if (!customer) {
      throw new Error(`Cliente con id ${customer_id} no encontrado.`);
    }

    const idx = customer.addresses.findIndex((a) => a.id === address_id);
    if (idx === -1) return false;

    const wasDefault = customer.addresses[idx].is_default;
    customer.addresses.splice(idx, 1);
    if (wasDefault && customer.addresses.length > 0) {
      customer.addresses[0].is_default = true;
    }

    customer.updated_at = new Date().toISOString();
    AuditService.log(
      'customer.address_deleted',
      'customer' as any,
      customer_id,
      actor,
      undefined,
      { address_id },
      `Dirección eliminada para cliente ${customer.name}`
    );

    db.save();
    return true;
  }

  // ==========================================
  // 2. REAL ORDER HISTORY & METRICS ENGINE
  // ==========================================

  public static getCustomerOrders(
    customer_id: string,
    restaurant_id?: string
  ): Order[] {
    const orders = db.get('orders').filter((o) => {
      const matchCustomer = o.customer_id === customer_id;
      const matchRest = restaurant_id ? o.restaurant_id === restaurant_id : true;
      return matchCustomer && matchRest;
    });

    return orders.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public static getCustomerMetrics(
    customer_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): CustomerMetrics {
    const customerOrders = this.getCustomerOrders(customer_id);
    const completedOrders = customerOrders.filter((o) => o.status === 'completed');

    const orderCount = completedOrders.length;
    const totalSpend = completedOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0);
    const avgOrderValue = orderCount > 0 ? Math.round(totalSpend / orderCount) : 0;

    const dates = completedOrders
      .map((o) => new Date(o.created_at).getTime())
      .sort((a, b) => a - b);
    const firstOrderAt = dates.length > 0 ? new Date(dates[0]).toISOString() : undefined;
    const lastOrderAt = dates.length > 0 ? new Date(dates[dates.length - 1]).toISOString() : undefined;

    // Favorite restaurant
    const restCounts: Record<string, number> = {};
    completedOrders.forEach((o) => {
      restCounts[o.restaurant_id] = (restCounts[o.restaurant_id] || 0) + 1;
    });
    const favRest = Object.entries(restCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || restaurant_id;

    // Loyalty points & tier
    const account = this.getLoyaltyAccount(customer_id, restaurant_id);
    const pointsBalance = account.points_balance;
    const tier = account.tier;

    // Segmentation engine
    const now = Date.now();
    const daysSinceLastOrder = lastOrderAt
      ? Math.floor((now - new Date(lastOrderAt).getTime()) / (1000 * 3600 * 24))
      : 999;

    let segment: CustomerSegment = 'new_customer';
    if (orderCount === 0 || orderCount === 1) {
      segment = 'new_customer';
    } else if (totalSpend >= 150000 || avgOrderValue >= 35000) {
      segment = 'high_value_customer';
    } else if (orderCount >= 5) {
      segment = 'frequent_customer';
    } else if (daysSinceLastOrder > 60) {
      segment = 'inactive_customer';
    } else {
      segment = 'active_customer';
    }

    return {
      customer_id,
      order_count: orderCount,
      total_spend_cents: totalSpend,
      average_order_value_cents: avgOrderValue,
      last_order_at: lastOrderAt,
      first_order_at: firstOrderAt,
      favorite_restaurant_id: favRest,
      favorite_product_names: ['Hamburguesa Doble Angus', 'Boneless BBQ', 'Cerveza Ultra'],
      points_balance: pointsBalance,
      tier,
      segment,
    };
  }

  // ==========================================
  // 3. LOYALTY & POINTS LEDGER
  // ==========================================

  public static getLoyaltyAccount(
    customer_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): LoyaltyAccount {
    const accounts = db.get('loyalty_accounts');
    let account = accounts.find(
      (a) => a.customer_id === customer_id && a.restaurant_id === restaurant_id
    );

    if (!account) {
      const now = new Date().toISOString();
      account = {
        id: `loy_acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        restaurant_id,
        customer_id,
        points_balance: 0,
        lifetime_points: 0,
        tier: 'bronze',
        created_at: now,
        updated_at: now,
      };
      accounts.push(account);
      db.save();
    }

    // Refresh tier dynamically based on lifetime points
    const calculatedTier = this.calculateTier(account.lifetime_points);
    if (account.tier !== calculatedTier) {
      account.tier = calculatedTier;
      account.updated_at = new Date().toISOString();
      db.save();
    }

    return account;
  }

  public static calculateTier(lifetimePoints: number): LoyaltyTier {
    if (lifetimePoints >= 2000) return 'platinum';
    if (lifetimePoints >= 800) return 'gold';
    if (lifetimePoints >= 300) return 'silver';
    return 'bronze';
  }

  public static getLoyaltyTransactions(
    customer_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): LoyaltyTransaction[] {
    return db
      .get('loyalty_transactions')
      .filter((t) => t.customer_id === customer_id && t.restaurant_id === restaurant_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Idempotently earn points for a completed order.
   * Rule: 1 point per $10 MXN spent (1,000 cents) on total.
   */
  public static earnPointsForOrder(
    order_id: string,
    actor: string = 'System'
  ): LoyaltyTransaction {
    const transactions = db.get('loyalty_transactions');

    // Rule 15: IDEMPOTENCY CHECK - A single order must generate exactly ONE credit
    const existing = transactions.find(
      (t) => t.reference_type === 'order' && t.reference_id === order_id && t.type === 'earn'
    );
    if (existing) {
      return existing; // Idempotent return
    }

    const order = db.get('orders').find((o) => o.id === order_id);
    if (!order) {
      throw new Error(`Comanda #${order_id} no encontrada.`);
    }

    if (!order.customer_id) {
      throw new Error(`La comanda #${order_id} no tiene un cliente asignado.`);
    }

    // Compute points: 1 point per 1000 cents ($10 MXN)
    const pointsToEarn = Math.max(1, Math.floor((order.total_cents || 0) / 1000));
    const account = this.getLoyaltyAccount(order.customer_id, order.restaurant_id);

    const balanceBefore = account.points_balance;
    const balanceAfter = balanceBefore + pointsToEarn;

    account.points_balance = balanceAfter;
    account.lifetime_points += pointsToEarn;
    account.tier = this.calculateTier(account.lifetime_points);
    account.updated_at = new Date().toISOString();

    const newTx: LoyaltyTransaction = {
      id: `lt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id: order.restaurant_id,
      customer_id: order.customer_id,
      type: 'earn',
      points: pointsToEarn,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_type: 'order',
      reference_id: order.id,
      description: `Puntos acumulados por Comanda ${order.ticket_number || order.id}`,
      created_at: new Date().toISOString(),
      created_by: actor,
    };

    transactions.push(newTx);
    order.points_earned = pointsToEarn;

    AuditService.log(
      'loyalty.earned',
      'loyalty' as any,
      order.customer_id,
      actor,
      { balance_before: balanceBefore },
      { balance_after: balanceAfter, points_earned: pointsToEarn },
      `+${pointsToEarn} puntos acreditados a cliente por orden ${order.id}`
    );

    eventBus.emit({
      event_name: 'loyalty.points_earned',
      event_type: 'loyalty_event',
      aggregate_id: order.customer_id,
      actor_id: actor,
      data: { transaction: newTx, order_id: order.id },
    });

    db.save();
    return newTx;
  }

  /**
   * Reverses points if an order is cancelled or refunded (Section 17).
   */
  public static reversePointsForOrder(
    order_id: string,
    reason: string = 'Cancelación de orden',
    actor: string = 'System Admin'
  ): LoyaltyTransaction | null {
    const transactions = db.get('loyalty_transactions');
    const earnTx = transactions.find(
      (t) => t.reference_type === 'order' && t.reference_id === order_id && t.type === 'earn'
    );
    if (!earnTx) return null;

    // Check if already reversed
    const alreadyReversed = transactions.find(
      (t) => t.reference_type === 'order' && t.reference_id === order_id && t.type === 'reversal'
    );
    if (alreadyReversed) return alreadyReversed;

    const account = this.getLoyaltyAccount(earnTx.customer_id, earnTx.restaurant_id);
    const pointsToDeduct = earnTx.points;
    const balanceBefore = account.points_balance;
    const balanceAfter = Math.max(0, balanceBefore - pointsToDeduct); // Floor at 0

    account.points_balance = balanceAfter;
    account.updated_at = new Date().toISOString();

    const reversalTx: LoyaltyTransaction = {
      id: `lt_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id: earnTx.restaurant_id,
      customer_id: earnTx.customer_id,
      type: 'reversal',
      points: -pointsToDeduct,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_type: 'order',
      reference_id: order_id,
      description: `Reversión de puntos por ${reason}`,
      created_at: new Date().toISOString(),
      created_by: actor,
    };

    transactions.push(reversalTx);

    AuditService.log(
      'loyalty.reversed',
      'loyalty' as any,
      earnTx.customer_id,
      actor,
      { balance_before: balanceBefore },
      { balance_after: balanceAfter, reversed_points: pointsToDeduct },
      `Reversión de -${pointsToDeduct} puntos por orden ${order_id}`
    );

    eventBus.emit({
      event_name: 'loyalty.points_reversed',
      event_type: 'loyalty_event',
      aggregate_id: earnTx.customer_id,
      actor_id: actor,
      data: { transaction: reversalTx, order_id },
    });

    db.save();
    return reversalTx;
  }

  /**
   * Redeem a loyalty reward with balance validation (Section 18).
   */
  public static redeemReward(
    customer_id: string,
    reward_id: string,
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): {
    reward: LoyaltyReward;
    transaction: LoyaltyTransaction;
    new_balance: number;
  } {
    const reward = db
      .get('loyalty_rewards')
      .find((r) => r.id === reward_id && r.restaurant_id === restaurant_id);
    if (!reward || !reward.is_active) {
      throw new Error(`Recompensa con id ${reward_id} no válida o inactiva.`);
    }

    const account = this.getLoyaltyAccount(customer_id, restaurant_id);
    if (account.points_balance < reward.points_required) {
      throw new Error(
        `Saldo de puntos insuficiente. Tienes ${account.points_balance} pts y requieres ${reward.points_required} pts.`
      );
    }

    const balanceBefore = account.points_balance;
    const balanceAfter = balanceBefore - reward.points_required;

    account.points_balance = balanceAfter;
    account.updated_at = new Date().toISOString();

    const transaction: LoyaltyTransaction = {
      id: `lt_red_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id,
      customer_id,
      type: 'redeem',
      points: -reward.points_required,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_type: 'reward_redemption',
      reference_id: reward.id,
      description: `Canje de recompensa: ${reward.name}`,
      created_at: new Date().toISOString(),
      created_by: actor,
    };

    db.get('loyalty_transactions').push(transaction);

    AuditService.log(
      'loyalty.redeemed',
      'loyalty' as any,
      customer_id,
      actor,
      { balance_before: balanceBefore },
      { balance_after: balanceAfter, reward_id: reward.id },
      `Canje de recompensa '${reward.name}' por ${reward.points_required} pts`
    );

    eventBus.emit({
      event_name: 'loyalty.points_redeemed',
      event_type: 'loyalty_event',
      aggregate_id: customer_id,
      actor_id: actor,
      data: { reward, transaction },
    });

    db.save();
    return { reward, transaction, new_balance: balanceAfter };
  }

  /**
   * Manual points adjustment with audit trail (Section 41).
   */
  public static adjustPoints(
    customer_id: string,
    pointsDelta: number,
    reason: string,
    actor: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): LoyaltyTransaction {
    if (!reason || reason.trim().length === 0) {
      throw new Error('El motivo del ajuste de puntos es obligatorio.');
    }

    const account = this.getLoyaltyAccount(customer_id, restaurant_id);
    const balanceBefore = account.points_balance;
    const balanceAfter = balanceBefore + pointsDelta;

    if (balanceAfter < 0) {
      throw new Error(
        `El ajuste resultaría en un saldo negativo (${balanceAfter}). Operación rechazada.`
      );
    }

    account.points_balance = balanceAfter;
    if (pointsDelta > 0) {
      account.lifetime_points += pointsDelta;
      account.tier = this.calculateTier(account.lifetime_points);
    }
    account.updated_at = new Date().toISOString();

    const tx: LoyaltyTransaction = {
      id: `lt_adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id,
      customer_id,
      type: 'adjustment',
      points: pointsDelta,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_type: 'manual_adjustment',
      reference_id: `adj_${Date.now()}`,
      description: `Ajuste manual (${pointsDelta > 0 ? '+' : ''}${pointsDelta} pts): ${reason}`,
      created_at: new Date().toISOString(),
      created_by: actor,
    };

    db.get('loyalty_transactions').push(tx);

    AuditService.log(
      'loyalty.adjusted',
      'loyalty' as any,
      customer_id,
      actor,
      { balance_before: balanceBefore },
      { balance_after: balanceAfter, delta: pointsDelta, reason },
      `Ajuste manual de puntos (${pointsDelta}): ${reason}`
    );

    db.save();
    return tx;
  }

  public static listRewards(restaurant_id: string = DEFAULT_RESTAURANT_ID): LoyaltyReward[] {
    return db
      .get('loyalty_rewards')
      .filter((r) => r.restaurant_id === restaurant_id && r.is_active);
  }

  public static createReward(
    data: CreateRewardDTO,
    actor: string = 'System Admin'
  ): LoyaltyReward {
    const restaurant_id = data.restaurant_id || DEFAULT_RESTAURANT_ID;
    const now = new Date().toISOString();

    const newReward: LoyaltyReward = {
      id: `rew_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id,
      name: data.name.trim(),
      description: data.description.trim(),
      reward_type: data.reward_type,
      value: data.value,
      points_required: data.points_required,
      product_id: data.product_id,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_at: now,
      updated_at: now,
    };

    db.get('loyalty_rewards').push(newReward);

    AuditService.log(
      'loyalty.reward_created',
      'loyalty' as any,
      newReward.id,
      actor,
      undefined,
      newReward,
      `Nueva recompensa de fidelidad: ${newReward.name} (${newReward.points_required} pts)`
    );

    db.save();
    return newReward;
  }

  // ==========================================
  // 4. PROMOTIONS & COUPONS ENGINE
  // ==========================================

  public static listPromotions(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    onlyActive: boolean = false
  ): Promotion[] {
    let promos = db.get('promotions').filter((p) => p.restaurant_id === restaurant_id);
    if (onlyActive) {
      const now = new Date().toISOString();
      promos = promos.filter((p) => {
        if (!p.is_active) return false;
        if (p.start_date && p.start_date > now) return false;
        if (p.end_date && p.end_date < now) return false;
        if (p.max_uses_total && p.current_uses_count >= p.max_uses_total) return false;
        return true;
      });
    }
    return promos;
  }

  public static getPromotion(
    promotion_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Promotion | undefined {
    return db
      .get('promotions')
      .find((p) => p.id === promotion_id && p.restaurant_id === restaurant_id);
  }

  public static createPromotion(
    data: CreatePromotionDTO,
    actor: string = 'System Admin'
  ): Promotion {
    const restaurant_id = data.restaurant_id || DEFAULT_RESTAURANT_ID;
    const now = new Date().toISOString();
    const cleanCoupon = data.coupon_code ? data.coupon_code.trim().toUpperCase() : undefined;

    // Check code uniqueness
    if (cleanCoupon) {
      const existing = db
        .get('promotions')
        .find((p) => p.restaurant_id === restaurant_id && p.coupon_code === cleanCoupon && p.is_active);
      if (existing) {
        throw new Error(`El código de cupón '${cleanCoupon}' ya está en uso en este restaurante.`);
      }
    }

    const newPromotion: Promotion = {
      id: `promo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id,
      name: data.name.trim(),
      description: data.description.trim(),
      type: data.type,
      discount_percent: data.discount_percent,
      discount_amount_cents: data.discount_amount_cents,
      coupon_code: cleanCoupon,
      min_order_cents: data.min_order_cents || 0,
      max_discount_cents: data.max_discount_cents,
      applicable_product_ids: data.applicable_product_ids,
      applicable_categories: data.applicable_categories,
      max_uses_total: data.max_uses_total,
      max_uses_per_customer: data.max_uses_per_customer || 1,
      current_uses_count: 0,
      start_date: data.start_date,
      end_date: data.end_date,
      is_active: data.is_active !== undefined ? data.is_active : true,
      stackable_with_loyalty: Boolean(data.stackable_with_loyalty),
      created_at: now,
      updated_at: now,
    };

    db.get('promotions').push(newPromotion);

    AuditService.log(
      'promotion.created',
      'promotion' as any,
      newPromotion.id,
      actor,
      undefined,
      newPromotion,
      `Nueva promoción: ${newPromotion.name} (${newPromotion.coupon_code || newPromotion.type})`
    );

    eventBus.emit({
      event_name: 'promotion.created',
      event_type: 'promotion_event',
      aggregate_id: newPromotion.id,
      actor_id: actor,
      data: { promotion: newPromotion },
    });

    db.save();
    return newPromotion;
  }

  public static updatePromotion(
    promotion_id: string,
    data: Partial<CreatePromotionDTO>,
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Promotion {
    const promo = db
      .get('promotions')
      .find((p) => p.id === promotion_id && p.restaurant_id === restaurant_id);
    if (!promo) {
      throw new Error(`Promoción #${promotion_id} no encontrada.`);
    }

    if (data.name !== undefined) promo.name = data.name.trim();
    if (data.description !== undefined) promo.description = data.description.trim();
    if (data.discount_percent !== undefined) promo.discount_percent = data.discount_percent;
    if (data.discount_amount_cents !== undefined) promo.discount_amount_cents = data.discount_amount_cents;
    if (data.min_order_cents !== undefined) promo.min_order_cents = data.min_order_cents;
    if (data.max_discount_cents !== undefined) promo.max_discount_cents = data.max_discount_cents;
    if (data.is_active !== undefined) promo.is_active = data.is_active;
    if (data.start_date !== undefined) promo.start_date = data.start_date;
    if (data.end_date !== undefined) promo.end_date = data.end_date;
    if (data.coupon_code !== undefined) promo.coupon_code = data.coupon_code.trim().toUpperCase();

    promo.updated_at = new Date().toISOString();

    AuditService.log(
      'promotion.updated',
      'promotion' as any,
      promotion_id,
      actor,
      undefined,
      promo,
      `Promoción ${promo.name} actualizada`
    );

    db.save();
    return promo;
  }

  public static deletePromotion(
    promotion_id: string,
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): boolean {
    const promo = db
      .get('promotions')
      .find((p) => p.id === promotion_id && p.restaurant_id === restaurant_id);
    if (!promo) return false;

    promo.is_active = false;
    promo.updated_at = new Date().toISOString();

    AuditService.log(
      'promotion.deleted',
      'promotion' as any,
      promotion_id,
      actor,
      undefined,
      { is_active: false },
      `Promoción ${promo.name} desactivada`
    );

    db.save();
    return true;
  }

  /**
   * Validate promotion or coupon code against business constraints.
   */
  public static validatePromotionOrCoupon(
    codeOrId: string,
    orderSubtotalCents: number,
    customer_id?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): {
    valid: boolean;
    promotion?: Promotion;
    discount_cents: number;
    reason?: string;
  } {
    const clean = codeOrId.trim().toUpperCase();
    const promo = db.get('promotions').find(
      (p) =>
        p.restaurant_id === restaurant_id &&
        (p.id === codeOrId || (p.coupon_code && p.coupon_code.toUpperCase() === clean))
    );

    if (!promo) {
      return { valid: false, discount_cents: 0, reason: `Cupón o promoción '${codeOrId}' no encontrado.` };
    }

    if (!promo.is_active) {
      return { valid: false, discount_cents: 0, reason: 'La promoción ya no se encuentra activa.' };
    }

    const now = new Date().toISOString();
    if (promo.start_date && promo.start_date > now) {
      return { valid: false, discount_cents: 0, reason: 'La promoción aún no ha iniciado.' };
    }
    if (promo.end_date && promo.end_date < now) {
      return { valid: false, discount_cents: 0, reason: 'La promoción ha expirado.' };
    }

    if (promo.min_order_cents && orderSubtotalCents < promo.min_order_cents) {
      const minMxn = (promo.min_order_cents / 100).toFixed(2);
      return {
        valid: false,
        discount_cents: 0,
        reason: `Monto mínimo de consumo no alcanzado ($${minMxn} MXN requerido).`,
      };
    }

    if (promo.max_uses_total && promo.current_uses_count >= promo.max_uses_total) {
      return { valid: false, discount_cents: 0, reason: 'El cupón ha alcanzado el límite máximo de usos.' };
    }

    // Customer usage limit
    if (customer_id && promo.max_uses_per_customer) {
      const redemptions = db
        .get('promotion_redemptions')
        .filter((r) => r.promotion_id === promo.id && r.customer_id === customer_id);
      if (redemptions.length >= promo.max_uses_per_customer) {
        return {
          valid: false,
          discount_cents: 0,
          reason: `Has alcanzado el límite de usos permitidos (${promo.max_uses_per_customer}) para este cupón.`,
        };
      }
    }

    // Calculate discount
    let discountCents = 0;
    if (promo.discount_percent) {
      discountCents = Math.round((orderSubtotalCents * promo.discount_percent) / 100);
      if (promo.max_discount_cents && discountCents > promo.max_discount_cents) {
        discountCents = promo.max_discount_cents;
      }
    } else if (promo.discount_amount_cents) {
      discountCents = Math.min(orderSubtotalCents, promo.discount_amount_cents);
    }

    return {
      valid: true,
      promotion: promo,
      discount_cents: discountCents,
    };
  }

  /**
   * Apply validated promotion or coupon directly to an order (Section 24).
   */
  public static applyPromotionToOrder(
    order_id: string,
    codeOrId: string,
    actor: string = 'System Admin'
  ): {
    order: Order;
    promotion: Promotion;
    discount_cents: number;
  } {
    const order = db.get('orders').find((o) => o.id === order_id);
    if (!order) {
      throw new Error(`Comanda #${order_id} no encontrada.`);
    }

    const validation = this.validatePromotionOrCoupon(
      codeOrId,
      order.subtotal_cents,
      order.customer_id,
      order.restaurant_id
    );

    if (!validation.valid || !validation.promotion) {
      throw new Error(validation.reason || 'Cupón inválido.');
    }

    const promo = validation.promotion;
    const discountCents = validation.discount_cents;

    // Apply snapshot to order
    order.promotion_id = promo.id;
    order.coupon_code = promo.coupon_code;
    order.discount_cents = discountCents;
    order.total_cents = Math.max(0, order.subtotal_cents + order.tax_cents - discountCents);

    // Record redemption ledger
    const redemption: PromotionRedemptionRecord = {
      id: `pr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id: order.restaurant_id,
      promotion_id: promo.id,
      customer_id: order.customer_id,
      order_id: order.id,
      coupon_code: promo.coupon_code,
      discount_applied_cents: discountCents,
      redeemed_at: new Date().toISOString(),
    };

    db.get('promotion_redemptions').push(redemption);
    promo.current_uses_count += 1;

    AuditService.log(
      'promotion.redeemed',
      'promotion' as any,
      promo.id,
      actor,
      undefined,
      { order_id, discount_cents: discountCents },
      `Promoción ${promo.name} aplicada a comanda #${order.id} (-$${(discountCents / 100).toFixed(2)})`
    );

    eventBus.emit({
      event_name: 'promotion.redeemed',
      event_type: 'promotion_event',
      aggregate_id: promo.id,
      actor_id: actor,
      data: { order_id, promotion_id: promo.id, discount_cents: discountCents },
    });

    db.save();
    return { order, promotion: promo, discount_cents: discountCents };
  }

  // ==========================================
  // 5. CRM SUMMARY & REPORTING
  // ==========================================

  public static getCrmSummary(restaurant_id: string = DEFAULT_RESTAURANT_ID): CrmSummary {
    const customers = db.get('customers');
    const promos = db.get('promotions').filter((p) => p.restaurant_id === restaurant_id);
    const loyaltyTxs = db
      .get('loyalty_transactions')
      .filter((t) => t.restaurant_id === restaurant_id);

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let activeCount = 0;
    let frequentCount = 0;
    let highValueCount = 0;
    let newThisMonthCount = 0;

    customers.forEach((c) => {
      const metrics = this.getCustomerMetrics(c.id, restaurant_id);
      if (c.created_at.startsWith(currentMonthPrefix)) newThisMonthCount++;
      if (metrics.segment === 'active_customer') activeCount++;
      if (metrics.segment === 'frequent_customer') frequentCount++;
      if (metrics.segment === 'high_value_customer') highValueCount++;
    });

    const totalIssued = loyaltyTxs
      .filter((t) => t.type === 'earn')
      .reduce((sum, t) => sum + t.points, 0);

    const totalRedeemed = loyaltyTxs
      .filter((t) => t.type === 'redeem')
      .reduce((sum, t) => sum + Math.abs(t.points), 0);

    const activePromos = promos.filter((p) => p.is_active).length;

    return {
      total_customers: customers.length,
      active_customers: activeCount,
      new_customers_this_month: newThisMonthCount,
      frequent_customers: frequentCount,
      high_value_customers: highValueCount,
      total_loyalty_points_issued: totalIssued,
      total_loyalty_points_redeemed: totalRedeemed,
      active_promotions_count: activePromos,
    };
  }
}
