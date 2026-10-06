import React from 'react';
import { usePos } from '../../context/PosContext';
import { NavigationTarget } from '../navigation/Sidebar';
import {
  UtensilsCrossed,
  ChefHat,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Smartphone,
  Receipt,
  Clock,
  CheckCircle2,
  Boxes,
  BookOpen,
  ShoppingBag,
} from 'lucide-react';

interface OperationalSummaryProps {
  onNavigate: (target: NavigationTarget) => void;
  onOpenQuickCobro: () => void;
}

export const OperationalSummary: React.FC<OperationalSummaryProps> = ({
  onNavigate,
  onOpenQuickCobro,
}) => {
  const {
    tables,
    kdsItems,
    cashData,
    inventorySummary,
    inventoryAlerts,
    recipeSummary,
    purchaseSummary,
    loadCanonicalScenario,
    loading,
    selectTable,
  } = usePos();

  // 1. MESAS METRICS
  const occupiedTables = tables.filter(
    (t) => t.status === 'occupied' || t.status === 'bill_requested' || t.status === 'paying'
  );
  const freeTables = tables.filter((t) => t.status === 'available');
  const billRequestedTables = tables.filter(
    (t) => t.status === 'bill_requested' || t.status === 'paying'
  );
  const totalTablesCount = tables.length;

  // 2. COMANDAS METRICS
  const activeItems = kdsItems.filter(
    (i) => i.preparation_status !== 'delivered' && i.preparation_status !== 'cancelled'
  );
  const preparingItems = kdsItems.filter((i) => i.preparation_status === 'preparing');
  const readyItems = kdsItems.filter((i) => i.preparation_status === 'ready');
  const overdueItems = kdsItems.filter((i) => i.is_overdue);
  const pendingItems = kdsItems.filter((i) => i.preparation_status === 'pending');

  // 3. CAJA METRICS
  const isShiftOpen = cashData?.shift?.status === 'open';
  const cashAmountCents = cashData?.totals?.net_cash_cents || (cashData?.shift?.initial_float_cents || 0);

  // 4. VENTAS ACTIVAS
  const totalActiveCents = tables.reduce((acc, t) => acc + (t.total_cents || 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Welcome & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#05268F] bg-[#EAF0FF] px-2.5 py-0.5 rounded-full">
              Panel Operativo
            </span>
            <span className="text-xs text-[#667085] font-semibold">
              • Turno en Vivo
            </span>
          </div>
          <h2 className="text-2xl font-black text-[#101828] tracking-tight mt-1">
            Resumen Operativo del Salón
          </h2>
          <p className="text-xs text-[#667085] mt-0.5">
            Estado en tiempo real de mesas, comandas, tiempos de cocina y saldo en caja.
          </p>
        </div>

        {/* Quick Canonical Loader for Instant Test Validation */}
        <button
          onClick={() => loadCanonicalScenario()}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
          title="Cargar Mesa 1 con 4 comensales (Carlos, Ana, Luis, María) con pedidos exactos"
        >
          <Sparkles className="w-4 h-4 text-[#101828]" />
          <span>Cargar Caso Canónico (Mesa 1)</span>
        </button>
      </div>

      {/* CORE OPERATIONAL SUMMARY GRID (5 Main Cards: Mesas, Comandas, Cocina, Caja, Inventario) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* CARD 1: MESAS */}
        <div
          onClick={() => onNavigate('tables')}
          className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs hover:border-[#05268F] transition cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-[#EAF0FF] text-[#05268F] group-hover:bg-[#05268F] group-hover:text-white transition">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#05268F] flex items-center gap-1">
              Ver Salón <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </span>
          </div>

          <div className="my-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] block">
              Mesas / Salón
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black text-[#101828]">
                {occupiedTables.length}
              </span>
              <span className="text-xs text-[#667085] font-bold">
                de {totalTablesCount} ocupadas
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-[#667085]">
            <span className="font-semibold text-emerald-700">
              {freeTables.length} libres
            </span>
            {billRequestedTables.length > 0 ? (
              <span className="font-bold text-[#05268F] bg-[#FFF7D6] px-2 py-0.5 rounded-full">
                {billRequestedTables.length} por cobrar
              </span>
            ) : (
              <span className="font-medium text-[#667085]">0 por cobrar</span>
            )}
          </div>
        </div>

        {/* CARD 2: COMANDAS */}
        <div
          onClick={() => onNavigate('comandero')}
          className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs hover:border-[#05268F] transition cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-[#FFF7D6] text-[#101828] group-hover:bg-[#FFD318] transition">
              <Smartphone className="w-5 h-5 text-[#05268F]" />
            </div>
            <span className="text-xs font-bold text-[#05268F] flex items-center gap-1">
              Comandero <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </span>
          </div>

          <div className="my-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] block">
              Comandas Activas
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black text-[#101828]">
                {activeItems.length}
              </span>
              <span className="text-xs text-[#667085] font-bold">
                ítems en comanda
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-[#667085]">
            <span className="font-bold text-[#05268F]">
              {preparingItems.length} preparando
            </span>
            <span className="font-bold text-emerald-700">
              {readyItems.length} listas
            </span>
          </div>
        </div>

        {/* CARD 3: COCINA / KDS */}
        <div
          onClick={() => onNavigate('kds')}
          className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs hover:border-[#05268F] transition cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between">
            <div
              className={`p-3 rounded-2xl transition ${
                overdueItems.length > 0
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-[#EAF0FF] text-[#05268F] group-hover:bg-[#05268F] group-hover:text-white'
              }`}
            >
              <ChefHat className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#05268F] flex items-center gap-1">
              Pantalla KDS <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </span>
          </div>

          <div className="my-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] block">
              Cocina / KDS
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black text-[#101828]">
                {pendingItems.length + preparingItems.length}
              </span>
              <span className="text-xs text-[#667085] font-bold">
                en producción
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#667085]">
              {pendingItems.length} pendientes
            </span>
            <span
              className={`font-black px-2 py-0.5 rounded-full ${
                overdueItems.length > 0
                  ? 'bg-rose-100 text-rose-700 animate-pulse'
                  : 'text-zinc-500'
              }`}
            >
              {overdueItems.length} retrasadas
            </span>
          </div>
        </div>

        {/* CARD 4: CAJA */}
        <div
          onClick={() => onNavigate('cash')}
          className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs hover:border-[#05268F] transition cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#05268F] flex items-center gap-1">
              Turno Caja <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </span>
          </div>

          <div className="my-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] block">
              Efectivo en Caja
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-[#101828]">
                ${(cashAmountCents / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-[#667085] font-bold">MXN</span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="text-[#667085] font-semibold">Estado:</span>
            <span
              className={`font-black px-2 py-0.5 rounded-full ${
                isShiftOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {isShiftOpen ? 'Turno Abierto' : 'Caja Cerrada'}
            </span>
          </div>
        </div>

        {/* CARD 5: INVENTARIO & ALERTAS (CORE F6) */}
        <div
          onClick={() => onNavigate('inventory')}
          className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs hover:border-[#05268F] transition cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-[#FFF7D6] text-[#101828] group-hover:bg-[#FFD318] transition">
              <Boxes className="w-5 h-5 text-[#05268F]" />
            </div>
            <span className="text-xs font-bold text-[#05268F] flex items-center gap-1">
              Inventario <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </span>
          </div>

          <div className="my-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085] block">
              Inventario
            </span>
            <div className="space-y-1 mt-1">
              {inventorySummary?.low_stock_count ? (
                <div className="text-xs font-bold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{inventorySummary.low_stock_count} con stock bajo</span>
                </div>
              ) : null}

              {inventorySummary?.out_of_stock_count ? (
                <div className="text-xs font-black text-rose-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse shrink-0" />
                  <span>{inventorySummary.out_of_stock_count} agotados</span>
                </div>
              ) : null}

              {!inventorySummary?.low_stock_count && !inventorySummary?.out_of_stock_count && (
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Stock en nivel óptimo</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-bold">
            <span className="text-[#05268F] group-hover:underline">[Ver alertas]</span>
            <span className="text-zinc-500 font-semibold">
              {inventorySummary?.total_items || 0} insumos
            </span>
          </div>
        </div>
      </div>

      {/* RECIPES & INVENTORY OPERATIONAL ALERTS BANNER (Section 5) */}
      {Boolean(recipeSummary && recipeSummary.products_without_recipe > 0) && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-3xl flex items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-amber-900 block">
                ⚠ {recipeSummary?.products_without_recipe} producto(s) en catálogo sin receta configurada
              </span>
              <span className="text-amber-700 text-[11px]">
                Configura sus fichas técnicas para descontar inventario y calcular COGS automáticamente.
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('recipes')}
            className="px-3.5 py-1.5 rounded-xl bg-[#05268F] hover:bg-[#041E70] text-white font-black text-xs transition cursor-pointer shrink-0"
          >
            [Ver recetas]
          </button>
        </div>
      )}

      {/* REAL-TIME ALERTS / ATTENTION REQUIRED SECTION */}
      {(overdueItems.length > 0 || readyItems.length > 0 || occupiedTables.length > 0) && (
        <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#05268F] animate-ping" />
              <h3 className="text-sm font-black text-[#101828] uppercase tracking-wider">
                Atención Operativa Inmediata
              </h3>
            </div>
            <span className="text-xs text-[#667085] font-semibold">
              Ventas acumuladas en salón: <strong className="text-[#101828]">${(totalActiveCents / 100).toFixed(2)} MXN</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Attention Item 1: Ready to Serve */}
            {readyItems.length > 0 ? (
              <div
                onClick={() => onNavigate('comandero')}
                className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between cursor-pointer hover:bg-emerald-100/70 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-emerald-950 block">
                      {readyItems.length} platillos listos para entregar a mesas
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Toca para abrir el Comandero y llevar a comensales
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-800" />
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#F4F6F8] border border-zinc-200 flex items-center gap-3 text-xs text-[#667085]">
                <Clock className="w-4 h-4 text-[#05268F]" />
                <span>No hay platillos pendientes de entrega a mesa.</span>
              </div>
            )}

            {/* Attention Item 2: Overdue SLA */}
            {overdueItems.length > 0 ? (
              <div
                onClick={() => onNavigate('kds')}
                className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between cursor-pointer hover:bg-rose-100/70 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-600 text-white">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-rose-950 block">
                      {overdueItems.length} comanda(s) superaron el tiempo SLA de preparación
                    </span>
                    <span className="text-[11px] text-rose-800">
                      Revisar estación en KDS Cocina/Barra
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-800" />
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#F4F6F8] border border-zinc-200 flex items-center gap-3 text-xs text-[#667085]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Todos los tiempos de preparación dentro de SLA.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAST OPERATION BAR (Primary CTAs - Operation First) */}
      <div className="bg-[#05268F] rounded-3xl p-5 text-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>Acciones Rápidas de Operación</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#FFD318] text-[#101828]">
                Alta Velocidad
              </span>
            </h3>
            <p className="text-xs text-white/80">
              Inicia comandas, abre mesas o cobra cuentas sin navegar por submenús.
            </p>
          </div>
        </div>

        {/* 4 Big Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('tables')}
            className="p-3.5 rounded-2xl bg-white hover:bg-zinc-100 text-[#101828] font-black text-xs transition flex flex-col items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
          >
            <UtensilsCrossed className="w-5 h-5 text-[#05268F]" />
            <span>Abrir Mesas / Salón</span>
          </button>

          <button
            onClick={() => onNavigate('comandero')}
            className="p-3.5 rounded-2xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-xs transition flex flex-col items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
          >
            <Smartphone className="w-5 h-5 text-[#101828]" />
            <span>Nueva Comanda</span>
          </button>

          <button
            onClick={async () => {
              if (occupiedTables.length > 0) {
                await selectTable(occupiedTables[0].id);
                onOpenQuickCobro();
              } else {
                onNavigate('tables');
              }
            }}
            className="p-3.5 rounded-2xl bg-white hover:bg-zinc-100 text-[#101828] font-black text-xs transition flex flex-col items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
          >
            <Receipt className="w-5 h-5 text-emerald-700" />
            <span>Consultar Cuentas / Cobrar</span>
          </button>

          <button
            onClick={() => onNavigate('kds')}
            className="p-3.5 rounded-2xl bg-[#041E72] hover:bg-[#031758] border border-white/20 text-white font-bold text-xs transition flex flex-col items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
          >
            <ChefHat className="w-5 h-5 text-[#FFD318]" />
            <span>KDS Pantalla</span>
          </button>
        </div>
      </div>
    </div>
  );
};
