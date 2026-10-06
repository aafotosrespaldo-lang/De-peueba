/**
 * DIRECTAURANTE POS & COMANDERO - Client HTTP SDK Adapter
 * Browser-safe client adapter communicating via fetch (/api/*).
 * Zero server-side or filesystem dependencies.
 */

import {
  GuestSubaccount,
  Product,
  Order,
  OrderItem,
  OrderItemStatus,
  TableBill,
  SubaccountBill,
  Payment,
  CashShift,
  CashMovement,
  AuditLog,
  PluginDefinition,
  Allergy,
  Ingredient,
  KdsItemView,
  KdsTicketView,
  KdsProductionSummaryItem,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  InventoryCount,
  InventoryAlert,
  InventorySummary,
  Expense,
  ExpenseCategory,
  FinancialMovement,
  RestaurantSettlement,
  DriverSettlement,
  OperatingPnL,
  ZCutReport,
  PaymentMethod,
  PaymentStatus,
  Solution,
  Capability,
  CommercialPlan,
  Entitlement,
  EntitlementCheckResult,
  ActionAuthorizationResult,
  SolutionStatus,
  CommercialAvailability,
  EntitlementSource,
  Permission,
} from '../core/types';
import type {
  RecordPaymentInput,
  RefundPaymentInput,
  CreateExpenseDTO,
  CashSessionOpenDTO,
  CashSessionCloseDTO,
  FinancialMovementFilter,
} from '../modules/finance/financeService';

export interface DirectauranteSdkAdapter {
  // Tables
  listTables(restaurantId?: string): Promise<any[]>;
  getTable(tableId: string, restaurantId?: string): Promise<any>;
  openTableSession(
    tableId: string,
    waiterName: string,
    initialGuests?: Array<{ name: string; allergy_ids?: string[] }>,
    restaurantId?: string
  ): Promise<any>;
  closeTableSession(tableIdOrSessionId: string, actor?: string, restaurantId?: string): Promise<any>;

  // Guests
  listSubaccounts(tableIdOrSessionId: string, restaurantId?: string): Promise<GuestSubaccount[]>;
  createSubaccount(
    tableIdOrSessionId: string,
    displayName: string,
    allergyIds?: string[],
    notes?: string,
    actor?: string,
    restaurantId?: string
  ): Promise<GuestSubaccount>;
  updateSubaccount(
    subaccountId: string,
    updates: Partial<GuestSubaccount>,
    actor?: string,
    restaurantId?: string
  ): Promise<GuestSubaccount>;
  getSubaccount(subaccountId: string, restaurantId?: string): Promise<GuestSubaccount>;

