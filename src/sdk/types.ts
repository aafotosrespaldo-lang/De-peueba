/**
 * DIRECTAURANTE POS & COMANDERO - Unified SDK Types & Contracts
 * Pure TypeScript contract layer. Ensures 100% type safety and zero duplication.
 */

import {
  Table,
  TableSession,
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
  Recipe,
  RecipeItem,
  RecipeModifierItem,
  RecipeVersionRecord,
  RecipeCostCalculation,
  RecipeSummary,
  Supplier,
  SupplierProduct,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseReceipt,
  PriceHistoryRecord,
  PurchaseSummary,
  User,
  RestaurantMember,
  Role,
  Permission,
  Shift,
  ShiftStatus,
  MemberHistoryRecord,
  CurrentRestaurantContext,
  StaffSummary,
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
  Expense,
  ExpenseCategory,
  FinancialMovement,
  FinancialMovementType,
  RestaurantSettlement,
  DriverSettlement,
  DriverProfile,
  DeliveryDispatch,
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
  Printer,
  PrintJob,
} from '../core/types';
import type {
  RecordPaymentInput,
  RefundPaymentInput,
  CreateExpenseDTO,
  CashSessionOpenDTO,
  CashSessionCloseDTO,
  FinancialMovementFilter,
} from '../modules/finance/financeService';
import type {
  RegisterSolutionDTO,
  CreatePlanDTO,
  GrantEntitlementDTO,
} from '../modules/solutions/solutionService';
import type { CreateRecipeDTO, UpdateRecipeDTO } from '../modules/recipes/recipeService';
import type {
  CreateSupplierDTO,
  CreatePurchaseOrderDTO,
  ReceivePurchaseOrderDTO,
  MarginImpactAlert,
} from '../modules/purchases/purchaseService';
import type {
  CreateMemberDTO,
  UpdateMemberDTO,
  CreateRoleDTO,
  UpdateRoleDTO,
  CreateShiftDTO,
  StartShiftDTO,
  AuthCheckResult,
} from '../modules/staff/staffService';
import type {
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CreateRewardDTO,
  CreatePromotionDTO,
} from '../modules/crm/crmService';

export interface TablesSdk {
  listTables(restaurantId?: string): Promise<
    Array<
      Table & {
        guests_count: number;
        active_items_count: number;
        total_cents: number;
        active_session?: TableSession;
      }
    >
  >;
  getTable(
    tableId: string,
    restaurantId?: string
  ): Promise<{
    table: Table;
    session: TableSession | null;
    subaccounts: GuestSubaccount[];
    orders: Order[];
    order: Order | null;
    items: OrderItem[];
  }>;
  openTableSession(
    tableId: string,
    waiterName: string,
    initialGuests?: Array<{ name: string; allergy_ids?: string[] }>,
    restaurantId?: string
  ): Promise<{
    table: Table;
    session: TableSession;
    order: Order;
    orders: Order[];
    subaccounts: GuestSubaccount[];
  }>;
  getActiveSession(tableId: string, restaurantId?: string): Promise<TableSession | null>;
  closeTableSession(
    tableIdOrSessionId: string,
    actor?: string,
    restaurantId?: string
  ): Promise<{
    success: boolean;
    table: Table;
    session: TableSession;
    total_cents: number;
    paid_cents: number;
  }>;
}

export interface GuestsSdk {
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
}

