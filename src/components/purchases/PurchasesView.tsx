import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import {
  ShoppingBag,
  ArrowLeft,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Truck,
  FileText,
  DollarSign,
  TrendingUp,
  PackageCheck,
  ChevronRight,
  X,
  Save,
  Trash2,
  Calendar,
  Layers,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  Supplier,
  SupplierProduct,
  InventoryUnit,
} from '../../core/types';

interface PurchasesViewProps {
  onBack: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ onBack }) => {
  const {
    suppliers,
    purchaseOrders,
    priceHistory,
    purchaseSummary,
    inventoryItems,
    recipes,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    linkSupplierProduct,
    createPurchaseOrder,
    updateOrderStatus,
    receivePurchaseOrder,
  } = usePos();

  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers' | 'receiving' | 'history' | 'costs'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<PurchaseOrder | null>(null);

  // Modal States
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);

  // New Supplier Form State
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    legal_name: '',
    phone: '',
    email: '',
    address: '',
    tax_id: '',
    notes: '',
  });

  // New Purchase Order Form State
  const [poFormSupplierId, setPoFormSupplierId] = useState('');
  const [poFormNotes, setPoFormNotes] = useState('');
  const [poFormDueDate, setPoFormDueDate] = useState('');
  const [poFormItems, setPoFormItems] = useState<Array<{
    inventory_item_id: string;
    quantity_ordered: number;
    unit: InventoryUnit;
    cost_cents_per_unit: number;
    notes?: string;
  }>>([]);

  // Receiving Form State
  const [recInvoiceNumber, setRecInvoiceNumber] = useState('');
  const [recInvoiceDate, setRecInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [recReceivedBy, setRecReceivedBy] = useState('Almacén Central');
  const [recNotes, setRecNotes] = useState('');
  const [recFreightCents, setRecFreightCents] = useState(0);
  const [recDiscountCents, setRecDiscountCents] = useState(0);
  const [recTaxCents, setRecTaxCents] = useState(0);
  const [recCostPolicy, setRecCostPolicy] = useState<'last_cost' | 'average_cost'>('last_cost');
  const [recItems, setRecItems] = useState<Array<{
    purchase_order_item_id: string;
    inventory_item_id: string;
    item_name: string;
    quantity_ordered: number;
    previously_received: number;
    quantity_receiving_now: number;
    quantity_accepted: number;
    quantity_rejected: number;
    rejection_reason: string;
    unit: InventoryUnit;
    cost_cents_per_unit: number;
  }>>([]);

  // Feedback notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      const matchStatus = statusFilter === 'all' ? true : order.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q
        ? true
        : order.order_number.toLowerCase().includes(q) ||
          order.supplier_name.toLowerCase().includes(q) ||
          (order.notes && order.notes.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  // Open Receiving Modal for an Order
  const handleOpenReceiving = (order: PurchaseOrder) => {
    setReceivingOrderId(order.id);
    setRecInvoiceNumber('');
    setRecInvoiceDate(new Date().toISOString().split('T')[0]);
    setRecReceivedBy('Almacén Central');
    setRecNotes('');
    setRecFreightCents(0);
    setRecDiscountCents(0);
    setRecTaxCents(0);
    setRecCostPolicy('last_cost');

    const mappedItems = order.items.map((item) => {
      const remaining = Math.max(0, item.quantity_ordered - (item.quantity_received || 0));
      return {
        purchase_order_item_id: item.id,
        inventory_item_id: item.inventory_item_id,
        item_name: item.item_name || 'Insumo',
        quantity_ordered: item.quantity_ordered,
        previously_received: item.quantity_received || 0,
        quantity_receiving_now: remaining,
        quantity_accepted: remaining,
        quantity_rejected: 0,
        rejection_reason: '',
        unit: item.unit,
        cost_cents_per_unit: item.cost_cents_per_unit,
      };
    });

    setRecItems(mappedItems);
    setIsReceivingModalOpen(true);
  };

  // Submit Reception
  const handleProcessReception = async () => {
    if (!receivingOrderId) return;
    try {
      const payload = {
        invoice_number: recInvoiceNumber.trim() || undefined,
        invoice_date: recInvoiceDate,
        received_by: recReceivedBy.trim() || 'Almacenista',
        notes: recNotes.trim() || undefined,
        freight_cents: recFreightCents,
        discount_cents: recDiscountCents,
        tax_cents: recTaxCents,
        cost_update_policy: recCostPolicy,
        items: recItems
          .filter((i) => i.quantity_receiving_now > 0)
          .map((i) => ({
            purchase_order_item_id: i.purchase_order_item_id,
            quantity_received: i.quantity_receiving_now,
            quantity_accepted: i.quantity_accepted,
            quantity_rejected: i.quantity_rejected,
            rejection_reason: i.rejection_reason || undefined,
            unit: i.unit,
            cost_cents_per_unit: i.cost_cents_per_unit,
          })),
      };

      if (payload.items.length === 0) {
        showNotification('Debe ingresar cantidad a recibir para al menos una partida.', 'error');
        return;
      }

      const res = await receivePurchaseOrder(receivingOrderId, payload);
      setIsReceivingModalOpen(false);

      if (res.margin_alerts && res.margin_alerts.length > 0) {
        showNotification(
          `¡Mercancía recibida e inventario actualizado! Alerta: ${res.margin_alerts.length} insumo(s) tuvieron variación de costo impactando margen de recetas.`,
          'success'
        );
      } else {
        showNotification('¡Recepción procesada exitosamente! Stock y Kárdex F6 actualizados.', 'success');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error al procesar recepción', 'error');
    }
  };

  // Submit New Order
  const handleCreateOrder = async () => {
    if (!poFormSupplierId) {
      showNotification('Seleccione un proveedor.', 'error');
      return;
    }
    if (poFormItems.length === 0) {
      showNotification('Agregue al menos un insumo a la orden de compra.', 'error');
      return;
    }

    try {
      await createPurchaseOrder({
        supplier_id: poFormSupplierId,
        items: poFormItems,
        notes: poFormNotes,
        due_date: poFormDueDate || undefined,
        status: 'ordered',
      });
      setIsNewOrderModalOpen(false);
      setPoFormItems([]);
      setPoFormSupplierId('');
      setPoFormNotes('');
      showNotification('Orden de compra creada y colocada a proveedor.', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Error al crear orden de compra', 'error');
    }
  };

  // Submit New Supplier
  const handleCreateSupplier = async () => {
    if (!supplierForm.name.trim()) {
      showNotification('El nombre comercial del proveedor es requerido.', 'error');
      return;
    }

    try {
      await createSupplier({
        name: supplierForm.name,
        legal_name: supplierForm.legal_name || undefined,
        phone: supplierForm.phone || undefined,
        email: supplierForm.email || undefined,
        address: supplierForm.address || undefined,
        tax_id: supplierForm.tax_id || undefined,
        notes: supplierForm.notes || undefined,
      });
      setIsNewSupplierModalOpen(false);
      setSupplierForm({
        name: '',
        legal_name: '',
        phone: '',
        email: '',
        address: '',
        tax_id: '',
        notes: '',
      });
      showNotification('Proveedor registrado con éxito.', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Error al crear proveedor', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-bold">{notification.message}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={onBack}
              className="p-1 rounded-xl hover:bg-zinc-100 text-[#05268F] transition cursor-pointer"
              title="Volver al panel"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#05268F]">
              Directaurante Core • FASE 8 Compras & Proveedores
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#101828] tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-[#05268F]" />
            Compras, Proveedores y Entradas de Inventario
          </h1>
          <p className="text-xs text-[#667085] mt-1 max-w-2xl">
            Flujo conectado: <strong className="text-[#101828]">Compras → Recepción → Entrada Kárdex F6 → Costeo Recetas F7</strong>.
            Una compra no tiene inventario duplicado; alimenta directamente el stock físico del restaurante.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsNewSupplierModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl border border-zinc-200 hover:bg-[#F4F6F8] text-[#101828] font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Building2 className="w-4 h-4 text-[#05268F]" />
            <span>Nuevo Proveedor</span>
          </button>
          <button
            onClick={() => {
              setPoFormSupplierId(suppliers[0]?.id || '');
              setPoFormItems([]);
              setIsNewOrderModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-[#05268F] hover:bg-[#041E70] text-white font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#FFD318]" />
            <span>Nueva Orden de Compra</span>
          </button>
        </div>
      </div>

      {/* OPERATIONAL KPI CARDS (Section 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pendientes de recibir */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] block">
              Pendientes de Recibir
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#101828]">
                {purchaseSummary?.pending_orders_count || 0}
              </span>
              <span className="text-xs text-[#667085] font-semibold">órdenes</span>
            </div>
            <span className="text-[10px] text-amber-700 font-bold block mt-0.5">
              Mercancía en tránsito o por validar
            </span>
          </div>
        </div>

        {/* KPI 2: Recibidas hoy */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] block">
              Recibidas Hoy
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#101828]">
                {purchaseSummary?.received_today_count || 0}
              </span>
              <span className="text-xs text-[#667085] font-semibold">entradas</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
              Kárdex F6 actualizado en turno
            </span>
          </div>
        </div>

        {/* KPI 3: Gasto mensual */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-[#EAF0FF] text-[#05268F] shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] block">
              Gasto Mensual Compras
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#101828]">
                ${((purchaseSummary?.total_monthly_spend_cents || 0) / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-[#667085] font-bold">MXN</span>
            </div>
            <span className="text-[10px] text-[#05268F] font-bold block mt-0.5">
              Facturado en almacén
            </span>
          </div>
        </div>

        {/* KPI 4: Proveedores activos */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-[#FFF7D6] text-[#05268F] shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] block">
              Proveedores Catálogo
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-[#101828]">
                {suppliers.filter((s) => s.is_active).length}
              </span>
              <span className="text-xs text-[#667085] font-semibold">activos</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">
              Relacionados a insumos F6
            </span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'orders', label: 'Órdenes de Compra', count: purchaseOrders.length },
          { id: 'suppliers', label: 'Proveedores', count: suppliers.length },
          { id: 'receiving', label: 'Recepciones F6/F7' },
          { id: 'history', label: 'Historial de Precios', count: priceHistory.length },
          { id: 'costs', label: 'Costos e Impacto COGS' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-2 shadow-xs ${
              activeTab === tab.id
                ? 'bg-[#05268F] text-white'
                : 'bg-white text-[#667085] hover:text-[#101828] border border-zinc-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === tab.id
                    ? 'bg-[#FFD318] text-[#101828]'
                    : 'bg-zinc-100 text-[#667085]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: ÓRDENES DE COMPRA */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-[#F4F6F8] px-3.5 py-2 rounded-2xl border border-zinc-200 w-full sm:w-72">
              <Search className="w-4 h-4 text-[#667085]" />
              <input
                type="text"
                placeholder="Buscar OC, proveedor o nota..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold outline-none"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'ordered', label: 'En Espera' },
                { id: 'partially_received', label: 'Parciales' },
                { id: 'received', label: 'Recibidas' },
                { id: 'draft', label: 'Borradores' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    statusFilter === filter.id
                      ? 'bg-[#101828] text-white'
                      : 'bg-[#F4F6F8] text-[#667085] hover:text-[#101828]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F8] text-[#667085] font-black uppercase text-[10px] tracking-wider rounded-xl">
                <tr>
                  <th className="p-3.5 rounded-l-2xl">Folio OC</th>
                  <th className="p-3.5">Proveedor</th>
                  <th className="p-3.5">Partidas</th>
                  <th className="p-3.5">Total MXN</th>
                  <th className="p-3.5">Estado</th>
                  <th className="p-3.5">Fecha Pedido</th>
                  <th className="p-3.5 rounded-r-2xl text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-semibold text-[#101828]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-400">
                      No se encontraron órdenes de compra con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const statusBadgeClass =
                      order.status === 'received'
                        ? 'bg-emerald-100 text-emerald-800'
                        : order.status === 'partially_received'
                        ? 'bg-amber-100 text-amber-800'
                        : order.status === 'ordered'
                        ? 'bg-blue-100 text-blue-800'
                        : order.status === 'draft'
                        ? 'bg-zinc-100 text-zinc-700'
                        : 'bg-rose-100 text-rose-800';

                    const statusLabel =
                      order.status === 'received'
                        ? 'Recibida Completa'
                        : order.status === 'partially_received'
                        ? 'Parcialmente Recibida'
                        : order.status === 'ordered'
                        ? 'Colocada (En Espera)'
                        : order.status === 'draft'
                        ? 'Borrador'
                        : 'Cancelada';

                    return (
                      <tr key={order.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="p-3.5 font-black text-[#05268F]">
                          {order.order_number}
                        </td>
                        <td className="p-3.5 font-bold">
                          {order.supplier_name}
                        </td>
                        <td className="p-3.5 text-zinc-600">
                          {order.items.length} insumo(s) (
                          {order.items.map((i) => i.item_name).slice(0, 2).join(', ')}
                          {order.items.length > 2 ? '...' : ''})
                        </td>
                        <td className="p-3.5 font-black">
                          ${(order.total_cents / 100).toFixed(2)}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${statusBadgeClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="p-3.5 text-zinc-500 text-[11px]">
                          {order.ordered_at ? new Date(order.ordered_at).toLocaleDateString() : 'Borrador'}
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          <button
                            onClick={() => setSelectedOrderForDetail(order)}
                            className="px-2.5 py-1 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-bold transition cursor-pointer"
                          >
                            Detalle
                          </button>
                          {(order.status === 'ordered' || order.status === 'partially_received') && (
                            <button
                              onClick={() => handleOpenReceiving(order)}
                              className="px-3 py-1 rounded-xl bg-[#05268F] hover:bg-[#041E70] text-white text-xs font-black transition cursor-pointer shadow-xs inline-flex items-center gap-1"
                            >
                              <PackageCheck className="w-3.5 h-3.5 text-[#FFD318]" />
                              <span>Recibir</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PROVEEDORES */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-white rounded-3xl border border-zinc-200 p-5 shadow-xs hover:border-[#05268F] transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2.5 rounded-2xl bg-[#EAF0FF] text-[#05268F]">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-[#101828] leading-tight">
                          {sup.name}
                        </h3>
                        {sup.legal_name && (
                          <span className="text-[10px] text-zinc-500 block truncate max-w-[200px]">
                            {sup.legal_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                        sup.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {sup.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Supplier Info */}
                  <div className="mt-4 space-y-1.5 text-xs text-zinc-600">
                    {sup.tax_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[11px]">RFC / Tax ID:</span>
                        <strong className="text-zinc-800">{sup.tax_id}</strong>
                      </div>
                    )}
                    {sup.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[11px]">Teléfono:</span>
                        <strong className="text-zinc-800">{sup.phone}</strong>
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[11px]">Correo:</span>
                        <strong className="text-zinc-800 truncate max-w-[170px]">{sup.email}</strong>
                      </div>
                    )}
                  </div>

                  {/* Products Supplied */}
                  <div className="mt-4 pt-3 border-t border-zinc-100">
                    <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1.5">
                      Insumos que suministra ({sup.products?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(sup.products || []).slice(0, 3).map((p, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-700 text-[10px] font-bold"
                        >
                          {p.item_name || p.inventory_item_id}
                        </span>
                      ))}
                      {(sup.products || []).length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-lg bg-zinc-100 text-zinc-500 text-[10px] font-bold">
                          +{sup.products!.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[11px] text-[#05268F] font-bold">
                    {purchaseOrders.filter((o) => o.supplier_id === sup.id).length} órdenes históricas
                  </span>
                  <button
                    onClick={() => {
                      setPoFormSupplierId(sup.id);
                      setPoFormItems([]);
                      setIsNewOrderModalOpen(true);
                    }}
                    className="px-3 py-1 rounded-xl bg-[#05268F] text-white text-xs font-bold hover:bg-[#041E70] transition cursor-pointer"
                  >
                    Crear Orden
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RECEPCIONES GUIADAS */}
      {activeTab === 'receiving' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs p-6 space-y-6">
          <div className="border-b border-zinc-100 pb-4">
            <h3 className="text-lg font-black text-[#101828]">
              Recepción de Mercancía e Ingreso a Kárdex Core F6
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Seleccione una orden de compra colocada para registrar la llegada de insumos físicos.
              Se procesa el Kárdex en tiempo real y se recalculan costos y mermas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {purchaseOrders
              .filter((o) => o.status === 'ordered' || o.status === 'partially_received')
              .map((order) => (
                <div
                  key={order.id}
                  className="p-5 rounded-2xl border border-zinc-200 hover:border-[#05268F] transition bg-[#F9FAFB] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-[#05268F]">
                        {order.order_number}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-blue-100 text-blue-800 uppercase">
                        {order.status === 'partially_received' ? 'Parcial' : 'En Espera'}
                      </span>
                    </div>
                    <strong className="text-sm text-[#101828] block mt-1">
                      {order.supplier_name}
                    </strong>
                    <div className="mt-3 space-y-1 text-xs text-zinc-600">
                      {order.items.map((i) => (
                        <div key={i.id} className="flex justify-between items-center">
                          <span>{i.item_name}</span>
                          <span className="font-bold text-zinc-800">
                            {i.quantity_received || 0} / {i.quantity_ordered} {i.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-200 flex justify-between items-center">
                    <span className="text-xs font-black text-[#101828]">
                      Total: ${(order.total_cents / 100).toFixed(2)} MXN
                    </span>
                    <button
                      onClick={() => handleOpenReceiving(order)}
                      className="px-4 py-1.5 rounded-xl bg-[#05268F] hover:bg-[#041E70] text-white text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <PackageCheck className="w-4 h-4 text-[#FFD318]" />
                      <span>Recibir Mercancía</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 4: HISTORIAL DE PRECIOS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs p-6 space-y-4">
          <div>
            <h3 className="text-lg font-black text-[#101828]">
              Historial y Evolución de Precios de Compra
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Auditoría cronológica de costos unitarios registrados en recepciones de proveedores.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F8] text-[#667085] font-black uppercase text-[10px] tracking-wider rounded-xl">
                <tr>
                  <th className="p-3.5 rounded-l-2xl">Fecha</th>
                  <th className="p-3.5">Insumo</th>
                  <th className="p-3.5">Proveedor</th>
                  <th className="p-3.5">Cantidad Recibida</th>
                  <th className="p-3.5">Costo Unit. Compra</th>
                  <th className="p-3.5 rounded-r-2xl">Costo Base Normalizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-semibold text-[#101828]">
                {priceHistory.map((ph) => (
                  <tr key={ph.id} className="hover:bg-[#F9FAFB] transition">
                    <td className="p-3.5 text-zinc-500 text-[11px]">
                      {new Date(ph.date).toLocaleDateString()} {new Date(ph.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3.5 font-black text-[#05268F]">
                      {ph.item_name}
                    </td>
                    <td className="p-3.5 text-zinc-700">
                      {ph.supplier_name}
                    </td>
                    <td className="p-3.5 font-bold">
                      {ph.quantity_received} {ph.unit}
                    </td>
                    <td className="p-3.5 font-bold">
                      ${(ph.cost_cents_per_unit / 100).toFixed(2)} / {ph.unit}
                    </td>
                    <td className="p-3.5 font-black text-emerald-700">
                      ${(ph.cost_cents_per_base_unit / 100).toFixed(2)} / unidad base
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: COSTOS E IMPACTO COGS */}
      {activeTab === 'costs' && (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs p-6 space-y-6">
          <div className="border-b border-zinc-100 pb-4">
            <h3 className="text-lg font-black text-[#101828]">
              Cadena de Suministro y Márgenes de Recetas (F8 → F6 → F7)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Al entrar una compra con nuevo costo, la existencia física en F6 se actualiza de inmediato.
              Las fichas técnicas en F7 recalculan el COGS unitario dinámicamente protegiendo el margen del restaurante.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventoryItems.map((item) => {
              const preferredSupplier = suppliers.find((s) => s.id === item.preferred_supplier_id);
              const linkedRecipes = recipes.filter((r) =>
                r.items.some((i) => i.inventory_item_id === item.id)
              );

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-zinc-200 bg-[#F9FAFB] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <strong className="text-sm font-black text-[#101828] block">
                        {item.name}
                      </strong>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {item.sku} • {item.category}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      ${(item.cost_cents / 100).toFixed(2)} / {item.base_unit}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-zinc-600">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Stock Actual F6:</span>
                      <strong>{item.current_stock} {item.base_unit}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Proveedor Preferido:</span>
                      <strong className="text-[#05268F]">{preferredSupplier?.name || 'No asignado'}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-200">
                    <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">
                      Recetas F7 que lo consumen ({linkedRecipes.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {linkedRecipes.length === 0 ? (
                        <span className="text-[11px] text-zinc-400 italic">Sin recetas vinculadas</span>
                      ) : (
                        linkedRecipes.map((r) => (
                          <span
                            key={r.id}
                            className="px-2 py-0.5 rounded-lg bg-[#EAF0FF] text-[#05268F] text-[10px] font-bold"
                          >
                            {r.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: RECEPCIÓN DE MERCANCÍA */}
      {isReceivingModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-zinc-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#101828]">
                    Registrar Recepción de Mercancía
                  </h3>
                  <span className="text-xs text-zinc-500 font-semibold">
                    Entrada de stock directo al Kárdex de F6
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsReceivingModalOpen(false)}
                className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* General Reception Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                  Folio Factura / Remisión
                </label>
                <input
                  type="text"
                  placeholder="Ej. FAC-49201"
                  value={recInvoiceNumber}
                  onChange={(e) => setRecInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                  Recibido Por (Usuario)
                </label>
                <input
                  type="text"
                  value={recReceivedBy}
                  onChange={(e) => setRecReceivedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                  Política de Costeo
                </label>
                <select
                  value={recCostPolicy}
                  onChange={(e) => setRecCostPolicy(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none cursor-pointer"
                >
                  <option value="last_cost">Último Costo de Compra</option>
                  <option value="average_cost">Costo Promedio Ponderado (CPP)</option>
                </select>
              </div>
            </div>

            {/* Items Checklist Table */}
            <div className="border border-zinc-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F4F6F8] text-[#667085] font-black uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Insumo</th>
                    <th className="p-3 text-center">Pedido / Previo</th>
                    <th className="p-3 text-center">Recibiendo Ahora</th>
                    <th className="p-3 text-center">Aceptado (Stock)</th>
                    <th className="p-3 text-center">Rechazado (Merma)</th>
                    <th className="p-3 text-right">Costo Unitario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-semibold">
                  {recItems.map((item, idx) => (
                    <tr key={item.purchase_order_item_id} className="hover:bg-[#F9FAFB]">
                      <td className="p-3">
                        <strong className="text-xs text-[#101828] block">{item.item_name}</strong>
                        <span className="text-[10px] text-zinc-400 font-mono">Unidad: {item.unit}</span>
                      </td>
                      <td className="p-3 text-center text-zinc-600">
                        {item.quantity_ordered} / {item.previously_received}
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantity_receiving_now}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = [...recItems];
                            updated[idx].quantity_receiving_now = val;
                            updated[idx].quantity_accepted = Math.max(0, val - updated[idx].quantity_rejected);
                            setRecItems(updated);
                          }}
                          className="w-20 px-2 py-1 bg-white border border-zinc-200 rounded-lg text-center font-bold text-xs"
                        />
                      </td>
                      <td className="p-3 text-center font-black text-emerald-700">
                        {item.quantity_accepted} {item.unit}
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantity_rejected}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = [...recItems];
                            updated[idx].quantity_rejected = val;
                            updated[idx].quantity_accepted = Math.max(0, updated[idx].quantity_receiving_now - val);
                            setRecItems(updated);
                          }}
                          className="w-16 px-2 py-1 bg-white border border-rose-200 rounded-lg text-center font-bold text-xs text-rose-700"
                        />
                      </td>
                      <td className="p-3 text-right font-black">
                        ${(item.cost_cents_per_unit / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsReceivingModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleProcessReception}
                className="px-5 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#041E70] text-white text-xs font-black cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-[#FFD318]" />
                <span>Confirmar Recepción y Asentar en Kárdex</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NUEVA ORDEN DE COMPRA */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-zinc-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#EAF0FF] text-[#05268F]">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#101828]">
                    Generar Orden de Compra
                  </h3>
                  <span className="text-xs text-zinc-500 font-semibold">
                    No afecta inventario hasta recibir mercancía
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Proveedor</label>
                <select
                  value={poFormSupplierId}
                  onChange={(e) => setPoFormSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none cursor-pointer"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.tax_id || 'Sin RFC'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items in order */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-zinc-800">Partidas a Pedir</span>
                  <button
                    onClick={() => {
                      if (inventoryItems.length > 0) {
                        const first = inventoryItems[0];
                        setPoFormItems([
                          ...poFormItems,
                          {
                            inventory_item_id: first.id,
                            quantity_ordered: 10,
                            unit: first.base_unit,
                            cost_cents_per_unit: first.cost_cents,
                          },
                        ]);
                      }
                    }}
                    className="text-xs text-[#05268F] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Insumo</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {poFormItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-zinc-200 bg-[#F9FAFB] flex items-center justify-between gap-3"
                    >
                      <select
                        value={item.inventory_item_id}
                        onChange={(e) => {
                          const inv = inventoryItems.find((i) => i.id === e.target.value);
                          const updated = [...poFormItems];
                          updated[idx].inventory_item_id = e.target.value;
                          if (inv) {
                            updated[idx].unit = inv.base_unit;
                            updated[idx].cost_cents_per_unit = inv.cost_cents;
                          }
                          setPoFormItems(updated);
                        }}
                        className="px-2 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-bold"
                      >
                        {inventoryItems.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.base_unit})
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-zinc-500">Cant:</span>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={item.quantity_ordered}
                          onChange={(e) => {
                            const updated = [...poFormItems];
                            updated[idx].quantity_ordered = parseFloat(e.target.value) || 1;
                            setPoFormItems(updated);
                          }}
                          className="w-16 px-2 py-1 bg-white border border-zinc-200 rounded-lg text-center font-bold"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-zinc-500">Costo $:</span>
                        <input
                          type="number"
                          step="0.01"
                          value={(item.cost_cents_per_unit / 100).toFixed(2)}
                          onChange={(e) => {
                            const updated = [...poFormItems];
                            updated[idx].cost_cents_per_unit = Math.round((parseFloat(e.target.value) || 0) * 100);
                            setPoFormItems(updated);
                          }}
                          className="w-20 px-2 py-1 bg-white border border-zinc-200 rounded-lg text-center font-bold"
                        />
                      </div>

                      <button
                        onClick={() => {
                          setPoFormItems(poFormItems.filter((_, i) => i !== idx));
                        }}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Notas de Entrega</label>
                <textarea
                  rows={2}
                  placeholder="Instrucciones para el repartidor o turno de recepción..."
                  value={poFormNotes}
                  onChange={(e) => setPoFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOrder}
                className="px-5 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#041E70] text-white text-xs font-black cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4 text-[#FFD318]" />
                <span>Generar Orden de Compra</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: NUEVO PROVEEDOR */}
      {isNewSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-[#101828]">
                Registrar Nuevo Proveedor
              </h3>
              <button
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  placeholder="Ej. Distribuidora Avícola del Centro"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Razón Social</label>
                <input
                  type="text"
                  placeholder="Ej. Avícola Central S.A. de C.V."
                  value={supplierForm.legal_name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, legal_name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">RFC / Tax ID</label>
                  <input
                    type="text"
                    placeholder="RFC123456XYZ"
                    value={supplierForm.tax_id}
                    onChange={(e) => setSupplierForm({ ...supplierForm, tax_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+52 55..."
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="pedidos@proveedor.com"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">Dirección / Bodega</label>
                <input
                  type="text"
                  placeholder="Calle, número, ciudad..."
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F4F6F8] rounded-xl border border-zinc-200 text-xs font-semibold outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateSupplier}
                className="px-5 py-2 rounded-xl bg-[#05268F] hover:bg-[#041E70] text-white text-xs font-black cursor-pointer shadow-xs"
              >
                Guardar Proveedor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL FOR ORDER */}
      {selectedOrderForDetail && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-black text-[#101828]">
                  Detalle de Orden {selectedOrderForDetail.order_number}
                </h3>
                <span className="text-xs text-zinc-500 font-semibold">
                  {selectedOrderForDetail.supplier_name}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="p-1 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Estado:</span>
                <span className="font-black uppercase text-[#05268F]">{selectedOrderForDetail.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Subtotal:</span>
                <span className="font-bold">${(selectedOrderForDetail.subtotal_cents / 100).toFixed(2)} MXN</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Total:</span>
                <span className="font-black text-sm text-[#101828]">
                  ${(selectedOrderForDetail.total_cents / 100).toFixed(2)} MXN
                </span>
              </div>

              <div className="pt-2">
                <strong className="block text-zinc-700 mb-1">Partidas Solicitadas:</strong>
                <div className="space-y-1.5 bg-[#F9FAFB] p-3 rounded-xl border border-zinc-200">
                  {selectedOrderForDetail.items.map((i) => (
                    <div key={i.id} className="flex justify-between items-center text-xs">
                      <span>{i.item_name}</span>
                      <span className="font-bold">
                        {i.quantity_received || 0} / {i.quantity_ordered} {i.unit} (${(i.total_cost_cents / 100).toFixed(2)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrderForDetail.receipts && selectedOrderForDetail.receipts.length > 0 && (
                <div className="pt-2">
                  <strong className="block text-zinc-700 mb-1">Recepciones Realizadas:</strong>
                  <div className="space-y-1 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-emerald-900 text-xs">
                    {selectedOrderForDetail.receipts.map((r) => (
                      <div key={r.id} className="flex justify-between">
                        <span>{r.receipt_number} (Factura: {r.invoice_number || 'S/N'})</span>
                        <span className="font-bold">${(r.total_cents / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-zinc-200 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
