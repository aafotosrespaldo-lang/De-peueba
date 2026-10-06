/**
 * DIRECTAURANTE POS CORE v0.1 - Inventory & Kardex Core Service
 * Unified, persistent, atomic, multi-tenant inventory & kardex engine.
 * Single source of truth for physical stock, movements, physical counts and alerts.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  InventoryCount,
  InventoryCountItem,
  InventoryAlert,
  InventorySummary,
  InventoryUnit,
} from '../../core/types';
import { AuditService } from '../../core/audit';

export interface RegisterMovementParams {
  restaurant_id?: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  reason: string;
  reference_type: string;
  reference_id?: string;
  actor: string;
  cost_cents_per_unit?: number;
}

export interface PhysicalCountInput {
  restaurant_id?: string;
  performed_by: string;
  notes?: string;
  counts: Array<{
    inventory_item_id: string;
    counted_stock: number;
    reason?: string;
  }>;
}

export class InventoryService {
  /**
   * Helper to generate unique identifiers
   */
  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * List all inventory items for a restaurant with optional filters
   */
  public static getItems(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: {
      category?: string;
      search?: string;
      status?: 'all' | 'low_stock' | 'out_of_stock' | 'normal';
    }
  ): InventoryItem[] {
    const items = db.get('inventory_items') || [];
    let result = items.filter((item) => item.restaurant_id === restaurant_id && item.is_active);

    if (filters?.category && filters.category !== 'Todos') {
      result = result.filter(
        (i) => i.category.toLowerCase() === filters.category!.toLowerCase()
      );
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
      );
    }

    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'out_of_stock') {
        result = result.filter((i) => i.current_stock <= 0);
      } else if (filters.status === 'low_stock') {
        result = result.filter((i) => i.current_stock > 0 && i.current_stock <= i.min_stock);
      } else if (filters.status === 'normal') {
        result = result.filter((i) => i.current_stock > i.min_stock);
      }
    }

    return result;
  }

  /**
   * Get single inventory item by ID
   */
  public static getItemById(
    item_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): InventoryItem | undefined {
    const items = db.get('inventory_items') || [];
    return items.find((i) => i.id === item_id && i.restaurant_id === restaurant_id);
  }

  /**
   * Get stock status and thresholds for an item
   */
  public static getStock(
    item_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): {
    item: InventoryItem;
    current_stock: number;
    min_stock: number;
    base_unit: InventoryUnit;
    is_low: boolean;
    is_out: boolean;
  } {
    const item = this.getItemById(item_id, restaurant_id);
    if (!item) {
      throw new Error(`Insumo de inventario ${item_id} no encontrado en restaurante ${restaurant_id}.`);
    }

    return {
      item,
      current_stock: item.current_stock,
      min_stock: item.min_stock,
      base_unit: item.base_unit,
      is_low: item.current_stock > 0 && item.current_stock <= item.min_stock,
      is_out: item.current_stock <= 0,
    };
  }

  /**
   * Create or update an Inventory Item
   */
  public static createOrUpdateItem(
    itemData: Partial<InventoryItem> & { name: string; sku: string; base_unit: InventoryUnit },
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): InventoryItem {
    const items = db.get('inventory_items');
    const now = new Date().toISOString();

    if (itemData.id) {
      const existing = items.find((i) => i.id === itemData.id && i.restaurant_id === restaurant_id);
      if (!existing) {
        throw new Error(`Insumo ${itemData.id} no existe para modificar.`);
      }

      Object.assign(existing, {
        ...itemData,
        updated_at: now,
      });

      db.save();
      AuditService.log(
        'inventory_item_updated',
        'inventory_item',
        existing.id,
        actor,
        null,
        existing,
        `Insumo "${existing.name}" actualizado.`,
        restaurant_id
      );
      return existing;
    }

    // Check SKU uniqueness per restaurant
    const duplicateSku = items.find(
      (i) => i.sku.toUpperCase() === itemData.sku.toUpperCase() && i.restaurant_id === restaurant_id
    );
    if (duplicateSku) {
      throw new Error(`El SKU "${itemData.sku}" ya está registrado para "${duplicateSku.name}".`);
    }

    const newItem: InventoryItem = {
      id: this.generateId('inv'),
      restaurant_id,
      sku: itemData.sku.toUpperCase(),
      name: itemData.name,
      category: itemData.category || 'Insumos Cocina',
      current_stock: Number(itemData.current_stock) || 0,
      min_stock: Number(itemData.min_stock) || 5,
      max_stock: itemData.max_stock ? Number(itemData.max_stock) : undefined,
      base_unit: itemData.base_unit,
      purchase_unit: itemData.purchase_unit,
      conversion_factor: itemData.conversion_factor ? Number(itemData.conversion_factor) : undefined,
      cost_cents: Number(itemData.cost_cents) || 0,
      linked_product_id: itemData.linked_product_id,
      allow_negative_stock: Boolean(itemData.allow_negative_stock),
      is_active: itemData.is_active !== undefined ? itemData.is_active : true,
      created_at: now,
      updated_at: now,
    };

    items.push(newItem);

    // Initial movement if stock > 0
    if (newItem.current_stock > 0) {
      const movements = db.get('inventory_movements');
      const initMovement: InventoryMovement = {
        id: this.generateId('mov_inv'),
        restaurant_id,
        inventory_item_id: newItem.id,
        item_name: newItem.name,
        movement_type: 'initial_stock',
        quantity: newItem.current_stock,
        unit: newItem.base_unit,
        previous_stock: 0,
        new_stock: newItem.current_stock,
        reason: 'Inventario inicial de creación',
        reference_type: 'initial',
        reference_id: `INIT-${newItem.sku}`,
        user_id: actor,
        cost_cents_per_unit: newItem.cost_cents,
        created_at: now,
      };
      movements.push(initMovement);
    }

    db.save();
    AuditService.log(
      'inventory_item_created',
      'inventory_item',
      newItem.id,
      actor,
      null,
      newItem,
      `Nuevo insumo de inventario creado: "${newItem.name}" (${newItem.sku}).`,
      restaurant_id
    );

    return newItem;
  }

  /**
   * Register an atomic inventory movement.
   * Enforces:
   * 1. Multi-tenant isolation (restaurant_id)
   * 2. Idempotency (reference_type + reference_id per item)
   * 3. Non-negative stock protection (unless allow_negative_stock is set)
   * 4. Automatic commercial catalog availability synchronization
   * 5. Immutable audit trail
   */
  public static registerMovement(params: RegisterMovementParams): InventoryMovement {
    const restaurant_id = params.restaurant_id || DEFAULT_RESTAURANT_ID;
    const items = db.get('inventory_items');
    const movements = db.get('inventory_movements');

    const item = items.find((i) => i.id === params.inventory_item_id && i.restaurant_id === restaurant_id);
    if (!item) {
      throw new Error(`Insumo de inventario ${params.inventory_item_id} no encontrado en el restaurante.`);
    }

    // 1. Idempotency Check: if reference_type and reference_id already processed for this item, return existing
    if (params.reference_type && params.reference_id) {
      const existingMovement = movements.find(
        (m) =>
          m.restaurant_id === restaurant_id &&
          m.inventory_item_id === item.id &&
          m.reference_type === params.reference_type &&
          m.reference_id === params.reference_id
      );

      if (existingMovement) {
        return existingMovement;
      }
    }

    // 2. Compute Signed Delta based on movement type
    let delta = 0;
    const qty = Math.abs(params.quantity);

    switch (params.movement_type) {
      case 'purchase':
      case 'adjustment_in':
      case 'transfer_in':
      case 'initial_stock':
      case 'production_output':
      case 'return':
        delta = qty;
        break;

      case 'sale':
      case 'waste':
      case 'adjustment_out':
      case 'transfer_out':
      case 'purchase_return':
      case 'production_consumed':
      case 'production_waste':
        delta = -qty;
        break;

      case 'count_adjustment':
        // For count adjustments, quantity may be signed directly
        delta = params.quantity;
        break;

      default:
        delta = params.quantity;
        break;
    }

    if (delta === 0) {
      throw new Error('La cantidad del movimiento de inventario no puede ser cero.');
    }

    const previous_stock = item.current_stock;
    const new_stock = Math.round((previous_stock + delta) * 1000) / 1000;

    // 3. Negative Stock Validation
    if (new_stock < 0 && !item.allow_negative_stock) {
      throw new Error(
        `Existencia insuficiente para "${item.name}": se intentó descontar ${Math.abs(delta)} ${item.base_unit}, pero la existencia actual es de ${previous_stock} ${item.base_unit}. Operación rechazada.`
      );
    }

    // 4. Mutate Item Stock Atomically
    const now = new Date().toISOString();
    item.current_stock = new_stock;
    item.updated_at = now;

    // 5. Synchronize Commercial Catalog Availability
    this.syncProductCommercialAvailability(item);

    // 6. Record Movement
    const movement: InventoryMovement = {
      id: this.generateId('mov_inv'),
      restaurant_id,
      inventory_item_id: item.id,
      item_name: item.name,
      movement_type: params.movement_type,
      quantity: delta,
      unit: item.base_unit,
      previous_stock,
      new_stock,
      reason: params.reason || `Movimiento de tipo ${params.movement_type}`,
      reference_type: params.reference_type,
      reference_id: params.reference_id,
      user_id: params.actor,
      cost_cents_per_unit: params.cost_cents_per_unit || item.cost_cents,
      created_at: now,
    };

    movements.push(movement);
    db.save();

    // 7. Audit Log
    AuditService.log(
      'inventory_movement_created',
      'inventory_movement',
      movement.id,
      params.actor,
      { stock: previous_stock },
      { stock: new_stock, movement_type: params.movement_type, delta },
      `Movimiento ${params.movement_type} (${delta > 0 ? '+' : ''}${delta} ${item.base_unit}) en "${item.name}". Motivo: ${movement.reason}`,
      restaurant_id
    );

    return movement;
  }

  /**
   * Synchronize Product Commercial Availability
   * When physical stock hits zero, automatically disables commercial sale
   * When stock is replenished, automatically re-enables commercial sale
   */
  private static syncProductCommercialAvailability(item: InventoryItem): void {
    if (!item.linked_product_id) return;

    const products = db.get('products');
    const product = products.find(
      (p) => p.id === item.linked_product_id && p.restaurant_id === item.restaurant_id
    );

    if (product) {
      if (item.current_stock <= 0) {
        product.available = false;
      } else if (item.current_stock > 0 && !product.available) {
        product.available = true;
      }
    }
  }

  /**
   * Get Kardex (auditable movement history with running balance reconstruction)
   */
  public static getKardex(
    inventory_item_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: {
      start_date?: string;
      end_date?: string;
      movement_type?: string;
    }
  ): {
    item: InventoryItem;
    movements: Array<
      InventoryMovement & {
        in_qty: number;
        out_qty: number;
        running_balance: number;
      }
    >;
    current_stock: number;
    total_entries: number;
    total_exits: number;
  } {
    const item = this.getItemById(inventory_item_id, restaurant_id);
    if (!item) {
      throw new Error(`Insumo ${inventory_item_id} no encontrado en restaurante ${restaurant_id}.`);
    }

    const allMovements = db.get('inventory_movements') || [];
    let itemMovements = allMovements
      .filter((m) => m.inventory_item_id === item.id && m.restaurant_id === restaurant_id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (filters?.movement_type && filters.movement_type !== 'all') {
      itemMovements = itemMovements.filter((m) => m.movement_type === filters.movement_type);
    }

    if (filters?.start_date) {
      const start = new Date(filters.start_date).getTime();
      itemMovements = itemMovements.filter((m) => new Date(m.created_at).getTime() >= start);
    }

    if (filters?.end_date) {
      const end = new Date(filters.end_date).getTime();
      itemMovements = itemMovements.filter((m) => new Date(m.created_at).getTime() <= end);
    }

    let running = 0;
    let totalEntries = 0;
    let totalExits = 0;

    const formattedMovements = itemMovements.map((m) => {
      const in_qty = m.quantity > 0 ? m.quantity : 0;
      const out_qty = m.quantity < 0 ? Math.abs(m.quantity) : 0;
      running = Math.round((running + m.quantity) * 1000) / 1000;
      totalEntries += in_qty;
      totalExits += out_qty;

      return {
        ...m,
        in_qty,
        out_qty,
        running_balance: running,
      };
    });

    return {
      item,
      movements: formattedMovements.reverse(), // Return newest first for tabular display
      current_stock: item.current_stock,
      total_entries: Math.round(totalEntries * 1000) / 1000,
      total_exits: Math.round(totalExits * 1000) / 1000,
    };
  }

  /**
   * Process a Physical Inventory Count
   * Compares system stock with physical count and generates `count_adjustment` movements
   */
  public static applyPhysicalCount(input: PhysicalCountInput): InventoryCount {
    const restaurant_id = input.restaurant_id || DEFAULT_RESTAURANT_ID;
    const items = db.get('inventory_items');
    const counts = db.get('inventory_counts');
    const now = new Date().toISOString();

    const countId = this.generateId('count');
    const countItems: InventoryCountItem[] = [];

    for (const entry of input.counts) {
      const item = items.find((i) => i.id === entry.inventory_item_id && i.restaurant_id === restaurant_id);
      if (!item) continue;

      const system_stock = item.current_stock;
      const counted_stock = Math.round(Number(entry.counted_stock) * 1000) / 1000;
      const diff = Math.round((counted_stock - system_stock) * 1000) / 1000;

      countItems.push({
        inventory_item_id: item.id,
        item_name: item.name,
        sku: item.sku,
        system_stock,
        counted_stock,
        difference: diff,
        unit: item.base_unit,
        reason: entry.reason || 'Conteo físico periódico',
      });

      // If difference detected, register Kardex count adjustment movement
      if (diff !== 0) {
        this.registerMovement({
          restaurant_id,
          inventory_item_id: item.id,
          movement_type: 'count_adjustment',
          quantity: diff,
          reason: `Ajuste por conteo físico: Sistema ${system_stock} ${item.base_unit} ➔ Físico ${counted_stock} ${item.base_unit} (Dif: ${diff > 0 ? '+' : ''}${diff})`,
          reference_type: 'physical_count',
          reference_id: countId,
          actor: input.performed_by,
        });
      }

      item.last_count_at = now;
    }

    const record: InventoryCount = {
      id: countId,
      restaurant_id,
      performed_by: input.performed_by,
      notes: input.notes,
      status: 'applied',
      items: countItems,
      created_at: now,
      applied_at: now,
    };

    counts.push(record);
    db.save();

    AuditService.log(
      'physical_count_applied',
      'inventory_count',
      countId,
      input.performed_by,
      null,
      { count_items_count: countItems.length },
      `Conteo físico aplicado para ${countItems.length} insumos por ${input.performed_by}.`,
      restaurant_id
    );

    return record;
  }

  /**
   * Get Active Stock Alerts (out of stock + low stock)
   */
  public static getAlerts(restaurant_id: string = DEFAULT_RESTAURANT_ID): InventoryAlert[] {
    const items = this.getItems(restaurant_id, { status: 'all' });
    const alerts: InventoryAlert[] = [];

    for (const item of items) {
      if (item.current_stock <= 0) {
        alerts.push({
          inventory_item_id: item.id,
          item_name: item.name,
          sku: item.sku,
          current_stock: item.current_stock,
          min_stock: item.min_stock,
          unit: item.base_unit,
          type: 'out_of_stock',
          message: `Producto AGOTADO (0 ${item.base_unit} restantes). Requiere reposición inmediata.`,
          severity: 'critical',
        });
      } else if (item.current_stock <= item.min_stock) {
        alerts.push({
          inventory_item_id: item.id,
          item_name: item.name,
          sku: item.sku,
          current_stock: item.current_stock,
          min_stock: item.min_stock,
          unit: item.base_unit,
          type: 'low_stock',
          message: `Existencia baja: ${item.current_stock} ${item.base_unit} (Mínimo: ${item.min_stock} ${item.base_unit}).`,
          severity: 'warning',
        });
      }
    }

    return alerts;
  }

  /**
   * Get Overall Inventory Summary
   */
  public static getSummary(restaurant_id: string = DEFAULT_RESTAURANT_ID): InventorySummary {
    const items = this.getItems(restaurant_id);
    const alerts = this.getAlerts(restaurant_id);
    const movements = db.get('inventory_movements') || [];

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentMovements = movements.filter(
      (m) => m.restaurant_id === restaurant_id && new Date(m.created_at).getTime() >= oneDayAgo
    );

    let totalValuationCents = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of items) {
      totalValuationCents += Math.round(item.current_stock * item.cost_cents);
      if (item.current_stock <= 0) {
        outOfStockCount++;
      } else if (item.current_stock <= item.min_stock) {
        lowStockCount++;
      }
    }

    return {
      total_items: items.length,
      total_valuation_cents: totalValuationCents,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
      recent_movements_count: recentMovements.length,
      alerts,
    };
  }

  /**
   * Export Kardex to standard CSV string
   */
  public static exportKardexCsv(
    inventory_item_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): string {
    const kardex = this.getKardex(inventory_item_id, restaurant_id);
    const headers = [
      'Fecha',
      'SKU',
      'Insumo',
      'Tipo de Movimiento',
      'Entrada',
      'Salida',
      'Saldo',
      'Unidad',
      'Motivo',
      'Referencia',
      'Usuario',
    ];

    const rows = kardex.movements.map((m) => [
      `"${m.created_at}"`,
      `"${kardex.item.sku}"`,
      `"${kardex.item.name}"`,
      `"${m.movement_type}"`,
      m.in_qty > 0 ? m.in_qty : '',
      m.out_qty > 0 ? m.out_qty : '',
      m.running_balance,
      `"${m.unit}"`,
      `"${(m.reason || '').replace(/"/g, '""')}"`,
      `"${m.reference_id || ''}"`,
      `"${m.user_id}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Export Full Inventory Snapshot to standard CSV string
   */
  public static exportInventoryCsv(restaurant_id: string = DEFAULT_RESTAURANT_ID): string {
    const items = this.getItems(restaurant_id);
    const headers = [
      'SKU',
      'Nombre',
      'Categoría',
      'Stock Actual',
      'Stock Mínimo',
      'Unidad Base',
      'Unidad Compra',
      'Factor Conversión',
      'Costo Unitario MXN',
      'Valoración Total MXN',
      'Estado',
    ];

    const rows = items.map((i) => {
      let status = 'Normal';
      if (i.current_stock <= 0) status = 'Agotado';
      else if (i.current_stock <= i.min_stock) status = 'Stock Bajo';

      const unitCostMxn = (i.cost_cents / 100).toFixed(2);
      const totalMxn = ((i.current_stock * i.cost_cents) / 100).toFixed(2);

      return [
        `"${i.sku}"`,
        `"${i.name.replace(/"/g, '""')}"`,
        `"${i.category}"`,
        i.current_stock,
        i.min_stock,
        `"${i.base_unit}"`,
        `"${i.purchase_unit || ''}"`,
        i.conversion_factor || 1,
        unitCostMxn,
        totalMxn,
        `"${status}"`,
      ];
    });

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Sale Stock Deduction Hook (Single Source of Truth)
   * Deducts physical inventory when a commercial product linked to an inventory item is ordered.
   */
  public static deductProductSale(params: {
    restaurant_id?: string;
    product_id: string;
    quantity: number;
    order_id: string;
    actor: string;
  }): InventoryMovement | null {
    const restaurant_id = params.restaurant_id || DEFAULT_RESTAURANT_ID;
    const products = db.get('products');
    const product = products.find((p) => p.id === params.product_id && p.restaurant_id === restaurant_id);
    if (!product || !product.inventory_item_id) {
      return null;
    }

    return this.registerMovement({
      restaurant_id,
      inventory_item_id: product.inventory_item_id,
      movement_type: 'sale',
      quantity: params.quantity,
      reason: `Venta POS Orden ${params.order_id}`,
      reference_type: 'sale',
      reference_id: params.order_id,
      actor: params.actor,
    });
  }
}
