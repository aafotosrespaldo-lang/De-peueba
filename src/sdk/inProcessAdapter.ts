/**
 * DIRECTAURANTE POS & COMANDERO - In-Process Directaurante SDK Adapter
 * Allows executing all SDK calls natively in Node.js, test suites, or direct memory environments.
 */

import { DirectauranteSdkAdapter } from './adapter';
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
  Allergy,
  Ingredient,
  KdsItemView,
  KdsTicketView,
  KdsProductionSummaryItem,
  DEFAULT_RESTAURANT_ID,
  Permission,
  EntitlementSource,
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
  PrintJob,
  Printer,
} from '../core/types';
import { PosService } from '../modules/pos/posService';
import { KdsService } from '../modules/kds/kdsService';
import { CashService } from '../modules/cash/cashService';
import { InventoryService } from '../modules/inventory/inventoryService';
import { RecipeService } from '../modules/recipes/recipeService';
import { PurchaseService } from '../modules/purchases/purchaseService';
import { StaffService } from '../modules/staff/staffService';
import { CrmService } from '../modules/crm/crmService';
import { FinanceService } from '../modules/finance/financeService';
import { SolutionService } from '../modules/solutions/solutionService';
import { DeliveryService } from '../modules/delivery/deliveryService';
import { PrintService } from '../modules/directprint/printService';
import type {
  RecordPaymentInput,
  RefundPaymentInput,
  CreateExpenseDTO,
  FinancialMovementFilter,
} from '../modules/finance/financeService';
import { PluginRegistry } from '../core/pluginRegistry';
import { AuditService } from '../core/audit';
import { db } from '../core/database';

export class InProcessDirectauranteAdapter implements DirectauranteSdkAdapter {
  async listTables(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.getTables(restaurantId);
  }

  async getTable(tableId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.getTableDetails(tableId, restaurantId);
  }

  async openTableSession(
    tableId: string,
    waiterName: string,
    initialGuests?: Array<{ name: string; allergy_ids?: string[] }>,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.openTable(tableId, waiterName, initialGuests, restaurantId);
  }

  async closeTableSession(tableIdOrSessionId: string, actor: string = 'Cajero', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.closeTable(tableIdOrSessionId, actor, restaurantId);
  }

  async listSubaccounts(tableIdOrSessionId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const details = PosService.getTableDetails(tableIdOrSessionId, restaurantId);
    return details.subaccounts || [];
  }

  async createSubaccount(
    tableIdOrSessionId: string,
    displayName: string,
    allergyIds: string[] = [],
    notes?: string,
    actor: string = 'Mesero',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    const seat = PosService.addGuestSubaccount(tableIdOrSessionId, displayName, allergyIds, notes, actor, restaurantId);
    return seat;
  }

  async updateSubaccount(
    subaccountId: string,
    updates: Partial<GuestSubaccount>,
    _actor: string = 'Mesero',
    _restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    const subaccounts = db.get('guest_subaccounts');
    const seat = subaccounts.find((s) => s.id === subaccountId);
    if (!seat) throw new Error(`Subcuenta ${subaccountId} no encontrada.`);
    Object.assign(seat, updates, { updated_at: new Date().toISOString() });
    db.save();
    return seat;
  }

  async getSubaccount(subaccountId: string, _restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const seat = db.get('guest_subaccounts').find((s) => s.id === subaccountId);
    if (!seat) throw new Error(`Subcuenta ${subaccountId} no encontrada.`);
    return seat;
  }

  async createOrderTicket(
    tableIdOrSessionId: string,
    waiterName: string = 'Mesero',
    notes?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.createOrderTicket(tableIdOrSessionId, waiterName, notes, restaurantId);
  }

  async createPosOrder(
    data: {
      server_id?: string;
      customer_id?: string;
      notes?: string;
      ticket_number?: string;
      table_id?: string;
      table_session_id?: string;
    },
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.createDirectPostOrder({
      ...data,
      restaurant_id: restaurantId,
    });
  }