  // Orders
  createOrderTicket(
    tableIdOrSessionId: string,
    waiterName?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<Order>;
  getSessionOrders(tableIdOrSessionId: string, restaurantId?: string): Promise<Order[]>;
  addOrderItem(
    tableIdOrSessionId: string,
    guestSubaccountId: string,
    productId: string,
    quantity?: number,
    notes?: string,
    overrideAllergy?: boolean,
    actor?: string,
    restaurantId?: string,
    orderTicketId?: string,
    modifiers?: string[]
  ): Promise<any>;
  updateOrderItemStatus(
    itemId: string,
    status: OrderItemStatus,
    actor?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<OrderItem>;
  acknowledgeItem(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;
  removeOrderItem(
    itemId: string,
    reason?: string,
    actor?: string,
    restaurantId?: string
  ): Promise<OrderItem>;
  reassignItemSubaccount(
    itemId: string,
    newSubaccountId: string,
    actor?: string,
    restaurantId?: string
  ): Promise<OrderItem>;

  // Bills
  getSessionBill(tableIdOrSessionId: string, restaurantId?: string): Promise<TableBill>;
  getSubaccountBill(
    tableIdOrSessionId: string,
    subaccountId: string,
    restaurantId?: string
  ): Promise<SubaccountBill>;
  recordPayment(
    tableIdOrSessionId: string,
    amountCents: number,
    method: Payment['method'],
    guestSubaccountId?: string,
    cashier?: string,
    reference?: string,
    restaurantId?: string
  ): Promise<Payment>;

  // KDS
  getStationItems(station?: string, restaurantId?: string, includeCompleted?: boolean): Promise<KdsItemView[]>;
  getStationTickets(station?: string, restaurantId?: string, includeCompleted?: boolean): Promise<KdsTicketView[]>;
  getProductionSummary(station?: string, restaurantId?: string): Promise<KdsProductionSummaryItem[]>;
  startPreparingTicket(orderId: string, station?: string, actor?: string, restaurantId?: string): Promise<OrderItem[]>;
  markTicketReady(orderId: string, station?: string, actor?: string, restaurantId?: string): Promise<OrderItem[]>;
  deliverTicket(orderId: string, station?: string, actor?: string, restaurantId?: string): Promise<OrderItem[]>;
  recallTicket(orderId: string, station?: string, actor?: string, restaurantId?: string): Promise<OrderItem[]>;
  recallItem(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;

  // Catalog
  listProducts(category?: string, restaurantId?: string): Promise<Product[]>;
  listAllergies(): Promise<{ allergies: Allergy[]; ingredients: Ingredient[] }>;

  // Cash
  getCurrentShift(restaurantId?: string): Promise<any>;
  openShift(
    initialFloatCents: number,
    cashier?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<CashShift>;
  closeShift(
    actualCashCents: number,
    cashier?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<CashShift>;
  recordMovement(
    type: CashMovement['type'],
    amountCents: number,
    description: string,
    performer?: string,
    restaurantId?: string
  ): Promise<CashMovement>;

  // Audit
  listAuditEvents(limit?: number, entityType?: string, restaurantId?: string): Promise<AuditLog[]>;

  // Plugins
  listPlugins(restaurantId?: string): Promise<any[]>;
  togglePlugin(pluginId: string, enabled: boolean, actor?: string, restaurantId?: string): Promise<any>;

  // Inventory & Kardex (Core F6)
  listInventoryItems(filters?: any, restaurantId?: string): Promise<InventoryItem[]>;
  getInventoryItem(itemId: string, restaurantId?: string): Promise<InventoryItem | undefined>;
  getInventoryStock(itemId: string, restaurantId?: string): Promise<{ current_stock: number; min_stock: number; is_low: boolean; is_out: boolean }>;
  getKardex(itemId: string, filters?: any, restaurantId?: string): Promise<{
    item: InventoryItem;
    movements: Array<InventoryMovement & { in_qty: number; out_qty: number; running_balance: number }>;
    current_stock: number;
    total_entries: number;
    total_exits: number;
  }>;
  createInventoryMovement(params: {
    inventory_item_id: string;
    movement_type: InventoryMovementType;
    quantity: number;
    reason: string;
    reference_type: string;
    reference_id?: string;
    actor: string;
    cost_cents_per_unit?: number;
    restaurantId?: string;
  }): Promise<InventoryMovement>;
  createInventoryAdjustment(params: {
    inventory_item_id: string;
    type: 'adjustment_in' | 'adjustment_out' | 'waste';
    quantity: number;
    reason: string;
    actor?: string;
    restaurantId?: string;
  }): Promise<InventoryMovement>;
  createInventoryCount(params: {
    performed_by: string;
    notes?: string;
    counts: Array<{ inventory_item_id: string; counted_stock: number; reason?: string }>;
    restaurantId?: string;
  }): Promise<InventoryCount>;
  getInventoryAlerts(restaurantId?: string): Promise<InventoryAlert[]>;
  getInventorySummary(restaurantId?: string): Promise<InventorySummary>;
  exportKardexCsv(itemId: string, restaurantId?: string): Promise<string>;
  exportInventoryCsv(restaurantId?: string): Promise<string>;

  // Recipes, Ingredients & COGS (Core F7)
  listRecipes(filters?: any, restaurantId?: string): Promise<any[]>;
  getRecipe(recipeId: string, restaurantId?: string): Promise<any>;
  getProductRecipe(productId: string, restaurantId?: string): Promise<any>;
  createRecipe(data: any, actor?: string, restaurantId?: string): Promise<any>;
  updateRecipe(recipeId: string, data: any, actor?: string, restaurantId?: string): Promise<any>;
  deleteRecipe(recipeId: string, actor?: string, restaurantId?: string): Promise<boolean>;
  calculateRecipeCost(recipeId: string, restaurantId?: string): Promise<any>;
  getRecipeVersions(recipeId: string, restaurantId?: string): Promise<any[]>;
  getRecipeSummary(restaurantId?: string): Promise<any>;

  // Purchases & Suppliers (Core F8)
  listSuppliers(restaurantId?: string): Promise<any[]>;
  getSupplier(supplierId: string, restaurantId?: string): Promise<any>;
  createSupplier(data: any, actor?: string, restaurantId?: string): Promise<any>;
  updateSupplier(supplierId: string, data: any, actor?: string, restaurantId?: string): Promise<any>;
  deleteSupplier(supplierId: string, actor?: string, restaurantId?: string): Promise<boolean>;
  linkSupplierProduct(supplierId: string, product: any, actor?: string, restaurantId?: string): Promise<any>;
  listPurchaseOrders(filters?: any, restaurantId?: string): Promise<any[]>;
  getPurchaseOrder(orderId: string, restaurantId?: string): Promise<any>;
  createPurchaseOrder(data: any, actor?: string, restaurantId?: string): Promise<any>;
  updatePurchaseOrder(orderId: string, data: any, actor?: string, restaurantId?: string): Promise<any>;
  updateOrderStatus(orderId: string, status: any, actor?: string, restaurantId?: string): Promise<any>;
  receivePurchaseOrder(orderId: string, receiptData: any, actor?: string, restaurantId?: string): Promise<any>;
  getPriceHistory(itemId?: string, restaurantId?: string): Promise<any[]>;
  getPurchaseSummary(restaurantId?: string): Promise<any>;

  // Staff, Roles, Permissions & Shifts (Core F10)
  listStaffMembers(filters?: any, restaurantId?: string): Promise<any[]>;
  getStaffMember(memberId: string, restaurantId?: string): Promise<any>;
  createStaffMember(data: any, actor?: string): Promise<any>;
  updateStaffMember(memberId: string, data: any, actor?: string, restaurantId?: string): Promise<any>;
  deactivateStaffMember(memberId: string, reason?: string, actor?: string, restaurantId?: string): Promise<any>;
  activateStaffMember(memberId: string, actor?: string, restaurantId?: string): Promise<any>;
  getStaffMemberHistory(memberId: string, restaurantId?: string): Promise<any[]>;
  getStaffSummary(restaurantId?: string): Promise<any>;

  listRoles(restaurantId?: string): Promise<any[]>;
  getRole(roleId: string, restaurantId?: string): Promise<any>;
  createRole(data: any, actor?: string): Promise<any>;
  updateRole(roleId: string, data: any, actor?: string, restaurantId?: string): Promise<any>;
  deleteRole(roleId: string, actor?: string, restaurantId?: string): Promise<boolean>;

  listPermissions(): Promise<any[]>;
  authorizePermission(userId: string, permission: string, restaurantId?: string): Promise<any>;

  listShifts(filters?: any, restaurantId?: string): Promise<any[]>;
  getShift(shiftId: string, restaurantId?: string): Promise<any>;
  getActiveShift(memberId: string, restaurantId?: string): Promise<any>;
  scheduleShift(data: any, actor?: string): Promise<any>;
  startShift(data: any, actor?: string): Promise<any>;
  endShift(shiftId: string, notes?: string, actor?: string, restaurantId?: string): Promise<any>;
  cancelShift(shiftId: string, reason?: string, actor?: string, restaurantId?: string): Promise<any>;

  getRestaurantContext(userId: string, restaurantId?: string): Promise<any>;

  // Customers, CRM, Loyalty & Promotions (Core F11)
  listCustomers(filters?: any): Promise<any[]>;
  getCustomer(customerId: string): Promise<any>;
  findCustomerByPhoneOrEmail(query: string): Promise<any>;
  createCustomer(data: any, actor?: string): Promise<any>;
  updateCustomer(customerId: string, data: any, actor?: string): Promise<any>;
  getCustomerOrders(customerId: string, restaurantId?: string): Promise<any[]>;
  getCustomerMetrics(customerId: string, restaurantId?: string): Promise<any>;
  addCustomerAddress(customerId: string, address: any, actor?: string): Promise<any>;
  deleteCustomerAddress(customerId: string, addressId: string, actor?: string): Promise<boolean>;

  getLoyaltyAccount(customerId: string, restaurantId?: string): Promise<any>;
  getLoyaltyTransactions(customerId: string, restaurantId?: string): Promise<any[]>;
  listLoyaltyRewards(restaurantId?: string): Promise<any[]>;
  createLoyaltyReward(data: any, actor?: string): Promise<any>;
  redeemLoyaltyReward(customerId: string, rewardId: string, actor?: string, restaurantId?: string): Promise<any>;
  adjustLoyaltyPoints(customerId: string, points: number, reason: string, actor?: string, restaurantId?: string): Promise<any>;
  earnLoyaltyPoints(orderId: string, actor?: string): Promise<any>;
  reverseLoyaltyPoints(orderId: string, reason?: string, actor?: string): Promise<any>;

  listPromotions(restaurantId?: string, onlyActive?: boolean): Promise<any[]>;
  getPromotion(promotionId: string, restaurantId?: string): Promise<any>;
  createPromotion(data: any, actor?: string): Promise<any>;
  updatePromotion(promotionId: string, data: any, actor?: string, restaurantId?: string): Promise<any>;
  deletePromotion(promotionId: string, actor?: string, restaurantId?: string): Promise<boolean>;
  validateCoupon(code: string, subtotalCents: number, customerId?: string, restaurantId?: string): Promise<any>;
  applyPromotionToOrder(orderId: string, code: string, actor?: string): Promise<any>;

  getCrmSummary(restaurantId?: string): Promise<any>;

  // Payments & Finance (F12 / F12.1)
  listPayments(restaurantId?: string, filters?: { table_session_id?: string }): Promise<Payment[]>;
  recordPaymentStrict(input: RecordPaymentInput): Promise<{ payment: Payment; idempotency_replayed: boolean }>;
  refundPayment(input: RefundPaymentInput): Promise<Payment>;
  listExpenses(restaurantId?: string, filters?: { category?: ExpenseCategory; payment_method?: PaymentMethod }): Promise<Expense[]>;
  createExpense(dto: CreateExpenseDTO): Promise<Expense>;
  getFinancialLedger(filters?: FinancialMovementFilter): Promise<FinancialMovement[]>;
  getOperatingPnL(restaurantId?: string, startDate?: string, endDate?: string): Promise<OperatingPnL>;
  getZCutReport(shiftId: string, restaurantId?: string): Promise<ZCutReport>;
  listRestaurantSettlements(restaurantId?: string): Promise<RestaurantSettlement[]>;
  createRestaurantSettlement(data: Omit<RestaurantSettlement, 'id' | 'created_at'>, userId?: string): Promise<RestaurantSettlement>;
  listDriverSettlements(restaurantId?: string): Promise<DriverSettlement[]>;
  createDriverSettlement(data: Omit<DriverSettlement, 'id' | 'created_at'>, userId?: string): Promise<DriverSettlement>;

  // Solutions & Entitlements (Core F13)
  listSolutions(filters?: any): Promise<Solution[]>;
  getSolution(solutionId: string): Promise<Solution | undefined>;
  listCapabilities(solutionId?: string): Promise<Capability[]>;
  listPlans(onlyActive?: boolean): Promise<CommercialPlan[]>;
  getPlan(planIdOrCode: string): Promise<CommercialPlan | undefined>;
  createPlan(data: any): Promise<CommercialPlan>;
  getRestaurantEntitlements(restaurantId?: string, onlyActive?: boolean): Promise<Entitlement[]>;
  grantEntitlement(data: any, restaurantId?: string): Promise<Entitlement>;
  revokeEntitlement(entitlementId: string, restaurantId?: string): Promise<boolean>;
  suspendEntitlement(entitlementId: string, restaurantId?: string): Promise<Entitlement>;
  activateEntitlement(entitlementId: string, restaurantId?: string): Promise<Entitlement>;
  assignPlan(planId: string, restaurantId?: string, source?: EntitlementSource): Promise<Entitlement[]>;
  isSolutionEnabled(solutionId: string, restaurantId?: string): Promise<boolean>;
  hasCapability(capability: string, restaurantId?: string): Promise<boolean>;
  checkCapability(capability: string, restaurantId?: string): Promise<EntitlementCheckResult>;
  authorizeAction(
    userId: string | undefined,
    permission?: Permission,
    capability?: string,
    restaurantId?: string
  ): Promise<ActionAuthorizationResult>;
}

/**
 * HTTP REST Client Adapter: Communicates with backend endpoints (/api/...)
 */
export class HttpDirectauranteAdapter implements DirectauranteSdkAdapter {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err: any = new Error(data.error || `HTTP Error ${res.status}`);
      err.status = res.status;
      err.data = data;
      err.is_allergy_warning = data.is_allergy_warning;
      err.conflicts = data.conflicts;
      throw err;
    }

    return data as T;
  }

  async listTables(_restaurantId?: string) {
    const data = await this.request<{ tables: any[] }>('/api/pos/tables');
    return data.tables || [];
  }

  async getTable(tableId: string) {
    return await this.request<any>(`/api/pos/tables/${tableId}`);
  }

  async openTableSession(tableId: string, waiterName: string, initialGuests?: any[]) {
    return await this.request<any>(`/api/pos/tables/${tableId}/open`, {
      method: 'POST',
      body: JSON.stringify({ waiter_name: waiterName, initial_guests: initialGuests }),
    });
  }

  async closeTableSession(tableIdOrSessionId: string, actor?: string) {
    return await this.request<any>(`/api/pos/tables/${tableIdOrSessionId}/close`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  }

  async listSubaccounts(tableIdOrSessionId: string) {
    const details = await this.getTable(tableIdOrSessionId);
    return details.subaccounts || [];
  }

  async createSubaccount(
    tableIdOrSessionId: string,
    displayName: string,
    allergyIds: string[] = [],
    notes?: string,
    actor?: string
  ) {
    const data = await this.request<{ seat: GuestSubaccount }>(`/api/pos/tables/${tableIdOrSessionId}/seats`, {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName, allergy_ids: allergyIds, notes, actor }),
    });
    return data.seat;
  }

  async updateSubaccount(_subaccountId: string, updates: Partial<GuestSubaccount>) {
    return updates as GuestSubaccount;
  }

  async getSubaccount(_subaccountId: string, _restaurantId?: string): Promise<GuestSubaccount> {
    throw new Error('Not implemented over HTTP');
  }

  async createOrderTicket(tableIdOrSessionId: string, waiterName?: string, notes?: string) {
    const data = await this.request<{ ticket: Order }>(`/api/pos/tables/${tableIdOrSessionId}/tickets`, {
      method: 'POST',
      body: JSON.stringify({ waiter_name: waiterName, notes }),
    });
    return data.ticket;
  }

  async getSessionOrders(tableIdOrSessionId: string) {
    const details = await this.getTable(tableIdOrSessionId);
    return details.orders || [];
  }

  async addOrderItem(
    tableIdOrSessionId: string,
    guestSubaccountId: string,
    productId: string,
    quantity: number = 1,
    notes?: string,
    overrideAllergy: boolean = false,
    actor?: string,
    _restaurantId?: string,
    orderTicketId?: string,
    modifiers?: string[]
  ) {
    try {
      const data = await this.request<{ item: OrderItem }>(`/api/pos/tables/${tableIdOrSessionId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          guest_subaccount_id: guestSubaccountId,
          product_id: productId,
          quantity,
          notes,
          override_allergy: overrideAllergy,
          actor,
          order_ticket_id: orderTicketId,
          modifiers,
        }),
      });
      return { item: data.item, allergy_warning: false };
    } catch (err: any) {
      if (err.is_allergy_warning) {
        return { item: null as any, allergy_warning: true, conflicts: err.conflicts };
      }
      throw err;
    }
  }

  async updateOrderItemStatus(itemId: string, status: OrderItemStatus, actor?: string, notes?: string) {
    const data = await this.request<{ item: OrderItem }>(`/api/pos/items/${itemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, actor, notes }),
    });
    return data.item;
  }

  async acknowledgeItem(itemId: string, actor?: string) {
    const data = await this.request<{ item: OrderItem }>(`/api/pos/items/${itemId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
    return data.item;
  }

  async removeOrderItem(itemId: string, reason?: string, actor?: string) {
    return await this.updateOrderItemStatus(itemId, 'cancelled', actor, reason);
  }

  async reassignItemSubaccount(itemId: string, newSubaccountId: string, actor?: string) {
    const data = await this.request<{ item: OrderItem }>(`/api/pos/items/${itemId}/reassign`, {
      method: 'PATCH',
      body: JSON.stringify({ new_subaccount_id: newSubaccountId, actor }),
    });
    return data.item;
  }

  async getSessionBill(tableIdOrSessionId: string) {
    const data = await this.request<{ bill: TableBill }>(`/api/pos/tables/${tableIdOrSessionId}/bill`);
    return data.bill;
  }

  async getSubaccountBill(tableIdOrSessionId: string, subaccountId: string) {
    const bill = await this.getSessionBill(tableIdOrSessionId);
    const subaccountBill = bill.subaccounts.find((s) => s.guest_subaccount_id === subaccountId);
    if (!subaccountBill) throw new Error(`Subcuenta ${subaccountId} no encontrada en la cuenta.`);
    return subaccountBill;
  }

  async recordPayment(
    tableIdOrSessionId: string,
    amountCents: number,
    method: Payment['method'],
    guestSubaccountId?: string,
    cashier?: string,
    reference?: string
  ) {
    const data = await this.request<{ payment: Payment }>(`/api/pos/tables/${tableIdOrSessionId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        amount_cents: amountCents,
        method,
        guest_subaccount_id: guestSubaccountId,
        cashier,
        reference,
      }),
    });
    return data.payment;
  }

