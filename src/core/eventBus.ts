/**
 * DIRECTAURANTE POS CORE v0.1 - Domain Event Bus
 * In-process extensible event dispatcher for decoupled plugin architecture.
 */

export type DomainEventType =
  | 'TABLE_OPENED'
  | 'TABLE_CLOSED'
  | 'TABLE_SESSION_OPENED'
  | 'TABLE_SESSION_CLOSED'
  | 'SUBACCOUNT_CREATED'
  | 'SUBACCOUNT_UPDATED'
  | 'ORDER_CREATED'
  | 'ORDER_TICKET_CREATED'
  | 'ORDER_ITEM_CREATED'
  | 'ORDER_ITEM_SENT_TO_PRODUCTION'
  | 'ORDER_ITEM_ACKNOWLEDGED'
  | 'ORDER_ITEM_PREPARING'
  | 'ORDER_ITEM_READY'
  | 'ORDER_ITEM_DELIVERED'
  | 'ORDER_ITEM_CANCELLED'
  | 'ORDER_ITEM_MODIFIED'
  | 'ITEM_REASSIGNED'
  | 'SEAT_REMOVED'
  | 'ORDER_ITEMS_MOVED'
  | 'ORDER_SPLIT'
  | 'ORDER_SEAT_PAID'
  | 'TABLE_PENDING_PAYMENT'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_REFUNDED'
  | 'SHIFT_OPENED'
  | 'SHIFT_CLOSED'
  | 'SALE_CANCELLED'
  | 'EXPENSE_CREATED'
  | 'FINANCIAL_MOVEMENT_CREATED'
  | 'ALLERGY_WARNING_OVERRIDDEN'
  | 'PLUGIN_TOGGLED'
  | 'SOLUTION_REGISTERED'
  | 'ENTITLEMENT_GRANTED'
  | 'ENTITLEMENT_REVOKED'
  | 'ENTITLEMENT_UPDATED';

export interface DomainEvent<T = any> {
  id: string;
  type: DomainEventType;
  restaurant_id: string;
  timestamp: string;
  actor: string;
  payload: T;
}

export type EventHandler<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

class DomainEventBus {
  private handlers: Map<DomainEventType, Set<EventHandler>> = new Map();
  private eventHistory: DomainEvent[] = [];
  private readonly maxHistory = 200;

  public subscribe<T = any>(type: DomainEventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const handlersSet = this.handlers.get(type)!;
    handlersSet.add(handler);

    // Return unbind function
    return () => {
      handlersSet.delete(handler);
    };
  }

  public async publish<T = any>(
    type: DomainEventType,
    restaurant_id: string,
    actor: string,
    payload: T
  ): Promise<DomainEvent<T>> {
    const event: DomainEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      restaurant_id,
      timestamp: new Date().toISOString(),
      actor,
      payload,
    };

    // Keep history for inspection & diagnostics
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.pop();
    }

    const handlers = this.handlers.get(type);
    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        try {
          await Promise.resolve(handler(event));
        } catch (err) {
          console.error(`[DomainEventBus] Error in handler for event ${type}:`, err);
        }
      }
    }

    return event;
  }

  public emit(eventData: any): void {
    const event: any = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...eventData,
    };
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.pop();
    }
  }

  public getHistory(restaurant_id?: string, limit = 50): DomainEvent[] {
    if (restaurant_id) {
      return this.eventHistory.filter((e) => e.restaurant_id === restaurant_id).slice(0, limit);
    }
    return this.eventHistory.slice(0, limit);
  }
}

export const eventBus = new DomainEventBus();
