/**
 * DIRECTAURANTE POS CORE v0.1 - Domain Types & Schemas
 * Modular Monolith architecture matching Directaurante's backend conventions.
 */

export const DEFAULT_RESTAURANT_ID = 'rest_directaurante_01';

export interface Restaurant {
  id: string;
  name: string;
  legal_name: string;
  currency: string; // e.g. "MXN"
  tax_rate: number; // e.g. 0.16
  status?: 'active' | 'suspended' | 'pending_approval';
  is_approved?: boolean;
  phone?: string;
  email?: string;
  address?: {
    street: string;
    number: string;
    interior?: string;
    colony: string;
    city: string;
    state: string;
    postal_code: string;
    latitude?: number;
    longitude?: number;
  };
  operating_hours?: {
    monday?: { open: string; close: string; closed?: boolean };
    tuesday?: { open: string; close: string; closed?: boolean };
    wednesday?: { open: string; close: string; closed?: boolean };
    thursday?: { open: string; close: string; closed?: boolean };
    friday?: { open: string; close: string; closed?: boolean };
    saturday?: { open: string; close: string; closed?: boolean };
    sunday?: { open: string; close: string; closed?: boolean };
  };
  settings?: {
    allow_negative_stock?: boolean;
    require_open_cash_for_payments?: boolean;
    default_preparation_time_minutes?: number;
    auto_print_order_tickets?: boolean;
  };
  created_at: string;
  updated_at?: string;
}

export interface Branch {
  id: string;
  restaurant_id: string;
  name: string;
  code: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
}

export interface Allergy {
  id: string;
  name: string;
  ingredient_ids: string[];
  severity: 'mild' | 'moderate' | 'severe';
  description?: string;
}

export interface OrderItemAllocation {
  guest_subaccount_id: string;
  seat_number: string;
  percentage: number;
  allocated_price_cents: number;
}

export type KdsStation = 'kitchen' | 'bar' | 'grill' | 'desserts' | 'expediter' | (string & {});

export interface ProductVariant {
  id: string;
  name: string; // e.g. "Chico", "Mediano", "Grande"
  price_cents: number;
  sku?: string;
  inventory_item_id?: string;
}

export interface ProductTopping {
  id: string;
  name: string; // e.g. "Tocino Crujiente", "Aguacate Extra"
  price_cents: number; // e.g. 2500 -> $25.00 MXN
  max_quantity?: number;
}

export interface Product {
  id: string;
  restaurant_id: string;
  sku?: string;
  name: string;
  category: 'Platillos' | 'Bebidas' | 'Entradas' | 'Postres' | 'Snacks' | string;
  description: string;
  price_cents: number; // Integer cents to prevent IEEE 754 precision issues
  ingredient_ids: string[];
  destination_station: KdsStation;
  preparation_time_minutes: number;
  target_preparation_seconds?: number; // Target SLA for KDS timers
  available_modifiers?: string[]; // e.g. ["Extra queso", "Sin cebolla", "Término medio"]
  variants?: ProductVariant[];
  toppings?: ProductTopping[];
  available: boolean;
  is_active?: boolean;
  inventory_item_id?: string; // Links product to physical inventory item
  inventory_tracking?: boolean; // false for non-inventoriable items (e.g. services, tips), default true
  auto_disable_on_zero_stock?: boolean;
  image_url?: string;
  updated_at?: string;
}

export type TableStatus = 'available' | 'occupied' | 'pending_payment' | 'bill_requested' | 'paying' | 'closed';
export type TableSessionStatus = 'active' | 'pending_payment' | 'bill_requested' | 'paying' | 'closed';

