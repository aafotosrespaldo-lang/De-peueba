/**
 * DIRECTAURANTE POS CORE v0.1 - POS Service
 * Core business engine implementing the authoritative restaurant domain hierarchy:
 * TABLE -> TABLE SESSION -> GUEST SUBACCOUNT -> ORDER TICKET / ORDER -> ORDER ITEM
 * Enforces:
 * 1. String UUID domain identifiers (no ObjectId in POS domain contracts).
 * 2. TableSession first-class lifecycle (only 1 active session per table).
 * 3. GuestSubaccount strictly bound to table_session_id.
 * 4. Multiple comanda tickets (Order #001, #002, #003) under the SAME table_session_id.
 * 5. Unified financial settlement at TableSession level with individual guest subaccounts.
 * 6. Deterministic allergy prevention and full audit trail.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
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
  Allergy,
  Ingredient,
} from '../../core/types';
import { eventBus } from '../../core/eventBus';
import { AuditService } from '../../core/audit';
import { RecipeService } from '../recipes/recipeService';
import { FinanceService } from '../finance/financeService';

export interface AllergyConflict {
  allergy: Allergy;
  conflicting_ingredient: Ingredient;
  product: Product;
  severity: 'mild' | 'moderate' | 'severe';
  message: string;
}

export class PosService {
  /**
   * Helper to generate UUID/string IDs
   */
  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get all tables with real-time operational status, guests count, active items and total.
   */
  public static getTables(restaurant_id: string = DEFAULT_RESTAURANT_ID): Array<
    Table & {
      guests_count: number;
      active_items_count: number;
      total_cents: number;
      active_session?: TableSession;
    }
  > {
    const tables = db.get('tables').filter((t) => t.restaurant_id === restaurant_id);
    const sessions = db.get('table_sessions');
    const subaccounts = db.get('guest_subaccounts');
    const items = db.get('order_items');

    return tables.map((tbl) => {
      const activeSession = tbl.active_session_id
        ? sessions.find((s) => s.id === tbl.active_session_id && s.status !== 'closed')
        : undefined;

      if (!activeSession) {
        return {
          ...tbl,
          guests_count: 0,
          active_items_count: 0,
          total_cents: 0,
          active_session: undefined,
        };
      }

      const tableGuests = subaccounts.filter(
        (s) => s.table_session_id === activeSession.id && s.status !== 'closed'
      );
      const sessionItems = items.filter(
        (i) => i.table_session_id === activeSession.id && i.preparation_status !== 'cancelled'
      );
      const total_cents = sessionItems.reduce((acc, i) => acc + i.total_price_cents, 0);

      return {
        ...tbl,
        guests_count: tableGuests.length,
        active_items_count: sessionItems.length,
        total_cents,
        active_session: activeSession,
      };
    });
  }

  /**
   * Get table by ID with its active session, comanda tickets, subaccounts, and order items.
   */
  public static getTableDetails(table_id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID) {
    const table = db.get('tables').find((t) => t.id === table_id && t.restaurant_id === restaurant_id);
    if (!table) {
      throw new Error(`Mesa ${table_id} no encontrada.`);
    }

    const sessions = db.get('table_sessions');
    const activeSession = table.active_session_id
      ? sessions.find((s) => s.id === table.active_session_id && s.status !== 'closed')
      : undefined;

    if (!activeSession) {
      return {
        table,
        session: null,
        subaccounts: [],
        orders: [],
        order: null,
        items: [],
      };
    }

    const subaccounts = db
      .get('guest_subaccounts')
      .filter((s) => s.table_session_id === activeSession.id && s.status !== 'closed');
    const orders = db
      .get('orders')
      .filter((o) => o.table_session_id === activeSession.id && o.status === 'open');
    const items = db
      .get('order_items')
      .filter((i) => i.table_session_id === activeSession.id);

    return {
      table,
      session: activeSession,
      subaccounts,
      orders,
      order: orders[orders.length - 1] || orders[0] || null, // Active comanda
      items,
    };
  }

  /**
   * Open a table and create a first-class TableSession.
   * Regla: Una mesa puede tener muchas sesiones históricas, pero solo una sesión activa simultáneamente.
   */
  public static openTable(
    table_id: string,
    waiter_name: string = 'Mesero',
    initial_guests: Array<{ name: string; allergy_ids?: string[] }> = [
      { name: 'Carlos' },
      { name: 'Ana' },
      { name: 'Luis' },
      { name: 'María' },
    ],
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ) {
    const tables = db.get('tables');
    const table = tables.find((t) => t.id === table_id && t.restaurant_id === restaurant_id);
    if (!table) {
      throw new Error(`Mesa con ID ${table_id} no existe.`);
    }

    if (table.active_session_id) {
      const existingSession = db
        .get('table_sessions')
        .find((s) => s.id === table.active_session_id && s.status !== 'closed');
      if (existingSession) {
        throw new Error(`La mesa ${table.number} ya tiene una sesión activa (${existingSession.id}).`);
      }
    }

    const now = new Date().toISOString();
    const sessionId = this.generateId('sess');

    // 1. Create first-class TableSession
    const session: TableSession = {
      id: sessionId,
      restaurant_id,
      table_id,
      status: 'active',
      opened_at: now,
      server_id: waiter_name,
      guest_count: initial_guests.length,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    db.get('table_sessions').push(session);

    // 2. Link table to active session
    const previousTableState = { ...table };
    table.status = 'occupied';
    table.active_session_id = sessionId;
    table.opened_at = now;
    table.assigned_waiter = waiter_name;

    // 3. Create initial GuestSubaccounts strictly tied to table_session_id
    const subaccounts = db.get('guest_subaccounts');
    const createdSubaccounts: GuestSubaccount[] = [];
    const tableNumberDigits = table.number.replace(/\D/g, '') || '1';

    initial_guests.forEach((g, index) => {
      const seatNumber = `${tableNumberDigits}.${index + 1}`;
      const subaccount: GuestSubaccount = {
        id: this.generateId('seat'),
        table_session_id: sessionId,
        table_id,
        seat_number: seatNumber,
        display_name: g.name.trim(),
        allergy_ids: g.allergy_ids || [],
        status: 'active',
        created_at: now,
        updated_at: now,
      };
      subaccounts.push(subaccount);
      createdSubaccounts.push(subaccount);
    });

    // 4. Create initial Comanda Ticket #001 under this table_session_id
    const orderTicketId = this.generateId('ord');
    const initialOrder: Order = {
      id: orderTicketId,
      restaurant_id,
      table_id,
      table_session_id: sessionId,
      ticket_number: 'Comanda #001',
      order_type: 'dine_in',
      status: 'open',
      subtotal_cents: 0,
      tax_cents: 0,
      total_cents: 0,
      server_id: waiter_name,
      created_at: now,
    };
    db.get('orders').push(initialOrder);

    db.save();

    AuditService.log(
      'table_opened',
      'table_session',
      session.id,
      waiter_name,
      previousTableState,
      session,
      `Sesión iniciada en ${table.number} con ${createdSubaccounts.length} comensales. Comanda #001 generada.`,
      restaurant_id
    );

    eventBus.publish('TABLE_OPENED', restaurant_id, waiter_name, {
      table_id,
      table_number: table.number,
      table_session_id: session.id,
      order_id: initialOrder.id,
      ticket_number: initialOrder.ticket_number,
      subaccounts: createdSubaccounts,
    });

    return {
      table,
      session,
      order: initialOrder,
      orders: [initialOrder],
      subaccounts: createdSubaccounts,
    };
  }

  /**
   * Create a new Comanda Ticket (Order) within the active TableSession.
   * Model: TABLE SESSION -> ORDER TICKETS (Comanda #001, Comanda #002, Comanda #003)
   */
  public static createOrderTicket(
    table_id_or_session_id: string,
    waiter_name: string = 'Mesero',
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Order {
    const session = this.resolveActiveSession(table_id_or_session_id, restaurant_id);
    const existingOrders = db
      .get('orders')
      .filter((o) => o.table_session_id === session.id);
    const ticketNumber = `Comanda #${String(existingOrders.length + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const newTicket: Order = {
      id: this.generateId('ord'),
      restaurant_id,
      table_id: session.table_id,
      table_session_id: session.id,
      ticket_number: ticketNumber,
      order_type: 'dine_in',
      status: 'open',
      subtotal_cents: 0,
      tax_cents: 0,
      total_cents: 0,
      server_id: waiter_name,
      notes,
      created_at: now,
    };

    db.get('orders').push(newTicket);
    db.save();

    AuditService.log(
      'order_ticket_created',
      'order',
      newTicket.id,
      waiter_name,
      null,
      newTicket,
      `Nueva comanda ${ticketNumber} aperturada en sesión ${session.id}.`,
      restaurant_id
    );

    return newTicket;
  }

  /**
   * Create a canonical Order origin from DirectPost (order_type = 'pos').
   * Can be created at counter, bar, or takeout without requiring an active TableSession.
   */
  public static createDirectPostOrder(dto: {
    restaurant_id?: string;
    server_id?: string;
    customer_id?: string;
    notes?: string;
    ticket_number?: string;
    table_id?: string;
    table_session_id?: string;
  }): Order {
    const restaurant_id = dto.restaurant_id || DEFAULT_RESTAURANT_ID;
    const now = new Date().toISOString();
    const existingPosOrders = db.get('orders').filter((o) => o.restaurant_id === restaurant_id && o.order_type === 'pos');
    const ticketNumber = dto.ticket_number || `POS #${String(existingPosOrders.length + 1).padStart(3, '0')}`;
    const orderId = this.generateId('ord_pos');

    const order: Order = {
      id: orderId,
      restaurant_id,
      ticket_number: ticketNumber,
      order_type: 'pos',
      status: 'open',
      subtotal_cents: 0,
      tax_cents: 0,
      total_cents: 0,
      server_id: dto.server_id || 'Cajero POS',
      customer_id: dto.customer_id,
      table_id: dto.table_id,
      table_session_id: dto.table_session_id,
      notes: dto.notes,
      created_at: now,
      updated_at: now,
    };

    db.get('orders').push(order);
    db.save();

    AuditService.log(
      'order_created',
      'order',
      order.id,
      dto.server_id || 'Cajero POS',
      null,
      order,
      `Venta DirectPost ${ticketNumber} iniciada en Core.`,
      restaurant_id
    );

    eventBus.publish('ORDER_STATUS_CHANGED', restaurant_id, dto.server_id || 'Cajero POS', {
      order_id: order.id,
      ticket_number: order.ticket_number,
      order_type: 'pos',
      previous_status: null,
      new_status: 'open',
      timestamp: now,
    });

    return order;
  }

  /**
   * Add a guest subaccount to an active TableSession.
   * Enforces unique constraint: table_session_id + seat_number.
   */
  public static addGuestSubaccount(
    table_id_or_session_id: string,
    display_name: string,
    allergy_ids: string[] = [],
    notes?: string,
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): GuestSubaccount {
    const session = this.resolveActiveSession(table_id_or_session_id, restaurant_id);
    const table = db.get('tables').find((t) => t.id === session.table_id);
    const tableNumberDigits = table ? table.number.replace(/\D/g, '') || '1' : '1';

    const subaccounts = db.get('guest_subaccounts');
    const sessionSubaccounts = subaccounts.filter(
      (s) => s.table_session_id === session.id && s.status !== 'closed'
    );

    const nextSeatIndex = sessionSubaccounts.length + 1;
    const seatNumber = `${tableNumberDigits}.${nextSeatIndex}`;

    // Verify constraint: table_session_id + seat_number
    const collision = sessionSubaccounts.find((s) => s.seat_number === seatNumber);
    if (collision) {
      throw new Error(`El número de comensal ${seatNumber} ya existe en esta sesión.`);
    }

    const now = new Date().toISOString();
    const newSubaccount: GuestSubaccount = {
      id: this.generateId('seat'),
      table_session_id: session.id,
      table_id: session.table_id,
      seat_number: seatNumber,
      display_name: display_name.trim(),
      allergy_ids,
      notes,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    subaccounts.push(newSubaccount);
    session.guest_count = sessionSubaccounts.length + 1;
    session.updated_at = now;
    db.save();

    AuditService.log(
      'subaccount_created',
      'guest_subaccount',
      newSubaccount.id,
      actor,
      null,
      newSubaccount,
      `Comensal ${newSubaccount.seat_number} (${newSubaccount.display_name}) añadido a sesión ${session.id}.`,
      restaurant_id
    );

    eventBus.publish('SUBACCOUNT_CREATED', restaurant_id, actor, newSubaccount);
    return newSubaccount;
  }

  /**
   * Deterministic allergy safety checker.
   * Matches GuestSubaccount allergies -> ingredients against Product -> ingredients.
   */
  public static checkAllergies(
    guest_subaccount_id: string,
    product_id: string
  ): { has_conflict: boolean; conflicts: AllergyConflict[] } {
    const subaccount = db.get('guest_subaccounts').find((s) => s.id === guest_subaccount_id);
    const product = db.get('products').find((p) => p.id === product_id);

    if (!subaccount || !product) {
      return { has_conflict: false, conflicts: [] };
    }

    if (!subaccount.allergy_ids || subaccount.allergy_ids.length === 0) {
      return { has_conflict: false, conflicts: [] };
    }

    const allergies = db.get('allergies');
    const ingredients = db.get('ingredients');
    const conflicts: AllergyConflict[] = [];

    for (const allergyId of subaccount.allergy_ids) {
      const allergy = allergies.find((a) => a.id === allergyId);
      if (!allergy) continue;

      for (const ingId of allergy.ingredient_ids) {
        if (product.ingredient_ids.includes(ingId)) {
          const ing = ingredients.find((i) => i.id === ingId) || { id: ingId, name: ingId, category: 'General' };
          conflicts.push({
            allergy,
            conflicting_ingredient: ing,
            product,
            severity: allergy.severity,
            message: `¡ALERTA CRÍTICA DE ALERGIA! El comensal ${subaccount.seat_number} (${subaccount.display_name}) tiene registrada alergia a "${allergy.name}" y el producto "${product.name}" contiene "${ing.name}".`,
          });
        }
      }
    }

    return {
      has_conflict: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Add product item assigned strictly to a guest subaccount and comanda ticket.
   */
  public static addItemToSubaccount(
    table_id_or_session_id: string,
    guest_subaccount_id: string,
    product_id: string,
    quantity: number = 1,
    notes?: string,
    override_allergy: boolean = false,
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    order_ticket_id?: string,
    modifiers: string[] = []
  ): OrderItem {
    if (quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a 0.');
    }

    const session = this.resolveActiveSession(table_id_or_session_id, restaurant_id);

    // Verify subaccount belongs to this session
    const subaccount = db
      .get('guest_subaccounts')
      .find((s) => s.id === guest_subaccount_id && s.table_session_id === session.id);
    if (!subaccount) {
      throw new Error(`Comensal ${guest_subaccount_id} no pertenece a la sesión activa ${session.id}.`);
    }

    const product = db.get('products').find((p) => p.id === product_id && p.restaurant_id === restaurant_id);
    if (!product) {
      throw new Error(`Producto ${product_id} no encontrado en catálogo.`);
    }

    // Deterministic allergy check
    const allergyCheck = this.checkAllergies(guest_subaccount_id, product_id);
    if (allergyCheck.has_conflict && !override_allergy) {
      const firstConflict = allergyCheck.conflicts[0];
      const error: any = new Error(firstConflict.message);
      error.allergy_conflict = allergyCheck.conflicts;
      error.is_allergy_warning = true;
      throw error;
    }

    if (allergyCheck.has_conflict && override_allergy) {
      AuditService.log(
        'allergy_override',
        'order_item',
        product.id,
        actor,
        null,
        {
          table_session_id: session.id,
          guest_subaccount_id,
          seat_number: subaccount.seat_number,
          conflicts: allergyCheck.conflicts.map((c) => ({
            allergy: c.allergy.name,
            ingredient: c.conflicting_ingredient.name,
          })),
        },
        `Advertencia de alergia autorizada expresamente por ${actor} para comensal ${subaccount.seat_number}.`,
        restaurant_id
      );

      eventBus.publish('ALLERGY_WARNING_OVERRIDDEN', restaurant_id, actor, {
        table_session_id: session.id,
        guest_subaccount_id,
        product_id,
        conflicts: allergyCheck.conflicts,
      });
    }

    // Resolve or create Order Ticket (Comanda)
    const orders = db.get('orders');
    let order: Order | undefined;

    if (order_ticket_id) {
      order = orders.find((o) => o.id === order_ticket_id && o.table_session_id === session.id);
      if (!order) {
        throw new Error(`Comanda ticket ${order_ticket_id} no encontrada en esta sesión.`);
      }
    } else {
      const sessionOrders = orders.filter((o) => o.table_session_id === session.id && o.status === 'open');
      order = sessionOrders[sessionOrders.length - 1];
      if (!order) {
        order = this.createOrderTicket(session.id, actor, undefined, restaurant_id);
      }
    }

    const now = new Date().toISOString();
    const unitPrice = product.price_cents;
    const totalPrice = unitPrice * quantity;
    const targetSeconds =
      product.target_preparation_seconds || (product.preparation_time_minutes || 10) * 60;

    const item: OrderItem = {
      id: this.generateId('item'),
      order_id: order.id,
      table_session_id: session.id,
      restaurant_id,
      product_id: product.id,
      product_name: product.name,
      guest_subaccount_id: subaccount.id,
      seat_number: subaccount.seat_number,
      guest_name: subaccount.display_name,
      quantity,
      unit_price_cents: unitPrice,
      total_price_cents: totalPrice,
      destination_station: product.destination_station,
      notes,
      modifiers: modifiers || [],
      target_preparation_seconds: targetSeconds,
      preparation_status: 'pending',
      status_history: [
        {
          status: 'pending',
          changed_by: actor,
          timestamp: now,
          notes: `Registrado en ${order.ticket_number || 'Comanda'}.`,
        },
      ],
      created_at: now,
    };

    db.get('order_items').push(item);
    this.recalculateOrderTotals(order.id);
    session.updated_at = now;
    db.save();

    // F7: Automatic Recipe & Ingredient Consumption Hook into Core F6 Inventory
    try {
      RecipeService.consumeRecipeForOrderItem({
        order_id: order.id,
        order_item_id: item.id,
        product_id: product.id,
        quantity,
        modifiers: modifiers || [],
        actor,
        restaurant_id,
      });
    } catch (err: any) {
      console.warn(`[PosService] Recipe consumption notice for ${item.id}:`, err?.message);
    }

    AuditService.log(
      'order_item_created',
      'order_item',
      item.id,
      actor,
      null,
      item,
      `Item agregado: ${quantity}x ${product.name} a ${subaccount.seat_number} (${subaccount.display_name}) en ${order.ticket_number}.`,
      restaurant_id
    );

    eventBus.publish('ORDER_ITEM_CREATED', restaurant_id, actor, item);
    eventBus.publish('ORDER_ITEM_SENT_TO_PRODUCTION', restaurant_id, actor, {
      item,
      destination_station: item.destination_station,
      ticket_number: order.ticket_number,
      table_session_id: session.id,
    });

    return item;
  }

  /**
   * Update item status with operational tracking (KDS flow).
   */
  public static updateItemStatus(
    item_id: string,
    new_status: OrderItemStatus,
    actor: string = 'Cocina / Operador',
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    const items = db.get('order_items');
    const item = items.find((i) => i.id === item_id && i.restaurant_id === restaurant_id);
    if (!item) {
      throw new Error(`Item ${item_id} no encontrado.`);
    }

    const prevStatus = item.preparation_status;
    if (prevStatus === new_status) {
      return item;
    }

    const validTransitions: Record<OrderItemStatus, OrderItemStatus[]> = {
      draft: ['pending', 'cancelled'],
      pending: ['preparing', 'cancelled'],
      preparing: ['ready', 'pending', 'cancelled'],
      ready: ['delivered', 'preparing', 'cancelled'],
      delivered: ['ready', 'preparing', 'paid', 'cancelled'],
      paid: [],
      cancelled: ['pending'],
    };

    if (!validTransitions[prevStatus].includes(new_status)) {
      throw new Error(
        `Transición de estado inválida: no se permite cambiar de "${prevStatus}" a "${new_status}".`
      );
    }

    const now = new Date().toISOString();
    item.preparation_status = new_status;

    if (new_status === 'preparing') {
      item.preparing_at = now;
    }
    if (new_status === 'ready') {
      item.ready_at = now;
      if (item.preparing_at) {
        item.preparation_duration_seconds = Math.max(
          0,
          Math.floor((new Date(now).getTime() - new Date(item.preparing_at).getTime()) / 1000)
        );
      }
    }
    if (new_status === 'delivered') {
      item.delivered_at = now;
      item.total_operational_duration_seconds = Math.max(
        0,
        Math.floor((new Date(now).getTime() - new Date(item.created_at).getTime()) / 1000)
      );
    }
    if (new_status === 'cancelled') {
      item.cancelled_at = now;
    }

    item.status_history.push({
      status: new_status,
      changed_by: actor,
      timestamp: now,
      notes,
    });

    if (new_status === 'cancelled') {
      this.recalculateOrderTotals(item.order_id);

      // F7: Reversal of recipe inventory consumption on cancellation
      try {
        RecipeService.reverseRecipeConsumption({
          order_id: item.order_id,
          order_item_id: item.id,
          actor,
          reason: notes || `Reversión por cancelación de ítem "${item.product_name}"`,
          restaurant_id,
        });
      } catch (err: any) {
        console.warn(`[PosService] Recipe reversal notice for ${item.id}:`, err?.message);
      }
    }

    db.save();

    AuditService.log(
      'order_item_status_changed',
      'order_item',
      item.id,
      actor,
      { status: prevStatus },
      { status: new_status },
      notes || `Estado cambiado de ${prevStatus} a ${new_status}.`,
      restaurant_id
    );

    let eventName: any = 'ORDER_ITEM_PREPARING';
    if (new_status === 'preparing') eventName = 'ORDER_ITEM_PREPARING';
    else if (new_status === 'ready') eventName = 'ORDER_ITEM_READY';
    else if (new_status === 'delivered') eventName = 'ORDER_ITEM_DELIVERED';
    else if (new_status === 'cancelled') eventName = 'ORDER_ITEM_CANCELLED';

    const order = db.get('orders').find((o) => o.id === item.order_id);
    const table = order ? db.get('tables').find((t) => t.id === order.table_id) : undefined;

    eventBus.publish(eventName, restaurant_id, actor, {
      item_id: item.id,
      product_name: item.product_name,
      seat_number: item.seat_number,
      guest_name: item.guest_name,
      table_id: table?.id,
      table_number: table?.number || 'Mesa',
      table_session_id: item.table_session_id,
      destination_station: item.destination_station,
      previous_status: prevStatus,
      new_status,
      timestamp: now,
    });

    return item;
  }

  /**
   * Station operator acknowledges receipt of an item ticket in station
   */
  public static acknowledgeItem(
    item_id: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    const items = db.get('order_items');
    const item = items.find((i) => i.id === item_id && i.restaurant_id === restaurant_id);
    if (!item) {
      throw new Error(`Item ${item_id} no encontrado.`);
    }

    const now = new Date().toISOString();
    item.acknowledged_at = now;
    item.acknowledged_by = actor;
    db.save();

    AuditService.log(
      'order_item_acknowledged',
      'order_item',
      item.id,
      actor,
      null,
      item,
      `Item ${item.product_name} acusado de recibo en estación ${item.destination_station} por ${actor}.`,
      restaurant_id
    );

    eventBus.publish('ORDER_ITEM_ACKNOWLEDGED', restaurant_id, actor, {
      item_id: item.id,
      acknowledged_by: actor,
      acknowledged_at: now,
    });

    return item;
  }

  /**
   * Cancel and remove an item with compensatory audit record
   */
  public static removeOrderItem(
    item_id: string,
    reason: string = 'Cancelado por mesero',
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return this.updateItemStatus(item_id, 'cancelled', actor, reason, restaurant_id);
  }

  /**
   * Reassign item to a different guest subaccount within the same TableSession
   */
  public static reassignItemSubaccount(
    item_id: string,
    new_subaccount_id: string,
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    const items = db.get('order_items');
    const item = items.find((i) => i.id === item_id && i.restaurant_id === restaurant_id);
    if (!item) {
      throw new Error(`Item ${item_id} no encontrado.`);
    }

    const subaccounts = db.get('guest_subaccounts');
    const newSubaccount = subaccounts.find(
      (s) => s.id === new_subaccount_id && s.table_session_id === item.table_session_id
    );
    if (!newSubaccount) {
      throw new Error(`La subcuenta destino ${new_subaccount_id} no pertenece a la misma sesión.`);
    }

    const prevSeat = item.seat_number;
    item.guest_subaccount_id = newSubaccount.id;
    item.seat_number = newSubaccount.seat_number;
    item.guest_name = newSubaccount.display_name;

    db.save();

    AuditService.log(
      'item_reassigned',
      'order_item',
      item.id,
      actor,
      { guest_subaccount_id: item.guest_subaccount_id, seat_number: prevSeat },
      { guest_subaccount_id: newSubaccount.id, seat_number: newSubaccount.seat_number },
      `Item ${item.product_name} reasignado de ${prevSeat} a ${newSubaccount.seat_number}.`,
      restaurant_id
    );

    eventBus.publish('ITEM_REASSIGNED', restaurant_id, actor, {
      item_id: item.id,
      previous_seat: prevSeat,
      new_seat: newSubaccount.seat_number,
      new_guest_id: newSubaccount.id,
    });

    return item;
  }

  /**
   * Calculate deterministic global table session bill and individual subaccount bills.
   */
  public static calculateTableBill(
    table_id_or_session_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): TableBill {
    let session: TableSession;
    try {
      session = this.resolveActiveSession(table_id_or_session_id, restaurant_id);
    } catch (err) {
      const table = db
        .get('tables')
        .find((t) => t.id === table_id_or_session_id && t.restaurant_id === restaurant_id);
      if (table) {
        return {
          table_id: table.id,
          table_session_id: '',
          table_number: table.number,
          orders: [],
          subaccounts: [],
          total_items_count: 0,
          subtotal_cents: 0,
          tax_cents: 0,
          total_cents: 0,
          paid_cents: 0,
          balance_cents: 0,
          status: 'closed',
        };
      }
      throw err;
    }
    const table = db.get('tables').find((t) => t.id === session.table_id);
    const tableNumber = table ? table.number : 'Mesa';

    const sessionOrders = db
      .get('orders')
      .filter((o) => o.table_session_id === session.id);

    const subaccounts = db
      .get('guest_subaccounts')
      .filter((s) => s.table_session_id === session.id && s.status !== 'closed');

    const allSessionItems = db
      .get('order_items')
      .filter(
        (i) => i.table_session_id === session.id && i.preparation_status !== 'cancelled'
      );

    const sessionPayments = db
      .get('payments')
      .filter((p) => p.table_session_id === session.id);

    const taxRate = 0.16; // 16% IVA estándar

    const subaccountBills: SubaccountBill[] = subaccounts.map((seat) => {
      const seatItems = allSessionItems.filter((i) => i.guest_subaccount_id === seat.id);
      const subtotal_cents = seatItems.reduce((sum, item) => sum + item.total_price_cents, 0);
      const tax_cents = Math.round(subtotal_cents * taxRate);
      const total_cents = subtotal_cents + tax_cents;

      const seatPayments = sessionPayments.filter((p) => p.guest_subaccount_id === seat.id);
      const paid_cents = seatPayments.reduce((sum, p) => sum + p.amount_cents, 0);
      const balance_cents = Math.max(0, total_cents - paid_cents);

      return {
        guest_subaccount_id: seat.id,
        seat_number: seat.seat_number,
        display_name: seat.display_name,
        items: seatItems,
        subtotal_cents,
        tax_cents,
        total_cents,
        paid_cents,
        balance_cents,
      };
    });

    const globalSubtotal = subaccountBills.reduce((acc, s) => acc + s.subtotal_cents, 0);
    const globalTax = subaccountBills.reduce((acc, s) => acc + s.tax_cents, 0);
    const globalTotal = globalSubtotal + globalTax;
    const globalPaid = sessionPayments.reduce((acc, p) => acc + p.amount_cents, 0);
    const globalBalance = Math.max(0, globalTotal - globalPaid);

    return {
      table_id: session.table_id,
      table_number: tableNumber,
      table_session_id: session.id,
      session_status: session.status,
      orders: sessionOrders,
      order_id: sessionOrders[0]?.id,
      subaccounts: subaccountBills,
      total_items_count: allSessionItems.reduce((acc, i) => acc + i.quantity, 0),
      subtotal_cents: globalSubtotal,
      tax_cents: globalTax,
      total_cents: globalTotal,
      paid_cents: globalPaid,
      balance_cents: globalBalance,
    };
  }

  /**
   * Record payment for the active TableSession or a specific guest subaccount.
   */
  public static recordPayment(
    table_id_or_session_id: string,
    amount_cents: number,
    method: Payment['method'],
    guest_subaccount_id?: string,
    cashier: string = 'Cajero',
    reference?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    idempotency_key?: string,
    user_id?: string
  ): Payment {
    const result = FinanceService.recordPayment({
      table_id_or_session_id,
      amount_cents,
      method,
      guest_subaccount_id,
      cashier,
      user_id,
      reference,
      idempotency_key,
      restaurant_id,
    });
    return result.payment;
  }

  /**
   * Close a TableSession after settling all payments (balance_cents == 0).
   * Liberates the table back to 'available' status.
   */
  public static closeTable(
    table_id_or_session_id: string,
    actor: string = 'Mesero / Cajero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ) {
    const session = this.resolveActiveSession(table_id_or_session_id, restaurant_id);
    const table = db.get('tables').find((t) => t.id === session.table_id);
    if (!table) {
      throw new Error(`Mesa ${session.table_id} no encontrada.`);
    }

    const bill = this.calculateTableBill(session.id, restaurant_id);
    if (bill.balance_cents > 0) {
      throw new Error(
        `No se puede cerrar la mesa: aún existe un saldo pendiente de $${(
          bill.balance_cents / 100
        ).toFixed(2)}.`
      );
    }

    const now = new Date().toISOString();

    // 1. Close TableSession
    session.status = 'closed';
    session.closed_at = now;
    session.updated_at = now;

    // 2. Free Table
    const prevTableState = { ...table };
    table.status = 'available';
    table.active_session_id = undefined;
    table.opened_at = undefined;
    table.assigned_waiter = undefined;

    // 3. Mark all orders for this session as completed
    const sessionOrders = db
      .get('orders')
      .filter((o) => o.table_session_id === session.id);
    sessionOrders.forEach((o) => {
      o.status = 'completed';
      o.closed_at = now;
    });

    // 4. Mark all subaccounts for this session as closed
    const sessionSubaccounts = db
      .get('guest_subaccounts')
      .filter((s) => s.table_session_id === session.id);
    sessionSubaccounts.forEach((s) => {
      s.status = 'closed';
      s.updated_at = now;
    });

    db.save();

    AuditService.log(
      'table_closed',
      'table_session',
      session.id,
      actor,
      prevTableState,
      { table, session },
      `Sesión ${session.id} finalizada y Mesa ${table.number} liberada. Total cobrado: $${(
        bill.paid_cents / 100
      ).toFixed(2)}.`,
      restaurant_id
    );

    eventBus.publish('TABLE_CLOSED', restaurant_id, actor, {
      table_id: table.id,
      table_number: table.number,
      table_session_id: session.id,
      total_cents: bill.total_cents,
      paid_cents: bill.paid_cents,
    });

    return {
      success: true,
      table,
      session,
      total_cents: bill.total_cents,
      paid_cents: bill.paid_cents,
    };
  }

  /**
   * Helper to resolve active TableSession by table_id or session_id
   */
  private static resolveActiveSession(
    table_id_or_session_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): TableSession {
    const sessions = db.get('table_sessions');

    // Check if it's already a session ID
    let session = sessions.find(
      (s) => s.id === table_id_or_session_id && s.restaurant_id === restaurant_id
    );

    if (!session) {
      // Check if it's a table ID
      const table = db
        .get('tables')
        .find((t) => t.id === table_id_or_session_id && t.restaurant_id === restaurant_id);
      if (table && table.active_session_id) {
        session = sessions.find((s) => s.id === table.active_session_id && s.status !== 'closed');
      }
    }

    if (!session || session.status === 'closed') {
      throw new Error(`No hay sesión activa para ${table_id_or_session_id}.`);
    }

    return session;
  }

  /**
   * Helper to recalculate order totals
   */
  private static recalculateOrderTotals(order_id: string): void {
    const orders = db.get('orders');
    const order = orders.find((o) => o.id === order_id);
    if (!order) return;

    const items = db
      .get('order_items')
      .filter((i) => i.order_id === order_id && i.preparation_status !== 'cancelled');

    const subtotal = items.reduce((acc, i) => acc + i.total_price_cents, 0);
    const tax = Math.round(subtotal * 0.16);

    order.subtotal_cents = subtotal;
    order.tax_cents = tax;
    order.total_cents = subtotal + tax;
  }

  /**
   * Universal Order State Machine Transition Engine
   * Validates state flow for dine_in, delivery, takeout, catering, and pos orders.
   */
  public static updateOrderStatus(
    order_id: string,
    new_status: any,
    actor: string = 'Sistema / Operador',
    reason?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Order {
    const orders = db.get('orders');
    const order = orders.find((o) => o.id === order_id && o.restaurant_id === restaurant_id);
    if (!order) {
      throw new Error(`Orden ${order_id} no encontrada en este restaurante.`);
    }

    const prevStatus = order.status;
    if (prevStatus === new_status) {
      return order;
    }

    const validOrderTransitions: Record<string, string[]> = {
      open: ['confirmed', 'preparing', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['assigned', 'out_for_delivery', 'delivered', 'completed', 'cancelled'],
      assigned: ['out_for_delivery', 'ready', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    if (!validOrderTransitions[prevStatus]?.includes(new_status)) {
      throw new Error(
        `Transición de orden inválida: no se permite cambiar de "${prevStatus}" a "${new_status}".`
      );
    }

    const now = new Date().toISOString();
    order.status = new_status;
    order.updated_at = now;

    if (new_status === 'completed') {
      order.closed_at = now;
    }
    if (new_status === 'delivered') {
      order.delivered_at = now;
    }
    if (new_status === 'cancelled') {
      order.cancellation_reason = reason;
      order.closed_at = now;
    }

    db.save();

    AuditService.log(
      'order_status_changed',
      'order',
      order.id,
      actor,
      { status: prevStatus },
      { status: new_status },
      reason || `Estado de orden actualizado a ${new_status}.`,
      restaurant_id
    );

    eventBus.publish('ORDER_STATUS_CHANGED', restaurant_id, actor, {
      order_id: order.id,
      ticket_number: order.ticket_number,
      order_type: order.order_type,
      previous_status: prevStatus,
      new_status,
      reason,
      timestamp: now,
    });

    if (new_status === 'cancelled') {
      eventBus.publish('ORDER_CANCELLED', restaurant_id, actor, {
        order_id: order.id,
        ticket_number: order.ticket_number,
        reason,
        timestamp: now,
      });
    }

    return order;
  }

  /**
   * Cancel an entire order / ticket cleanly
   */
  public static cancelOrder(
    order_id: string,
    reason: string = 'Cancelado por usuario / operador',
    actor: string = 'Operador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Order {
    return this.updateOrderStatus(order_id, 'cancelled', actor, reason, restaurant_id);
  }
}