export interface OrdersSdk {
  createOrderTicket(
    tableIdOrSessionId: string,
    waiterName?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<Order>;
  createPosOrder(
    data: {
      server_id?: string;
      customer_id?: string;
      notes?: string;
      ticket_number?: string;
      table_id?: string;
      table_session_id?: string;
    },
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
  ): Promise<{
    item: OrderItem;
    allergy_warning?: boolean;
    conflicts?: any[];
  }>;
  getOrder(orderId: string, restaurantId?: string): Promise<Order & { items: OrderItem[] }>;
  updateOrderStatus(
    orderId: string,
    status: Order['status'],
    actor?: string,
    reason?: string,
    restaurantId?: string
  ): Promise<Order>;
  cancelOrder(orderId: string, reason?: string, actor?: string, restaurantId?: string): Promise<Order>;
  updateOrderItem(
    itemId: string,
    updates: Partial<OrderItem>,
    actor?: string,
    restaurantId?: string
  ): Promise<OrderItem>;
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
}

export interface BillsSdk {
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
}

export interface KdsSdk {
  getKitchenItems(restaurantId?: string): Promise<KdsItemView[]>;
  getStationItems(station?: string, restaurantId?: string, includeCompleted?: boolean): Promise<KdsItemView[]>;
  getStationTickets(station?: string, restaurantId?: string, includeCompleted?: boolean): Promise<KdsTicketView[]>;
  getProductionSummary(station?: string, restaurantId?: string): Promise<KdsProductionSummaryItem[]>;
  updateItemStatus(
    itemId: string,
    status: OrderItemStatus,
    actor?: string,
    notes?: string,
    restaurantId?: string
  ): Promise<OrderItem>;
  acknowledgeItem(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;
  markItemReady(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;
  markItemDelivered(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;
  startPreparingTicket(orderId: string, station?: string, actor?: string, restaurantId?: string): Promise<OrderItem[]>;
  markTicketReady(orderId: string, station?: string, actor?: string, restaurantId?: string): Promise<OrderItem[]>;
  deliverTicket(orderId: string, station?: string, actor?: string, restaurantId?: string): Promise<OrderItem[]>;
  recallTicket(orderId: string, station?: string, actor?: string, restaurantId?: string): Promise<OrderItem[]>;
  recallItem(itemId: string, actor?: string, restaurantId?: string): Promise<OrderItem>;
}

export interface CashSdk {
  getCurrentShift(
    restaurantId?: string
  ): Promise<{
    shift: CashShift | null;
    movements: CashMovement[];
    totals: { sales_cents: number; expenses_cents: number; withdrawals_cents: number; net_cash_cents: number };
  }>;
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
}

export interface CatalogSdk {
  listProducts(category?: string, restaurantId?: string): Promise<Product[]>;
  listAllergies(): Promise<{ allergies: Allergy[]; ingredients: Ingredient[] }>;
}

export interface AuditSdk {
  listAuditEvents(limit?: number, entityType?: string, restaurantId?: string): Promise<AuditLog[]>;
}

export interface PluginsSdk {
  listPlugins(
    restaurantId?: string
  ): Promise<Array<PluginDefinition & { enabled: boolean; settings: Record<string, any> }>>;
  getPluginState(pluginId: string, restaurantId?: string): Promise<boolean>;
  togglePlugin(pluginId: string, enabled: boolean, actor?: string, restaurantId?: string): Promise<any>;
}

export interface InventorySdk {
  listItems(
    filters?: {
      category?: string;
      search?: string;
      status?: 'all' | 'low_stock' | 'out_of_stock' | 'normal';
    },
    restaurantId?: string
  ): Promise<InventoryItem[]>;
  getItem(itemId: string, restaurantId?: string): Promise<InventoryItem | undefined>;
  getStock(
    itemId: string,
    restaurantId?: string
  ): Promise<{ current_stock: number; min_stock: number; is_low: boolean; is_out: boolean }>;
  getKardex(
    itemId: string,
    filters?: { start_date?: string; end_date?: string; movement_type?: string },
    restaurantId?: string
  ): Promise<{
    item: InventoryItem;
    movements: Array<InventoryMovement & { in_qty: number; out_qty: number; running_balance: number }>;
    current_stock: number;
    total_entries: number;
    total_exits: number;
  }>;
  createMovement(params: {
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
  createAdjustment(params: {
    inventory_item_id: string;
    type: 'adjustment_in' | 'adjustment_out' | 'waste';
    quantity: number;
    reason: string;
    actor?: string;
    restaurantId?: string;
  }): Promise<InventoryMovement>;
  createCount(params: {
    performed_by: string;
    notes?: string;
    counts: Array<{ inventory_item_id: string; counted_stock: number; reason?: string }>;
    restaurantId?: string;
  }): Promise<InventoryCount>;
  getAlerts(restaurantId?: string): Promise<InventoryAlert[]>;
  getSummary(restaurantId?: string): Promise<InventorySummary>;
  exportKardexCsv(itemId: string, restaurantId?: string): Promise<string>;
  exportInventoryCsv(restaurantId?: string): Promise<string>;
}

export interface RecipesSdk {
  listRecipes(
    filters?: { product_id?: string; search?: string },
    restaurantId?: string
  ): Promise<Array<Recipe & { cost_calculation?: RecipeCostCalculation }>>;
  getRecipe(
    recipeId: string,
    restaurantId?: string
  ): Promise<(Recipe & { cost_calculation?: RecipeCostCalculation }) | undefined>;
  getProductRecipe(
    productId: string,
    restaurantId?: string
  ): Promise<(Recipe & { cost_calculation?: RecipeCostCalculation }) | undefined>;
  createRecipe(
    data: CreateRecipeDTO,
    actor?: string,
    restaurantId?: string
  ): Promise<Recipe & { cost_calculation?: RecipeCostCalculation }>;
  updateRecipe(
    recipeId: string,
    data: UpdateRecipeDTO,
    actor?: string,
    restaurantId?: string
  ): Promise<Recipe & { cost_calculation?: RecipeCostCalculation }>;
  deleteRecipe(recipeId: string, actor?: string, restaurantId?: string): Promise<boolean>;
  calculateCost(recipeId: string, restaurantId?: string): Promise<RecipeCostCalculation>;
  getRecipeVersions(recipeId: string, restaurantId?: string): Promise<RecipeVersionRecord[]>;
  getSummary(restaurantId?: string): Promise<RecipeSummary>;
}

export interface PurchasesSdk {
  listSuppliers(restaurantId?: string): Promise<Supplier[]>;
  getSupplier(supplierId: string, restaurantId?: string): Promise<Supplier | undefined>;
  createSupplier(data: CreateSupplierDTO, actor?: string, restaurantId?: string): Promise<Supplier>;
  updateSupplier(supplierId: string, data: Partial<CreateSupplierDTO>, actor?: string, restaurantId?: string): Promise<Supplier>;
  deleteSupplier(supplierId: string, actor?: string, restaurantId?: string): Promise<boolean>;
  linkSupplierProduct(supplierId: string, product: SupplierProduct, actor?: string, restaurantId?: string): Promise<Supplier>;
  listPurchaseOrders(
    filters?: { status?: PurchaseOrderStatus; supplier_id?: string; search?: string },
    restaurantId?: string
  ): Promise<PurchaseOrder[]>;
  getPurchaseOrder(orderId: string, restaurantId?: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(data: CreatePurchaseOrderDTO, actor?: string, restaurantId?: string): Promise<PurchaseOrder>;
  updatePurchaseOrder(orderId: string, data: Partial<PurchaseOrder>, actor?: string, restaurantId?: string): Promise<PurchaseOrder>;
  updateOrderStatus(orderId: string, status: PurchaseOrderStatus, actor?: string, restaurantId?: string): Promise<PurchaseOrder>;
  receivePurchaseOrder(
    orderId: string,
    receiptData: ReceivePurchaseOrderDTO,
    actor?: string,
    restaurantId?: string
  ): Promise<{
    purchase_order: PurchaseOrder;
    receipt: PurchaseReceipt;
    movements: InventoryMovement[];
    price_changes: PriceHistoryRecord[];
    margin_alerts: MarginImpactAlert[];
  }>;
  getPriceHistory(itemId?: string, restaurantId?: string): Promise<PriceHistoryRecord[]>;
  getSummary(restaurantId?: string): Promise<PurchaseSummary>;
}

export interface StaffSdk {
  listMembers(filters?: { is_active?: boolean; role_id?: string; search?: string }, restaurantId?: string): Promise<(RestaurantMember & { role_name: string; user_name: string })[]>;
  getMember(memberId: string, restaurantId?: string): Promise<(RestaurantMember & { role_name: string; user_name: string; role?: Role }) | undefined>;
  createMember(data: CreateMemberDTO, actor?: string): Promise<RestaurantMember>;
  updateMember(memberId: string, data: UpdateMemberDTO, actor?: string, restaurantId?: string): Promise<RestaurantMember>;
  deactivateMember(memberId: string, reason?: string, actor?: string, restaurantId?: string): Promise<RestaurantMember>;
  activateMember(memberId: string, actor?: string, restaurantId?: string): Promise<RestaurantMember>;
  getMemberHistory(memberId: string, restaurantId?: string): Promise<MemberHistoryRecord[]>;
  getSummary(restaurantId?: string): Promise<StaffSummary>;
}

export interface RolesSdk {
  listRoles(restaurantId?: string): Promise<Role[]>;
  getRole(roleId: string, restaurantId?: string): Promise<Role | undefined>;
  createRole(data: CreateRoleDTO, actor?: string): Promise<Role>;
  updateRole(roleId: string, data: UpdateRoleDTO, actor?: string, restaurantId?: string): Promise<Role>;
  deleteRole(roleId: string, actor?: string, restaurantId?: string): Promise<boolean>;
}

export interface PermissionsSdk {
  listPermissions(): Promise<{ permission: Permission; label: string; category: string; description: string }[]>;
  authorize(userId: string, permission: Permission, restaurantId?: string): Promise<AuthCheckResult>;
}

export interface ShiftsSdk {
  listShifts(filters?: { member_id?: string; status?: ShiftStatus; date?: string }, restaurantId?: string): Promise<(Shift & { member_name: string; role_name: string })[]>;
  getShift(shiftId: string, restaurantId?: string): Promise<(Shift & { member_name: string; role_name: string }) | undefined>;
  getActiveShift(memberId: string, restaurantId?: string): Promise<Shift | undefined>;
  scheduleShift(data: CreateShiftDTO, actor?: string): Promise<Shift>;
  startShift(data: StartShiftDTO, actor?: string): Promise<Shift>;
  endShift(shiftId: string, notes?: string, actor?: string, restaurantId?: string): Promise<Shift>;
  cancelShift(shiftId: string, reason?: string, actor?: string, restaurantId?: string): Promise<Shift>;
}

export interface CustomersSdk {
  listCustomers(filters?: { search?: string; segment?: CustomerSegment; is_active?: boolean }): Promise<(CustomerProfile & { metrics: CustomerMetrics })[]>;
  getCustomer(customerId: string): Promise<(CustomerProfile & { metrics: CustomerMetrics }) | undefined>;
  findByPhoneOrEmail(query: string): Promise<(CustomerProfile & { metrics: CustomerMetrics }) | undefined>;
  createCustomer(data: CreateCustomerDTO, actor?: string): Promise<CustomerProfile>;
  updateCustomer(customerId: string, data: UpdateCustomerDTO, actor?: string): Promise<CustomerProfile>;
  getOrders(customerId: string, restaurantId?: string): Promise<Order[]>;
  getMetrics(customerId: string, restaurantId?: string): Promise<CustomerMetrics>;
  addAddress(customerId: string, address: Partial<CustomerAddress>, actor?: string): Promise<CustomerAddress>;
  deleteAddress(customerId: string, addressId: string, actor?: string): Promise<boolean>;
}

export interface LoyaltySdk {
  getAccount(customerId: string, restaurantId?: string): Promise<LoyaltyAccount>;
  getTransactions(customerId: string, restaurantId?: string): Promise<LoyaltyTransaction[]>;
  listRewards(restaurantId?: string): Promise<LoyaltyReward[]>;
  createReward(data: CreateRewardDTO, actor?: string): Promise<LoyaltyReward>;
  redeemReward(customerId: string, rewardId: string, actor?: string, restaurantId?: string): Promise<{ reward: LoyaltyReward; transaction: LoyaltyTransaction; new_balance: number }>;
  adjustPoints(customerId: string, pointsDelta: number, reason: string, actor: string, restaurantId?: string): Promise<LoyaltyTransaction>;
  earnPointsForOrder(orderId: string, actor?: string): Promise<LoyaltyTransaction>;
  reversePointsForOrder(orderId: string, reason?: string, actor?: string): Promise<LoyaltyTransaction | null>;
}

export interface PromotionsSdk {
  listPromotions(restaurantId?: string, onlyActive?: boolean): Promise<Promotion[]>;
  getPromotion(promotionId: string, restaurantId?: string): Promise<Promotion | undefined>;
  createPromotion(data: CreatePromotionDTO, actor?: string): Promise<Promotion>;
  updatePromotion(promotionId: string, data: Partial<CreatePromotionDTO>, actor?: string, restaurantId?: string): Promise<Promotion>;
  deletePromotion(promotionId: string, actor?: string, restaurantId?: string): Promise<boolean>;
  validateCoupon(code: string, subtotalCents: number, customerId?: string, restaurantId?: string): Promise<{ valid: boolean; promotion?: Promotion; discount_cents: number; reason?: string }>;
  applyToOrder(orderId: string, codeOrId: string, actor?: string): Promise<{ order: Order; promotion: Promotion; discount_cents: number }>;
}

export interface CrmSdk {
  getSummary(restaurantId?: string): Promise<CrmSummary>;
  getMetrics(customerId: string, restaurantId?: string): Promise<CustomerMetrics>;
}

export interface PaymentsSdk {
  listPayments(restaurantId?: string, filters?: { table_session_id?: string }): Promise<Payment[]>;
  recordPayment(input: RecordPaymentInput): Promise<{ payment: Payment; idempotency_replayed: boolean }>;
  refundPayment(input: RefundPaymentInput): Promise<Payment>;
}

export interface ExpensesSdk {
  listExpenses(restaurantId?: string, filters?: { category?: ExpenseCategory; payment_method?: PaymentMethod }): Promise<Expense[]>;
  createExpense(dto: CreateExpenseDTO): Promise<Expense>;
}

export interface FinancialSdk {
  getLedger(filters?: FinancialMovementFilter): Promise<FinancialMovement[]>;
  getPnL(restaurantId?: string, startDate?: string, endDate?: string): Promise<OperatingPnL>;
}

export interface ReportsSdk {
  getOperatingPnL(restaurantId?: string, startDate?: string, endDate?: string): Promise<OperatingPnL>;
  getZCutReport(shiftId: string, restaurantId?: string): Promise<ZCutReport>;
}

export interface SettlementsSdk {
  listRestaurantSettlements(restaurantId?: string): Promise<RestaurantSettlement[]>;
  createRestaurantSettlement(data: Omit<RestaurantSettlement, 'id' | 'created_at'>, userId?: string): Promise<RestaurantSettlement>;
  listDriverSettlements(restaurantId?: string): Promise<DriverSettlement[]>;
  createDriverSettlement(data: Omit<DriverSettlement, 'id' | 'created_at'>, userId?: string): Promise<DriverSettlement>;
}

export interface SolutionsSdk {
  listSolutions(filters?: {
    status?: SolutionStatus;
    category?: string;
    commercial_availability?: CommercialAvailability;
  }): Promise<Solution[]>;
  getSolution(solutionId: string): Promise<Solution | undefined>;
  listCapabilities(solutionId?: string): Promise<Capability[]>;
  listPlans(onlyActive?: boolean): Promise<CommercialPlan[]>;
  getPlan(planIdOrCode: string): Promise<CommercialPlan | undefined>;
  createPlan(data: CreatePlanDTO): Promise<CommercialPlan>;
  getRestaurantEntitlements(restaurantId?: string, onlyActive?: boolean): Promise<Entitlement[]>;
  grantEntitlement(data: GrantEntitlementDTO, restaurantId?: string): Promise<Entitlement>;
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

export interface DeliverySdk {
  listDrivers(
    restaurantId?: string,
    filters?: { status?: DriverProfile['status']; is_verified?: boolean }
  ): Promise<DriverProfile[]>;
  getDriver(driverId: string, restaurantId?: string): Promise<DriverProfile | null>;
  createDriver(
    data: {
      name: string;
      phone: string;
      email?: string;
      vehicle_type: DriverProfile['vehicle_type'];
      license_plate?: string;
      is_verified?: boolean;
    },
    actor?: string,
    restaurantId?: string
  ): Promise<DriverProfile>;
  verifyDriver(driverId: string, isVerified: boolean, actor?: string, restaurantId?: string): Promise<DriverProfile>;
  updateDriverGps(driverId: string, gps: { latitude: number; longitude: number }, restaurantId?: string): Promise<DriverProfile>;
  findEligibleDrivers(restaurantId?: string, maxGpsAgeMinutes?: number): Promise<DriverProfile[]>;
  dispatchOrder(data: {
    order_id: string;
    delivery_address: string;
    delivery_fee_cents?: number;
    cash_to_collect_cents?: number;
    driver_id?: string;
    offer_timeout_seconds?: number;
    actor?: string;
    restaurant_id?: string;
  }): Promise<DeliveryDispatch>;
  markDelivered(dispatchId: string, actor?: string, restaurantId?: string): Promise<DeliveryDispatch>;
  listDispatches(
    restaurantId?: string,
    filters?: { status?: DeliveryDispatch['status']; driver_id?: string; order_id?: string }
  ): Promise<DeliveryDispatch[]>;
}

export interface PrintSdk {
  listPrintJobs(
    restaurantId?: string,
    filters?: { status?: string; printer_id?: string; station?: string }
  ): Promise<PrintJob[]>;
  createPrintJob(
    params: {
      type: PrintJob['type'];
      station: string;
      printer_id?: string;
      order_id?: string;
      table_id?: string;
      table_number?: string;
      formatted_content: string;
      escpos_hex?: string;
      paper_width?: 58 | 80;
      status?: PrintJob['status'];
      actor?: string;
    },
    restaurantId?: string
  ): Promise<PrintJob>;
  updatePrintJobStatus(
    jobId: string,
    status: PrintJob['status'],
    errorMessage?: string,
    restaurantId?: string
  ): Promise<PrintJob>;
  listPrinters(restaurantId?: string): Promise<Printer[]>;
}

export interface IDirectauranteSDK {
  tables: TablesSdk;
  guests: GuestsSdk;
  orders: OrdersSdk;
  bills: BillsSdk;
  payments: PaymentsSdk;
  kds: KdsSdk;
  catalog: CatalogSdk;
  cash: CashSdk;
  expenses: ExpensesSdk;
  financial: FinancialSdk;
  reports: ReportsSdk;
  settlements: SettlementsSdk;
  audit: AuditSdk;
  plugins: PluginsSdk;
  inventory: InventorySdk;
  recipes: RecipesSdk;
  purchases: PurchasesSdk;
  staff: StaffSdk;
  roles: RolesSdk;
  permissions: PermissionsSdk;
  shifts: ShiftsSdk;
  customers: CustomersSdk;
  loyalty: LoyaltySdk;
  promotions: PromotionsSdk;
  crm: CrmSdk;
  solutions: SolutionsSdk;
  delivery: DeliverySdk;
  print: PrintSdk;
  getContext(userId: string, restaurantId?: string): Promise<CurrentRestaurantContext>;
}