export interface TableSession {
  id: string; // UUID/str (e.g. sess_...)
  restaurant_id: string;
  branch_id?: string;
  table_id: string;
  status: TableSessionStatus;
  opened_at: string;
  closed_at?: string;
  server_id: string; // Waiter / Server identifier
  guest_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Table {
  id: string;
  restaurant_id: string;
  branch_id?: string;
  number: string; // e.g. "Mesa 1", "Mesa 2"
  capacity: number; // Physical/informational capacity (never limits diners 1..N)
  current_diners?: number;
  status: TableStatus;
  active_session_id?: string;
  opened_at?: string;
  assigned_waiter?: string;
  notes?: string;
}

export interface GuestSubaccount {
  id: string; // UUID/str (e.g. seat_...)
  table_session_id: string; // Mandatory link to active session
  table_id?: string; // Optional convenience link to table
  seat_number: string; // e.g. "1.1", "1.2", "1.3", "1.4"
  display_name: string; // e.g. "Carlos", "Ana", "Luis", "María"
  customer_id?: string; // Optional CRM customer link
  allergy_ids: string[];
  notes?: string;
  status: 'active' | 'inactive' | 'paid' | 'closed';
  created_at: string;
  updated_at: string;
}

export type OrderItemStatus = 'draft' | 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'paid';

export interface OrderItemStatusHistory {
  status: OrderItemStatus;
  changed_by: string;
  timestamp: string;
  notes?: string;
}

export interface OrderItem {
  id: string;
  order_id: string; // Comanda Ticket ID
  table_session_id: string; // TableSession ID
  restaurant_id: string;
  product_id: string;
  product_name: string;
  guest_subaccount_id: string; // Diner Subaccount ID
  seat_id?: string; // Convenient alias for guest_subaccount_id
  seat_number: string;
  guest_name: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  destination_station: KdsStation;
  notes?: string;
  modifiers?: string[];
  preparation_status: OrderItemStatus;
  status_history: OrderItemStatusHistory[];
  created_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  preparing_at?: string;
  ready_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  target_preparation_seconds?: number;
  preparation_duration_seconds?: number;
  total_operational_duration_seconds?: number;
  allocations?: OrderItemAllocation[];
}

export type OrderType = 'dine_in' | 'delivery' | 'pos' | 'directgo' | 'catering' | 'takeout';
export type OrderStatus = 'open' | 'confirmed' | 'preparing' | 'ready' | 'assigned' | 'out_for_delivery' | 'delivered' | 'completed' | 'cancelled';

export interface Order {
  id: string; // UUID/str (e.g. ord_..., or comanda ticket)
  restaurant_id: string;
  branch_id?: string;
  table_id?: string; // Optional for delivery / takeout / catering
  table_session_id?: string; // Optional for delivery / takeout / catering
  ticket_number?: string; // e.g. "Comanda #001", "Pedido #104"
  order_type: OrderType;
  status: OrderStatus;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  server_id?: string;
  customer_id?: string;
  delivery_address_id?: string;
  delivery_address?: string;
  driver_id?: string;
  driver_name?: string;
  dispatch_status?: 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'failed';
  dispatched_at?: string;
  delivered_at?: string;
  promotion_id?: string;
  coupon_code?: string;
  discount_cents?: number;
  points_earned?: number;
  points_redeemed?: number;
  cancellation_reason?: string;
  notes?: string;
  created_at: string;
  closed_at?: string;
  updated_at?: string;
}

export interface SubaccountBill {
  guest_subaccount_id: string;
  seat_number: string;
  display_name: string;
  items: OrderItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
}

export interface TableBill {
  table_id: string;
  table_number: string;
  table_session_id: string;
  session_status?: TableSessionStatus;
  status?: TableSessionStatus;
  orders: Order[]; // All orders/tickets within this session (e.g. Comanda #001, #002)
  order_id?: string;
  subaccounts: SubaccountBill[];
  total_items_count: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'digital' | 'other';
export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'cancelled';

export interface Payment {
  id: string; // UUID/str
  restaurant_id: string;
  table_session_id: string; // Mandatory: links payment to session
  table_id: string;
  order_id?: string; // Optional: references specific ticket or global order
  guest_subaccount_id?: string; // Optional: for individual guest settlement
  amount_cents: number;
  method: PaymentMethod;
  payment_status: PaymentStatus;
  created_at: string;
  cashier: string;
  user_id?: string;
  reference?: string;
  idempotency_key?: string;
  refunded_amount_cents?: number;
  refund_reason?: string;
  refunded_at?: string;
}

export type CashSessionStatus = 'open' | 'active' | 'closed';

export interface CashShift {
  id: string;
  restaurant_id: string;
  opened_by: string;
  user_id?: string;
  opened_at: string;
  initial_float_cents: number;
  opening_amount_cents?: number; // Normalized alias
  status: 'open' | 'closed';
  closed_by?: string;
  closed_at?: string;
  expected_cash_cents: number;
  actual_cash_cents?: number;
  counted_cash_cents?: number; // Normalized alias
  difference_cents?: number;
  notes?: string;
}

export type CashSession = CashShift;

export interface CashMovement {
  id: string;
  shift_id: string;
  restaurant_id: string;
  type: 'opening_float' | 'sale' | 'expense' | 'withdrawal' | 'deposit' | 'adjustment' | 'refund';
  amount_cents: number;
  description: string;
  performed_by: string;
  user_id?: string;
  timestamp: string;
  reference_order_id?: string;
  reference_expense_id?: string;
}

export type ExpenseCategory =
  | 'utilities'
  | 'rent'
  | 'supplies'
  | 'maintenance'
  | 'marketing'
  | 'transport'
  | 'services'
  | 'payroll'
  | 'other';

export interface Expense {
  id: string;
  restaurant_id: string;
  category: ExpenseCategory;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod;
  vendor?: string;
  reference?: string;
  description: string;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  cash_session_id?: string;
  created_by: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export type FinancialMovementType =
  | 'sale'
  | 'refund'
  | 'expense'
  | 'cash_in'
  | 'cash_out'
  | 'deposit'
  | 'withdrawal'
  | 'adjustment'
  | 'opening'
  | 'closing'
  | 'settlement';

export type FinancialDirection = 'in' | 'out';

export interface FinancialMovement {
  id: string;
  restaurant_id: string;
  type: FinancialMovementType;
  direction: FinancialDirection;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod;
  reference_type: 'payment' | 'expense' | 'cash_session' | 'settlement' | 'order' | 'manual';
  reference_id: string;
  cash_session_id?: string;
  description: string;
  idempotency_key?: string;
  created_by: string;
  user_id?: string;
  created_at: string;
}

export interface RestaurantSettlement {
  id: string;
  restaurant_id: string;
  channel: 'directgo' | 'third_party' | 'dine_in' | 'catering';
  period_start: string;
  period_end: string;
  gross_sales_cents: number;
  commissions_cents: number;
  net_payout_cents: number;
  status: 'pending' | 'settled' | 'disputed';
  payment_reference?: string;
  created_by: string;
  settled_at?: string;
  created_at: string;
}

export interface DriverProfile {
  id: string; // e.g. drv_01
  restaurant_id: string;
  name: string;
  phone: string;
  email?: string;
  vehicle_type: 'motorcycle' | 'bicycle' | 'car' | 'walker';
  license_plate?: string;
  is_verified: boolean;
  status: 'offline' | 'available' | 'busy' | 'suspended';
  current_latitude?: number;
  current_longitude?: number;
  last_gps_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface DeliveryDispatch {
  id: string; // e.g. dsp_01
  order_id: string;
  restaurant_id: string;
  driver_id?: string;
  driver_name?: string;
  status: 'offered' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled' | 'expired';
  delivery_address: string;
  delivery_fee_cents: number;
  cash_to_collect_cents: number;
  offered_at?: string;
  expires_at?: string;
  assigned_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  created_at: string;
}

export interface DriverSettlement {
  id: string;
  restaurant_id: string;
  driver_id: string;
  driver_name: string;
  period_date: string;
  cash_collected_cents: number;
  delivery_fees_earned_cents: number;
  tips_cents: number;
  balance_due_cents: number; // positive = driver owes restaurant; negative = restaurant owes driver
  status: 'pending' | 'reconciled';
  created_by: string;
  reconciled_at?: string;
  created_at: string;
}

export interface OperatingPnL {
  restaurant_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  // Top-line Revenue
  gross_sales_cents: number;
  discounts_cents: number;
  refunds_cents: number;
  net_sales_cents: number;
  // Cost of Goods Sold (Reutilizando F7 COGS)
  cogs_cents: number;
  gross_profit_cents: number;
  gross_margin_percent: number;
  // Operating Expenses (F12 Expenses)
  operating_expenses_cents: number;
  expenses_by_category: Record<ExpenseCategory, number>;
  // Operating Result / EBITDA
  operating_result_cents: number;
  operating_margin_percent: number;
  orders_count: number;
  payments_count: number;
}

export interface ZCutReport {
  id: string;
  restaurant_id: string;
  shift_id: string;
  opened_at: string;
  closed_at: string;
  opened_by: string;
  closed_by: string;
  initial_float_cents: number;
  sales_by_method: Record<PaymentMethod, number>;
  total_sales_cents: number;
  total_expenses_cents: number;
  total_withdrawals_cents: number;
  total_deposits_cents: number;
  total_refunds_cents: number;
  expected_cash_cents: number;
  counted_cash_cents: number;
  difference_cents: number;
  movements_count: number;
  generated_at: string;
}

export interface AuditLog {
  id: string;
  restaurant_id: string;
  action: string;
  entity_type:
    | 'table'
    | 'table_session'
    | 'order'
    | 'order_item'
    | 'guest_subaccount'
    | 'payment'
    | 'cash_shift'
    | 'plugin'
    | 'inventory_item'
    | 'inventory_movement'
    | 'inventory_count'
    | (string & {});
  entity_id: string;
  actor: string;
  previous_state?: any;
  new_state?: any;
  notes?: string;
  timestamp: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  isCore: boolean;
  category: 'operations' | 'kitchen' | 'finance' | 'hardware' | 'migration' | 'intelligence';
  icon: string;
  defaultEnabled: boolean;
  capabilities: string[];
}

export interface RestaurantPluginConfig {
  restaurant_id: string;
  plugin_id: string;
  enabled: boolean;
  version: string;
  settings: Record<string, any>;
  updated_at: string;
}

export type PrinterConnectionType =
  | 'network'
  | 'ethernet'
  | 'usb'
  | 'bluetooth'
  | 'local'
  | 'wifi'
  | 'serial';

export interface PrinterProfile {
  id: string;
  restaurant_id: string;
  name: string;
  connection_type: PrinterConnectionType;
  host: string;
  address?: string; // backwards compatibility alias for host
  port: number;
  station: 'kitchen' | 'bar' | 'cash' | 'cashier' | 'grill' | 'desserts' | 'expediter' | string;
  paper_width: 58 | 80;
  is_active: boolean;
  enabled?: boolean; // backwards compatibility alias for is_active
  protocol: 'esc_pos';
}

export type Printer = PrinterProfile;

export interface PrintJob {
  id: string; // print_job_id for idempotency
  restaurant_id: string;
  order_id?: string;
  table_id?: string;
  table_number?: string;
  station: string;
  printer_id: string;
  printer_name?: string;
  type:
    | 'kitchen'
    | 'bar'
    | 'cashier'
    | 'customer'
    | 'general'
    | 'kitchen_ticket'
    | 'bar_ticket'
    | 'pre_check'
    | 'receipt'
    | 'z_report'
    | 'test';
  paper_width: 58 | 80;
  status: 'pending' | 'queued' | 'processing' | 'sent' | 'printed' | 'completed' | 'failed';
  formatted_content: string;
  escpos_hex: string;
  bytes_count: number;
  created_at: string;
  retries_count: number;
  error_message?: string;
}

export interface PrinterRoutingRule {
  id: string;
  restaurant_id: string;
  station: KdsStation;
  printer_id: string;
  categories: string[];
}

export interface ImportJob {
  id: string;
  restaurant_id: string;
  source_pos: string; // e.g. 'SoftRestaurant', 'Toast', 'Square', 'Micros', 'Excel'
  file_name: string;
  status: 'pending' | 'analyzing' | 'preview_ready' | 'imported' | 'reverted' | 'failed';
  total_products_detected: number;
  issues_count: number;
  created_at: string;
  preview_data?: {
    categories: string[];
    sample_products: Array<{ name: string; price: number; category: string }>;
  };
}

export interface ImportCandidate {
  raw_name: string;
  mapped_name: string;
  raw_price: number;
  price_cents: number;
  category: Product['category'];
  station: KdsStation;
  has_issue: boolean;
  issue_message?: string;
}

export interface KdsItemView extends OrderItem {
  table_number: string;
  ticket_number?: string;
  elapsed_seconds: number;
  preparation_seconds?: number;
  target_seconds: number;
  traffic_light: 'pending' | 'preparing' | 'ready' | 'overdue' | 'delivered';
  traffic_light_label: string;
  traffic_light_color: string;
  is_overdue: boolean;
  diner_allergies?: string[];
}

export interface KdsTicketView {
  id: string; // Unique ticket station id (e.g. ord_01_kitchen)
  order_id: string;
  order_number: string;
  ticket_number: string;
  table_id: string;
  table_number: string;
  server_name: string;
  destination_station: KdsStation;
  station_label: string;
  created_at: string;
  elapsed_seconds: number;
  target_seconds: number;
  is_overdue: boolean;
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  status_label: string;
  items: KdsItemView[];
  diner_subaccounts: Array<{
    seat_number: string;
    guest_name: string;
  }>;
  all_allergies: string[];
  has_allergies: boolean;
  notes?: string[];
}

export interface KdsProductionSummaryItem {
  product_id: string;
  product_name: string;
  category: string;
  destination_station: string;
  pending_qty: number;
  preparing_qty: number;
  total_active_qty: number;
}

export interface KdsSettings {
  station_id: string; // 'all' | 'kitchen' | 'bar' | 'grill' | 'desserts' | 'expediter'
  warning_threshold_seconds: number; // e.g. 480
  overdue_threshold_seconds: number; // e.g. 900
  sound_alerts: boolean;
  view_mode: 'tickets' | 'items' | 'summary';
}

// ==========================================
// FASE 6 — INVENTARIO, KÁRDEX Y CONTROL DE EXISTENCIAS
// ==========================================

export type InventoryMovementType =
  | 'purchase'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'waste'
  | 'return'
  | 'transfer_in'
  | 'transfer_out'
  | 'sale'
  | 'initial_stock'
  | 'count_adjustment'
  | 'purchase_return'
  | 'production_consumed'
  | 'production_output'
  | 'production_waste';

export type InventoryUnit = 'pza' | 'kg' | 'g' | 'lt' | 'ml' | 'oz' | 'caja' | 'porción' | string;

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  sku: string;
  name: string;
  category:
    | 'Insumos Cocina'
    | 'Bebidas & Licores'
    | 'Carnes & Proteínas'
    | 'Lácteos'
    | 'Verduras & Frutas'
    | 'Abarrotes'
    | 'Desechables'
    | string;
  current_stock: number;
  min_stock: number;
  max_stock?: number;
  base_unit: InventoryUnit; // e.g. 'pza', 'kg', 'lt'
  purchase_unit?: InventoryUnit; // e.g. 'caja'
  conversion_factor?: number; // e.g. 1 caja = 24 pza
  cost_cents: number; // Average unit cost in cents
  cost_cents_per_unit?: number; // Alias for base unit cost in cents
  linked_product_id?: string; // Direct linked commercial product
  preferred_supplier_id?: string; // Preferred supplier identifier (F8)
  last_purchase_cost_cents?: number; // Latest purchase price per base unit in cents (F8)
  allow_negative_stock: boolean; // default false
  is_active: boolean;
  last_count_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  restaurant_id: string;
  inventory_item_id: string;
  item_name?: string;
  movement_type: InventoryMovementType;
  quantity: number; // Signed delta or positive with type convention
  unit: InventoryUnit;
  previous_stock: number;
  new_stock: number;
  reason: string;
  reference_type: 'purchase' | 'manual_adjustment' | 'waste' | 'sale' | 'physical_count' | 'transfer' | 'initial' | string;
  reference_id?: string; // Idempotency key (e.g. 'PURCHASE-101', 'ord_123', 'COUNT-01')
  user_id: string; // Actor
  cost_cents_per_unit?: number;
  created_at: string;
}

export interface InventoryCountItem {
  inventory_item_id: string;
  item_name?: string;
  sku?: string;
  system_stock: number;
  counted_stock: number;
  difference: number;
  unit: InventoryUnit;
  reason?: string;
}

export interface InventoryCount {
  id: string;
  restaurant_id: string;
  performed_by: string;
  notes?: string;
  status: 'draft' | 'applied';
  items: InventoryCountItem[];
  created_at: string;
  applied_at?: string;
}

export interface InventoryAlert {
  inventory_item_id: string;
  item_name: string;
  sku: string;
  current_stock: number;
  min_stock: number;
  unit: InventoryUnit;
  type: 'out_of_stock' | 'low_stock';
  message: string;
  severity: 'critical' | 'warning';
}

export interface InventorySummary {
  total_items: number;
  total_valuation_cents: number;
  low_stock_count: number;
  out_of_stock_count: number;
  recent_movements_count: number;
  alerts: InventoryAlert[];
}

// ==========================================
// FASE 7 — RECETAS, CONSUMO DE INGREDIENTES Y COSTEO (COGS)
// ==========================================

export interface RecipeItem {
  inventory_item_id: string;
  quantity: number;
  unit: InventoryUnit;
  waste_percent?: number; // e.g. 5 means 5% waste
  notes?: string;
  item_name?: string;
}

// Subrecipe reference support
export interface RecipeSubItem {
  sub_recipe_id: string;
  quantity: number;
  unit: string;
  waste_percent?: number;
}

// Modifiers with or without inventory impact (affects_inventory)
export interface RecipeModifierItem {
  modifier_name: string;
  affects_inventory: boolean;
  inventory_item_id?: string;
  quantity?: number;
  unit?: InventoryUnit;
  waste_percent?: number;
  notes?: string;
}

export interface RecipeVersionRecord {
  version: number;
  yield_quantity: number;
  yield_unit: string;
  items: RecipeItem[];
  modifier_items?: RecipeModifierItem[];
  sub_recipe_ids?: string[];
  total_cost_cents: number;
  cost_per_yield_cents: number;
  calculated_at: string;
  changed_by: string;
  notes?: string;
}

export interface Recipe {
  id: string;
  restaurant_id: string;
  product_id: string;
  name: string;
  yield_quantity: number; // e.g. 1 portion or 1000g
  yield_unit: string; // e.g. 'porción', 'pza', 'g', 'kg', 'lt'
  items: RecipeItem[];
  modifier_items?: RecipeModifierItem[];
  sub_recipe_ids?: string[];
  version: number;
  is_active: boolean;
  preparation_instructions?: string;
  versions_history?: RecipeVersionRecord[];
  created_at: string;
  updated_at: string;
  // Compatibility fields
  yield_portions?: number;
  ingredients?: RecipeItem[];
}

export interface RecipeCostBreakdownItem {
  inventory_item_id: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  waste_percent: number;
  effective_quantity: number;
  unit_cost_cents: number;
  base_unit: string;
  line_cost_cents: number;
}

export interface RecipeCostCalculation {
  recipe_id: string;
  product_id: string;
  product_name: string;
  selling_price_cents: number;
  yield_quantity: number;
  yield_unit: string;
  total_batch_cost_cents: number;
  cogs_cents: number; // Cost per yield unit (per portion)
  gross_margin_cents: number; // selling_price_cents - cogs_cents
  gross_margin_percent: number; // ((selling - cogs) / selling) * 100
  food_cost_percent: number; // (cogs / selling) * 100
  items_breakdown: RecipeCostBreakdownItem[];
  modifier_costs?: Array<{
    modifier_name: string;
    affects_inventory: boolean;
    cost_cents: number;
    inventory_item_name?: string;
  }>;
  has_outdated_cost?: boolean;
  calculated_at: string;
}

export interface RecipeSummary {
  total_recipes: number;
  products_with_recipe: number;
  products_without_recipe: number;
  average_food_cost_percent: number;
  average_gross_margin_percent: number;
  missing_recipe_products: Array<{
    id: string;
    name: string;
    category: string;
    price_cents: number;
  }>;
  low_margin_recipes: Array<{
    recipe_id: string;
    product_name: string;
    margin_percent: number;
    cogs_cents: number;
    price_cents: number;
  }>;
  outdated_cost_recipes_count: number;
}

// ==========================================
// FASE 8 — COMPRAS, PROVEEDORES Y ENTRADAS DE INVENTARIO
// ==========================================

export interface SupplierProduct {
  inventory_item_id: string;
  item_name?: string;
  supplier_sku?: string;
  purchase_unit: InventoryUnit;
  conversion_factor?: number; // e.g. 1 caja = 24 pza
  last_purchase_cost_cents: number;
  is_preferred?: boolean;
}

export interface Supplier {
  id: string; // e.g. sup_123
  restaurant_id: string;
  name: string;
  legal_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string; // RFC / Tax ID
  notes?: string;
  products?: SupplierProduct[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  inventory_item_id: string;
  item_name?: string;
  sku?: string;
  quantity_ordered: number;
  quantity_received: number; // Cumulative accepted/received
  unit: InventoryUnit; // e.g. 'caja', 'kg', 'pza'
  cost_cents_per_unit: number; // Unit cost in order unit
  total_cost_cents: number;
  notes?: string;
}

export interface PurchaseReceiptItem {
  purchase_order_item_id: string;
  inventory_item_id: string;
  item_name?: string;
  quantity_received: number; // Received total
  quantity_accepted: number; // Valid stock entering inventory
  quantity_rejected?: number; // Damaged or rejected
  rejection_reason?: string;
  unit: InventoryUnit;
  cost_cents_per_unit: number;
  conversion_factor?: number;
  base_unit?: InventoryUnit;
}

export interface PurchaseReceipt {
  id: string; // e.g. rec_123
  restaurant_id: string;
  purchase_order_id: string;
  receipt_number: string; // e.g. REC-00125
  invoice_number?: string; // Invoice / folio
  invoice_date?: string;
  received_by: string; // User / Actor
  received_at: string;
  items: PurchaseReceiptItem[];
  subtotal_cents: number;
  freight_cents?: number;
  discount_cents?: number;
  tax_cents?: number;
  total_cents: number;
  notes?: string;
}

export interface PurchaseOrder {
  id: string; // e.g. po_123
  restaurant_id: string;
  order_number: string; // e.g. OC-000125
  supplier_id: string;
  supplier_name: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal_cents: number;
  freight_cents?: number;
  discount_cents?: number;
  tax_cents?: number;
  total_cents: number;
  receipts?: PurchaseReceipt[];
  // Accounts payable preparation (Section 21)
  payment_status?: 'pending' | 'partially_paid' | 'paid';
  paid_amount_cents?: number;
  due_date?: string;
  notes?: string;
  ordered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryRecord {
  id: string;
  restaurant_id: string;
  inventory_item_id: string;
  item_name: string;
  supplier_id: string;
  supplier_name: string;
  purchase_order_id: string;
  receipt_id: string;
  quantity_received: number;
  unit: InventoryUnit;
  cost_cents_per_unit: number;
  cost_cents_per_base_unit: number;
  date: string;
}

export interface PurchaseSummary {
  total_orders: number;
  pending_orders_count: number; // draft + ordered
  partially_received_count: number;
  received_today_count: number;
  total_suppliers: number;
  total_monthly_spend_cents: number;
  recent_price_increases_count: number;
}

// ==========================================
// FASE 9 — PRODUCCIÓN, TRANSFORMACIÓN Y MERMAS
// ==========================================

export type ProductionOrderStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ProductionWasteType =
  | 'production_waste'
  | 'spoilage'
  | 'process_loss'
  | 'damaged'
  | 'expired';

export interface ProductionConsumedItem {
  inventory_item_id: string;
  item_name?: string;
  quantity_planned: number;
  quantity_consumed: number;
  unit: InventoryUnit;
  waste_percent_expected: number;
  cost_cents_per_unit: number;
  total_cost_cents: number;
}

export interface ProductionWasteRecord {
  id: string;
  production_order_id: string;
  inventory_item_id: string;
  item_name: string;
  quantity: number;
  unit: InventoryUnit;
  waste_type: ProductionWasteType;
  reason: string;
  cost_cents: number;
  recorded_by: string;
  created_at: string;
}

export interface ProductionOrder {
  id: string; // e.g. prd_123
  restaurant_id: string;
  batch_number: string; // e.g. PROD-000101
  recipe_id: string;
  recipe_name: string;
  recipe_version: number;
  product_id?: string; // Target commercial or sub-recipe product
  output_inventory_item_id: string; // F6 inventory item receiving produced goods
  output_item_name: string;
  quantity_planned: number;
  quantity_produced: number;
  unit: InventoryUnit;
  yield_quantity: number;
  yield_unit: InventoryUnit;
  status: ProductionOrderStatus;
  items_consumed: ProductionConsumedItem[];
  waste_records: ProductionWasteRecord[];
  total_ingredients_cost_cents: number;
  total_waste_cost_cents: number;
  total_production_cost_cents: number;
  unit_cost_cents: number; // cost per produced unit
  movements: string[]; // F6 InventoryMovement IDs generated
  notes?: string;
  created_by: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionSummary {
  total_orders: number;
  completed_count: number;
  in_progress_count: number;
  draft_count: number;
  total_units_produced: number;
  total_production_spend_cents: number;
  total_waste_cost_cents: number;
  active_recipes_count: number;
}

// ==========================================
// FASE 10 — PERSONAL, ROLES, PERMISOS Y TURNOS
// ==========================================

export type Permission =
  | 'restaurant.view'
  | 'restaurant.manage'
  | 'orders.view'
  | 'orders.create'
  | 'orders.update'
  | 'orders.cancel'
  | 'tables.view'
  | 'tables.manage'
  | 'payments.view'
  | 'payments.create'
  | 'payments.refund'
  | 'cash.view'
  | 'cash.open'
  | 'cash.close'
  | 'cash.adjust'
  | 'expenses.view'
  | 'expenses.create'
  | 'expenses.edit'
  | 'financial.view'
  | 'reports.financial'
  | 'settlements.view'
  | 'settlements.manage'
  | 'inventory.view'
  | 'inventory.adjust'
  | 'recipes.view'
  | 'recipes.manage'
  | 'purchases.view'
  | 'purchases.create'
  | 'purchases.receive'
  | 'production.view'
  | 'production.create'
  | 'production.complete'
  | 'production.cancel'
  | 'production.waste'
  | 'staff.view'
  | 'staff.manage'
  | 'roles.view'
  | 'roles.manage'
  | 'permissions.view'
  | 'shifts.view'
  | 'shifts.manage'
  | 'shifts.start'
  | 'shifts.end'
  | 'customers.view'
  | 'customers.manage'
  | 'loyalty.view'
  | 'loyalty.manage'
  | 'loyalty.adjust'
  | 'promotions.view'
  | 'promotions.manage'
  | 'reports.view';

export const ALL_PERMISSIONS: Permission[] = [
  'restaurant.view',
  'restaurant.manage',
  'orders.view',
  'orders.create',
  'orders.update',
  'orders.cancel',
  'tables.view',
  'tables.manage',
  'payments.view',
  'payments.create',
  'payments.refund',
  'cash.view',
  'cash.open',
  'cash.close',
  'cash.adjust',
  'expenses.view',
  'expenses.create',
  'expenses.edit',
  'financial.view',
  'reports.financial',
  'settlements.view',
  'settlements.manage',
  'inventory.view',
  'inventory.adjust',
  'recipes.view',
  'recipes.manage',
  'purchases.view',
  'purchases.create',
  'purchases.receive',
  'production.view',
  'production.create',
  'production.complete',
  'production.cancel',
  'production.waste',
  'staff.view',
  'staff.manage',
  'roles.view',
  'roles.manage',
  'permissions.view',
  'shifts.view',
  'shifts.manage',
  'shifts.start',
  'shifts.end',
  'customers.view',
  'customers.manage',
  'loyalty.view',
  'loyalty.manage',
  'loyalty.adjust',
  'promotions.view',
  'promotions.manage',
  'reports.view',
];

export interface User {
  id: string; // e.g. usr_carlos_01
  email: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  is_superadmin?: boolean; // Platform/Master level, separate from restaurant
  created_at: string;
  updated_at: string;
}

export interface RestaurantMember {
  id: string; // e.g. mem_001
  restaurant_id: string;
  user_id: string;
  role_id: string;
  display_name: string;
  employee_code?: string; // e.g. EMP-001
  email: string;
  phone?: string;
  is_active: boolean;
  joined_at: string;
  left_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string; // e.g. role_owner, role_manager, role_waiter, etc.
  restaurant_id: string; // system roles belong to global or specific restaurant
  name: string;
  description: string;
  permissions: Permission[];
  is_system: boolean; // Protected from deletion / unassignment if last owner
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface Shift {
  id: string; // e.g. shf_001
  restaurant_id: string;
  member_id: string;
  user_id: string;
  role_id: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  break_start?: string;
  break_end?: string;
  status: ShiftStatus;
  notes?: string;
  cash_shift_id?: string; // Links with cash register drawer session
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MemberHistoryRecord {
  id: string;
  member_id: string;
  restaurant_id: string;
  event_type: 'joined' | 'role_changed' | 'deactivated' | 'reactivated' | 'updated';
  previous_role_id?: string;
  new_role_id?: string;
  performed_by: string;
  notes?: string;
  created_at: string;
}

export interface CurrentRestaurantContext {
  restaurant_id: string;
  user_id: string;
  member_id: string;
  display_name: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  permissions: Permission[];
  active_shift_id?: string;
  hasPermission: (permission: Permission) => boolean;
}

export interface StaffSummary {
  total_members: number;
  active_members: number;
  inactive_members: number;
  active_shifts_now: number;
  shifts_completed_today: number;
  total_roles: number;
}

// ==========================================
// FASE 11 — CLIENTES, CRM, FIDELIDAD Y PROMOCIONES
// ==========================================

export interface CustomerAddress {
  id: string;
  restaurant_id?: string;
  street: string;
  number: string;
  interior?: string;
  colony: string;
  city: string;
  state: string;
  postal_code: string;
  latitude?: number;
  longitude?: number;
  references?: string;
  label: 'home' | 'work' | 'other';
  is_default: boolean;
  created_at: string;
}

export type CustomerSegment =
  | 'new_customer'
  | 'active_customer'
  | 'frequent_customer'
  | 'high_value_customer'
  | 'inactive_customer';

export interface CustomerProfile {
  id: string; // e.g. cust_001
  user_id?: string; // Links to global User identity
  name: string;
  phone: string;
  email: string;
  birth_date?: string;
  notes?: string;
  marketing_opt_in: boolean;
  marketing_updated_at?: string;
  addresses: CustomerAddress[];
  preferences?: {
    allergies?: string[];
    favorite_items?: string[];
    dietary_notes?: string;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CustomerMetrics {
  customer_id: string;
  order_count: number;
  total_spend_cents: number;
  average_order_value_cents: number;
  last_order_at?: string;
  first_order_at?: string;
  favorite_restaurant_id?: string;
  favorite_product_names: string[];
  points_balance: number;
  tier: LoyaltyTier;
  segment: CustomerSegment;
}

export interface LoyaltyAccount {
  id: string;
  restaurant_id: string;
  customer_id: string;
  points_balance: number;
  lifetime_points: number;
  tier: LoyaltyTier;
  created_at: string;
  updated_at: string;
}

export type LoyaltyTransactionType =
  | 'earn'
  | 'redeem'
  | 'adjustment'
  | 'expire'
  | 'refund'
  | 'reversal';

export interface LoyaltyTransaction {
  id: string;
  restaurant_id: string;
  customer_id: string;
  type: LoyaltyTransactionType;
  points: number; // positive for earn/refund, negative for redeem/expire
  balance_before: number;
  balance_after: number;
  reference_type: 'order' | 'manual_adjustment' | 'reward_redemption' | 'cancellation';
  reference_id: string; // e.g. order_id
  description: string;
  created_at: string;
  created_by: string; // Staff member or 'System'
}

export interface LoyaltyReward {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  reward_type: 'discount_amount' | 'discount_percent' | 'free_product';
  value: number; // e.g. 5000 = $50 MXN, 15 = 15%
  points_required: number;
  product_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PromotionType =
  | 'percentage'
  | 'fixed_amount'
  | 'free_product'
  | 'buy_x_get_y'
  | 'coupon';

export interface Promotion {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  type: PromotionType;
  discount_percent?: number;
  discount_amount_cents?: number;
  coupon_code?: string;
  min_order_cents?: number;
  max_discount_cents?: number;
  applicable_product_ids?: string[];
  applicable_categories?: string[];
  max_uses_total?: number;
  max_uses_per_customer?: number;
  current_uses_count: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  stackable_with_loyalty: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromotionRedemptionRecord {
  id: string;
  restaurant_id: string;
  promotion_id: string;
  customer_id?: string;
  order_id: string;
  coupon_code?: string;
  discount_applied_cents: number;
  redeemed_at: string;
}

export interface CrmSummary {
  total_customers: number;
  active_customers: number;
  new_customers_this_month: number;
  frequent_customers: number;
  high_value_customers: number;
  total_loyalty_points_issued: number;
  total_loyalty_points_redeemed: number;
  active_promotions_count: number;
}

// ==========================================
// FASE 13 — SOLUCIONES NATIVAS + MODELO COMERCIAL DEL CORE
// ==========================================

export type SolutionStatus = 'active' | 'beta' | 'deprecated' | 'maintenance';
export type CommercialAvailability = 'available' | 'restricted' | 'private' | 'upcoming';
export type EntitlementStatus = 'active' | 'suspended' | 'expired';
export type EntitlementSource = 'plan' | 'addon' | 'manual' | 'trial' | 'promotional';
export type PlanTier = 'basic' | 'pro' | 'enterprise' | 'custom';

export interface Capability {
  id: string; // e.g. 'pos.tables', 'print.kitchen_ticket', 'delivery.orders'
  name: string;
  description: string;
  solution_id: string;
  required_permissions?: Permission[];
}

export interface Solution {
  solution_id: string; // e.g. 'pos', 'delivery', 'directprint', 'loyalty', 'crm', 'kds', 'analytics'
  name: string;
  description: string;
  version: string;
  status: SolutionStatus;
  category: 'operations' | 'hardware' | 'kitchen' | 'growth' | 'intelligence' | 'logistics';
  dependencies: string[]; // solution_id[]
  capabilities: Capability[];
  required_permissions: Permission[];
  commercial_availability: CommercialAvailability;
  icon?: string;
  metadata?: Record<string, any>;
}

export interface CommercialPlan {
  id: string; // e.g. 'plan_basic', 'plan_pro', 'plan_enterprise'
  name: string;
  code: string;
  description: string;
  tier: PlanTier;
  solutions: string[]; // IDs de soluciones incluidas
  included_capabilities: string[]; // IDs de capabilities específicas o ['*']
  is_active: boolean;
  price_cents_monthly?: number;
  currency?: string;
  created_at: string;
}

export interface Entitlement {
  id: string;
  restaurant_id: string;
  solution_id: string;
  capability?: string; // ID específico o undefined / '*' para toda la solución
  status: EntitlementStatus;
  source: EntitlementSource;
  plan_id?: string;
  start_date: string;
  end_date?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EntitlementCheckResult {
  has_access: boolean;
  reason?: string;
  solution_id?: string;
  capability?: string;
  entitlement?: Entitlement;
}

export interface ActionAuthorizationResult {
  authorized: boolean;
  entitlement_granted: boolean;
  permission_granted: boolean;
  status_code: 200 | 403;
  reason?: string;
}



