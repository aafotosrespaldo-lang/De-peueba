import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  InventoryItem,
  InventoryMovement,
  InventoryAlert,
} from '../../core/types';
import {
  Boxes,
  ArrowLeft,
  Search,
  Filter,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  User,
  Hash,
  Scale,
  DollarSign,
  AlertCircle,
  Trash2,
  X,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';

interface InventoryViewProps {
  onBack: () => void;
}

type TabType = 'existencias' | 'kardex' | 'ajustes' | 'conteo' | 'alertas';

export const InventoryView: React.FC<InventoryViewProps> = ({ onBack }) => {
  const {
    inventoryItems,
    inventorySummary,
    inventoryAlerts,
    fetchInventory,
    registerInventoryMovement,
    registerInventoryAdjustment,
    applyPhysicalCount,
  } = usePos();

  const [activeTab, setActiveTab] = useState<TabType>('existencias');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low_stock' | 'out_of_stock' | 'normal'>('all');

  // Kardex state
  const [selectedKardexItemId, setSelectedKardexItemId] = useState<string>('');
  const [kardexData, setKardexData] = useState<{
    item: InventoryItem;
    movements: Array<InventoryMovement & { in_qty: number; out_qty: number; running_balance: number }>;
    current_stock: number;
    total_entries: number;
    total_exits: number;
  } | null>(null);
  const [kardexLoading, setKardexLoading] = useState(false);
  const [kardexMovementFilter, setKardexMovementFilter] = useState('all');

  // Adjustment Modal / Form state
  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustType, setAdjustType] = useState<'adjustment_in' | 'adjustment_out' | 'waste'>('adjustment_in');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustActor, setAdjustActor] = useState('Admin Inventario');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);

  // Physical Count state
  const [countedValues, setCountedValues] = useState<{ [itemId: string]: number }>({});
  const [countNotes, setCountNotes] = useState('Auditoría física semanal');
  const [countSuccess, setCountSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Set default item for Kardex if none selected
  useEffect(() => {
    if (!selectedKardexItemId && inventoryItems.length > 0) {
      setSelectedKardexItemId(inventoryItems[0].id);
    }
  }, [inventoryItems, selectedKardexItemId]);

  // Fetch Kardex when selected item changes
  useEffect(() => {
    if (!selectedKardexItemId) return;
    setKardexLoading(true);
    fetch(`/api/inventory/items/${selectedKardexItemId}/kardex?movement_type=${kardexMovementFilter}`)
      .then((res) => res.json())
      .then((data) => {
        setKardexData(data);
        setKardexLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching kardex:', err);
        setKardexLoading(false);
      });
  }, [selectedKardexItemId, kardexMovementFilter]);

  // Categories list
  const categories = ['Todos', 'Insumos Cocina', 'Bebidas & Licores', 'Carnes & Proteínas', 'Lácteos', 'Abarrotes'];

  // Filtered items
  const filteredItems = inventoryItems.filter((item) => {
    if (categoryFilter !== 'Todos' && item.category.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      if (!matchName && !matchSku) return false;
    }
    if (statusFilter === 'out_of_stock' && item.current_stock > 0) return false;
    if (statusFilter === 'low_stock' && (item.current_stock <= 0 || item.current_stock > item.min_stock)) return false;
    if (statusFilter === 'normal' && item.current_stock <= item.min_stock) return false;
    return true;
  });

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    setAdjustSuccess(null);

    if (!adjustItemId) {
      setAdjustError('Por favor selecciona un insumo de inventario.');
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError('El motivo del ajuste o merma es obligatorio para trazabilidad.');
      return;
    }
    if (adjustQty <= 0) {
      setAdjustError('La cantidad debe ser mayor a 0.');
      return;
    }

    try {
      await registerInventoryAdjustment({
        inventory_item_id: adjustItemId,
        type: adjustType,
        quantity: adjustQty,
        reason: adjustReason.trim(),
        actor: adjustActor,
      });

      setAdjustSuccess(`Movimiento asentado con éxito en el Kárdex.`);
      setAdjustReason('');
      setAdjustQty(1);

      // Refresh kardex if this item was displayed
      if (selectedKardexItemId === adjustItemId) {
        fetch(`/api/inventory/items/${adjustItemId}/kardex`)
          .then((res) => res.json())
          .then((d) => setKardexData(d));
      }
    } catch (err: any) {
      setAdjustError(err.message || 'Error al registrar el ajuste');
    }
  };

  const handleApplyCount = async () => {
    setCountSuccess(null);
    const countsPayload = inventoryItems
      .filter((item) => countedValues[item.id] !== undefined)
      .map((item) => ({
        inventory_item_id: item.id,
        counted_stock: countedValues[item.id],
        reason: countNotes,
      }));

    if (countsPayload.length === 0) {
      alert('Introduce al menos un valor de conteo físico para comparar.');
      return;
    }

    try {
      await applyPhysicalCount({
        performed_by: 'Auditor de Inventario',
        notes: countNotes,
        counts: countsPayload,
      });

      setCountSuccess(`¡Conteo físico procesado exitosamente! Las diferencias se asentaron en el Kárdex.`);
      setCountedValues({});
      await fetchInventory();
    } catch (err: any) {
      alert(err.message || 'Error al procesar conteo físico');
    }
  };

  const selectedItemForAdjustment = inventoryItems.find((i) => i.id === adjustItemId);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl border border-zinc-200 text-[#101828] hover:bg-[#F4F6F8] transition cursor-pointer"
            title="Volver al Salón"
          >
            <ArrowLeft className="w-5 h-5 text-[#05268F]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#05268F] bg-[#EAF0FF] px-2.5 py-0.5 rounded-full">
                Core v0.1 • Inventario
              </span>
              <span className="text-xs text-[#667085] font-semibold">
                Directaurante Grill & Bar
              </span>
            </div>
            <h2 className="text-2xl font-black text-[#101828] tracking-tight mt-1 flex items-center gap-2">
              <Boxes className="w-6 h-6 text-[#05268F]" />
              <span>Inventario, Kárdex y Existencias</span>
            </h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Control de existencias físicas, movimientos atómicos, mermas y auditoría inmutable.
            </p>
          </div>
        </div>

        {/* Global Summary Metric Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-2 rounded-2xl bg-[#F4F6F8] border border-zinc-200 text-center">
            <span className="text-[10px] uppercase font-bold text-[#667085] block">Insumos Activos</span>
            <span className="text-base font-black text-[#101828]">{inventorySummary?.total_items || 0}</span>
          </div>

          <div className="px-3 py-2 rounded-2xl bg-[#EAF0FF] border border-[#05268F]/20 text-center">
            <span className="text-[10px] uppercase font-bold text-[#05268F] block">Valoración Almacén</span>
            <span className="text-base font-black text-[#05268F]">
              ${(((inventorySummary?.total_valuation_cents || 0)) / 100).toFixed(2)}
            </span>
          </div>

          <div
            onClick={() => setActiveTab('alertas')}
            className={`px-3 py-2 rounded-2xl border cursor-pointer transition text-center ${
              (inventorySummary?.low_stock_count || 0) + (inventorySummary?.out_of_stock_count || 0) > 0
                ? 'bg-rose-50 border-rose-200 hover:bg-rose-100/70 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span className="text-[10px] uppercase font-bold block">Alertas de Stock</span>
            <span className="text-base font-black flex items-center justify-center gap-1">
              {(inventorySummary?.out_of_stock_count || 0) > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              )}
              {inventoryAlerts.length} alertas
            </span>
          </div>

          <a
            href="/api/inventory/export/items"
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-zinc-200 hover:border-[#05268F] text-[#101828] text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>CSV Inventario</span>
          </a>
        </div>
      </div>

      {/* 2. TABBED NAVIGATION */}
      <div className="flex border-b border-zinc-200 gap-2 overflow-x-auto">
        {[
          { id: 'existencias', label: 'Catálogo de Existencias', count: inventoryItems.length },
          { id: 'kardex', label: 'Línea de Tiempo Kárdex' },
          { id: 'ajustes', label: 'Ajustes y Mermas' },
          { id: 'conteo', label: 'Conteo Físico' },
          { id: 'alertas', label: 'Alertas y Unidades', badge: inventoryAlerts.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-3 text-xs font-black tracking-wide transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-[#05268F] text-[#05268F] bg-white rounded-t-xl'
                : 'border-transparent text-[#667085] hover:text-[#101828] hover:border-zinc-300'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-100 text-zinc-600 font-bold">
                {tab.count}
              </span>
            )}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB 1: EXISTENCIAS */}
      {activeTab === 'existencias' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por insumo o SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-2xl bg-[#F4F6F8] border border-zinc-200 text-xs text-[#101828] focus:outline-none focus:border-[#05268F]"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'bg-[#F4F6F8] text-[#667085] hover:bg-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 w-full md:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  statusFilter === 'all' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('low_stock')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  statusFilter === 'low_stock' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800'
                }`}
              >
                Stock Bajo
              </button>
              <button
                onClick={() => setStatusFilter('out_of_stock')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  statusFilter === 'out_of_stock' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800'
                }`}
              >
                Agotados
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F4F6F8] text-[#667085] border-b border-zinc-200 uppercase tracking-wider font-extrabold text-[10px]">
                    <th className="py-3 px-4">SKU / Insumo</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Existencia Actual</th>
                    <th className="py-3 px-4 text-right">Mínimo</th>
                    <th className="py-3 px-4 text-right">Costo Promedio</th>
                    <th className="py-3 px-4 text-right">Valoración</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredItems.map((item) => {
                    const isOutOfStock = item.current_stock <= 0;
                    const isLowStock = !isOutOfStock && item.current_stock <= item.min_stock;
                    const valuationMxn = ((item.current_stock * item.cost_cents) / 100).toFixed(2);
                    const costMxn = (item.cost_cents / 100).toFixed(2);

                    return (
                      <tr key={item.id} className="hover:bg-[#EAF0FF]/30 transition group">
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-[#101828] group-hover:text-[#05268F] transition">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-[#667085] font-mono mt-0.5">
                            SKU: {item.sku}
                            {item.linked_product_id && (
                              <span className="ml-2 px-1.5 py-0.2 rounded bg-blue-50 text-[#05268F] font-sans">
                                En Venta POS
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-[#667085]">
                          <span className="px-2 py-0.5 rounded-full bg-[#F4F6F8] text-[#101828] font-bold text-[10px]">
                            {item.category}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-black text-sm">
                          <span
                            className={
                              isOutOfStock
                                ? 'text-rose-600'
                                : isLowStock
                                ? 'text-amber-600'
                                : 'text-[#101828]'
                            }
                          >
                            {item.current_stock}
                          </span>
                          <span className="text-[10px] text-[#667085] ml-1 font-semibold">
                            {item.base_unit}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right text-[#667085] font-semibold">
                          {item.min_stock} {item.base_unit}
                        </td>

                        <td className="py-3 px-4 text-right font-medium text-[#101828]">
                          ${costMxn} MXN
                        </td>

                        <td className="py-3 px-4 text-right font-black text-[#101828]">
                          ${valuationMxn} MXN
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                              AGOTADO
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              STOCK BAJO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              ÓPTIMO
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedKardexItemId(item.id);
                                setActiveTab('kardex');
                              }}
                              className="px-2.5 py-1 rounded-xl bg-[#EAF0FF] hover:bg-[#05268F] text-[#05268F] hover:text-white font-bold text-[11px] transition cursor-pointer"
                              title="Consultar historial Kárdex"
                            >
                              Kárdex
                            </button>
                            <button
                              onClick={() => {
                                setAdjustItemId(item.id);
                                setActiveTab('ajustes');
                              }}
                              className="px-2 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[11px] transition cursor-pointer"
                              title="Registrar ajuste o merma"
                            >
                              Ajustar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KÁRDEX */}
      {activeTab === 'kardex' && (
        <div className="space-y-4">
          {/* Kardex Header Bar */}
          <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <label className="text-xs font-bold text-[#667085] whitespace-nowrap">
                Insumo a Consultar:
              </label>
              <select
                value={selectedKardexItemId}
                onChange={(e) => setSelectedKardexItemId(e.target.value)}
                className="px-3 py-2 rounded-2xl bg-[#F4F6F8] border border-zinc-200 font-bold text-xs text-[#101828] focus:outline-none focus:border-[#05268F] cursor-pointer"
              >
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.sku}) - {item.current_stock} {item.base_unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={kardexMovementFilter}
                onChange={(e) => setKardexMovementFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[#F4F6F8] border border-zinc-200 text-xs font-semibold text-[#101828]"
              >
                <option value="all">Todos los movimientos</option>
                <option value="purchase">Compras (+)</option>
                <option value="sale">Ventas POS (-)</option>
                <option value="waste">Mermas (-)</option>
                <option value="adjustment_in">Ajustes Entrada (+)</option>
                <option value="adjustment_out">Ajustes Salida (-)</option>
                <option value="count_adjustment">Conteo Físico (±)</option>
              </select>

              {selectedKardexItemId && (
                <a
                  href={`/api/inventory/export/kardex/${selectedKardexItemId}`}
                  download
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-[#101828] hover:border-[#05268F] transition shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Descargar Kárdex CSV</span>
                </a>
              )}
            </div>
          </div>

          {/* Kardex Item Overview Cards */}
          {kardexData?.item && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-[#667085]">Existencia Actual</span>
                <div className="text-2xl font-black text-[#101828] mt-0.5">
                  {kardexData.current_stock} <span className="text-xs font-semibold text-[#667085]">{kardexData.item.base_unit}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-emerald-700">Entradas Acumuladas</span>
                <div className="text-2xl font-black text-emerald-700 mt-0.5 flex items-center gap-1">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <span>+{kardexData.total_entries}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-rose-700">Salidas / Consumo</span>
                <div className="text-2xl font-black text-rose-700 mt-0.5 flex items-center gap-1">
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                  <span>-{kardexData.total_exits}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-[#05268F]">Stock Mínimo Seguro</span>
                <div className="text-2xl font-black text-[#05268F] mt-0.5">
                  {kardexData.item.min_stock} <span className="text-xs font-semibold text-[#667085]">{kardexData.item.base_unit}</span>
                </div>
              </div>
            </div>
          )}

          {/* Kardex Movements Table */}
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
            {kardexLoading ? (
              <div className="p-8 text-center text-[#667085]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#05268F] mb-2" />
                <p>Cargando Kárdex...</p>
              </div>
            ) : kardexData?.movements && kardexData.movements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F4F6F8] text-[#667085] border-b border-zinc-200 uppercase tracking-wider font-extrabold text-[10px]">
                      <th className="py-3 px-4">Fecha y Hora</th>
                      <th className="py-3 px-4">Tipo Movimiento</th>
                      <th className="py-3 px-4 text-right">Entrada</th>
                      <th className="py-3 px-4 text-right">Salida</th>
                      <th className="py-3 px-4 text-right">Saldo</th>
                      <th className="py-3 px-4">Motivo / Detalle</th>
                      <th className="py-3 px-4">Referencia</th>
                      <th className="py-3 px-4">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                    {kardexData.movements.map((m) => {
                      const isEntry = m.quantity > 0;
                      return (
                        <tr key={m.id} className="hover:bg-[#EAF0FF]/20 transition">
                          <td className="py-3 px-4 text-[#667085] whitespace-nowrap">
                            {new Date(m.created_at).toLocaleString('es-MX', {
                              dateStyle: 'short',
                              timeStyle: 'medium',
                            })}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full font-sans font-bold text-[10px] ${
                                m.movement_type === 'purchase'
                                  ? 'bg-blue-100 text-blue-900'
                                  : m.movement_type === 'sale'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : m.movement_type === 'waste'
                                  ? 'bg-rose-100 text-rose-900'
                                  : m.movement_type === 'count_adjustment'
                                  ? 'bg-purple-100 text-purple-900'
                                  : 'bg-zinc-100 text-zinc-800'
                              }`}
                            >
                              {m.movement_type.toUpperCase()}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-black text-emerald-700">
                            {m.in_qty > 0 ? `+${m.in_qty}` : '-'}
                          </td>

                          <td className="py-3 px-4 text-right font-black text-rose-700">
                            {m.out_qty > 0 ? `-${m.out_qty}` : '-'}
                          </td>

                          <td className="py-3 px-4 text-right font-black text-[#101828] text-xs">
                            {m.running_balance} {m.unit}
                          </td>

                          <td className="py-3 px-4 font-sans text-xs text-[#101828] max-w-xs truncate" title={m.reason}>
                            {m.reason}
                          </td>

                          <td className="py-3 px-4 text-[#667085] text-[10px]">
                            {m.reference_id || 'N/A'}
                          </td>

                          <td className="py-3 px-4 font-sans text-xs text-[#667085]">
                            {m.user_id}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-[#667085]">
                <p>No se encontraron movimientos registrados en el Kárdex para los filtros seleccionados.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AJUSTES Y MERMAS */}
      {activeTab === 'ajustes' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Form */}
          <div className="md:col-span-7 bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-5">
            <div>
              <h3 className="text-lg font-black text-[#101828] flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#05268F]" />
                <span>Registrar Ajuste o Merma</span>
              </h3>
              <p className="text-xs text-[#667085] mt-1">
                Toda modificación genera un asiento trazable en el Kárdex con usuario, fecha y motivo inmutable.
              </p>
            </div>

            {adjustError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            {adjustSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{adjustSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1.5">
                  Tipo de Operación:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('adjustment_in')}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-black transition border cursor-pointer ${
                      adjustType === 'adjustment_in'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                        : 'bg-[#F4F6F8] border-zinc-200 text-[#667085] hover:bg-zinc-100'
                    }`}
                  >
                    + Entrada Manual
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('adjustment_out')}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-black transition border cursor-pointer ${
                      adjustType === 'adjustment_out'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs'
                        : 'bg-[#F4F6F8] border-zinc-200 text-[#667085] hover:bg-zinc-100'
                    }`}
                  >
                    - Salida Manual
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('waste')}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-black transition border cursor-pointer ${
                      adjustType === 'waste'
                        ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-xs'
                        : 'bg-[#F4F6F8] border-zinc-200 text-[#667085] hover:bg-zinc-100'
                    }`}
                  >
                    ⚠ Merma / Desperdicio
                  </button>
                </div>
              </div>

              {/* Item Selection */}
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">
                  Insumo de Inventario:
                </label>
                <select
                  value={adjustItemId}
                  onChange={(e) => setAdjustItemId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-[#F4F6F8] border border-zinc-200 text-xs font-bold text-[#101828] focus:outline-none focus:border-[#05268F] cursor-pointer"
                  required
                >
                  <option value="">-- Seleccionar insumo --</option>
                  {inventoryItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Stock: {i.current_stock} {i.base_unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">
                    Cantidad a {adjustType === 'adjustment_in' ? 'ingresar' : 'descontar'}:
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-2xl bg-[#F4F6F8] border border-zinc-200 text-xs font-black text-[#101828]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">
                    Unidad Base:
                  </label>
                  <input
                    type="text"
                    disabled
                    value={selectedItemForAdjustment?.base_unit || 'Unidad'}
                    className="w-full px-3 py-2 rounded-2xl bg-zinc-100 border border-zinc-200 text-xs font-bold text-[#667085]"
                  />
                </div>
              </div>

              {/* Reason (MANDATORY) */}
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1 flex items-center justify-between">
                  <span>Motivo del Ajuste (Obligatorio):</span>
                  <span className="text-[10px] text-rose-600 font-semibold">* Exigido por auditoría</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Producto dañado por caída, merma de preparación, donación, etc."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-[#F4F6F8] border border-zinc-200 text-xs text-[#101828] focus:outline-none focus:border-[#05268F]"
                  required
                />
              </div>

              {/* Responsible Actor */}
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">
                  Usuario Responsable:
                </label>
                <input
                  type="text"
                  value={adjustActor}
                  onChange={(e) => setAdjustActor(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-[#F4F6F8] border border-zinc-200 text-xs text-[#101828]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-[#05268F] hover:bg-[#041E70] text-white text-xs font-black shadow-md transition active:scale-98 cursor-pointer"
              >
                Asentar Movimiento en Kárdex
              </button>
            </form>
          </div>

          {/* Impact Preview Side Panel */}
          <div className="md:col-span-5 bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#667085]">
              Impacto Inmediato en Stock
            </h4>

            {selectedItemForAdjustment ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#F4F6F8] border border-zinc-200">
                  <span className="text-[10px] text-[#667085] font-bold block">Insumo:</span>
                  <span className="font-extrabold text-sm text-[#101828] block">
                    {selectedItemForAdjustment.name}
                  </span>
                  <span className="text-xs text-[#667085]">SKU: {selectedItemForAdjustment.sku}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] text-[#667085] font-bold block">Stock Actual</span>
                    <span className="text-lg font-black text-[#101828]">
                      {selectedItemForAdjustment.current_stock} {selectedItemForAdjustment.base_unit}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#EAF0FF] border border-[#05268F]/20">
                    <span className="text-[10px] text-[#05268F] font-bold block">Nuevo Stock Proyectado</span>
                    <span className="text-lg font-black text-[#05268F]">
                      {adjustType === 'adjustment_in'
                        ? selectedItemForAdjustment.current_stock + adjustQty
                        : selectedItemForAdjustment.current_stock - adjustQty}{' '}
                      {selectedItemForAdjustment.base_unit}
                    </span>
                  </div>
                </div>

                {adjustType !== 'adjustment_in' &&
                  selectedItemForAdjustment.current_stock - adjustQty < 0 && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        ¡Alerta! Esta operación generaría stock negativo y será RECHAZADA por el Core.
                      </span>
                    </div>
                  )}

                <div className="text-[11px] text-[#667085] p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <strong>Regla de Negocio:</strong> Cuando el stock llega a 0, los productos comerciales vinculados se desactivan automáticamente para impedir cobros sin producto disponible.
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#667085]">
                Selecciona un insumo para ver la proyección del movimiento y verificar que no genere saldo negativo.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CONTEO FÍSICO */}
      {activeTab === 'conteo' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-[#101828] flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#05268F]" />
                <span>Auditoría y Conteo Físico de Existencias</span>
              </h3>
              <p className="text-xs text-[#667085] mt-0.5">
                Captura la cantidad real contada en almacén. El sistema calcula diferencias y crea ajustes en Kárdex.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Notas de auditoría..."
                value={countNotes}
                onChange={(e) => setCountNotes(e.target.value)}
                className="px-3 py-2 rounded-2xl bg-[#F4F6F8] border border-zinc-200 text-xs font-semibold text-[#101828]"
              />
              <button
                onClick={handleApplyCount}
                className="px-5 py-2.5 rounded-2xl bg-[#05268F] hover:bg-[#041E70] text-white text-xs font-black shadow-md transition active:scale-95 cursor-pointer"
              >
                Aplicar Conteo Físico
              </button>
            </div>
          </div>

          {countSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{countSuccess}</span>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F4F6F8] text-[#667085] border-b border-zinc-200 uppercase tracking-wider font-extrabold text-[10px]">
                    <th className="py-3 px-4">Insumo / SKU</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Stock en Sistema</th>
                    <th className="py-3 px-4 text-center w-40">Conteo Real Físico</th>
                    <th className="py-3 px-4 text-right">Diferencia</th>
                    <th className="py-3 px-4 text-center">Estado Auditoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {inventoryItems.map((item) => {
                    const counted = countedValues[item.id];
                    const hasCount = counted !== undefined;
                    const diff = hasCount ? counted - item.current_stock : 0;

                    return (
                      <tr key={item.id} className="hover:bg-[#EAF0FF]/20 transition">
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-[#101828]">{item.name}</div>
                          <div className="text-[10px] text-[#667085]">SKU: {item.sku}</div>
                        </td>

                        <td className="py-3 px-4 text-[#667085]">
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] font-bold">
                            {item.category}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-black text-sm text-[#101828]">
                          {item.current_stock} <span className="text-[10px] text-[#667085]">{item.base_unit}</span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            step="any"
                            placeholder={String(item.current_stock)}
                            value={countedValues[item.id] !== undefined ? countedValues[item.id] : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                              setCountedValues((prev) => {
                                const next = { ...prev };
                                if (val === undefined) {
                                  delete next[item.id];
                                } else {
                                  next[item.id] = val;
                                }
                                return next;
                              });
                            }}
                            className="w-28 text-center py-1.5 px-2 rounded-xl bg-[#F4F6F8] border border-zinc-200 font-black text-xs text-[#101828] focus:border-[#05268F] focus:outline-none"
                          />
                        </td>

                        <td className="py-3 px-4 text-right font-black">
                          {hasCount ? (
                            <span
                              className={
                                diff === 0
                                  ? 'text-emerald-700'
                                  : diff < 0
                                  ? 'text-rose-700'
                                  : 'text-blue-700'
                              }
                            >
                              {diff > 0 ? `+${diff}` : diff} {item.base_unit}
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-normal">Sin cambio</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {hasCount ? (
                            diff === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Exacto
                              </span>
                            ) : diff < 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                Faltante ({diff})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                                Sobrante (+{diff})
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-zinc-400 font-semibold">Pendiente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ALERTAS Y UNIDADES */}
      {activeTab === 'alertas' && (
        <div className="space-y-6">
          {/* Active Alerts */}
          <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs space-y-3">
            <h3 className="text-base font-black text-[#101828] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Alertas Activas de Reabastecimiento</span>
            </h3>
            <p className="text-xs text-[#667085]">
              Insumos cuyo stock físico actual está por debajo del umbral mínimo de seguridad o totalmente agotado.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {inventoryAlerts.map((alert) => (
                <div
                  key={alert.inventory_item_id}
                  className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                    alert.type === 'out_of_stock'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm">{alert.item_name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70">
                        {alert.sku}
                      </span>
                    </div>
                    <p className="text-xs">{alert.message}</p>
                    <div className="text-[11px] font-semibold opacity-90">
                      Existencia: <strong>{alert.current_stock} {alert.unit}</strong> | Mínimo requerido: <strong>{alert.min_stock} {alert.unit}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setAdjustItemId(alert.inventory_item_id);
                      setAdjustType('adjustment_in');
                      setActiveTab('ajustes');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white border border-current font-black text-xs hover:bg-white/80 transition cursor-pointer shrink-0"
                  >
                    Reabastecer
                  </button>
                </div>
              ))}
              {inventoryAlerts.length === 0 && (
                <div className="col-span-2 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center font-bold text-xs">
                  ✓ Todas las existencias se encuentran en niveles seguros por encima del stock mínimo.
                </div>
              )}
            </div>
          </div>

          {/* Units and Conversion Factors (Preparation for F8 Purchases) */}
          <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs space-y-3">
            <h3 className="text-base font-black text-[#101828] flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#05268F]" />
              <span>Unidades de Medida y Factores de Conversión</span>
            </h3>
            <p className="text-xs text-[#667085]">
              Estructura multi-unidad preparada para compras mayoristas (F8) sin alterar la unidad base de conteo.
            </p>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F4F6F8] text-[#667085] border-b border-zinc-200 uppercase tracking-wider font-extrabold text-[10px]">
                    <th className="py-2.5 px-4">Insumo</th>
                    <th className="py-2.5 px-4">Unidad Base</th>
                    <th className="py-2.5 px-4">Unidad de Compra</th>
                    <th className="py-2.5 px-4">Factor de Conversión</th>
                    <th className="py-2.5 px-4">Equivalencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {inventoryItems
                    .filter((i) => i.purchase_unit && i.conversion_factor)
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50">
                        <td className="py-2.5 px-4 font-bold text-[#101828]">{item.name}</td>
                        <td className="py-2.5 px-4 font-mono">{item.base_unit}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-[#05268F]">
                          {item.purchase_unit}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-black">{item.conversion_factor}</td>
                        <td className="py-2.5 px-4 text-[#667085]">
                          1 {item.purchase_unit} = {item.conversion_factor} {item.base_unit}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