  async getSessionOrders(tableIdOrSessionId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const details = PosService.getTableDetails(tableIdOrSessionId, restaurantId);
    return details.orders || [];
  }

  async getOrder(orderId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const orders = db.get('orders');
    const order = orders.find((o) => o.id === orderId && o.restaurant_id === restaurantId);
    if (!order) {
      throw new Error(`Orden ${orderId} no encontrada.`);
    }
    const items = db.get('order_items').filter((i) => i.order_id === order.id);
    return { ...order, items };
  }

  async updateOrderStatus(
    orderId: string,
    status: Order['status'],
    actor: string = 'Operador',
    reason?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.updateOrderStatus(orderId, status, actor, reason, restaurantId);
  }

  async cancelOrder(
    orderId: string,
    reason?: string,
    actor: string = 'Operador',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.cancelOrder(orderId, reason, actor, restaurantId);
  }

  async addOrderItem(
    tableIdOrSessionId: string,
    guestSubaccountId: string,
    productId: string,
    quantity: number = 1,
    notes?: string,
    overrideAllergy: boolean = false,
    actor: string = 'Mesero',
    restaurantId: string = DEFAULT_RESTAURANT_ID,
    orderTicketId?: string,
    modifiers?: string[]
  ) {
    try {
      const item = PosService.addItemToSubaccount(
        tableIdOrSessionId,
        guestSubaccountId,
        productId,
        quantity,
        notes,
        overrideAllergy,
        actor,
        restaurantId,
        orderTicketId,
        modifiers
      );
      return { item, allergy_warning: false };
    } catch (err: any) {
      if (err.is_allergy_warning) {
        return { item: null as any, allergy_warning: true, conflicts: err.conflicts };
      }
      throw err;
    }
  }

  async updateOrderItemStatus(
    itemId: string,
    status: OrderItemStatus,
    actor: string = 'Cocina',
    notes?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.updateItemStatus(itemId, status, actor, notes, restaurantId);
  }

  async acknowledgeItem(itemId: string, actor: string = 'Cocina', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.acknowledgeItem(itemId, actor, restaurantId);
  }

  async removeOrderItem(itemId: string, reason?: string, actor: string = 'Mesero', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.removeOrderItem(itemId, reason, actor, restaurantId);
  }

  async reassignItemSubaccount(
    itemId: string,
    newSubaccountId: string,
    actor: string = 'Mesero',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PosService.reassignItemSubaccount(itemId, newSubaccountId, actor, restaurantId);
  }

  async getSessionBill(tableIdOrSessionId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PosService.calculateTableBill(tableIdOrSessionId, restaurantId);
  }

  async getSubaccountBill(
    tableIdOrSessionId: string,
    subaccountId: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    const bill = PosService.calculateTableBill(tableIdOrSessionId, restaurantId);
    const subaccountBill = bill.subaccounts.find((s) => s.guest_subaccount_id === subaccountId);
    if (!subaccountBill) throw new Error(`Subcuenta ${subaccountId} no encontrada en la cuenta.`);
    return subaccountBill;
  }

  async recordPayment(
    tableIdOrSessionId: string,
    amountCents: number,
    method: Payment['method'],
    guestSubaccountId?: string,
    cashier: string = 'Cajero',
    reference?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    const payment = PosService.recordPayment(
      tableIdOrSessionId,
      amountCents,
      method,
      guestSubaccountId,
      cashier,
      reference,
      restaurantId
    );
    return payment;
  }

  async getStationItems(station?: string, restaurantId: string = DEFAULT_RESTAURANT_ID, includeCompleted: boolean = false) {
    return KdsService.getActiveStationItems(station, restaurantId, includeCompleted);
  }

  async getStationTickets(station?: string, restaurantId: string = DEFAULT_RESTAURANT_ID, includeCompleted: boolean = false) {
    return KdsService.getActiveTickets(station, restaurantId, includeCompleted);
  }

  async getProductionSummary(station?: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return KdsService.getProductionSummary(station, restaurantId);
  }

