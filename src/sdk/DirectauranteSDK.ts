/**
 * DIRECTAURANTE POS & COMANDERO - DirectauranteSDK
 * Unified, enterprise-grade SDK facade consumed by UI components.
 * Guarantees zero direct storage or untyped API access.
 */

import { DirectauranteSdkAdapter, HttpDirectauranteAdapter } from './adapter';
import {
  IDirectauranteSDK,
  TablesSdk,
  GuestsSdk,
  OrdersSdk,
  BillsSdk,
  KdsSdk,
  CatalogSdk,
  CashSdk,
  AuditSdk,
  PluginsSdk,
  InventorySdk,
  RecipesSdk,
  PurchasesSdk,
  StaffSdk,
  RolesSdk,
  PermissionsSdk,
  ShiftsSdk,
  CustomersSdk,
  LoyaltySdk,
  PromotionsSdk,
  CrmSdk,
  PaymentsSdk,
  ExpensesSdk,
  FinancialSdk,
  ReportsSdk,
  SettlementsSdk,
  SolutionsSdk,
} from './types';
import {
  DEFAULT_RESTAURANT_ID,
  Payment,
  OrderItemStatus,
  CashMovement,
  CurrentRestaurantContext,
  Permission,
  EntitlementSource,
} from '../core/types';
import type {
  RecordPaymentInput,
  RefundPaymentInput,
  CreateExpenseDTO,
  FinancialMovementFilter,
} from '../modules/finance/financeService';

export class DirectauranteSDK implements IDirectauranteSDK {
  private adapter: DirectauranteSdkAdapter;
  private defaultRestaurantId: string;

  constructor(adapter?: DirectauranteSdkAdapter, defaultRestaurantId: string = DEFAULT_RESTAURANT_ID) {
    this.adapter = adapter || new HttpDirectauranteAdapter();
    this.defaultRestaurantId = defaultRestaurantId;
  }

  public setAdapter(adapter: DirectauranteSdkAdapter) {
    this.adapter = adapter;
  }

  public get tables(): TablesSdk {
    return {
      listTables: async (restaurantId?: string) => {
        return this.adapter.listTables(restaurantId || this.defaultRestaurantId);
      },
      getTable: async (tableId: string, restaurantId?: string) => {
        return this.adapter.getTable(tableId, restaurantId || this.defaultRestaurantId);
      },
      openTableSession: async (
        tableId: string,
        waiterName: string,
        initialGuests?: Array<{ name: string; allergy_ids?: string[] }>,
        restaurantId?: string
      ) => {
        return this.adapter.openTableSession(
          tableId,
          waiterName,
          initialGuests,
          restaurantId || this.defaultRestaurantId
        );
      },
      getActiveSession: async (tableId: string, restaurantId?: string) => {
        const details = await this.adapter.getTable(tableId, restaurantId || this.defaultRestaurantId);
        return details.session || null;
      },
      closeTableSession: async (tableIdOrSessionId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.closeTableSession(
          tableIdOrSessionId,
          actor,
          restaurantId || this.defaultRestaurantId
        );
      },
    };
  }