  async getStationItems(station?: string, _restaurantId?: string, includeCompleted: boolean = false) {
    const params = new URLSearchParams();
    if (station && station !== 'all') params.append('station', station);
    if (includeCompleted) params.append('include_completed', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await this.request<{ items: KdsItemView[] }>(`/api/pos/kds/items${qs}`);
    return data.items || [];
  }

  async getStationTickets(station?: string, _restaurantId?: string, includeCompleted: boolean = false) {
    const params = new URLSearchParams();
    if (station && station !== 'all') params.append('station', station);
    if (includeCompleted) params.append('include_completed', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await this.request<{ tickets: KdsTicketView[] }>(`/api/pos/kds/tickets${qs}`);
    return data.tickets || [];
  }

  async getProductionSummary(station?: string, _restaurantId?: string) {
    const params = new URLSearchParams();
    if (station && station !== 'all') params.append('station', station);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await this.request<{ summary: KdsProductionSummaryItem[] }>(`/api/pos/kds/summary${qs}`);
    return data.summary || [];
  }

  async startPreparingTicket(orderId: string, station?: string, actor?: string) {
    const data = await this.request<{ items: OrderItem[] }>(`/api/pos/kds/tickets/${orderId}/prepare`, {
      method: 'POST',
      body: JSON.stringify({ station, actor }),
    });
    return data.items || [];
  }

  async markTicketReady(orderId: string, station?: string, actor?: string) {
    const data = await this.request<{ items: OrderItem[] }>(`/api/pos/kds/tickets/${orderId}/ready`, {
      method: 'POST',
      body: JSON.stringify({ station, actor }),
    });
    return data.items || [];
  }

  async deliverTicket(orderId: string, station?: string, actor?: string) {
    const data = await this.request<{ items: OrderItem[] }>(`/api/pos/kds/tickets/${orderId}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ station, actor }),
    });
    return data.items || [];
  }

  async recallTicket(orderId: string, station?: string, actor?: string) {
    const data = await this.request<{ items: OrderItem[] }>(`/api/pos/kds/tickets/${orderId}/recall`, {
      method: 'POST',
      body: JSON.stringify({ station, actor }),
    });
    return data.items || [];
  }

  async recallItem(itemId: string, actor?: string) {
    const data = await this.request<{ item: OrderItem }>(`/api/pos/kds/items/${itemId}/recall`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
    return data.item;
  }

  async listProducts(category?: string) {
    const url = category ? `/api/pos/products?category=${encodeURIComponent(category)}` : '/api/pos/products';
    const data = await this.request<{ products: Product[] }>(url);
    return data.products || [];
  }

  async listAllergies() {
    return await this.request<{ allergies: Allergy[]; ingredients: Ingredient[] }>('/api/pos/allergies');
  }

  async getCurrentShift() {
    return await this.request<any>('/api/cash/current');
  }

  async openShift(initialFloatCents: number, cashier?: string, notes?: string) {
    const data = await this.request<{ shift: CashShift }>('/api/cash/open', {
      method: 'POST',
      body: JSON.stringify({ initial_float_cents: initialFloatCents, cashier, notes }),
    });
    return data.shift;
  }

  async closeShift(actualCashCents: number, cashier?: string, notes?: string) {
    const data = await this.request<{ shift: CashShift }>('/api/cash/close', {
      method: 'POST',
      body: JSON.stringify({ actual_cash_cents: actualCashCents, cashier, notes }),
    });
    return data.shift;
  }

  async recordMovement(type: CashMovement['type'], amountCents: number, description: string, performer?: string) {
    const data = await this.request<{ movement: CashMovement }>('/api/cash/movement', {
      method: 'POST',
      body: JSON.stringify({ type, amount_cents: amountCents, description, performed_by: performer }),
    });
    return data.movement;
  }

  async listAuditEvents(limit: number = 50) {
    const data = await this.request<{ logs: AuditLog[] }>(`/api/audit/logs?limit=${limit}`);
    return data.logs || [];
  }

  async listPlugins() {
    const data = await this.request<{ plugins: any[] }>('/api/plugins');
    return data.plugins || [];
  }

  async togglePlugin(pluginId: string, enabled: boolean, actor?: string) {
    return await this.request<any>(`/api/plugins/${pluginId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled, actor }),
    });
  }