  async startPreparingTicket(orderId: string, station?: string, actor: string = 'Cocina', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return KdsService.startPreparingTicket(orderId, station, actor, restaurantId);
  }

  async markTicketReady(orderId: string, station?: string, actor: string = 'Cocina', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return KdsService.markTicketReady(orderId, station, actor, restaurantId);
  }

  async deliverTicket(orderId: string, station?: string, actor: string = 'Mesero', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return KdsService.deliverTicket(orderId, station, actor, restaurantId);
  }

  async recallTicket(orderId: string, station?: string, actor: string = 'Cocina', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return KdsService.recallTicket(orderId, station, actor, restaurantId);
  }

  async recallItem(itemId: string, actor: string = 'Cocina', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return KdsService.recallItem(itemId, actor, restaurantId);
  }

  async listProducts(category?: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    let prods = db.get('products').filter((p) => p.restaurant_id === restaurantId);
    if (category) {
      prods = prods.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    return prods;
  }

  async listAllergies() {
    return {
      allergies: db.get('allergies'),
      ingredients: db.get('ingredients'),
    };
  }

  async getCurrentShift(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CashService.getCurrentShift(restaurantId);
  }

  async openShift(
    initialFloatCents: number,
    cashier: string = 'Cajero Turno',
    notes?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return CashService.openShift(initialFloatCents, cashier, notes, restaurantId);
  }

  async closeShift(
    actualCashCents: number,
    cashier: string = 'Cajero Turno',
    notes?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return CashService.closeShift(actualCashCents, cashier, notes, restaurantId);
  }

  async recordMovement(
    type: CashMovement['type'],
    amountCents: number,
    description: string,
    performer: string = 'Cajero',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return CashService.recordMovement(type, amountCents, description, performer, restaurantId);
  }

  async listAuditEvents(limit: number = 50, entityType?: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    let logs = AuditService.getLogs(restaurantId, limit);
    if (entityType) {
      logs = logs.filter((l) => l.entity_type === entityType);
    }
    return logs;
  }

  async listPlugins(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PluginRegistry.getRestaurantPlugins(restaurantId);
  }

  async togglePlugin(
    pluginId: string,
    enabled: boolean,
    actor: string = 'Administrador',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    PluginRegistry.togglePlugin(pluginId, enabled, restaurantId, actor);
    return { success: true, plugin_id: pluginId, enabled };
  }

  // Inventory & Kardex (Core F6)
  async listInventoryItems(filters?: any, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return InventoryService.getItems(restaurantId, filters);
  }

  async getInventoryItem(itemId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return InventoryService.getItemById(itemId, restaurantId);
  }

  async getInventoryStock(itemId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return InventoryService.getStock(itemId, restaurantId);
  }

  async getKardex(itemId: string, filters?: any, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return InventoryService.getKardex(itemId, restaurantId, filters);
  }

  async createInventoryMovement(params: any) {
    return InventoryService.registerMovement(params);
  }

  async createInventoryAdjustment(params: any) {
    return InventoryService.registerMovement({
      restaurant_id: params.restaurantId || DEFAULT_RESTAURANT_ID,
      inventory_item_id: params.inventory_item_id,
      movement_type: params.type,
      quantity: params.quantity,
      reason: params.reason,
      reference_type: params.type === 'waste' ? 'waste' : 'manual_adjustment',
      reference_id: `ADJ-${Date.now()}`,
      actor: params.actor || 'Operador',
    });
  }

  async createInventoryCount(params: any) {
    return InventoryService.applyPhysicalCount({
      restaurant_id: params.restaurantId || DEFAULT_RESTAURANT_ID,
      performed_by: params.performed_by,
      notes: params.notes,
      counts: params.counts,
    });
  }

  async getInventoryAlerts(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return InventoryService.getAlerts(restaurantId);
  }

  async getInventorySummary(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return InventoryService.getSummary(restaurantId);
  }

  async exportKardexCsv(itemId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return InventoryService.exportKardexCsv(itemId, restaurantId);
  }

  async exportInventoryCsv(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return InventoryService.exportInventoryCsv(restaurantId);
  }

  // Recipes, Ingredients & COGS (Core F7)
  async listRecipes(filters?: any, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const recipes = RecipeService.getRecipes(restaurantId, filters);
    return recipes.map((r) => {
      try {
        const costCalc = RecipeService.calculateRecipeCost(r, restaurantId);
        return { ...r, cost_calculation: costCalc };
      } catch {
        return r;
      }
    });
  }

  async getRecipe(recipeId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const recipe = RecipeService.getRecipeById(recipeId, restaurantId);
    if (!recipe) return undefined;
    const costCalc = RecipeService.calculateRecipeCost(recipe, restaurantId);
    return { ...recipe, cost_calculation: costCalc };
  }

  async getProductRecipe(productId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const recipe = RecipeService.getRecipeByProductId(productId, restaurantId);
    if (!recipe) return undefined;
    const costCalc = RecipeService.calculateRecipeCost(recipe, restaurantId);
    return { ...recipe, cost_calculation: costCalc };
  }

  async createRecipe(data: any, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const recipe = RecipeService.createRecipe(data, actor, restaurantId);
    const costCalc = RecipeService.calculateRecipeCost(recipe, restaurantId);
    return { ...recipe, cost_calculation: costCalc };
  }

  async updateRecipe(recipeId: string, data: any, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const updated = RecipeService.updateRecipe(recipeId, data, actor, restaurantId);
    const costCalc = RecipeService.calculateRecipeCost(updated, restaurantId);
    return { ...updated, cost_calculation: costCalc };
  }

  async deleteRecipe(recipeId: string, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return RecipeService.deleteRecipe(recipeId, actor, restaurantId);
  }

  async calculateRecipeCost(recipeId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return RecipeService.calculateRecipeCost(recipeId, restaurantId);
  }

  async getRecipeVersions(recipeId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return RecipeService.getRecipeVersions(recipeId, restaurantId);
  }

  async getRecipeSummary(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return RecipeService.getRecipeSummary(restaurantId);
  }

  // Purchases & Suppliers (Core F8)
  async listSuppliers(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.getSuppliers(restaurantId);
  }

  async getSupplier(supplierId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.getSupplierById(supplierId, restaurantId);
  }

  async createSupplier(data: any, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.createSupplier(data, actor, restaurantId);
  }

  async updateSupplier(supplierId: string, data: any, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.updateSupplier(supplierId, data, actor, restaurantId);
  }

  async deleteSupplier(supplierId: string, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.deleteSupplier(supplierId, actor, restaurantId);
  }

  async linkSupplierProduct(supplierId: string, product: any, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.linkSupplierProduct(supplierId, product, actor, restaurantId);
  }

  async listPurchaseOrders(filters?: any, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.getPurchaseOrders(restaurantId, filters);
  }

  async getPurchaseOrder(orderId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.getPurchaseOrderById(orderId, restaurantId);
  }

  async createPurchaseOrder(data: any, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.createPurchaseOrder(data, actor, restaurantId);
  }

  async updatePurchaseOrder(orderId: string, data: any, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.updatePurchaseOrder(orderId, data, actor, restaurantId);
  }

  async updatePurchaseOrderStatus(orderId: string, status: any, actor: string = 'Administrador', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.updateOrderStatus(orderId, status, actor, restaurantId);
  }

  async receivePurchaseOrder(orderId: string, receiptData: any, actor: string = 'Almacenista', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.receivePurchaseOrder(orderId, receiptData, actor, restaurantId);
  }

  async getPriceHistory(itemId?: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.getPriceHistory(itemId, restaurantId);
  }

  async getPurchaseSummary(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PurchaseService.getSummary(restaurantId);
  }

  // Staff, Roles, Permissions & Shifts (Core F10)
  async listStaffMembers(filters?: any, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.listMembers(restaurantId, filters);
  }

  async getStaffMember(memberId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.getMember(memberId, restaurantId);
  }

  async createStaffMember(data: any, actor: string = 'System Admin') {
    return StaffService.createMember(data, actor);
  }

  async updateStaffMember(memberId: string, data: any, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.updateMember(memberId, data, actor, restaurantId);
  }

  async deactivateStaffMember(memberId: string, reason?: string, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.deactivateMember(memberId, reason, actor, restaurantId);
  }

  async activateStaffMember(memberId: string, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.activateMember(memberId, actor, restaurantId);
  }

  async getStaffMemberHistory(memberId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.getMemberHistory(memberId, restaurantId);
  }

  async getStaffSummary(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.getStaffSummary(restaurantId);
  }

  async listRoles(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.listRoles(restaurantId);
  }

  async getRole(roleId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.getRole(roleId, restaurantId);
  }

  async createRole(data: any, actor: string = 'System Admin') {
    return StaffService.createRole(data, actor);
  }

  async updateRole(roleId: string, data: any, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.updateRole(roleId, data, actor, restaurantId);
  }

  async deleteRole(roleId: string, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.deleteRole(roleId, actor, restaurantId);
  }

  async listPermissions() {
    return StaffService.listPermissions();
  }

  async authorizePermission(userId: string, permission: any, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.authorize(userId, restaurantId, permission);
  }

  async listShifts(filters?: any, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.listShifts(restaurantId, filters);
  }

  async getShift(shiftId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.getShift(shiftId, restaurantId);
  }

  async getActiveShift(memberId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.getActiveShift(memberId, restaurantId);
  }

  async scheduleShift(data: any, actor: string = 'System Admin') {
    return StaffService.createShift(data, actor);
  }

  async startShift(data: any, actor: string = 'System Admin') {
    return StaffService.startShift(data, actor);
  }

  async endShift(shiftId: string, notes?: string, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.endShift(shiftId, notes, actor, restaurantId);
  }

  async cancelShift(shiftId: string, reason?: string, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.cancelShift(shiftId, reason, actor, restaurantId);
  }

  async getRestaurantContext(userId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return StaffService.getRestaurantContext(userId, restaurantId);
  }

  // Customers, CRM, Loyalty & Promotions (Core F11)
  async listCustomers(filters?: any) {
    return CrmService.listCustomers(filters);
  }

  async getCustomer(customerId: string) {
    return CrmService.getCustomer(customerId);
  }

  async findCustomerByPhoneOrEmail(query: string) {
    return CrmService.getCustomerByPhoneOrEmail(query);
  }

  async createCustomer(data: any, actor: string = 'System Admin') {
    return CrmService.createCustomer(data, actor);
  }

  async updateCustomer(customerId: string, data: any, actor: string = 'System Admin') {
    return CrmService.updateCustomer(customerId, data, actor);
  }

  async getCustomerOrders(customerId: string, restaurantId?: string) {
    return CrmService.getCustomerOrders(customerId, restaurantId);
  }

  async getCustomerMetrics(customerId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.getCustomerMetrics(customerId, restaurantId);
  }

  async addCustomerAddress(customerId: string, address: any, actor: string = 'System Admin') {
    return CrmService.addOrUpdateAddress(customerId, address, actor);
  }

  async deleteCustomerAddress(customerId: string, addressId: string, actor: string = 'System Admin') {
    return CrmService.deleteAddress(customerId, addressId, actor);
  }

  async getLoyaltyAccount(customerId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.getLoyaltyAccount(customerId, restaurantId);
  }

  async getLoyaltyTransactions(customerId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.getLoyaltyTransactions(customerId, restaurantId);
  }

  async listLoyaltyRewards(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.listRewards(restaurantId);
  }

  async createLoyaltyReward(data: any, actor: string = 'System Admin') {
    return CrmService.createReward(data, actor);
  }

  async redeemLoyaltyReward(customerId: string, rewardId: string, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.redeemReward(customerId, rewardId, actor, restaurantId);
  }

  async adjustLoyaltyPoints(customerId: string, points: number, reason: string, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.adjustPoints(customerId, points, reason, actor, restaurantId);
  }

  async earnLoyaltyPoints(orderId: string, actor: string = 'System') {
    return CrmService.earnPointsForOrder(orderId, actor);
  }

  async reverseLoyaltyPoints(orderId: string, reason?: string, actor: string = 'System Admin') {
    return CrmService.reversePointsForOrder(orderId, reason, actor);
  }

  async listPromotions(restaurantId: string = DEFAULT_RESTAURANT_ID, onlyActive?: boolean) {
    return CrmService.listPromotions(restaurantId, onlyActive);
  }

  async getPromotion(promotionId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.getPromotion(promotionId, restaurantId);
  }

  async createPromotion(data: any, actor: string = 'System Admin') {
    return CrmService.createPromotion(data, actor);
  }

  async updatePromotion(promotionId: string, data: any, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.updatePromotion(promotionId, data, actor, restaurantId);
  }

  async deletePromotion(promotionId: string, actor: string = 'System Admin', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.deletePromotion(promotionId, actor, restaurantId);
  }

  async validateCoupon(code: string, subtotalCents: number, customerId?: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.validatePromotionOrCoupon(code, subtotalCents, customerId, restaurantId);
  }

  async applyPromotionToOrder(orderId: string, code: string, actor: string = 'System Admin') {
    return CrmService.applyPromotionToOrder(orderId, code, actor);
  }

  async getCrmSummary(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return CrmService.getCrmSummary(restaurantId);
  }

  // Payments & Finance (F12 / F12.1)
  async listPayments(restaurantId: string = DEFAULT_RESTAURANT_ID, filters?: { table_session_id?: string }) {
    return FinanceService.listPayments(restaurantId, filters);
  }

  async recordPaymentStrict(input: RecordPaymentInput) {
    return FinanceService.recordPayment(input);
  }

  async refundPayment(input: RefundPaymentInput) {
    return FinanceService.refundPayment(input);
  }

  async listExpenses(restaurantId: string = DEFAULT_RESTAURANT_ID, filters?: any) {
    return FinanceService.listExpenses(restaurantId, filters);
  }

  async createExpense(dto: CreateExpenseDTO) {
    return FinanceService.createExpense(dto);
  }

  async getFinancialLedger(filters?: FinancialMovementFilter) {
    return FinanceService.getFinancialLedger(filters || {});
  }

  async getOperatingPnL(restaurantId: string = DEFAULT_RESTAURANT_ID, startDate?: string, endDate?: string) {
    return FinanceService.calculateOperatingPnL(restaurantId, startDate, endDate);
  }

  async getZCutReport(shiftId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    const current = FinanceService.getCurrentCashSession(restaurantId);
    if (!current.shift) throw new Error('No hay turno para generar corte Z');
    const closed = FinanceService.closeCashSession({
      actual_cash_cents: current.shift.expected_cash_cents,
      notes: 'Corte Z emitido vía SDK',
      restaurant_id: restaurantId,
    });
    return closed.z_cut;
  }

  async listRestaurantSettlements(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return FinanceService.listRestaurantSettlements(restaurantId);
  }

  async createRestaurantSettlement(data: any, userId?: string) {
    return FinanceService.createRestaurantSettlement(data, userId);
  }

  async listDriverSettlements(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return FinanceService.listDriverSettlements(restaurantId);
  }

  async createDriverSettlement(data: any, userId?: string) {
    return FinanceService.createDriverSettlement(data, userId);
  }

  // ==========================================
  // Solutions & Entitlements (Core F13)
  // ==========================================

  async listSolutions(filters?: any) {
    return SolutionService.listSolutions(filters);
  }

  async getSolution(solutionId: string) {
    return SolutionService.getSolution(solutionId);
  }

  async listCapabilities(solutionId?: string) {
    return SolutionService.listCapabilities(solutionId);
  }

  async listPlans(onlyActive?: boolean) {
    return SolutionService.listPlans(onlyActive);
  }

  async getPlan(planIdOrCode: string) {
    return SolutionService.getPlan(planIdOrCode);
  }

  async createPlan(data: any) {
    return SolutionService.createPlan(data);
  }

  async getRestaurantEntitlements(restaurantId: string = DEFAULT_RESTAURANT_ID, onlyActive?: boolean) {
    return SolutionService.getRestaurantEntitlements(restaurantId, onlyActive);
  }

  async grantEntitlement(data: any, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return SolutionService.grantEntitlement({
      ...data,
      restaurant_id: data.restaurant_id || restaurantId,
    });
  }

  async revokeEntitlement(entitlementId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return SolutionService.revokeEntitlement(entitlementId, restaurantId);
  }

  async suspendEntitlement(entitlementId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return SolutionService.suspendEntitlement(entitlementId, restaurantId);
  }

  async activateEntitlement(entitlementId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return SolutionService.activateEntitlement(entitlementId, restaurantId);
  }

  async assignPlan(planId: string, restaurantId: string = DEFAULT_RESTAURANT_ID, source?: EntitlementSource) {
    return SolutionService.assignPlanToRestaurant(restaurantId, planId, source);
  }

  async isSolutionEnabled(solutionId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return SolutionService.isSolutionEnabled(restaurantId, solutionId);
  }

  async hasCapability(capability: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return SolutionService.hasCapability(restaurantId, capability);
  }

  async checkCapability(capability: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return SolutionService.checkCapability(restaurantId, capability);
  }

  async authorizeAction(
    userId: string | undefined,
    permission?: Permission,
    capability?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return SolutionService.authorizeAction(userId, restaurantId, permission, capability);
  }

  // ==========================================
  // DELIVERY & DISPATCH METHODS (Core F14.1)
  // ==========================================

  async listDrivers(
    restaurantId: string = DEFAULT_RESTAURANT_ID,
    filters?: { status?: DriverProfile['status']; is_verified?: boolean }
  ) {
    return DeliveryService.listDrivers(restaurantId, filters);
  }

  async getDriver(driverId: string, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return DeliveryService.getDriver(driverId, restaurantId);
  }

  async createDriver(data: any, actor: string = 'System Admin', _restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return DeliveryService.createDriver(data, actor);
  }

  async verifyDriver(
    driverId: string,
    isVerified: boolean,
    actor: string = 'Admin',
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return DeliveryService.verifyDriver(driverId, isVerified, actor, restaurantId);
  }

  async updateDriverGps(
    driverId: string,
    gps: { latitude: number; longitude: number },
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return DeliveryService.updateDriverGps(driverId, gps, restaurantId);
  }

  async findEligibleDrivers(restaurantId: string = DEFAULT_RESTAURANT_ID, maxGpsAgeMinutes: number = 30) {
    return DeliveryService.findEligibleDrivers(restaurantId, maxGpsAgeMinutes);
  }

  async dispatchOrder(data: any) {
    return DeliveryService.dispatchOrder(data);
  }

  async markDelivered(dispatchId: string, actor: string = 'Driver', restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return DeliveryService.markDelivered(dispatchId, actor, restaurantId);
  }

  async listDispatches(
    restaurantId: string = DEFAULT_RESTAURANT_ID,
    filters?: { status?: DeliveryDispatch['status']; driver_id?: string; order_id?: string }
  ) {
    return DeliveryService.listDispatches(restaurantId, filters);
  }

  // ==========================================
  // DIRECTPRINT METHODS (Core F15.2)
  // ==========================================

  async listPrintJobs(
    restaurantId: string = DEFAULT_RESTAURANT_ID,
    filters?: { status?: string; printer_id?: string; station?: string }
  ) {
    return PrintService.listPrintJobs(restaurantId, filters);
  }

  async createPrintJob(params: any, restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.createPrintJob(params, restaurantId);
  }

  async updatePrintJobStatus(
    jobId: string,
    status: PrintJob['status'],
    errorMessage?: string,
    restaurantId: string = DEFAULT_RESTAURANT_ID
  ) {
    return PrintService.updatePrintJobStatus(jobId, status, errorMessage, restaurantId);
  }

  async listPrinters(restaurantId: string = DEFAULT_RESTAURANT_ID) {
    return PrintService.getPrinters(restaurantId);
  }
}