  public get guests(): GuestsSdk {
    return {
      listSubaccounts: async (tableIdOrSessionId: string, restaurantId?: string) => {
        return this.adapter.listSubaccounts(tableIdOrSessionId, restaurantId || this.defaultRestaurantId);
      },
      createSubaccount: async (
        tableIdOrSessionId: string,
        displayName: string,
        allergyIds: string[] = [],
        notes?: string,
        actor?: string,
        restaurantId?: string
      ) => {
        return this.adapter.createSubaccount(
          tableIdOrSessionId,
          displayName,
          allergyIds,
          notes,
          actor,
          restaurantId || this.defaultRestaurantId
        );
      },
      updateSubaccount: async (
        subaccountId: string,
        updates: any,
        actor?: string,
        restaurantId?: string
      ) => {
        return this.adapter.updateSubaccount(
          subaccountId,
          updates,
          actor,
          restaurantId || this.defaultRestaurantId
        );
      },
      getSubaccount: async (subaccountId: string, restaurantId?: string) => {
        return this.adapter.getSubaccount(subaccountId, restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get orders(): OrdersSdk {
    return {
      createOrderTicket: async (
        tableIdOrSessionId: string,
        waiterName?: string,
        notes?: string,
        restaurantId?: string
      ) => {
        return this.adapter.createOrderTicket(
          tableIdOrSessionId,
          waiterName,
          notes,
          restaurantId || this.defaultRestaurantId
        );
      },
      getSessionOrders: async (tableIdOrSessionId: string, restaurantId?: string) => {
        return this.adapter.getSessionOrders(tableIdOrSessionId, restaurantId || this.defaultRestaurantId);
      },
      addOrderItem: async (
        tableIdOrSessionId: string,
        guestSubaccountId: string,
        productId: string,
        quantity: number = 1,
        notes?: string,
        overrideAllergy: boolean = false,
        actor?: string,
        restaurantId?: string,
        orderTicketId?: string,
        modifiers?: string[]
      ) => {
        return this.adapter.addOrderItem(
          tableIdOrSessionId,
          guestSubaccountId,
          productId,
          quantity,
          notes,
          overrideAllergy,
          actor,
          restaurantId || this.defaultRestaurantId,
          orderTicketId,
          modifiers
        );
      },
      updateOrderItem: async (
        itemId: string,
        updates: any,
        actor?: string,
        restaurantId?: string
      ) => {
        if (updates.preparation_status) {
          return this.adapter.updateOrderItemStatus(
            itemId,
            updates.preparation_status,
            actor,
            updates.notes,
            restaurantId || this.defaultRestaurantId
          );
        }
        throw new Error('Not implemented for generic field update');
      },
      removeOrderItem: async (
        itemId: string,
        reason?: string,
        actor?: string,
        restaurantId?: string
      ) => {
        return this.adapter.removeOrderItem(itemId, reason, actor, restaurantId || this.defaultRestaurantId);
      },
      reassignItemSubaccount: async (
        itemId: string,
        newSubaccountId: string,
        actor?: string,
        restaurantId?: string
      ) => {
        return this.adapter.reassignItemSubaccount(
          itemId,
          newSubaccountId,
          actor,
          restaurantId || this.defaultRestaurantId
        );
      },
    };
  }

  public get bills(): BillsSdk {
    return {
      getSessionBill: async (tableIdOrSessionId: string, restaurantId?: string) => {
        return this.adapter.getSessionBill(tableIdOrSessionId, restaurantId || this.defaultRestaurantId);
      },
      getSubaccountBill: async (
        tableIdOrSessionId: string,
        subaccountId: string,
        restaurantId?: string
      ) => {
        return this.adapter.getSubaccountBill(
          tableIdOrSessionId,
          subaccountId,
          restaurantId || this.defaultRestaurantId
        );
      },
      recordPayment: async (
        tableIdOrSessionId: string,
        amountCents: number,
        method: Payment['method'],
        guestSubaccountId?: string,
        cashier?: string,
        reference?: string,
        restaurantId?: string
      ) => {
        return this.adapter.recordPayment(
          tableIdOrSessionId,
          amountCents,
          method,
          guestSubaccountId,
          cashier,
          reference,
          restaurantId || this.defaultRestaurantId
        );
      },
    };
  }

  public get kds(): KdsSdk {
    return {
      getKitchenItems: async (restaurantId?: string) => {
        return this.adapter.getStationItems('kitchen', restaurantId || this.defaultRestaurantId);
      },
      getStationItems: async (station?: string, restaurantId?: string, includeCompleted?: boolean) => {
        return this.adapter.getStationItems(station, restaurantId || this.defaultRestaurantId, includeCompleted);
      },
      getStationTickets: async (station?: string, restaurantId?: string, includeCompleted?: boolean) => {
        return this.adapter.getStationTickets(station, restaurantId || this.defaultRestaurantId, includeCompleted);
      },
      getProductionSummary: async (station?: string, restaurantId?: string) => {
        return this.adapter.getProductionSummary(station, restaurantId || this.defaultRestaurantId);
      },
      updateItemStatus: async (
        itemId: string,
        status: OrderItemStatus,
        actor?: string,
        notes?: string,
        restaurantId?: string
      ) => {
        return this.adapter.updateOrderItemStatus(
          itemId,
          status,
          actor,
          notes,
          restaurantId || this.defaultRestaurantId
        );
      },
      acknowledgeItem: async (itemId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.acknowledgeItem(itemId, actor, restaurantId || this.defaultRestaurantId);
      },
      markItemReady: async (itemId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.updateOrderItemStatus(
          itemId,
          'ready',
          actor || 'Cocina',
          undefined,
          restaurantId || this.defaultRestaurantId
        );
      },
      markItemDelivered: async (itemId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.updateOrderItemStatus(
          itemId,
          'delivered',
          actor || 'Mesero',
          undefined,
          restaurantId || this.defaultRestaurantId
        );
      },
      startPreparingTicket: async (orderId: string, station?: string, actor?: string, restaurantId?: string) => {
        return this.adapter.startPreparingTicket(orderId, station, actor || 'Cocina', restaurantId || this.defaultRestaurantId);
      },
      markTicketReady: async (orderId: string, station?: string, actor?: string, restaurantId?: string) => {
        return this.adapter.markTicketReady(orderId, station, actor || 'Cocina', restaurantId || this.defaultRestaurantId);
      },
      deliverTicket: async (orderId: string, station?: string, actor?: string, restaurantId?: string) => {
        return this.adapter.deliverTicket(orderId, station, actor || 'Mesero', restaurantId || this.defaultRestaurantId);
      },
      recallTicket: async (orderId: string, station?: string, actor?: string, restaurantId?: string) => {
        return this.adapter.recallTicket(orderId, station, actor || 'Cocina', restaurantId || this.defaultRestaurantId);
      },
      recallItem: async (itemId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.recallItem(itemId, actor || 'Cocina', restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get catalog(): CatalogSdk {
    return {
      listProducts: async (category?: string, restaurantId?: string) => {
        return this.adapter.listProducts(category, restaurantId || this.defaultRestaurantId);
      },
      listAllergies: async () => {
        return this.adapter.listAllergies();
      },
    };
  }

  public get cash(): CashSdk {
    return {
      getCurrentShift: async (restaurantId?: string) => {
        return this.adapter.getCurrentShift(restaurantId || this.defaultRestaurantId);
      },
      openShift: async (
        initialFloatCents: number,
        cashier?: string,
        notes?: string,
        restaurantId?: string
      ) => {
        return this.adapter.openShift(
          initialFloatCents,
          cashier,
          notes,
          restaurantId || this.defaultRestaurantId
        );
      },
      closeShift: async (
        actualCashCents: number,
        cashier?: string,
        notes?: string,
        restaurantId?: string
      ) => {
        return this.adapter.closeShift(
          actualCashCents,
          cashier,
          notes,
          restaurantId || this.defaultRestaurantId
        );
      },
      recordMovement: async (
        type: CashMovement['type'],
        amountCents: number,
        description: string,
        performer?: string,
        restaurantId?: string
      ) => {
        return this.adapter.recordMovement(
          type,
          amountCents,
          description,
          performer,
          restaurantId || this.defaultRestaurantId
        );
      },
    };
  }

  public get audit(): AuditSdk {
    return {
      listAuditEvents: async (limit?: number, entityType?: string, restaurantId?: string) => {
        return this.adapter.listAuditEvents(limit, entityType, restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get plugins(): PluginsSdk {
    return {
      listPlugins: async (restaurantId?: string) => {
        return this.adapter.listPlugins(restaurantId || this.defaultRestaurantId);
      },
      getPluginState: async (pluginId: string, restaurantId?: string) => {
        const plugins = await this.adapter.listPlugins(restaurantId || this.defaultRestaurantId);
        const p = plugins.find((item) => item.id === pluginId);
        return Boolean(p && p.enabled);
      },
      togglePlugin: async (pluginId: string, enabled: boolean, actor?: string, restaurantId?: string) => {
        return this.adapter.togglePlugin(
          pluginId,
          enabled,
          actor,
          restaurantId || this.defaultRestaurantId
        );
      },
    };
  }

  public get inventory(): InventorySdk {
    return {
      listItems: async (filters?: any, restaurantId?: string) => {
        return this.adapter.listInventoryItems(filters, restaurantId || this.defaultRestaurantId);
      },
      getItem: async (itemId: string, restaurantId?: string) => {
        return this.adapter.getInventoryItem(itemId, restaurantId || this.defaultRestaurantId);
      },
      getStock: async (itemId: string, restaurantId?: string) => {
        return this.adapter.getInventoryStock(itemId, restaurantId || this.defaultRestaurantId);
      },
      getKardex: async (itemId: string, filters?: any, restaurantId?: string) => {
        return this.adapter.getKardex(itemId, filters, restaurantId || this.defaultRestaurantId);
      },
      createMovement: async (params: any) => {
        return this.adapter.createInventoryMovement({
          ...params,
          restaurantId: params.restaurantId || this.defaultRestaurantId,
        });
      },
      createAdjustment: async (params: any) => {
        return this.adapter.createInventoryAdjustment({
          ...params,
          restaurantId: params.restaurantId || this.defaultRestaurantId,
        });
      },
      createCount: async (params: any) => {
        return this.adapter.createInventoryCount({
          ...params,
          restaurantId: params.restaurantId || this.defaultRestaurantId,
        });
      },
      getAlerts: async (restaurantId?: string) => {
        return this.adapter.getInventoryAlerts(restaurantId || this.defaultRestaurantId);
      },
      getSummary: async (restaurantId?: string) => {
        return this.adapter.getInventorySummary(restaurantId || this.defaultRestaurantId);
      },
      exportKardexCsv: async (itemId: string, restaurantId?: string) => {
        return this.adapter.exportKardexCsv(itemId, restaurantId || this.defaultRestaurantId);
      },
      exportInventoryCsv: async (restaurantId?: string) => {
        return this.adapter.exportInventoryCsv(restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get recipes(): RecipesSdk {
    return {
      listRecipes: async (filters?: any, restaurantId?: string) => {
        return this.adapter.listRecipes(filters, restaurantId || this.defaultRestaurantId);
      },
      getRecipe: async (recipeId: string, restaurantId?: string) => {
        return this.adapter.getRecipe(recipeId, restaurantId || this.defaultRestaurantId);
      },
      getProductRecipe: async (productId: string, restaurantId?: string) => {
        return this.adapter.getProductRecipe(productId, restaurantId || this.defaultRestaurantId);
      },
      createRecipe: async (data: any, actor?: string, restaurantId?: string) => {
        return this.adapter.createRecipe(data, actor, restaurantId || this.defaultRestaurantId);
      },
      updateRecipe: async (recipeId: string, data: any, actor?: string, restaurantId?: string) => {
        return this.adapter.updateRecipe(recipeId, data, actor, restaurantId || this.defaultRestaurantId);
      },
      deleteRecipe: async (recipeId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.deleteRecipe(recipeId, actor, restaurantId || this.defaultRestaurantId);
      },
      calculateCost: async (recipeId: string, restaurantId?: string) => {
        return this.adapter.calculateRecipeCost(recipeId, restaurantId || this.defaultRestaurantId);
      },
      getRecipeVersions: async (recipeId: string, restaurantId?: string) => {
        return this.adapter.getRecipeVersions(recipeId, restaurantId || this.defaultRestaurantId);
      },
      getSummary: async (restaurantId?: string) => {
        return this.adapter.getRecipeSummary(restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get purchases(): PurchasesSdk {
    return {
      listSuppliers: async (restaurantId?: string) => {
        return this.adapter.listSuppliers(restaurantId || this.defaultRestaurantId);
      },
      getSupplier: async (supplierId: string, restaurantId?: string) => {
        return this.adapter.getSupplier(supplierId, restaurantId || this.defaultRestaurantId);
      },
      createSupplier: async (data: any, actor?: string, restaurantId?: string) => {
        return this.adapter.createSupplier(data, actor, restaurantId || this.defaultRestaurantId);
      },
      updateSupplier: async (supplierId: string, data: any, actor?: string, restaurantId?: string) => {
        return this.adapter.updateSupplier(supplierId, data, actor, restaurantId || this.defaultRestaurantId);
      },
      deleteSupplier: async (supplierId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.deleteSupplier(supplierId, actor, restaurantId || this.defaultRestaurantId);
      },
      linkSupplierProduct: async (supplierId: string, product: any, actor?: string, restaurantId?: string) => {
        return this.adapter.linkSupplierProduct(supplierId, product, actor, restaurantId || this.defaultRestaurantId);
      },
      listPurchaseOrders: async (filters?: any, restaurantId?: string) => {
        return this.adapter.listPurchaseOrders(filters, restaurantId || this.defaultRestaurantId);
      },
      getPurchaseOrder: async (orderId: string, restaurantId?: string) => {
        return this.adapter.getPurchaseOrder(orderId, restaurantId || this.defaultRestaurantId);
      },
      createPurchaseOrder: async (data: any, actor?: string, restaurantId?: string) => {
        return this.adapter.createPurchaseOrder(data, actor, restaurantId || this.defaultRestaurantId);
      },
      updatePurchaseOrder: async (orderId: string, data: any, actor?: string, restaurantId?: string) => {
        return this.adapter.updatePurchaseOrder(orderId, data, actor, restaurantId || this.defaultRestaurantId);
      },
      updateOrderStatus: async (orderId: string, status: any, actor?: string, restaurantId?: string) => {
        return this.adapter.updateOrderStatus(orderId, status, actor, restaurantId || this.defaultRestaurantId);
      },
      receivePurchaseOrder: async (orderId: string, receiptData: any, actor?: string, restaurantId?: string) => {
        return this.adapter.receivePurchaseOrder(orderId, receiptData, actor, restaurantId || this.defaultRestaurantId);
      },
      getPriceHistory: async (itemId?: string, restaurantId?: string) => {
        return this.adapter.getPriceHistory(itemId, restaurantId || this.defaultRestaurantId);
      },
      getSummary: async (restaurantId?: string) => {
        return this.adapter.getPurchaseSummary(restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get staff(): StaffSdk {
    return {
      listMembers: async (filters?: any, restaurantId?: string) => {
        return this.adapter.listStaffMembers(filters, restaurantId || this.defaultRestaurantId);
      },
      getMember: async (memberId: string, restaurantId?: string) => {
        return this.adapter.getStaffMember(memberId, restaurantId || this.defaultRestaurantId);
      },
      createMember: async (data: any, actor?: string) => {
        return this.adapter.createStaffMember(data, actor);
      },
      updateMember: async (memberId: string, data: any, actor?: string, restaurantId?: string) => {
        return this.adapter.updateStaffMember(memberId, data, actor, restaurantId || this.defaultRestaurantId);
      },
      deactivateMember: async (memberId: string, reason?: string, actor?: string, restaurantId?: string) => {
        return this.adapter.deactivateStaffMember(memberId, reason, actor, restaurantId || this.defaultRestaurantId);
      },
      activateMember: async (memberId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.activateStaffMember(memberId, actor, restaurantId || this.defaultRestaurantId);
      },
      getMemberHistory: async (memberId: string, restaurantId?: string) => {
        return this.adapter.getStaffMemberHistory(memberId, restaurantId || this.defaultRestaurantId);
      },
      getSummary: async (restaurantId?: string) => {
        return this.adapter.getStaffSummary(restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get roles(): RolesSdk {
    return {
      listRoles: async (restaurantId?: string) => {
        return this.adapter.listRoles(restaurantId || this.defaultRestaurantId);
      },
      getRole: async (roleId: string, restaurantId?: string) => {
        return this.adapter.getRole(roleId, restaurantId || this.defaultRestaurantId);
      },
      createRole: async (data: any, actor?: string) => {
        return this.adapter.createRole(data, actor);
      },
      updateRole: async (roleId: string, data: any, actor?: string, restaurantId?: string) => {
        return this.adapter.updateRole(roleId, data, actor, restaurantId || this.defaultRestaurantId);
      },
      deleteRole: async (roleId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.deleteRole(roleId, actor, restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get permissions(): PermissionsSdk {
    return {
      listPermissions: async () => {
        return this.adapter.listPermissions();
      },
      authorize: async (userId: string, permission: any, restaurantId?: string) => {
        return this.adapter.authorizePermission(userId, permission, restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get shifts(): ShiftsSdk {
    return {
      listShifts: async (filters?: any, restaurantId?: string) => {
        return this.adapter.listShifts(filters, restaurantId || this.defaultRestaurantId);
      },
      getShift: async (shiftId: string, restaurantId?: string) => {
        return this.adapter.getShift(shiftId, restaurantId || this.defaultRestaurantId);
      },
      getActiveShift: async (memberId: string, restaurantId?: string) => {
        return this.adapter.getActiveShift(memberId, restaurantId || this.defaultRestaurantId);
      },
      scheduleShift: async (data: any, actor?: string) => {
        return this.adapter.scheduleShift(data, actor);
      },
      startShift: async (data: any, actor?: string) => {
        return this.adapter.startShift(data, actor);
      },
      endShift: async (shiftId: string, notes?: string, actor?: string, restaurantId?: string) => {
        return this.adapter.endShift(shiftId, notes, actor, restaurantId || this.defaultRestaurantId);
      },
      cancelShift: async (shiftId: string, reason?: string, actor?: string, restaurantId?: string) => {
        return this.adapter.cancelShift(shiftId, reason, actor, restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get customers(): CustomersSdk {
    return {
      listCustomers: async (filters?: any) => {
        return this.adapter.listCustomers(filters);
      },
      getCustomer: async (customerId: string) => {
        return this.adapter.getCustomer(customerId);
      },
      findByPhoneOrEmail: async (query: string) => {
        return this.adapter.findCustomerByPhoneOrEmail(query);
      },
      createCustomer: async (data: any, actor?: string) => {
        return this.adapter.createCustomer(data, actor);
      },
      updateCustomer: async (customerId: string, data: any, actor?: string) => {
        return this.adapter.updateCustomer(customerId, data, actor);
      },
      getOrders: async (customerId: string, restaurantId?: string) => {
        return this.adapter.getCustomerOrders(customerId, restaurantId || this.defaultRestaurantId);
      },
      getMetrics: async (customerId: string, restaurantId?: string) => {
        return this.adapter.getCustomerMetrics(customerId, restaurantId || this.defaultRestaurantId);
      },
      addAddress: async (customerId: string, address: any, actor?: string) => {
        return this.adapter.addCustomerAddress(customerId, address, actor);
      },
      deleteAddress: async (customerId: string, addressId: string, actor?: string) => {
        return this.adapter.deleteCustomerAddress(customerId, addressId, actor);
      },
    };
  }

  public get loyalty(): LoyaltySdk {
    return {
      getAccount: async (customerId: string, restaurantId?: string) => {
        return this.adapter.getLoyaltyAccount(customerId, restaurantId || this.defaultRestaurantId);
      },
      getTransactions: async (customerId: string, restaurantId?: string) => {
        return this.adapter.getLoyaltyTransactions(customerId, restaurantId || this.defaultRestaurantId);
      },
      listRewards: async (restaurantId?: string) => {
        return this.adapter.listLoyaltyRewards(restaurantId || this.defaultRestaurantId);
      },
      createReward: async (data: any, actor?: string) => {
        return this.adapter.createLoyaltyReward(data, actor);
      },
      redeemReward: async (customerId: string, rewardId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.redeemLoyaltyReward(customerId, rewardId, actor, restaurantId || this.defaultRestaurantId);
      },
      adjustPoints: async (customerId: string, pointsDelta: number, reason: string, actor: string = 'System Admin', restaurantId?: string) => {
        return this.adapter.adjustLoyaltyPoints(customerId, pointsDelta, reason, actor, restaurantId || this.defaultRestaurantId);
      },
      earnPointsForOrder: async (orderId: string, actor?: string) => {
        return this.adapter.earnLoyaltyPoints(orderId, actor);
      },
      reversePointsForOrder: async (orderId: string, reason?: string, actor?: string) => {
        return this.adapter.reverseLoyaltyPoints(orderId, reason, actor);
      },
    };
  }

  public get promotions(): PromotionsSdk {
    return {
      listPromotions: async (restaurantId?: string, onlyActive?: boolean) => {
        return this.adapter.listPromotions(restaurantId || this.defaultRestaurantId, onlyActive);
      },
      getPromotion: async (promotionId: string, restaurantId?: string) => {
        return this.adapter.getPromotion(promotionId, restaurantId || this.defaultRestaurantId);
      },
      createPromotion: async (data: any, actor?: string) => {
        return this.adapter.createPromotion(data, actor);
      },
      updatePromotion: async (promotionId: string, data: any, actor?: string, restaurantId?: string) => {
        return this.adapter.updatePromotion(promotionId, data, actor, restaurantId || this.defaultRestaurantId);
      },
      deletePromotion: async (promotionId: string, actor?: string, restaurantId?: string) => {
        return this.adapter.deletePromotion(promotionId, actor, restaurantId || this.defaultRestaurantId);
      },
      validateCoupon: async (code: string, subtotalCents: number, customerId?: string, restaurantId?: string) => {
        return this.adapter.validateCoupon(code, subtotalCents, customerId, restaurantId || this.defaultRestaurantId);
      },
      applyToOrder: async (orderId: string, codeOrId: string, actor?: string) => {
        return this.adapter.applyPromotionToOrder(orderId, codeOrId, actor);
      },
    };
  }

  public get crm(): CrmSdk {
    return {
      getSummary: async (restaurantId?: string) => {
        return this.adapter.getCrmSummary(restaurantId || this.defaultRestaurantId);
      },
      getMetrics: async (customerId: string, restaurantId?: string) => {
        return this.adapter.getCustomerMetrics(customerId, restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get payments(): PaymentsSdk {
    return {
      listPayments: async (restaurantId?: string, filters?: { table_session_id?: string }) => {
        return this.adapter.listPayments(restaurantId || this.defaultRestaurantId, filters);
      },
      recordPayment: async (input: RecordPaymentInput) => {
        return this.adapter.recordPaymentStrict({
          ...input,
          restaurant_id: input.restaurant_id || this.defaultRestaurantId,
        });
      },
      refundPayment: async (input: RefundPaymentInput) => {
        return this.adapter.refundPayment({
          ...input,
          restaurant_id: input.restaurant_id || this.defaultRestaurantId,
        });
      },
    };
  }

  public get expenses(): ExpensesSdk {
    return {
      listExpenses: async (restaurantId?: string, filters?: any) => {
        return this.adapter.listExpenses(restaurantId || this.defaultRestaurantId, filters);
      },
      createExpense: async (dto: CreateExpenseDTO) => {
        return this.adapter.createExpense({
          ...dto,
          restaurant_id: dto.restaurant_id || this.defaultRestaurantId,
        });
      },
    };
  }

  public get financial(): FinancialSdk {
    return {
      getLedger: async (filters?: FinancialMovementFilter) => {
        return this.adapter.getFinancialLedger({
          ...filters,
          restaurant_id: filters?.restaurant_id || this.defaultRestaurantId,
        });
      },
      getPnL: async (restaurantId?: string, startDate?: string, endDate?: string) => {
        return this.adapter.getOperatingPnL(restaurantId || this.defaultRestaurantId, startDate, endDate);
      },
    };
  }

  public get reports(): ReportsSdk {
    return {
      getOperatingPnL: async (restaurantId?: string, startDate?: string, endDate?: string) => {
        return this.adapter.getOperatingPnL(restaurantId || this.defaultRestaurantId, startDate, endDate);
      },
      getZCutReport: async (shiftId: string, restaurantId?: string) => {
        return this.adapter.getZCutReport(shiftId, restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public get settlements(): SettlementsSdk {
    return {
      listRestaurantSettlements: async (restaurantId?: string) => {
        return this.adapter.listRestaurantSettlements(restaurantId || this.defaultRestaurantId);
      },
      createRestaurantSettlement: async (data: any, userId?: string) => {
        return this.adapter.createRestaurantSettlement(data, userId);
      },
      listDriverSettlements: async (restaurantId?: string) => {
        return this.adapter.listDriverSettlements(restaurantId || this.defaultRestaurantId);
      },
      createDriverSettlement: async (data: any, userId?: string) => {
        return this.adapter.createDriverSettlement(data, userId);
      },
    };
  }

  public get solutions(): SolutionsSdk {
    return {
      listSolutions: async (filters?: any) => {
        return this.adapter.listSolutions(filters);
      },
      getSolution: async (solutionId: string) => {
        return this.adapter.getSolution(solutionId);
      },
      listCapabilities: async (solutionId?: string) => {
        return this.adapter.listCapabilities(solutionId);
      },
      listPlans: async (onlyActive?: boolean) => {
        return this.adapter.listPlans(onlyActive);
      },
      getPlan: async (planIdOrCode: string) => {
        return this.adapter.getPlan(planIdOrCode);
      },
      createPlan: async (data: any) => {
        return this.adapter.createPlan(data);
      },
      getRestaurantEntitlements: async (restaurantId?: string, onlyActive?: boolean) => {
        return this.adapter.getRestaurantEntitlements(restaurantId || this.defaultRestaurantId, onlyActive);
      },
      grantEntitlement: async (data: any, restaurantId?: string) => {
        return this.adapter.grantEntitlement(data, restaurantId || this.defaultRestaurantId);
      },
      revokeEntitlement: async (entitlementId: string, restaurantId?: string) => {
        return this.adapter.revokeEntitlement(entitlementId, restaurantId || this.defaultRestaurantId);
      },
      suspendEntitlement: async (entitlementId: string, restaurantId?: string) => {
        return this.adapter.suspendEntitlement(entitlementId, restaurantId || this.defaultRestaurantId);
      },
      activateEntitlement: async (entitlementId: string, restaurantId?: string) => {
        return this.adapter.activateEntitlement(entitlementId, restaurantId || this.defaultRestaurantId);
      },
      assignPlan: async (planId: string, restaurantId?: string, source?: EntitlementSource) => {
        return this.adapter.assignPlan(planId, restaurantId || this.defaultRestaurantId, source);
      },
      isSolutionEnabled: async (solutionId: string, restaurantId?: string) => {
        return this.adapter.isSolutionEnabled(solutionId, restaurantId || this.defaultRestaurantId);
      },
      hasCapability: async (capability: string, restaurantId?: string) => {
        return this.adapter.hasCapability(capability, restaurantId || this.defaultRestaurantId);
      },
      checkCapability: async (capability: string, restaurantId?: string) => {
        return this.adapter.checkCapability(capability, restaurantId || this.defaultRestaurantId);
      },
      authorizeAction: async (
        userId: string | undefined,
        permission?: Permission,
        capability?: string,
        restaurantId?: string
      ) => {
        return this.adapter.authorizeAction(userId, permission, capability, restaurantId || this.defaultRestaurantId);
      },
    };
  }

  public async getContext(userId: string, restaurantId?: string): Promise<CurrentRestaurantContext> {
    return this.adapter.getRestaurantContext(userId, restaurantId || this.defaultRestaurantId);
  }
}

