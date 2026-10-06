/**
 * DIRECTAURANTE POS CORE v0.1 - React State Management & API Client
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableSession,
  Product,
  Allergy,
  Ingredient,
  TableBill,
  OrderItem,
  GuestSubaccount,
  PluginDefinition,
  CashShift,
  CashMovement,
  AuditLog,
  KdsItemView,
  KdsTicketView,
  KdsProductionSummaryItem,
  KdsSettings,
  InventoryItem,
  InventoryAlert,
  InventorySummary,
  Recipe,
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
} from '../core/types';
import type { CreateRecipeDTO, UpdateRecipeDTO } from '../modules/recipes/recipeService';
import type {
  CreateSupplierDTO,
  CreatePurchaseOrderDTO,
  ReceivePurchaseOrderDTO,
} from '../modules/purchases/purchaseService';
import { directauranteSDK } from '../sdk';
import { IDirectauranteSDK } from '../sdk/types';
import { eventBus } from '../core/eventBus';

export interface ReadyNotification {
  item_id: string;
  product_name: string;
  seat_number: string;
  guest_name: string;
  table_number: string;
  table_id?: string;
  timestamp: string;
}

interface PosContextType {
  tables: Array<Table & { guests_count: number; active_items_count: number; total_cents: number; active_session?: TableSession }>;
  products: Product[];
  allergies: Allergy[];
  ingredients: Ingredient[];
  plugins: Array<PluginDefinition & { enabled: boolean; settings: Record<string, any> }>;
  selectedTableId: string | null;
  selectedTableDetails: {
    table: Table;
    session?: TableSession | null;
    subaccounts: GuestSubaccount[];
    orders?: any[];
    order?: any;
    items: OrderItem[];
  } | null;
  activeBill: TableBill | null;
  kdsItems: KdsItemView[];
  kdsTickets: KdsTicketView[];
  kdsSummary: KdsProductionSummaryItem[];
  kdsStationFilter: string;
  setKdsStationFilter: (st: string) => void;
  kdsViewMode: 'tickets' | 'items' | 'summary';
  setKdsViewMode: (mode: 'tickets' | 'items' | 'summary') => void;
  kdsShowHistory: boolean;
  setKdsShowHistory: (show: boolean) => void;
  kdsSettings: KdsSettings;
  updateKdsSettings: (settings: Partial<KdsSettings>) => void;
  cashData: {
    shift: CashShift | null;
    movements: CashMovement[];
    totals: { sales_cents: number; expenses_cents: number; withdrawals_cents: number; net_cash_cents: number };
  } | null;
  auditLogs: AuditLog[];
  readyNotifications: ReadyNotification[];
  sdk: IDirectauranteSDK;
  loading: boolean;
  error: string | null;

  // Actions
  refreshAll: () => Promise<void>;
  selectTable: (tableId: string | null) => Promise<void>;
  openTable: (tableId: string, waiterName: string, initialGuests?: Array<{ name: string; allergy_ids?: string[] }>) => Promise<void>;
  addGuest: (tableId: string, displayName: string, allergyIds?: string[], notes?: string) => Promise<GuestSubaccount>;
  createOrderTicket: (tableId: string, notes?: string) => Promise<any>;
  addItemToSeat: (
    tableId: string,
    guestSubaccountId: string,
    productId: string,
    quantity?: number,
    notes?: string,
    overrideAllergy?: boolean,
    orderTicketId?: string,
    modifiers?: string[]
  ) => Promise<{ success: boolean; item?: OrderItem; allergy_warning?: boolean; conflicts?: any[] }>;
  updateItemStatus: (itemId: string, status: OrderItem['preparation_status'], notes?: string) => Promise<void>;
  markItemDelivered: (itemId: string, actor?: string) => Promise<void>;
  fetchKds: (station?: string, includeCompleted?: boolean) => Promise<void>;
  startPreparingTicket: (orderId: string, station?: string) => Promise<void>;
  markTicketReady: (orderId: string, station?: string) => Promise<void>;
  deliverTicket: (orderId: string, station?: string) => Promise<void>;
  recallTicket: (orderId: string, station?: string) => Promise<void>;
  recallItem: (itemId: string) => Promise<void>;
  playKitchenChime: () => void;
  removeOrderItem: (itemId: string, reason?: string) => Promise<void>;
  reassignItemSubaccount: (itemId: string, newSubaccountId: string) => Promise<void>;
  dismissReadyNotification: (itemId: string) => void;
  fetchBill: (tableId: string) => Promise<TableBill>;
  recordPayment: (
    tableId: string,
    amountCents: number,
    method: 'cash' | 'card' | 'transfer',
    guestSubaccountId?: string,
    reference?: string
  ) => Promise<void>;
  closeTable: (tableId: string) => Promise<void>;
  togglePlugin: (pluginId: string, enabled: boolean) => Promise<void>;
  loadCanonicalScenario: () => Promise<void>;
  recordCashMovement: (type: CashMovement['type'], amountCents: number, description: string) => Promise<void>;
  openCashShift: (initialFloatCents: number, notes?: string) => Promise<void>;
  closeCashShift: (actualCashCents: number, notes?: string) => Promise<void>;

  // Inventory & Kardex (Core F6)
  inventoryItems: InventoryItem[];
  inventorySummary: InventorySummary | null;
  inventoryAlerts: InventoryAlert[];
  fetchInventory: () => Promise<void>;
  registerInventoryMovement: (params: any) => Promise<any>;
  registerInventoryAdjustment: (params: any) => Promise<any>;
  applyPhysicalCount: (params: any) => Promise<any>;

  // Recipes & Costing / COGS (Core F7)
  recipes: Array<Recipe & { cost_calculation?: RecipeCostCalculation }>;
  recipeSummary: RecipeSummary | null;
  fetchRecipes: () => Promise<void>;
  createRecipe: (data: CreateRecipeDTO) => Promise<any>;
  updateRecipe: (recipeId: string, data: UpdateRecipeDTO) => Promise<any>;
  deleteRecipe: (recipeId: string) => Promise<boolean>;

  // Purchases & Suppliers (Core F8)
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  priceHistory: PriceHistoryRecord[];
  purchaseSummary: PurchaseSummary | null;
  fetchPurchases: () => Promise<void>;
  createSupplier: (data: CreateSupplierDTO) => Promise<Supplier>;
  updateSupplier: (supplierId: string, data: Partial<CreateSupplierDTO>) => Promise<Supplier>;
  deleteSupplier: (supplierId: string) => Promise<boolean>;
  linkSupplierProduct: (supplierId: string, product: SupplierProduct) => Promise<Supplier>;
  createPurchaseOrder: (data: CreatePurchaseOrderDTO) => Promise<PurchaseOrder>;
  updatePurchaseOrder: (orderId: string, data: Partial<PurchaseOrder>) => Promise<PurchaseOrder>;
  updateOrderStatus: (orderId: string, status: PurchaseOrderStatus) => Promise<PurchaseOrder>;
  receivePurchaseOrder: (orderId: string, receiptData: ReceivePurchaseOrderDTO) => Promise<any>;
}

const PosContext = createContext<PosContextType | undefined>(undefined);

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTableDetails, setSelectedTableDetails] = useState<any | null>(null);
  const [activeBill, setActiveBill] = useState<TableBill | null>(null);
  const [kdsItems, setKdsItems] = useState<KdsItemView[]>([]);
  const [kdsTickets, setKdsTickets] = useState<KdsTicketView[]>([]);
  const [kdsSummary, setKdsSummary] = useState<KdsProductionSummaryItem[]>([]);
  const [kdsStationFilter, setKdsStationFilter] = useState<string>('all');
  const [kdsViewMode, setKdsViewMode] = useState<'tickets' | 'items' | 'summary'>('tickets');
  const [kdsShowHistory, setKdsShowHistory] = useState<boolean>(false);
  const [kdsSettings, setKdsSettings] = useState<KdsSettings>({
    station_id: 'all',
    warning_threshold_seconds: 480,
    overdue_threshold_seconds: 900,
    sound_alerts: true,
    view_mode: 'tickets',
  });
  const prevPendingCountRef = React.useRef(0);

  const updateKdsSettings = (newSettings: Partial<KdsSettings>) => {
    setKdsSettings((prev) => ({ ...prev, ...newSettings }));
  };
  const [cashData, setCashData] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [readyNotifications, setReadyNotifications] = useState<ReadyNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inventory states (Core F6)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryAlert[]>([]);

  // Recipes states (Core F7)
  const [recipes, setRecipes] = useState<Array<Recipe & { cost_calculation?: RecipeCostCalculation }>>([]);
  const [recipeSummary, setRecipeSummary] = useState<RecipeSummary | null>(null);

  // Purchases states (Core F8)
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRecord[]>([]);
  const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummary | null>(null);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/tables');
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
      }
    } catch (err: any) {
      console.error('Error fetching tables:', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
    }
  }, []);

  const fetchAllergies = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/allergies');
      if (res.ok) {
        const data = await res.json();
        setAllergies(data.allergies || []);
        setIngredients(data.ingredients || []);
      }
    } catch (err: any) {
      console.error('Error fetching allergies:', err);
    }
  }, []);

  const fetchPlugins = useCallback(async () => {
    try {
      const res = await fetch('/api/plugins');
      if (res.ok) {
        const data = await res.json();
        setPlugins(data.plugins || []);
      }
    } catch (err: any) {
      console.error('Error fetching plugins:', err);
    }
  }, []);

  const playKitchenChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Bell Tone 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Bell Tone 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.25, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.9);
    } catch {
      // AudioContext unavailable or autoplay blocked
    }
  }, []);

  const fetchKds = useCallback(
    async (station?: string, includeCompleted?: boolean) => {
      try {
        const activeStation = station !== undefined ? station : kdsStationFilter;
        const historyParam = includeCompleted !== undefined ? includeCompleted : kdsShowHistory;

        const stationQs = activeStation && activeStation !== 'all' ? `station=${encodeURIComponent(activeStation)}` : '';
        const histQs = historyParam ? 'include_completed=true' : '';
        const combined = [stationQs, histQs].filter(Boolean).join('&');
        const queryStr = combined ? `?${combined}` : '';

        const [itemsRes, ticketsRes, summaryRes] = await Promise.all([
          fetch(`/api/pos/kds/items${queryStr}`),
          fetch(`/api/pos/kds/tickets${queryStr}`),
          fetch(`/api/pos/kds/summary${stationQs ? `?${stationQs}` : ''}`),
        ]);

        if (itemsRes.ok) {
          const data = await itemsRes.json();
          setKdsItems(data.items || []);
        }
        if (ticketsRes.ok) {
          const data = await ticketsRes.json();
          const incomingTickets: KdsTicketView[] = data.tickets || [];
          setKdsTickets(incomingTickets);

          // Chime trigger if new pending orders arrived
          const pendingCount = incomingTickets.filter((t) => t.status === 'pending').length;
          if (pendingCount > prevPendingCountRef.current && kdsSettings.sound_alerts && !historyParam) {
            playKitchenChime();
          }
          prevPendingCountRef.current = pendingCount;
        }
        if (summaryRes.ok) {
          const data = await summaryRes.json();
          setKdsSummary(data.summary || []);
        }
      } catch (err: any) {
        console.error('Error fetching KDS:', err);
      }
    },
    [kdsStationFilter, kdsShowHistory, kdsSettings.sound_alerts, playKitchenChime]
  );

  const fetchCash = useCallback(async () => {
    try {
      const res = await fetch('/api/cash/current');
      if (res.ok) {
        const data = await res.json();
        setCashData(data);
      }
    } catch (err: any) {
      console.error('Error fetching cash:', err);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/audit/logs?limit=50');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err: any) {
      console.error('Error fetching audit:', err);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const [itemsRes, summaryRes, alertsRes] = await Promise.all([
        fetch('/api/inventory/items'),
        fetch('/api/inventory/summary'),
        fetch('/api/inventory/alerts'),
      ]);
      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setInventoryItems(d.items || []);
      }
      if (summaryRes.ok) {
        const d = await summaryRes.json();
        setInventorySummary(d.summary || null);
      }
      if (alertsRes.ok) {
        const d = await alertsRes.json();
        setInventoryAlerts(d.alerts || []);
      }
    } catch (err: any) {
      console.warn('Error fetching inventory:', err);
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      const [recRes, sumRes] = await Promise.all([
        fetch('/api/recipes'),
        fetch('/api/recipes/summary'),
      ]);
      if (recRes.ok) {
        const d = await recRes.json();
        setRecipes(d.data || []);
      }
      if (sumRes.ok) {
        const d = await sumRes.json();
        setRecipeSummary(d.data || null);
      }
    } catch (err: any) {
      console.warn('Error fetching recipes:', err);
    }
  }, []);

  const fetchPurchases = useCallback(async () => {
    try {
      const [supsRes, ordsRes, sumRes, histRes] = await Promise.all([
        fetch('/api/purchases/suppliers'),
        fetch('/api/purchases/orders'),
        fetch('/api/purchases/summary'),
        fetch('/api/purchases/price-history'),
      ]);
      if (supsRes.ok) {
        const d = await supsRes.json();
        setSuppliers(d.suppliers || []);
      }
      if (ordsRes.ok) {
        const d = await ordsRes.json();
        setPurchaseOrders(d.orders || []);
      }
      if (sumRes.ok) {
        const d = await sumRes.json();
        setPurchaseSummary(d.summary || null);
      }
      if (histRes.ok) {
        const d = await histRes.json();
        setPriceHistory(d.price_history || []);
      }
    } catch (err: any) {
      console.warn('Error fetching purchases:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchTables(),
      fetchProducts(),
      fetchAllergies(),
      fetchPlugins(),
      fetchKds(),
      fetchCash(),
      fetchAudit(),
      fetchInventory(),
      fetchRecipes(),
      fetchPurchases(),
    ]);
    if (selectedTableId) {
      await selectTable(selectedTableId);
    }
  }, [fetchTables, fetchProducts, fetchAllergies, fetchPlugins, fetchKds, fetchCash, fetchAudit, fetchInventory, fetchRecipes, fetchPurchases, selectedTableId]);

  const selectTable = async (tableId: string | null) => {
    setSelectedTableId(tableId);
    if (!tableId) {
      setSelectedTableDetails(null);
      setActiveBill(null);
      return;
    }
    try {
      const res = await fetch(`/api/pos/tables/${tableId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTableDetails(data);
        if (data.table.status !== 'available' && data.table.status !== 'closed') {
          const billRes = await fetch(`/api/pos/tables/${tableId}/bill`);
          if (billRes.ok) {
            const billData = await billRes.json();
            setActiveBill(billData.bill);
          }
        } else {
          setActiveBill(null);
        }
      }
    } catch (err: any) {
      console.error('Error selecting table:', err);
    }
  };

  const openTable = async (
    tableId: string,
    waiterName: string,
    initialGuests?: Array<{ name: string; allergy_ids?: string[] }>
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pos/tables/${tableId}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_name: waiterName, initial_guests: initialGuests }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al abrir mesa');
      await refreshAll();
      await selectTable(tableId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addGuest = async (tableId: string, displayName: string, allergyIds: string[] = [], notes?: string) => {
    const res = await fetch(`/api/pos/tables/${tableId}/seats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName, allergy_ids: allergyIds, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al añadir comensal');
    await selectTable(tableId);
    await fetchTables();
    return data.seat;
  };

  const createOrderTicket = async (tableId: string, notes?: string) => {
    const res = await fetch(`/api/pos/tables/${tableId}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al aperturar nueva comanda');
    await selectTable(tableId);
    return data.ticket;
  };

  const addItemToSeat = async (
    tableId: string,
    guestSubaccountId: string,
    productId: string,
    quantity: number = 1,
    notes?: string,
    overrideAllergy: boolean = false,
    orderTicketId?: string,
    modifiers?: string[]
  ) => {
    setError(null);
    const res = await fetch(`/api/pos/tables/${tableId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_subaccount_id: guestSubaccountId,
        product_id: productId,
        quantity,
        notes,
        override_allergy: overrideAllergy,
        order_ticket_id: orderTicketId,
        modifiers: modifiers || [],
      }),
    });
    const data = await res.json();
    if (res.status === 409 && data.is_allergy_warning) {
      return {
        success: false,
        allergy_warning: true,
        conflicts: data.conflicts,
      };
    }
    if (!res.ok) {
      throw new Error(data.error || 'Error al agregar producto');
    }
    await selectTable(tableId);
    await fetchTables();
    await fetchKds();
    await fetchAudit();
    return { success: true, item: data.item };
  };

  const updateItemStatus = async (itemId: string, status: OrderItem['preparation_status'], notes?: string) => {
    const res = await fetch(`/api/pos/items/${itemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al actualizar estado');
    }
    if (selectedTableId) await selectTable(selectedTableId);
    await fetchKds();
    await fetchAudit();
  };

  const markItemDelivered = async (itemId: string, actor: string = 'Mesero') => {
    await updateItemStatus(itemId, 'delivered', `Entregado al comensal por ${actor}`);
    setReadyNotifications((prev) => prev.filter((n) => n.item_id !== itemId));
  };

  const startPreparingTicket = async (orderId: string, station?: string) => {
    const res = await fetch(`/api/pos/kds/tickets/${orderId}/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station: station || kdsStationFilter, actor: 'Cocina' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al iniciar preparación del ticket');
    }
    await fetchKds();
    await fetchTables();
  };

  const markTicketReady = async (orderId: string, station?: string) => {
    const res = await fetch(`/api/pos/kds/tickets/${orderId}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station: station || kdsStationFilter, actor: 'Cocina' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al marcar ticket listo');
    }
    await fetchKds();
    await fetchTables();
  };

  const deliverTicket = async (orderId: string, station?: string) => {
    const res = await fetch(`/api/pos/kds/tickets/${orderId}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station: station || kdsStationFilter, actor: 'Mesero' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al despachar ticket');
    }
    await fetchKds();
    await fetchTables();
  };

  const recallTicket = async (orderId: string, station?: string) => {
    const res = await fetch(`/api/pos/kds/tickets/${orderId}/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station: station || kdsStationFilter, actor: 'Cocina' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al recuperar ticket');
    }
    await fetchKds();
    await fetchTables();
  };

  const recallItem = async (itemId: string) => {
    const res = await fetch(`/api/pos/kds/items/${itemId}/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'Cocina' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al recuperar producto');
    }
    await fetchKds();
    await fetchTables();
  };

  const removeOrderItem = async (itemId: string, reason: string = 'Cancelado por mesero') => {
    const res = await fetch(`/api/pos/items/${itemId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al cancelar producto');
    }
    if (selectedTableId) await selectTable(selectedTableId);
    await fetchTables();
    await fetchKds();
    await fetchAudit();
  };

  const reassignItemSubaccount = async (itemId: string, newSubaccountId: string) => {
    const res = await fetch(`/api/pos/items/${itemId}/reassign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_subaccount_id: newSubaccountId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al reasignar producto');
    }
    if (selectedTableId) await selectTable(selectedTableId);
    await fetchTables();
    await fetchKds();
    await fetchAudit();
  };

  const dismissReadyNotification = (itemId: string) => {
    setReadyNotifications((prev) => prev.filter((n) => n.item_id !== itemId));
  };

  const fetchBill = async (tableId: string): Promise<TableBill> => {
    try {
      const res = await fetch(`/api/pos/tables/${tableId}/bill`);
      const data = await res.json();
      if (!res.ok) {
        setActiveBill(null);
        return {
          table_id: tableId,
          table_session_id: '',
          table_number: 'Mesa',
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
      setActiveBill(data.bill);
      return data.bill;
    } catch (err: any) {
      console.warn('Error fetching bill for', tableId, err);
      setActiveBill(null);
      return {
        table_id: tableId,
        table_session_id: '',
        table_number: 'Mesa',
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
  };

  const recordPayment = async (
    tableId: string,
    amountCents: number,
    method: 'cash' | 'card' | 'transfer',
    guestSubaccountId?: string,
    reference?: string
  ) => {
    const res = await fetch(`/api/pos/tables/${tableId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_cents: amountCents,
        method,
        guest_subaccount_id: guestSubaccountId,
        reference,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar pago');
    await fetchBill(tableId);
    await fetchTables();
    await fetchCash();
    await fetchAudit();
  };

  const closeTable = async (tableId: string) => {
    const res = await fetch(`/api/pos/tables/${tableId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'Cajero / Mesero' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cerrar mesa');
    await refreshAll();
    setSelectedTableId(null);
    setSelectedTableDetails(null);
    setActiveBill(null);
  };

  const togglePlugin = async (pluginId: string, enabled: boolean) => {
    const res = await fetch(`/api/plugins/${pluginId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al cambiar plugin');
    }
    await fetchPlugins();
    await fetchAudit();
  };

  const loadCanonicalScenario = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pos/load-canonical-scenario', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar escenario canónico');
      await refreshAll();
      if (data.table?.id) {
        await selectTable(data.table.id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const recordCashMovement = async (type: CashMovement['type'], amountCents: number, description: string) => {
    const res = await fetch('/api/cash/movement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount_cents: amountCents, description }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error en movimiento de caja');
    }
    await fetchCash();
    await fetchAudit();
  };

  const openCashShift = async (initialFloatCents: number, notes?: string) => {
    const res = await fetch('/api/cash/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_float_cents: initialFloatCents, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al abrir turno');
    }
    await fetchCash();
    await fetchAudit();
  };

  const closeCashShift = async (actualCashCents: number, notes?: string) => {
    const res = await fetch('/api/cash/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_cash_cents: actualCashCents, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al cerrar turno');
    }
    await fetchCash();
    await fetchAudit();
  };

  const registerInventoryMovement = async (params: any) => {
    const res = await fetch('/api/inventory/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar movimiento de inventario');
    await fetchInventory();
    await fetchProducts();
    await fetchAudit();
    return data.movement;
  };

  const registerInventoryAdjustment = async (params: any) => {
    const res = await fetch('/api/inventory/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar ajuste de inventario');
    await fetchInventory();
    await fetchProducts();
    await fetchAudit();
    return data.movement;
  };

  const applyPhysicalCount = async (params: any) => {
    const res = await fetch('/api/inventory/counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al aplicar conteo físico');
    await fetchInventory();
    await fetchProducts();
    await fetchRecipes();
    await fetchAudit();
    return data.count;
  };

  const createRecipe = async (data: CreateRecipeDTO) => {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al crear receta');
    await fetchRecipes();
    await fetchAudit();
    return json.data;
  };

  const updateRecipe = async (recipeId: string, data: UpdateRecipeDTO) => {
    const res = await fetch(`/api/recipes/${recipeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al actualizar receta');
    await fetchRecipes();
    await fetchAudit();
    return json.data;
  };

  const deleteRecipe = async (recipeId: string) => {
    const res = await fetch(`/api/recipes/${recipeId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al desactivar receta');
    await fetchRecipes();
    await fetchAudit();
    return json.data?.deleted ?? true;
  };

  // ==========================================
  // Purchases & Suppliers (Core F8)
  // ==========================================

  const createSupplier = async (data: CreateSupplierDTO) => {
    const res = await fetch('/api/purchases/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al registrar proveedor');
    await fetchPurchases();
    await fetchAudit();
    return json.supplier;
  };

  const updateSupplier = async (supplierId: string, data: Partial<CreateSupplierDTO>) => {
    const res = await fetch(`/api/purchases/suppliers/${supplierId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al actualizar proveedor');
    await fetchPurchases();
    await fetchAudit();
    return json.supplier;
  };

  const deleteSupplier = async (supplierId: string) => {
    const res = await fetch(`/api/purchases/suppliers/${supplierId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al desactivar proveedor');
    await fetchPurchases();
    await fetchAudit();
    return json.success ?? true;
  };

  const linkSupplierProduct = async (supplierId: string, product: SupplierProduct) => {
    const res = await fetch(`/api/purchases/suppliers/${supplierId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al vincular insumo a proveedor');
    await fetchPurchases();
    return json.supplier;
  };

  const createPurchaseOrder = async (data: CreatePurchaseOrderDTO) => {
    const res = await fetch('/api/purchases/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al crear orden de compra');
    await fetchPurchases();
    await fetchAudit();
    return json.order;
  };

  const updatePurchaseOrder = async (orderId: string, data: Partial<PurchaseOrder>) => {
    const res = await fetch(`/api/purchases/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al actualizar orden de compra');
    await fetchPurchases();
    await fetchAudit();
    return json.order;
  };

  const updateOrderStatus = async (orderId: string, status: PurchaseOrderStatus) => {
    const res = await fetch(`/api/purchases/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al cambiar estado de orden');
    await fetchPurchases();
    await fetchAudit();
    return json.order;
  };

  const receivePurchaseOrder = async (orderId: string, receiptData: ReceivePurchaseOrderDTO) => {
    const res = await fetch(`/api/purchases/orders/${orderId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al recibir mercancía');
    await Promise.all([
      fetchPurchases(),
      fetchInventory(),
      fetchRecipes(),
      fetchProducts(),
      fetchAudit(),
    ]);
    return json;
  };

  useEffect(() => {
    refreshAll();

    const unsubReady = eventBus.subscribe('ORDER_ITEM_READY', (evt) => {
      const p = evt.payload;
      setReadyNotifications((prev) => [
        {
          item_id: p.item_id,
          product_name: p.product_name,
          seat_number: p.seat_number,
          guest_name: p.guest_name,
          table_number: p.table_number,
          table_id: p.table_id,
          timestamp: p.timestamp || new Date().toISOString(),
        },
        ...prev.filter((n) => n.item_id !== p.item_id),
      ]);
      fetchKds();
    });

    const unsubDelivered = eventBus.subscribe('ORDER_ITEM_DELIVERED', (evt) => {
      setReadyNotifications((prev) => prev.filter((n) => n.item_id !== evt.payload?.item_id));
      fetchKds();
    });

    const unsubCreated = eventBus.subscribe('ORDER_ITEM_CREATED', () => {
      fetchKds();
      fetchTables();
    });

    const unsubCancelled = eventBus.subscribe('ORDER_ITEM_CANCELLED', () => {
      fetchKds();
      fetchTables();
    });

    return () => {
      unsubReady();
      unsubDelivered();
      unsubCreated();
      unsubCancelled();
    };
  }, [refreshAll, fetchKds, fetchTables]);

  return (
    <PosContext.Provider
      value={{
        tables,
        products,
        allergies,
        ingredients,
        plugins,
        selectedTableId,
        selectedTableDetails,
        activeBill,
        kdsItems,
        kdsTickets,
        kdsSummary,
        kdsStationFilter,
        setKdsStationFilter,
        kdsViewMode,
        setKdsViewMode,
        kdsShowHistory,
        setKdsShowHistory,
        kdsSettings,
        updateKdsSettings,
        fetchKds,
        startPreparingTicket,
        markTicketReady,
        deliverTicket,
        recallTicket,
        recallItem,
        playKitchenChime,
        cashData,
        auditLogs,
        readyNotifications,
        sdk: directauranteSDK,
        loading,
        error,
        refreshAll,
        selectTable,
        openTable,
        addGuest,
        createOrderTicket,
        addItemToSeat,
        updateItemStatus,
        markItemDelivered,
        removeOrderItem,
        reassignItemSubaccount,
        dismissReadyNotification,
        fetchBill,
        recordPayment,
        closeTable,
        togglePlugin,
        loadCanonicalScenario,
        recordCashMovement,
        openCashShift,
        closeCashShift,
        inventoryItems,
        inventorySummary,
        inventoryAlerts,
        fetchInventory,
        registerInventoryMovement,
        registerInventoryAdjustment,
        applyPhysicalCount,
        recipes,
        recipeSummary,
        fetchRecipes,
        createRecipe,
        updateRecipe,
        deleteRecipe,
        suppliers,
        purchaseOrders,
        priceHistory,
        purchaseSummary,
        fetchPurchases,
        createSupplier,
        updateSupplier,
        deleteSupplier,
        linkSupplierProduct,
        createPurchaseOrder,
        updatePurchaseOrder,
        updateOrderStatus,
        receivePurchaseOrder,
      }}
    >
      {children}
    </PosContext.Provider>
  );
};

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) {
    throw new Error('usePos must be used within a PosProvider');
  }
  return context;
};