  // Inventory & Kardex (Core F6)
  async listInventoryItems(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    const data = await this.request<{ items: InventoryItem[] }>(`/api/inventory/items?${params.toString()}`);
    return data.items || [];
  }

  async getInventoryItem(itemId: string) {
    const data = await this.request<{ item: InventoryItem }>(`/api/inventory/items/${itemId}`);
    return data.item;
  }

  async getInventoryStock(itemId: string) {
    const data = await this.request<{ stock: any }>(`/api/inventory/items/${itemId}`);
    return data.stock;
  }

  async getKardex(itemId: string, filters?: any) {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.movement_type) params.append('movement_type', filters.movement_type);
    return await this.request<any>(`/api/inventory/items/${itemId}/kardex?${params.toString()}`);
  }

  async createInventoryMovement(params: any) {
    const data = await this.request<{ movement: InventoryMovement }>('/api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return data.movement;
  }

  async createInventoryAdjustment(params: any) {
    const data = await this.request<{ movement: InventoryMovement }>('/api/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return data.movement;
  }

  async createInventoryCount(params: any) {
    const data = await this.request<{ count: InventoryCount }>('/api/inventory/counts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return data.count;
  }

  async getInventoryAlerts() {
    const data = await this.request<{ alerts: InventoryAlert[] }>('/api/inventory/alerts');
    return data.alerts || [];
  }

  async getInventorySummary() {
    const data = await this.request<{ summary: InventorySummary }>('/api/inventory/summary');
    return data.summary;
  }

  async exportKardexCsv(itemId: string) {
    const res = await fetch(`/api/inventory/export/kardex/${itemId}`);
    return await res.text();
  }

  async exportInventoryCsv() {
    const res = await fetch('/api/inventory/export/items');
    return await res.text();
  }

  // Recipes, Ingredients & COGS (Core F7)
  async listRecipes(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.product_id) params.append('product_id', filters.product_id);
    if (filters?.search) params.append('search', filters.search);
    const data = await this.request<{ ok: boolean; data: any[] }>(`/api/recipes?${params.toString()}`);
    return data.data || [];
  }

  async getRecipe(recipeId: string) {
    const data = await this.request<{ ok: boolean; data: any }>(`/api/recipes/${recipeId}`);
    return data.data;
  }

  async getProductRecipe(productId: string) {
    const data = await this.request<{ ok: boolean; data: any }>(`/api/recipes/product/${productId}`);
    return data.data;
  }

  async createRecipe(payload: any, actor?: string) {
    const data = await this.request<{ ok: boolean; data: any }>('/api/recipes', {
      method: 'POST',
      headers: actor ? { 'x-actor': actor } : undefined,
      body: JSON.stringify(payload),
    });
    return data.data;
  }

  async updateRecipe(recipeId: string, payload: any, actor?: string) {
    const data = await this.request<{ ok: boolean; data: any }>(`/api/recipes/${recipeId}`, {
      method: 'PUT',
      headers: actor ? { 'x-actor': actor } : undefined,
      body: JSON.stringify(payload),
    });
    return data.data;
  }

  async deleteRecipe(recipeId: string, actor?: string) {
    const data = await this.request<{ ok: boolean; data: { deleted: boolean } }>(`/api/recipes/${recipeId}`, {
      method: 'DELETE',
      headers: actor ? { 'x-actor': actor } : undefined,
    });
    return data.data?.deleted ?? true;
  }

  async calculateRecipeCost(recipeId: string) {
    const data = await this.request<{ ok: boolean; data: any }>(`/api/recipes/${recipeId}/cost`);
    return data.data;
  }

  async getRecipeVersions(recipeId: string) {
    const data = await this.request<{ ok: boolean; data: any[] }>(`/api/recipes/${recipeId}/versions`);
    return data.data || [];
  }

  async getRecipeSummary() {
    const data = await this.request<{ ok: boolean; data: any }>('/api/recipes/summary');
    return data.data;
  }

  // Purchases & Suppliers (Core F8)
  async listSuppliers(restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ suppliers: any[] }>(`/api/purchases/suppliers?${params.toString()}`);
    return data.suppliers || [];
  }

  async getSupplier(supplierId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ supplier: any }>(`/api/purchases/suppliers/${supplierId}?${params.toString()}`);
    return data.supplier;
  }

  async createSupplier(payload: any, actor?: string, restaurantId?: string) {
    const data = await this.request<{ supplier: any }>('/api/purchases/suppliers', {
      method: 'POST',
      body: JSON.stringify({ ...payload, actor, restaurant_id: restaurantId }),
    });
    return data.supplier;
  }

  async updateSupplier(supplierId: string, payload: any, actor?: string, restaurantId?: string) {
    const data = await this.request<{ supplier: any }>(`/api/purchases/suppliers/${supplierId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, actor, restaurant_id: restaurantId }),
    });
    return data.supplier;
  }

  async deleteSupplier(supplierId: string, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    if (actor) params.append('actor', actor);
    const data = await this.request<{ success: boolean }>(`/api/purchases/suppliers/${supplierId}?${params.toString()}`, {
      method: 'DELETE',
    });
    return data.success ?? true;
  }

  async linkSupplierProduct(supplierId: string, product: any, actor?: string, restaurantId?: string) {
    const data = await this.request<{ supplier: any }>(`/api/purchases/suppliers/${supplierId}/products`, {
      method: 'POST',
      body: JSON.stringify({ product, actor, restaurant_id: restaurantId }),
    });
    return data.supplier;
  }

  async listPurchaseOrders(filters?: any, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.supplier_id) params.append('supplier_id', filters.supplier_id);
    if (filters?.search) params.append('search', filters.search);
    const data = await this.request<{ orders: any[] }>(`/api/purchases/orders?${params.toString()}`);
    return data.orders || [];
  }

  async getPurchaseOrder(orderId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ order: any }>(`/api/purchases/orders/${orderId}?${params.toString()}`);
    return data.order;
  }

  async createPurchaseOrder(payload: any, actor?: string, restaurantId?: string) {
    const data = await this.request<{ order: any }>('/api/purchases/orders', {
      method: 'POST',
      body: JSON.stringify({ ...payload, actor, restaurant_id: restaurantId }),
    });
    return data.order;
  }

  async updatePurchaseOrder(orderId: string, payload: any, actor?: string, restaurantId?: string) {
    const data = await this.request<{ order: any }>(`/api/purchases/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, actor, restaurant_id: restaurantId }),
    });
    return data.order;
  }

  async updateOrderStatus(orderId: string, status: any, actor?: string, restaurantId?: string) {
    const data = await this.request<{ order: any }>(`/api/purchases/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, actor, restaurant_id: restaurantId }),
    });
    return data.order;
  }

  async receivePurchaseOrder(orderId: string, receiptData: any, actor?: string, restaurantId?: string) {
    const data = await this.request<{
      purchase_order: any;
      receipt: any;
      movements: any[];
      price_changes: any[];
      margin_alerts: any[];
    }>(`/api/purchases/orders/${orderId}/receive`, {
      method: 'POST',
      body: JSON.stringify({ ...receiptData, actor, restaurant_id: restaurantId }),
    });
    return data;
  }

  async getPriceHistory(itemId?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    if (itemId) params.append('inventory_item_id', itemId);
    const data = await this.request<{ price_history: any[] }>(`/api/purchases/price-history?${params.toString()}`);
    return data.price_history || [];
  }

  async getPurchaseSummary(restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ summary: any }>(`/api/purchases/summary?${params.toString()}`);
    return data.summary;
  }

  // Staff, Roles, Permissions & Shifts (Core F10)
  async listStaffMembers(filters?: any, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    if (filters?.role_id) params.append('role_id', filters.role_id);
    if (filters?.search) params.append('search', filters.search);
    const data = await this.request<{ members: any[] }>(`/api/staff?${params.toString()}`);
    return data.members || [];
  }

  async getStaffMember(memberId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ member: any }>(`/api/staff/${memberId}?${params.toString()}`);
    return data.member;
  }

  async createStaffMember(data: any, actor?: string) {
    const res = await this.request<{ member: any }>('/api/staff', {
      method: 'POST',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.member;
  }

  async updateStaffMember(memberId: string, data: any, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ member: any }>(`/api/staff/${memberId}?${params.toString()}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.member;
  }

  async deactivateStaffMember(memberId: string, reason?: string, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ member: any }>(`/api/staff/${memberId}/deactivate?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ reason, actor }),
    });
    return res.member;
  }

  async activateStaffMember(memberId: string, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ member: any }>(`/api/staff/${memberId}/activate?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
    return res.member;
  }

  async getStaffMemberHistory(memberId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ history: any[] }>(`/api/staff/${memberId}/history?${params.toString()}`);
    return data.history || [];
  }

  async getStaffSummary(restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ summary: any }>(`/api/staff/summary/metrics?${params.toString()}`);
    return data.summary;
  }

  async listRoles(restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ roles: any[] }>(`/api/staff/roles/all?${params.toString()}`);
    return data.roles || [];
  }

  async getRole(roleId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ role: any }>(`/api/staff/roles/${roleId}?${params.toString()}`);
    return data.role;
  }

  async createRole(data: any, actor?: string) {
    const res = await this.request<{ role: any }>('/api/staff/roles', {
      method: 'POST',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.role;
  }

  async updateRole(roleId: string, data: any, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ role: any }>(`/api/staff/roles/${roleId}?${params.toString()}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.role;
  }

  async deleteRole(roleId: string, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ success: boolean }>(`/api/staff/roles/${roleId}?${params.toString()}`, {
      method: 'DELETE',
      body: JSON.stringify({ actor }),
    });
    return res.success;
  }

  async listPermissions() {
    const data = await this.request<{ permissions: any[] }>('/api/staff/permissions/all');
    return data.permissions || [];
  }

  async authorizePermission(userId: string, permission: string, restaurantId?: string) {
    const res = await this.request<any>('/api/staff/authorize', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, permission, restaurant_id: restaurantId }),
    });
    return res;
  }

  async listShifts(filters?: any, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    if (filters?.member_id) params.append('member_id', filters.member_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date) params.append('date', filters.date);
    const data = await this.request<{ shifts: any[] }>(`/api/staff/shifts/all?${params.toString()}`);
    return data.shifts || [];
  }

  async getShift(shiftId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ shift: any }>(`/api/staff/shifts/${shiftId}?${params.toString()}`);
    return data.shift;
  }

  async getActiveShift(memberId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ active_shift: any }>(`/api/staff/shifts/active/${memberId}?${params.toString()}`);
    return data.active_shift;
  }

  async scheduleShift(data: any, actor?: string) {
    const res = await this.request<{ shift: any }>('/api/staff/shifts/schedule', {
      method: 'POST',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.shift;
  }

  async startShift(data: any, actor?: string) {
    const res = await this.request<{ shift: any }>('/api/staff/shifts/start', {
      method: 'POST',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.shift;
  }

  async endShift(shiftId: string, notes?: string, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ shift: any }>(`/api/staff/shifts/${shiftId}/end?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ notes, actor }),
    });
    return res.shift;
  }

  async cancelShift(shiftId: string, reason?: string, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ shift: any }>(`/api/staff/shifts/${shiftId}/cancel?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ reason, actor }),
    });
    return res.shift;
  }

  async getRestaurantContext(userId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ context: any }>(`/api/staff/context/${userId}?${params.toString()}`);
    return data.context;
  }

  // Customers, CRM, Loyalty & Promotions (Core F11)
  async listCustomers(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.segment) params.append('segment', filters.segment);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    const data = await this.request<{ customers: any[] }>(`/api/customers?${params.toString()}`);
    return data.customers || [];
  }

  async getCustomer(customerId: string) {
    const data = await this.request<{ customer: any }>(`/api/customers/${customerId}`);
    return data.customer;
  }

  async findCustomerByPhoneOrEmail(query: string) {
    const params = new URLSearchParams({ search: query });
    const data = await this.request<{ customers: any[] }>(`/api/customers?${params.toString()}`);
    return data.customers?.[0];
  }

  async createCustomer(data: any, actor?: string) {
    const res = await this.request<{ customer: any }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.customer;
  }

  async updateCustomer(customerId: string, data: any, actor?: string) {
    const res = await this.request<{ customer: any }>(`/api/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.customer;
  }

  async getCustomerOrders(customerId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ orders: any[] }>(`/api/customers/${customerId}/orders?${params.toString()}`);
    return data.orders || [];
  }

  async getCustomerMetrics(customerId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ metrics: any }>(`/api/customers/${customerId}/metrics?${params.toString()}`);
    return data.metrics;
  }

  async addCustomerAddress(customerId: string, address: any, actor?: string) {
    const res = await this.request<{ address: any }>(`/api/customers/${customerId}/addresses`, {
      method: 'POST',
      body: JSON.stringify({ ...address, actor }),
    });
    return res.address;
  }

  async deleteCustomerAddress(customerId: string, addressId: string, actor?: string) {
    const res = await this.request<{ success: boolean }>(`/api/customers/${customerId}/addresses/${addressId}`, {
      method: 'DELETE',
    });
    return res.success;
  }

  async getLoyaltyAccount(customerId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ account: any }>(`/api/loyalty/account/${customerId}?${params.toString()}`);
    return data.account;
  }

  async getLoyaltyTransactions(customerId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ transactions: any[] }>(`/api/loyalty/transactions/${customerId}?${params.toString()}`);
    return data.transactions || [];
  }

  async listLoyaltyRewards(restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ rewards: any[] }>(`/api/loyalty/rewards?${params.toString()}`);
    return data.rewards || [];
  }

  async createLoyaltyReward(data: any, actor?: string) {
    const res = await this.request<{ reward: any }>('/api/loyalty/rewards', {
      method: 'POST',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.reward;
  }

  async redeemLoyaltyReward(customerId: string, rewardId: string, actor?: string, restaurantId?: string) {
    const res = await this.request<any>('/api/loyalty/redeem', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, reward_id: rewardId, actor, restaurant_id: restaurantId }),
    });
    return res;
  }

  async adjustLoyaltyPoints(customerId: string, points: number, reason: string, actor?: string, restaurantId?: string) {
    const res = await this.request<{ transaction: any }>('/api/loyalty/adjust', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, points, reason, actor, restaurant_id: restaurantId }),
    });
    return res.transaction;
  }

  async earnLoyaltyPoints(orderId: string, actor?: string) {
    const res = await this.request<{ transaction: any }>(`/api/loyalty/orders/${orderId}/earn`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
    return res.transaction;
  }

  async reverseLoyaltyPoints(orderId: string, reason?: string, actor?: string) {
    const res = await this.request<{ transaction: any }>(`/api/loyalty/orders/${orderId}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason, actor }),
    });
    return res.transaction;
  }

  async listPromotions(restaurantId?: string, onlyActive?: boolean) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    if (onlyActive) params.append('active', 'true');
    const data = await this.request<{ promotions: any[] }>(`/api/promotions?${params.toString()}`);
    return data.promotions || [];
  }

  async getPromotion(promotionId: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ promotion: any }>(`/api/promotions/${promotionId}?${params.toString()}`);
    return data.promotion;
  }

  async createPromotion(data: any, actor?: string) {
    const res = await this.request<{ promotion: any }>('/api/promotions', {
      method: 'POST',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.promotion;
  }

  async updatePromotion(promotionId: string, data: any, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ promotion: any }>(`/api/promotions/${promotionId}?${params.toString()}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, actor }),
    });
    return res.promotion;
  }

  async deletePromotion(promotionId: string, actor?: string, restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ success: boolean }>(`/api/promotions/${promotionId}?${params.toString()}`, {
      method: 'DELETE',
      body: JSON.stringify({ actor }),
    });
    return res.success;
  }

  async validateCoupon(code: string, subtotalCents: number, customerId?: string, restaurantId?: string) {
    const res = await this.request<any>('/api/promotions/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal_cents: subtotalCents, customer_id: customerId, restaurant_id: restaurantId }),
    });
    return res;
  }

  async applyPromotionToOrder(orderId: string, code: string, actor?: string) {
    const res = await this.request<any>('/api/promotions/apply-to-order', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, code, actor }),
    });
    return res;
  }

  async getCrmSummary(restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const data = await this.request<{ summary: any }>(`/api/crm/summary?${params.toString()}`);
    return data.summary;
  }

  // Payments & Finance (F12 / F12.1)
  async listPayments(restaurantId?: string, filters?: { table_session_id?: string }) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    if (filters?.table_session_id) params.append('table_session_id', filters.table_session_id);
    const res = await this.request<{ payments: Payment[] }>(`/api/finance/payments?${params.toString()}`);
    return res.payments;
  }

  async recordPaymentStrict(input: RecordPaymentInput) {
    const res = await this.request<{ payment: Payment; idempotency_replayed: boolean }>(`/api/finance/payments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res;
  }

  async refundPayment(input: RefundPaymentInput) {
    const res = await this.request<{ payment: Payment }>(`/api/finance/payments/${input.payment_id}/refund`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.payment;
  }

  async listExpenses(restaurantId?: string, filters?: { category?: ExpenseCategory; payment_method?: PaymentMethod }) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.payment_method) params.append('payment_method', filters.payment_method);
    const res = await this.request<{ expenses: Expense[] }>(`/api/finance/expenses?${params.toString()}`);
    return res.expenses;
  }

  async createExpense(dto: CreateExpenseDTO) {
    const res = await this.request<{ expense: Expense }>(`/api/finance/expenses`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
    return res.expense;
  }

  async getFinancialLedger(filters?: FinancialMovementFilter) {
    const params = new URLSearchParams();
    if (filters?.restaurant_id) params.append('restaurant_id', filters.restaurant_id);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.direction) params.append('direction', filters.direction);
    if (filters?.payment_method) params.append('payment_method', filters.payment_method);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    const res = await this.request<{ movements: FinancialMovement[] }>(`/api/finance/ledger?${params.toString()}`);
    return res.movements;
  }

  async getOperatingPnL(restaurantId?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const res = await this.request<{ pnl: OperatingPnL }>(`/api/finance/pnl?${params.toString()}`);
    return res.pnl;
  }

  async getZCutReport(shiftId: string, restaurantId?: string) {
    const res = await this.request<{ z_cut: ZCutReport }>(`/api/finance/cash/close`, {
      method: 'POST',
      body: JSON.stringify({ actual_cash_cents: 0, notes: 'Consulta de corte Z', restaurant_id: restaurantId }),
    });
    return res.z_cut;
  }

  async listRestaurantSettlements(restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ settlements: RestaurantSettlement[] }>(`/api/finance/settlements/restaurant?${params.toString()}`);
    return res.settlements;
  }

  async createRestaurantSettlement(data: Omit<RestaurantSettlement, 'id' | 'created_at'>, userId?: string) {
    const res = await this.request<{ settlement: RestaurantSettlement }>(`/api/finance/settlements/restaurant`, {
      method: 'POST',
      body: JSON.stringify({ ...data, user_id: userId }),
    });
    return res.settlement;
  }

  async listDriverSettlements(restaurantId?: string) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurant_id', restaurantId);
    const res = await this.request<{ settlements: DriverSettlement[] }>(`/api/finance/settlements/driver?${params.toString()}`);
    return res.settlements;
  }

  async createDriverSettlement(data: Omit<DriverSettlement, 'id' | 'created_at'>, userId?: string) {
    const res = await this.request<{ settlement: DriverSettlement }>(`/api/finance/settlements/driver`, {
      method: 'POST',
      body: JSON.stringify({ ...data, user_id: userId }),
    });
    return res.settlement;
  }

  // ==========================================
  // Solutions & Entitlements (F13)
  // ==========================================

  async listSolutions(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.commercial_availability) params.append('commercial_availability', filters.commercial_availability);
    const res = await this.request<{ solutions: Solution[] }>(`/api/solutions?${params.toString()}`);
    return res.solutions;
  }

  async getSolution(solutionId: string) {
    const res = await this.request<{ solution: Solution }>(`/api/solutions/${solutionId}`);
    return res.solution;
  }

  async listCapabilities(solutionId?: string) {
    const params = new URLSearchParams();
    if (solutionId) params.append('solution_id', solutionId);
    const res = await this.request<{ capabilities: Capability[] }>(`/api/solutions/capabilities?${params.toString()}`);
    return res.capabilities;
  }

  async listPlans(onlyActive?: boolean) {
    const res = await this.request<{ plans: CommercialPlan[] }>(`/api/solutions/plans/all?active=${Boolean(onlyActive)}`);
    return res.plans;
  }

  async getPlan(planIdOrCode: string) {
    const res = await this.request<{ plan: CommercialPlan }>(`/api/solutions/plans/${planIdOrCode}`);
    return res.plan;
  }

  async createPlan(data: any) {
    const res = await this.request<{ plan: CommercialPlan }>(`/api/solutions/plans`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.plan;
  }

  async getRestaurantEntitlements(restaurantId: string = 'rest_directaurante_01', onlyActive?: boolean) {
    const res = await this.request<{ entitlements: Entitlement[] }>(
      `/api/solutions/restaurants/${restaurantId}/entitlements?active=${onlyActive !== false}`
    );
    return res.entitlements;
  }

  async grantEntitlement(data: any, restaurantId: string = 'rest_directaurante_01') {
    const res = await this.request<{ entitlement: Entitlement }>(
      `/api/solutions/restaurants/${restaurantId}/entitlements`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return res.entitlement;
  }

  async revokeEntitlement(entitlementId: string, restaurantId: string = 'rest_directaurante_01') {
    const res = await this.request<{ success: boolean }>(
      `/api/solutions/restaurants/${restaurantId}/entitlements/${entitlementId}`,
      { method: 'DELETE' }
    );
    return res.success;
  }

  async suspendEntitlement(entitlementId: string, restaurantId: string = 'rest_directaurante_01') {
    const res = await this.request<{ entitlement: Entitlement }>(
      `/api/solutions/restaurants/${restaurantId}/entitlements/${entitlementId}/suspend`,
      { method: 'PATCH' }
    );
    return res.entitlement;
  }

  async activateEntitlement(entitlementId: string, restaurantId: string = 'rest_directaurante_01') {
    const res = await this.request<{ entitlement: Entitlement }>(
      `/api/solutions/restaurants/${restaurantId}/entitlements/${entitlementId}/activate`,
      { method: 'PATCH' }
    );
    return res.entitlement;
  }

  async assignPlan(planId: string, restaurantId: string = 'rest_directaurante_01', source?: EntitlementSource) {
    const res = await this.request<{ entitlements: Entitlement[] }>(
      `/api/solutions/restaurants/${restaurantId}/plans/${planId}/assign`,
      {
        method: 'POST',
        body: JSON.stringify({ source }),
      }
    );
    return res.entitlements;
  }

  async isSolutionEnabled(solutionId: string, restaurantId: string = 'rest_directaurante_01') {
    const res = await this.request<{ check: { has_access: boolean } }>(
      `/api/solutions/restaurants/${restaurantId}/check?solution_id=${solutionId}`
    );
    return Boolean(res.check?.has_access);
  }

  async hasCapability(capability: string, restaurantId: string = 'rest_directaurante_01') {
    const res = await this.request<{ check: { has_access: boolean } }>(
      `/api/solutions/restaurants/${restaurantId}/check?capability=${capability}`
    );
    return Boolean(res.check?.has_access);
  }

  async checkCapability(capability: string, restaurantId: string = 'rest_directaurante_01') {
    const res = await this.request<{ check: EntitlementCheckResult }>(
      `/api/solutions/restaurants/${restaurantId}/check?capability=${capability}`
    );
    return res.check;
  }

  async authorizeAction(
    userId: string | undefined,
    permission?: Permission,
    capability?: string,
    restaurantId: string = 'rest_directaurante_01'
  ) {
    const res = await this.request<ActionAuthorizationResult>(`/api/solutions/authorize`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        permission,
        capability,
        restaurant_id: restaurantId,
      }),
    });
    return res;
  }
}


