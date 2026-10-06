/**
 * DIRECTAURANTE POS CORE v0.1 - KDS Service (Kitchen Display System)
 * Multi-station real-time production queues, SLA timers, grouped ticket routing,
 * prep summary consolidation and tactile operational recovery (recall).
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  OrderItem,
  KdsItemView,
  KdsTicketView,
  KdsProductionSummaryItem,
  KdsStation,
} from '../../core/types';
import { PosService } from '../pos/posService';

export type { KdsItemView, KdsTicketView, KdsProductionSummaryItem };

export class KdsService {
  /**
   * Station label helper
   */
  public static getStationLabel(station: string): string {
    switch (station) {
      case 'kitchen':
        return 'Cocina Caliente';
      case 'bar':
        return 'Barra & Bebidas';
      case 'grill':
        return 'Parrilla & Asador';
      case 'desserts':
        return 'Postres & Dulce';
      case 'expediter':
        return 'Despacho & Pase';
      default:
        return station.charAt(0).toUpperCase() + station.slice(1);
    }
  }

  /**
   * Get all active kitchen/station items with calculated elapsed times and SLA semaphores
   */
  public static getActiveStationItems(
    station?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    includeRecentCompleted: boolean = false
  ): KdsItemView[] {
    const isAllOrExpediter = !station || station === 'all' || station === 'expediter';
    const now = Date.now();

    const items = db.get('order_items').filter((i) => {
      const matchRest = i.restaurant_id === restaurant_id;
      const matchStation = isAllOrExpediter ? true : i.destination_station === station;

      if (includeRecentCompleted) {
        // Return delivered or cancelled items within last 30 minutes for history & recall
        const isFinished = i.preparation_status === 'delivered' || i.preparation_status === 'cancelled';
        if (!isFinished) return false;
        const finishedTime = new Date(i.delivered_at || i.cancelled_at || i.created_at).getTime();
        return matchRest && matchStation && now - finishedTime < 1800000; // 30 mins
      }

      // Operational active queue: not delivered and not cancelled
      const notDone = i.preparation_status !== 'delivered' && i.preparation_status !== 'cancelled';
      return matchRest && matchStation && notDone;
    });

    const tables = db.get('tables');
    const orders = db.get('orders');
    const products = db.get('products');
    const subaccounts = db.get('guest_subaccounts');
    const allergies = db.get('allergies');

    return items
      .map((item) => {
        const order = orders.find((o) => o.id === item.order_id);
        const table = order ? tables.find((t) => t.id === order.table_id) : undefined;
        const product = products.find((p) => p.id === item.product_id);
        const subaccount = subaccounts.find((s) => s.id === item.guest_subaccount_id);

        const dinerAllergies = (subaccount?.allergy_ids || [])
          .map((algId) => allergies.find((a) => a.id === algId)?.name)
          .filter(Boolean) as string[];

        const createdTime = new Date(item.created_at).getTime();
        const elapsedSeconds = Math.max(0, Math.floor((now - createdTime) / 1000));

        let prepSeconds: number | undefined;
        if (item.preparing_at) {
          prepSeconds = Math.max(
            0,
            Math.floor((now - new Date(item.preparing_at).getTime()) / 1000)
          );
        }

        const targetSeconds =
          item.target_preparation_seconds ||
          product?.target_preparation_seconds ||
          (product?.preparation_time_minutes || 10) * 60;

        const isOverdue =
          elapsedSeconds > targetSeconds &&
          item.preparation_status !== 'ready' &&
          item.preparation_status !== 'delivered';

        let traffic_light: KdsItemView['traffic_light'] = 'pending';
        let traffic_light_label = 'En cola';
        let traffic_light_color = 'bg-zinc-100 text-zinc-700 border-zinc-300';

        if (isOverdue) {
          traffic_light = 'overdue';
          traffic_light_label = 'Retrasado';
          traffic_light_color = 'bg-rose-500/20 text-rose-300 border-rose-500';
        } else if (item.preparation_status === 'preparing') {
          traffic_light = 'preparing';
          traffic_light_label = 'En preparación';
          traffic_light_color = 'bg-blue-500/20 text-blue-300 border-blue-500';
        } else if (item.preparation_status === 'ready') {
          traffic_light = 'ready';
          traffic_light_label = 'Listo para servir';
          traffic_light_color = 'bg-emerald-500/20 text-emerald-300 border-emerald-500';
        } else if (item.preparation_status === 'delivered') {
          traffic_light = 'delivered';
          traffic_light_label = 'Entregado';
          traffic_light_color = 'bg-zinc-800 text-zinc-400 border-zinc-700';
        }

        return {
          ...item,
          table_number: table?.number || 'Mesa ?',
          ticket_number: order?.ticket_number || 'Comanda',
          elapsed_seconds: elapsedSeconds,
          preparation_seconds: prepSeconds,
          target_seconds: targetSeconds,
          traffic_light,
          traffic_light_label,
          traffic_light_color,
          is_overdue: isOverdue,
          diner_allergies: dinerAllergies,
        };
      })
      .sort((a, b) => {
        // Prioritize overdue items first, then ready items, then oldest pending
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        if (a.preparation_status === 'ready' && b.preparation_status !== 'ready') return -1;
        if (a.preparation_status !== 'ready' && b.preparation_status === 'ready') return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }

  /**
   * Get active tickets grouped by Order & Station conforming to kitchen ticket workflow
   */
  public static getActiveTickets(
    station?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    includeRecentCompleted: boolean = false
  ): KdsTicketView[] {
    const rawItems = this.getActiveStationItems(station, restaurant_id, includeRecentCompleted);
    const orders = db.get('orders');
    const tables = db.get('tables');

    // Group items by: order_id + (isExpediter ? '' : destination_station)
    const isAllOrExpediter = !station || station === 'all' || station === 'expediter';
    const groupedMap = new Map<string, KdsItemView[]>();

    for (const item of rawItems) {
      const groupKey = isAllOrExpediter
        ? `${item.order_id}_all`
        : `${item.order_id}_${item.destination_station}`;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, []);
      }
      groupedMap.get(groupKey)!.push(item);
    }

    const tickets: KdsTicketView[] = [];

    for (const [key, items] of groupedMap.entries()) {
      if (items.length === 0) continue;
      const firstItem = items[0];
      const order = orders.find((o) => o.id === firstItem.order_id);
      const table = order ? tables.find((t) => t.id === order.table_id) : undefined;

      // Calculate aggregated status of ticket
      const hasPending = items.some((i) => i.preparation_status === 'pending');
      const hasPreparing = items.some((i) => i.preparation_status === 'preparing');
      const allReady = items.every((i) => i.preparation_status === 'ready');
      const allDelivered = items.every((i) => i.preparation_status === 'delivered');

      let ticketStatus: KdsTicketView['status'] = 'pending';
      let statusLabel = 'Pendiente';

      if (allDelivered) {
        ticketStatus = 'delivered';
        statusLabel = 'Entregado';
      } else if (allReady) {
        ticketStatus = 'ready';
        statusLabel = '¡Listo!';
      } else if (hasPreparing) {
        ticketStatus = 'preparing';
        statusLabel = 'En Preparación';
      } else if (hasPending) {
        ticketStatus = 'pending';
        statusLabel = 'Pendiente';
      }

      // Maximum elapsed time and SLA
      const maxElapsed = Math.max(...items.map((i) => i.elapsed_seconds));
      const maxTarget = Math.max(...items.map((i) => i.target_seconds));
      const isOverdue = items.some((i) => i.is_overdue);

      // Collect distinct diners
      const dinersMap = new Map<string, string>();
      for (const i of items) {
        if (i.seat_number && i.guest_name) {
          dinersMap.set(i.seat_number, i.guest_name);
        }
      }
      const diner_subaccounts = Array.from(dinersMap.entries()).map(([seat_number, guest_name]) => ({
        seat_number,
        guest_name,
      }));

      // Collect all unique allergies
      const allergySet = new Set<string>();
      for (const i of items) {
        if (i.diner_allergies) {
          i.diner_allergies.forEach((a) => allergySet.add(a));
        }
      }
      const all_allergies = Array.from(allergySet);

      const targetStation = isAllOrExpediter ? 'expediter' : firstItem.destination_station;

      tickets.push({
        id: key,
        order_id: firstItem.order_id,
        order_number: order?.ticket_number?.replace(/\D/g, '') || firstItem.order_id.slice(-4),
        ticket_number: order?.ticket_number || 'Comanda',
        table_id: order?.table_id || '',
        table_number: table?.number || 'Mesa ?',
        server_name: order?.server_id || 'Mesero',
        destination_station: targetStation,
        station_label: this.getStationLabel(targetStation),
        created_at: firstItem.created_at,
        elapsed_seconds: maxElapsed,
        target_seconds: maxTarget,
        is_overdue: isOverdue,
        status: ticketStatus,
        status_label: statusLabel,
        items,
        diner_subaccounts,
        all_allergies,
        has_allergies: all_allergies.length > 0,
        notes: items.map((i) => i.notes).filter(Boolean) as string[],
      });
    }

    // Sort: Overdue tickets first, then ready, then oldest created
    return tickets.sort((a, b) => {
      if (a.is_overdue && !b.is_overdue) return -1;
      if (!a.is_overdue && b.is_overdue) return 1;
      if (a.status === 'ready' && b.status !== 'ready') return -1;
      if (a.status !== 'ready' && b.status === 'ready') return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  /**
   * Get production summary aggregated counts (Prep Summary for line cooks)
   */
  public static getProductionSummary(
    station?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): KdsProductionSummaryItem[] {
    const rawItems = this.getActiveStationItems(station, restaurant_id, false);
    const summaryMap = new Map<string, KdsProductionSummaryItem>();

    for (const item of rawItems) {
      if (item.preparation_status === 'delivered' || item.preparation_status === 'cancelled') {
        continue;
      }

      if (!summaryMap.has(item.product_id)) {
        summaryMap.set(item.product_id, {
          product_id: item.product_id,
          product_name: item.product_name,
          category: '',
          destination_station: item.destination_station,
          pending_qty: 0,
          preparing_qty: 0,
          total_active_qty: 0,
        });
      }

      const entry = summaryMap.get(item.product_id)!;
      if (item.preparation_status === 'pending') {
        entry.pending_qty += item.quantity;
      } else if (item.preparation_status === 'preparing') {
        entry.preparing_qty += item.quantity;
      }
      entry.total_active_qty += item.quantity;
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.total_active_qty - a.total_active_qty);
  }

  /**
   * KDS Operator marks single item preparation as started
   */
  public static startPreparing(
    itemId: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return PosService.updateItemStatus(itemId, 'preparing', actor, undefined, restaurant_id);
  }

  /**
   * KDS Operator marks item as ready for pickup (kitchen / bar done)
   */
  public static markItemReady(
    itemId: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return PosService.updateItemStatus(itemId, 'ready', actor, undefined, restaurant_id);
  }

  /**
   * Waiter confirms item delivery to the diner table (ready -> delivered)
   */
  public static markItemDelivered(
    itemId: string,
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return PosService.updateItemStatus(itemId, 'delivered', actor, undefined, restaurant_id);
  }

  /**
   * Start preparing ALL pending items of this station in an order ticket
   */
  public static startPreparingTicket(
    orderId: string,
    station?: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem[] {
    const isAll = !station || station === 'all' || station === 'expediter';
    const items = db
      .get('order_items')
      .filter(
        (i) =>
          i.order_id === orderId &&
          i.restaurant_id === restaurant_id &&
          i.preparation_status === 'pending' &&
          (isAll || i.destination_station === station)
      );

    const updated: OrderItem[] = [];
    for (const item of items) {
      updated.push(PosService.updateItemStatus(item.id, 'preparing', actor, 'Ticket iniciado', restaurant_id));
    }
    return updated;
  }

  /**
   * Mark ready ALL items in preparation of this station in an order ticket
   */
  public static markTicketReady(
    orderId: string,
    station?: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem[] {
    const isAll = !station || station === 'all' || station === 'expediter';
    const items = db
      .get('order_items')
      .filter(
        (i) =>
          i.order_id === orderId &&
          i.restaurant_id === restaurant_id &&
          (i.preparation_status === 'preparing' || i.preparation_status === 'pending') &&
          (isAll || i.destination_station === station)
      );

    const updated: OrderItem[] = [];
    for (const item of items) {
      updated.push(PosService.updateItemStatus(item.id, 'ready', actor, 'Ticket listo para servir', restaurant_id));
    }
    return updated;
  }

  /**
   * Deliver ALL ready items of this station in an order ticket
   */
  public static deliverTicket(
    orderId: string,
    station?: string,
    actor: string = 'Mesero',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem[] {
    const isAll = !station || station === 'all' || station === 'expediter';
    const items = db
      .get('order_items')
      .filter(
        (i) =>
          i.order_id === orderId &&
          i.restaurant_id === restaurant_id &&
          i.preparation_status === 'ready' &&
          (isAll || i.destination_station === station)
      );

    const updated: OrderItem[] = [];
    for (const item of items) {
      updated.push(PosService.updateItemStatus(item.id, 'delivered', actor, 'Ticket entregado', restaurant_id));
    }
    return updated;
  }

  /**
   * Operational Recall: Return a ready or delivered item back to preparing
   */
  public static recallItem(
    itemId: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return PosService.updateItemStatus(itemId, 'preparing', actor, 'Recall operativo KDS', restaurant_id);
  }

  /**
   * Operational Recall: Return all items in a ticket back to preparing
   */
  public static recallTicket(
    orderId: string,
    station?: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem[] {
    const isAll = !station || station === 'all' || station === 'expediter';
    const items = db
      .get('order_items')
      .filter(
        (i) =>
          i.order_id === orderId &&
          i.restaurant_id === restaurant_id &&
          (i.preparation_status === 'ready' || i.preparation_status === 'delivered') &&
          (isAll || i.destination_station === station)
      );

    const updated: OrderItem[] = [];
    for (const item of items) {
      updated.push(PosService.updateItemStatus(item.id, 'preparing', actor, 'Recall de comanda', restaurant_id));
    }
    return updated;
  }

  /**
   * Acknowledge incoming item in station
   */
  public static acknowledgeItem(
    itemId: string,
    actor: string = 'Cocina',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): OrderItem {
    return PosService.acknowledgeItem(itemId, actor, restaurant_id);
  }
}
