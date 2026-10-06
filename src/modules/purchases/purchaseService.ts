/**
 * DIRECTAURANTE POS CORE v0.1 - Purchases & Suppliers Core Service (FASE 8)
 * Connects Purchases -> Receiving -> F6 Inventory Movement -> F6 Kardex -> F7 Recipes COGS.
 * 
 * Rules:
 * 1. F6 is the ONLY source of truth for stock and Kardex.
 * 2. Creating or approving a Purchase Order does NOT affect inventory.
 * 3. Inventory strictly increases when merchandise is received (PurchaseReceipt).
 * 4. Partial receptions are accurately tracked without duplicate quantities.
 * 5. Receptions are 100% idempotent via reference_type 'purchase_receipt' and receipt ID.
 * 6. Cost updates reflect in F6 Inventory and dynamically update F7 Recipe COGS.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  Supplier,
  SupplierProduct,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseReceipt,
  PurchaseReceiptItem,
  PriceHistoryRecord,
  PurchaseSummary,
  InventoryUnit,
  InventoryMovement,
} from '../../core/types';
import { InventoryService } from '../inventory/inventoryService';
import { RecipeService } from '../recipes/recipeService';
import { AuditService } from '../../core/audit';

export interface CreateSupplierDTO {
  name: string;
  legal_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
  notes?: string;
  products?: SupplierProduct[];
  is_active?: boolean;
}

export interface CreatePurchaseOrderDTO {
  supplier_id: string;
  items: Array<{
    inventory_item_id: string;
    quantity_ordered: number;
    unit: InventoryUnit;
    cost_cents_per_unit: number;
    notes?: string;
  }>;
  notes?: string;
  due_date?: string;
  status?: PurchaseOrderStatus; // defaults to 'draft'
}

export interface ReceiveItemInput {
  purchase_order_item_id: string;
  quantity_received: number; // Delivered total
  quantity_accepted?: number; // Enters physical inventory (defaults to quantity_received)
  quantity_rejected?: number; // Damaged, broken or spoiled
  rejection_reason?: string;
  unit?: InventoryUnit;
  cost_cents_per_unit?: number; // Cost per receipt unit
}

export interface ReceivePurchaseOrderDTO {
  receipt_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  received_by?: string;
  items: ReceiveItemInput[];
  notes?: string;
  freight_cents?: number;
  discount_cents?: number;
  tax_cents?: number;
  cost_update_policy?: 'last_cost' | 'average_cost';
}

export interface MarginImpactAlert {
  inventory_item_id: string;
  item_name: string;
  old_cost_cents: number;
  new_cost_cents: number;
  percentage_change: number;
  impacted_recipes: Array<{
    recipe_id: string;
    recipe_name: string;
    old_margin_percent: number;
    new_margin_percent: number;
  }>;
}

export class PurchaseService {
  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  // ==========================================
  // 1. SUPPLIERS MANAGEMENT
  // ==========================================

  public static getSuppliers(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: { search?: string; is_active?: boolean }
  ): Supplier[] {
    const suppliers = db.get('suppliers') || [];
    let result = suppliers.filter((s) => s.restaurant_id === restaurant_id);

    if (filters?.is_active !== undefined) {
      result = result.filter((s) => s.is_active === filters.is_active);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.legal_name && s.legal_name.toLowerCase().includes(q)) ||
          (s.tax_id && s.tax_id.toLowerCase().includes(q))
      );
    }

    return result;
  }

  public static getSupplierById(
    supplier_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Supplier | undefined {
    const suppliers = db.get('suppliers') || [];
    return suppliers.find((s) => s.id === supplier_id && s.restaurant_id === restaurant_id);
  }

  public static createSupplier(
    data: CreateSupplierDTO,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Supplier {
    if (!data.name || !data.name.trim()) {
      throw new Error('El nombre comercial del proveedor es obligatorio.');
    }

    const suppliers = db.get('suppliers');
    const now = new Date().toISOString();

    const newSupplier: Supplier = {
      id: this.generateId('sup'),
      restaurant_id,
      name: data.name.trim(),
      legal_name: data.legal_name?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      address: data.address?.trim() || undefined,
      tax_id: data.tax_id?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      products: data.products || [],
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_at: now,
      updated_at: now,
    };

    suppliers.push(newSupplier);
    db.save();

    AuditService.log(
      'supplier_created',
      'supplier',
      newSupplier.id,
      actor,
      null,
      newSupplier,
      `Proveedor registrado: "${newSupplier.name}".`,
      restaurant_id
    );

    return newSupplier;
  }

  public static updateSupplier(
    supplier_id: string,
    data: Partial<CreateSupplierDTO>,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Supplier {
    const supplier = this.getSupplierById(supplier_id, restaurant_id);
    if (!supplier) {
      throw new Error(`Proveedor ${supplier_id} no encontrado.`);
    }

    const oldState = { ...supplier };
    Object.assign(supplier, {
      ...data,
      updated_at: new Date().toISOString(),
    });

    db.save();

    AuditService.log(
      'supplier_updated',
      'supplier',
      supplier.id,
      actor,
      oldState,
      supplier,
      `Proveedor actualizado: "${supplier.name}".`,
      restaurant_id
    );

    return supplier;
  }

  public static deleteSupplier(
    supplier_id: string,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): boolean {
    const supplier = this.getSupplierById(supplier_id, restaurant_id);
    if (!supplier) {
      return false;
    }

    supplier.is_active = false;
    supplier.updated_at = new Date().toISOString();
    db.save();

    AuditService.log(
      'supplier_deactivated',
      'supplier',
      supplier.id,
      actor,
      null,
      supplier,
      `Proveedor desactivado: "${supplier.name}".`,
      restaurant_id
    );

    return true;
  }

  public static linkSupplierProduct(
    supplier_id: string,
    product: SupplierProduct,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Supplier {
    const supplier = this.getSupplierById(supplier_id, restaurant_id);
    if (!supplier) {
      throw new Error(`Proveedor ${supplier_id} no encontrado.`);
    }

    const invItem = InventoryService.getItemById(product.inventory_item_id, restaurant_id);
    if (!invItem) {
      throw new Error(`Insumo de inventario ${product.inventory_item_id} no existe.`);
    }

    if (!supplier.products) {
      supplier.products = [];
    }

    const existingIdx = supplier.products.findIndex(
      (p) => p.inventory_item_id === product.inventory_item_id
    );

    const enrichedProduct: SupplierProduct = {
      ...product,
      item_name: invItem.name,
      conversion_factor: product.conversion_factor || invItem.conversion_factor || 1,
    };

    if (existingIdx >= 0) {
      supplier.products[existingIdx] = enrichedProduct;
    } else {
      supplier.products.push(enrichedProduct);
    }

    supplier.updated_at = new Date().toISOString();
    db.save();

    AuditService.log(
      'supplier_product_linked',
      'supplier',
      supplier.id,
      actor,
      null,
      enrichedProduct,
      `Insumo "${invItem.name}" vinculado a proveedor "${supplier.name}".`,
      restaurant_id
    );

    return supplier;
  }

  // ==========================================
  // 2. PURCHASE ORDERS (ÓRDENES DE COMPRA)
  // ==========================================

  public static getPurchaseOrders(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: { status?: PurchaseOrderStatus; supplier_id?: string; search?: string }
  ): PurchaseOrder[] {
    const orders = db.get('purchase_orders') || [];
    let result = orders.filter((o) => o.restaurant_id === restaurant_id);

    if (filters?.status) {
      result = result.filter((o) => o.status === filters.status);
    }

    if (filters?.supplier_id) {
      result = result.filter((o) => o.supplier_id === filters.supplier_id);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.supplier_name.toLowerCase().includes(q) ||
          (o.notes && o.notes.toLowerCase().includes(q))
      );
    }

    // Sort descending by created_at
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public static getPurchaseOrderById(
    order_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): PurchaseOrder | undefined {
    const orders = db.get('purchase_orders') || [];
    return orders.find((o) => (o.id === order_id || o.order_number === order_id) && o.restaurant_id === restaurant_id);
  }

  /**
   * Create a purchase order.
   * CRITICAL RULE: Creating a purchase order does NOT modify physical inventory or create kardex movements!
   */
  public static createPurchaseOrder(
    data: CreatePurchaseOrderDTO,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): PurchaseOrder {
    const supplier = this.getSupplierById(data.supplier_id, restaurant_id);
    if (!supplier) {
      throw new Error(`Proveedor ${data.supplier_id} no encontrado en el restaurante.`);
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('La orden de compra debe contener al menos un insumo.');
    }

    const orders = db.get('purchase_orders');
    const now = new Date().toISOString();

    // Generate formatted order number OC-000102
    const currentCount = orders.filter((o) => o.restaurant_id === restaurant_id).length + 101;
    const orderNumber = `OC-${String(currentCount).padStart(6, '0')}`;

    let subtotalCents = 0;
    const items: PurchaseOrderItem[] = data.items.map((item, idx) => {
      const invItem = InventoryService.getItemById(item.inventory_item_id, restaurant_id);
      if (!invItem) {
        throw new Error(`Insumo de inventario ${item.inventory_item_id} no existe.`);
      }

      if (item.quantity_ordered <= 0) {
        throw new Error(`La cantidad pedida para "${invItem.name}" debe ser mayor a 0.`);
      }

      const lineTotalCents = Math.round(item.quantity_ordered * item.cost_cents_per_unit);
      subtotalCents += lineTotalCents;

      return {
        id: `poi_${Date.now()}_${idx + 1}`,
        inventory_item_id: invItem.id,
        item_name: invItem.name,
        sku: invItem.sku,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit: item.unit,
        cost_cents_per_unit: item.cost_cents_per_unit,
        total_cost_cents: lineTotalCents,
        notes: item.notes?.trim() || undefined,
      };
    });

    const status: PurchaseOrderStatus = data.status || 'draft';
    const newOrder: PurchaseOrder = {
      id: this.generateId('po'),
      restaurant_id,
      order_number: orderNumber,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      status,
      items,
      subtotal_cents: subtotalCents,
      tax_cents: 0,
      total_cents: subtotalCents,
      receipts: [],
      payment_status: 'pending',
      paid_amount_cents: 0,
      due_date: data.due_date || new Date(Date.now() + 15 * 86400000).toISOString(),
      notes: data.notes?.trim() || undefined,
      ordered_at: status === 'ordered' ? now : undefined,
      created_at: now,
      updated_at: now,
    };

    orders.push(newOrder);
    db.save();

    AuditService.log(
      'purchase_order_created',
      'purchase_order',
      newOrder.id,
      actor,
      null,
      newOrder,
      `Orden de compra ${newOrder.order_number} creada para "${supplier.name}" (${items.length} partidas, total: $${(subtotalCents / 100).toFixed(2)}).`,
      restaurant_id
    );

    return newOrder;
  }

  /**
   * Update order status (draft -> ordered -> cancelled).
   * Changing to ordered does NOT modify physical stock.
   */
  public static updateOrderStatus(
    order_id: string,
    status: PurchaseOrderStatus,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): PurchaseOrder {
    const order = this.getPurchaseOrderById(order_id, restaurant_id);
    if (!order) {
      throw new Error(`Orden de compra ${order_id} no encontrada.`);
    }

    if (order.status === 'received' && status !== 'received') {
      throw new Error('Una orden completamente recibida no puede cambiar de estado.');
    }

    const oldStatus = order.status;
    order.status = status;
    order.updated_at = new Date().toISOString();

    if (status === 'ordered' && !order.ordered_at) {
      order.ordered_at = new Date().toISOString();
    }

    db.save();

    AuditService.log(
      'purchase_order_status_changed',
      'purchase_order',
      order.id,
      actor,
      { status: oldStatus },
      { status },
      `Estado de orden ${order.order_number} cambió de "${oldStatus}" a "${status}".`,
      restaurant_id
    );

    return order;
  }

  /**
   * Update purchase order general details
   */
  public static updatePurchaseOrder(
    order_id: string,
    data: Partial<PurchaseOrder>,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): PurchaseOrder {
    const order = this.getPurchaseOrderById(order_id, restaurant_id);
    if (!order) {
      throw new Error(`Orden de compra ${order_id} no encontrada.`);
    }

    const old = { ...order };
    Object.assign(order, {
      ...data,
      updated_at: new Date().toISOString(),
    });

    db.save();

    AuditService.log(
      'purchase_order_updated',
      'purchase_order',
      order.id,
      actor,
      old,
      order,
      `Orden ${order.order_number} actualizada.`,
      restaurant_id
    );

    return order;
  }

  // ==========================================
  // 3. RECEIVING & INVENTORY ENTRY (F8 -> F6 -> F7)
  // ==========================================

  /**
   * Process merchandise reception for a Purchase Order.
   * 
   * Flujo fundamental:
   * 1. Validación de orden y partidas.
   * 2. Idempotencia: verificación de receipt_number y receipt_id.
   * 3. Conversión de unidad de compra a unidad base del insumo en F6.
   * 4. Registro atómico de movimientos en F6 Kardex (movement_type: 'purchase').
   * 5. Merma/Rechazos: sólo quantity_accepted entra al inventario.
   * 6. Actualización de costo en InventoryItem (last_cost o promedio ponderado CPP).
   * 7. Recálculo dinámico de COGS en F7 Recetas y detección de alertas de margen.
   * 8. Transición de estado de la OC (partially_received o received).
   */
  public static receivePurchaseOrder(
    order_id: string,
    receiptData: ReceivePurchaseOrderDTO,
    actor: string = 'Almacenista',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): {
    purchase_order: PurchaseOrder;
    receipt: PurchaseReceipt;
    movements: InventoryMovement[];
    price_changes: PriceHistoryRecord[];
    margin_alerts: MarginImpactAlert[];
  } {
    const order = this.getPurchaseOrderById(order_id, restaurant_id);
    if (!order) {
      throw new Error(`Orden de compra ${order_id} no encontrada.`);
    }

    if (order.status === 'cancelled') {
      throw new Error(`La orden de compra ${order.order_number} está cancelada y no puede recibir mercancía.`);
    }

    if (order.status === 'received') {
      throw new Error(`La orden de compra ${order.order_number} ya fue recibida en su totalidad.`);
    }

    if (!receiptData.items || receiptData.items.length === 0) {
      throw new Error('Debe especificar al menos una partida para recibir.');
    }

    const now = new Date().toISOString();
    const receiptNumber =
      receiptData.receipt_number?.trim() ||
      `REC-${String((order.receipts?.length || 0) + 1).padStart(5, '0')}`;

    // IDEMPOTENCY CHECK:
    // If a receipt with this receipt_number or invoice_number already exists on this order, return existing.
    if (!order.receipts) {
      order.receipts = [];
    }

    const existingReceipt = order.receipts.find(
      (r) =>
        r.receipt_number === receiptNumber ||
        (receiptData.invoice_number && r.invoice_number === receiptData.invoice_number)
    );

    if (existingReceipt) {
      return {
        purchase_order: order,
        receipt: existingReceipt,
        movements: [],
        price_changes: [],
        margin_alerts: [],
      };
    }

    const receiptId = this.generateId('rec');
    const movements: InventoryMovement[] = [];
    const priceChanges: PriceHistoryRecord[] = [];
    const marginAlerts: MarginImpactAlert[] = [];
    const priceHistoryCollection = db.get('price_history');

    let receiptSubtotalCents = 0;
    const receiptItems: PurchaseReceiptItem[] = [];

    // Process each received item
    for (const recInput of receiptData.items) {
      const orderItem = order.items.find((i) => i.id === recInput.purchase_order_item_id);
      if (!orderItem) {
        throw new Error(`Partida de orden ${recInput.purchase_order_item_id} no pertenece a esta orden de compra.`);
      }

      const invItem = InventoryService.getItemById(orderItem.inventory_item_id, restaurant_id);
      if (!invItem) {
        throw new Error(`Insumo físico ${orderItem.inventory_item_id} no existe en inventario.`);
      }

      const quantityReceived = recInput.quantity_received;
      const quantityAccepted = recInput.quantity_accepted !== undefined ? recInput.quantity_accepted : quantityReceived;
      const quantityRejected = recInput.quantity_rejected || 0;

      if (quantityReceived <= 0) {
        continue;
      }

      if (quantityAccepted < 0 || quantityAccepted > quantityReceived) {
        throw new Error(
          `Cantidad aceptada inválida (${quantityAccepted}) para "${invItem.name}". Debe estar entre 0 y ${quantityReceived}.`
        );
      }

      const unit = recInput.unit || orderItem.unit;
      const costPerUnit = recInput.cost_cents_per_unit !== undefined ? recInput.cost_cents_per_unit : orderItem.cost_cents_per_unit;

      // 1. Resolve conversion factor from purchase unit to physical inventory base unit
      // Reutiliza sistema de unidades del Core (F6 / F7)
      const conversionFactor = RecipeService.convertUnit(1, unit, invItem.base_unit, invItem.conversion_factor);
      const baseQuantityAccepted = Math.round(quantityAccepted * conversionFactor * 1000) / 1000;
      const costPerBaseUnit = Math.round(costPerUnit / conversionFactor);

      const lineTotalCents = Math.round(quantityReceived * costPerUnit);
      receiptSubtotalCents += lineTotalCents;

      receiptItems.push({
        purchase_order_item_id: orderItem.id,
        inventory_item_id: invItem.id,
        item_name: invItem.name,
        quantity_received: quantityReceived,
        quantity_accepted: quantityAccepted,
        quantity_rejected: quantityRejected,
        rejection_reason: recInput.rejection_reason?.trim() || undefined,
        unit,
        cost_cents_per_unit: costPerUnit,
        conversion_factor: conversionFactor,
        base_unit: invItem.base_unit,
      });

      // 2. Physical Inventory Entry in F6 Kardex ONLY for quantity_accepted!
      if (baseQuantityAccepted > 0) {
        const movement = InventoryService.registerMovement({
          restaurant_id,
          inventory_item_id: invItem.id,
          movement_type: 'purchase',
          quantity: baseQuantityAccepted, // Positive, increases stock
          cost_cents_per_unit: costPerBaseUnit,
          reference_type: 'purchase_receipt',
          reference_id: receiptId,
          reason: `Recepción compra ${order.order_number} (${receiptNumber}) [${quantityAccepted} ${unit}]`,
          actor,
        });
        movements.push(movement);

        // 3. Cost Update Policy
        const oldCostCents = invItem.cost_cents;
        let newCostCents = oldCostCents;
        const policy = receiptData.cost_update_policy || 'last_cost';

        if (policy === 'average_cost') {
          // Weighted Average Cost (Costo Promedio Ponderado - CPP)
          // CPP = ((stock_anterior * costo_anterior) + (entrada * costo_entrada)) / (stock_total)
          const prevStock = movement.previous_stock;
          const totalStock = movement.new_stock;
          if (totalStock > 0 && prevStock >= 0) {
            newCostCents = Math.round(
              ((prevStock * oldCostCents) + (baseQuantityAccepted * costPerBaseUnit)) / totalStock
            );
          } else {
            newCostCents = costPerBaseUnit;
          }
        } else {
          // Last Cost Policy (default)
          newCostCents = costPerBaseUnit;
        }

        // Update inventory item cost
        invItem.cost_cents = newCostCents;
        invItem.cost_cents_per_unit = newCostCents;
        invItem.last_purchase_cost_cents = costPerBaseUnit;
        invItem.updated_at = now;

        // 4. Record Price History
        const priceRecord: PriceHistoryRecord = {
          id: this.generateId('ph'),
          restaurant_id,
          inventory_item_id: invItem.id,
          item_name: invItem.name,
          supplier_id: order.supplier_id,
          supplier_name: order.supplier_name,
          purchase_order_id: order.id,
          receipt_id: receiptId,
          quantity_received: quantityAccepted,
          unit,
          cost_cents_per_unit: costPerUnit,
          cost_cents_per_base_unit: costPerBaseUnit,
          date: now,
        };
        priceHistoryCollection.push(priceRecord);
        priceChanges.push(priceRecord);

        // 5. Margin Impact Check on F7 Recipes
        if (newCostCents > oldCostCents) {
          const percentageChange = Math.round(((newCostCents - oldCostCents) / oldCostCents) * 100);
          const allRecipes = RecipeService.getRecipes(restaurant_id, { is_active: true });
          const impacted = allRecipes.filter((r) =>
            r.items.some((i) => i.inventory_item_id === invItem.id)
          );

          if (impacted.length > 0) {
            const recipeImpacts: Array<{
              recipe_id: string;
              recipe_name: string;
              old_margin_percent: number;
              new_margin_percent: number;
            }> = [];

            for (const r of impacted) {
              // Calculate new cost
              const calc = RecipeService.calculateRecipeCost(r, restaurant_id);
              // Old margin approximation:
              const unitCostDiff = (newCostCents - oldCostCents);
              const recipeItem = r.items.find((i) => i.inventory_item_id === invItem.id);
              const qtyInRecipe = recipeItem ? recipeItem.quantity : 1;
              const oldCogs = Math.max(0, calc.cogs_cents - Math.round(qtyInRecipe * unitCostDiff));
              const oldMargin = calc.selling_price_cents > 0
                ? Math.round(((calc.selling_price_cents - oldCogs) / calc.selling_price_cents) * 100)
                : 0;

              recipeImpacts.push({
                recipe_id: r.id,
                recipe_name: r.name,
                old_margin_percent: oldMargin,
                new_margin_percent: calc.gross_margin_percent,
              });
            }

            marginAlerts.push({
              inventory_item_id: invItem.id,
              item_name: invItem.name,
              old_cost_cents: oldCostCents,
              new_cost_cents: newCostCents,
              percentage_change: percentageChange,
              impacted_recipes: recipeImpacts,
            });
          }
        }
      }

      // Update Order Item cumulative received quantity
      orderItem.quantity_received = Math.round((orderItem.quantity_received + quantityAccepted) * 1000) / 1000;
    }

    // Build Receipt record
    const freightCents = receiptData.freight_cents || 0;
    const discountCents = receiptData.discount_cents || 0;
    const taxCents = receiptData.tax_cents || 0;
    const receiptTotalCents = receiptSubtotalCents + freightCents + taxCents - discountCents;

    const receipt: PurchaseReceipt = {
      id: receiptId,
      restaurant_id,
      purchase_order_id: order.id,
      receipt_number: receiptNumber,
      invoice_number: receiptData.invoice_number?.trim() || undefined,
      invoice_date: receiptData.invoice_date || now,
      received_by: receiptData.received_by || actor,
      received_at: now,
      items: receiptItems,
      subtotal_cents: receiptSubtotalCents,
      freight_cents: freightCents,
      discount_cents: discountCents,
      tax_cents: taxCents,
      total_cents: receiptTotalCents,
      notes: receiptData.notes?.trim() || undefined,
    };

    order.receipts.push(receipt);

    // Determine new status for Purchase Order
    // Partially received vs Completely received
    const allCompleted = order.items.every((i) => i.quantity_received >= i.quantity_ordered);
    const anyReceived = order.items.some((i) => i.quantity_received > 0);

    if (allCompleted) {
      order.status = 'received';
    } else if (anyReceived) {
      order.status = 'partially_received';
    }

    order.updated_at = now;
    db.save();

    AuditService.log(
      'purchase_order_received',
      'purchase_order',
      order.id,
      actor,
      null,
      receipt,
      `Mercancía recibida para orden ${order.order_number} (${receiptNumber}, Factura: ${receipt.invoice_number || 'N/A'}). Nuevo estado: ${order.status}.`,
      restaurant_id
    );

    return {
      purchase_order: order,
      receipt,
      movements,
      price_changes: priceChanges,
      margin_alerts: marginAlerts,
    };
  }

  // ==========================================
  // 4. PRICE HISTORY & REPORTING
  // ==========================================

  public static getPriceHistory(
    inventory_item_id?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): PriceHistoryRecord[] {
    const history = db.get('price_history') || [];
    let result = history.filter((h) => h.restaurant_id === restaurant_id);

    if (inventory_item_id) {
      result = result.filter((h) => h.inventory_item_id === inventory_item_id);
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public static getSummary(
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): PurchaseSummary {
    const orders = this.getPurchaseOrders(restaurant_id);
    const suppliers = this.getSuppliers(restaurant_id, { is_active: true });
    const priceHistory = this.getPriceHistory(undefined, restaurant_id);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let pendingCount = 0;
    let partialCount = 0;
    let receivedTodayCount = 0;
    let monthlySpendCents = 0;

    for (const order of orders) {
      if (order.status === 'draft' || order.status === 'ordered') {
        pendingCount++;
      } else if (order.status === 'partially_received') {
        partialCount++;
      }

      // Check receipts
      for (const rec of order.receipts || []) {
        const recDate = new Date(rec.received_at);
        if (rec.received_at.startsWith(todayStr)) {
          receivedTodayCount++;
        }
        if (recDate.getTime() >= monthStart) {
          monthlySpendCents += rec.total_cents;
        }
      }
    }

    // Recent price increases (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentRecords = priceHistory.filter((p) => new Date(p.date).getTime() >= thirtyDaysAgo);

    return {
      total_orders: orders.length,
      pending_orders_count: pendingCount,
      partially_received_count: partialCount,
      received_today_count: receivedTodayCount,
      total_suppliers: suppliers.length,
      total_monthly_spend_cents: monthlySpendCents,
      recent_price_increases_count: Math.min(recentRecords.length, 5),
    };
  }

  /**
   * Process a supplier return (Section 18).
   * Generates InventoryMovement(type: 'purchase_return', delta: -quantity)
   * Does NOT delete the original reception. Net balance = receptions - returns.
   */
  public static returnToSupplier(
    order_id: string,
    params: {
      inventory_item_id: string;
      quantity: number;
      unit?: InventoryUnit;
      reason: string;
      actor?: string;
      restaurant_id?: string;
    }
  ): InventoryMovement {
    const restaurant_id = params.restaurant_id || DEFAULT_RESTAURANT_ID;
    const actor = params.actor || 'Almacenista';
    const order = this.getPurchaseOrderById(order_id, restaurant_id);
    if (!order) {
      throw new Error(`Orden de compra ${order_id} no encontrada.`);
    }

    const invItem = InventoryService.getItemById(params.inventory_item_id, restaurant_id);
    if (!invItem) {
      throw new Error(`Insumo ${params.inventory_item_id} no encontrado en almacén.`);
    }

    const conversionFactor = RecipeService.convertUnit(1, params.unit || invItem.base_unit, invItem.base_unit, invItem.conversion_factor);
    const baseQuantity = Math.round(params.quantity * conversionFactor * 1000) / 1000;

    const returnId = this.generateId('ret');

    // Register movement in F6 Kardex
    const movement = InventoryService.registerMovement({
      restaurant_id,
      inventory_item_id: invItem.id,
      movement_type: 'purchase_return',
      quantity: baseQuantity,
      reference_type: 'purchase_return',
      reference_id: returnId,
      reason: `Devolución a proveedor ${order.supplier_name} (OC: ${order.order_number}): ${params.reason}`,
      actor,
    });

    AuditService.log(
      'purchase_return_processed',
      'purchase_order',
      order.id,
      actor,
      null,
      movement,
      `Devolución a proveedor procesada para "${invItem.name}" (${params.quantity} ${params.unit || invItem.base_unit}). Motivo: ${params.reason}.`,
      restaurant_id
    );

    return movement;
  }

  /**
   * Cancel a purchase order (Section 32).
   * Draft can be cancelled directly.
   * If ordered, transitions to cancelled without modifying stock.
   * If received, rejects deletion/cancellation because it already affected inventory.
   */
  public static cancelPurchaseOrder(
    order_id: string,
    reason: string = 'Cancelado por usuario',
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): PurchaseOrder {
    const order = this.getPurchaseOrderById(order_id, restaurant_id);
    if (!order) {
      throw new Error(`Orden de compra ${order_id} no encontrada.`);
    }

    if (order.status === 'received') {
      throw new Error(`La orden ${order.order_number} ya fue recibida y afectó inventario; debe procesarse mediante devolución a proveedor.`);
    }

    order.status = 'cancelled';
    order.notes = order.notes ? `${order.notes} | Cancelada: ${reason}` : `Cancelada: ${reason}`;
    order.updated_at = new Date().toISOString();
    db.save();

    AuditService.log(
      'purchase_order_cancelled',
      'purchase_order',
      order.id,
      actor,
      null,
      order,
      `Orden de compra ${order.order_number} cancelada. Motivo: ${reason}.`,
      restaurant_id
    );

    return order;
  }
}
