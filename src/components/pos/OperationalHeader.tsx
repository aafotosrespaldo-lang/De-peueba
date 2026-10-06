import React from 'react';
import { usePos } from '../../context/PosContext';
import {
  ChefHat,
  DollarSign,
  Printer,
  UploadCloud,
  Puzzle,
  FileText,
  Sparkles,
  LayoutGrid,
  Smartphone,
} from 'lucide-react';

export type MainViewMode = 'pos' | 'comandero' | 'kds';

interface OperationalHeaderProps {
  activeMode?: MainViewMode;
  onChangeMode?: (mode: MainViewMode) => void;
  onOpenKds: () => void;
  onOpenCash: () => void;
  onOpenPrint: () => void;
  onOpenImport: () => void;
  onOpenPlugins: () => void;
  onOpenAudit: () => void;
}

export const OperationalHeader: React.FC<OperationalHeaderProps> = ({
  activeMode = 'pos',
  onChangeMode,
  onOpenKds,
  onOpenCash,
  onOpenPrint,
  onOpenImport,
  onOpenPlugins,
  onOpenAudit,
}) => {
  const { tables, kdsItems, cashData, loadCanonicalScenario, loading } = usePos();

  const occupiedTables = tables.filter((t) => t.status === 'occupied' || t.status === 'bill_requested' || t.status === 'paying');
  const preparingItems = kdsItems.filter((i) => i.preparation_status === 'preparing');
  const overdueItems = kdsItems.filter((i) => i.is_overdue);

  // Calculate total active sales from all open tables
  const totalActiveCents = tables.reduce((acc, t) => acc + (t.total_cents || 0), 0);
  const totalSalesStr = `$${(totalActiveCents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  const isCashOpen = cashData?.shift?.status === 'open';

  return (
    <header className="bg-[#05268F] border-b border-[#041E72] text-white sticky top-0 z-30 shadow-md">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Monolith Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFD318] text-[#05268F] flex items-center justify-center font-black text-2xl shadow-sm">
            D
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-tight text-lg text-white">DIRECTAURANTE</span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#041E72] text-[#FFD318] border border-[#FFD318]/30">
                POS CORE v0.1
              </span>
            </div>
            <p className="text-xs text-white/80 font-medium">Plataforma Modular para Restaurantes - Mismo Núcleo Operativo</p>
          </div>
        </div>

        {/* View Mode Switcher: POS vs Comandero vs KDS */}
        {onChangeMode && (
          <div className="flex items-center p-1 bg-[#041E72] rounded-xl border border-white/20 shadow-inner">
            <button
              onClick={() => onChangeMode('pos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeMode === 'pos'
                  ? 'bg-[#FFD318] text-[#101828] font-black shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>POS Salón</span>
            </button>
            <button
              onClick={() => onChangeMode('comandero')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeMode === 'comandero'
                  ? 'bg-[#FFD318] text-[#101828] font-black shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Comandero Táctil</span>
            </button>
            <button
              onClick={() => onChangeMode('kds')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeMode === 'kds'
                  ? 'bg-[#FFD318] text-[#101828] font-black shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>KDS Pantalla</span>
              {preparingItems.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full font-black text-[10px] ${
                    activeMode === 'kds' ? 'bg-[#05268F] text-[#FFD318]' : 'bg-[#FFD318] text-[#101828]'
                  }`}
                >
                  {preparingItems.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Operational Action Shortcuts */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Primary CTA in official Directaurante Yellow */}
          <button
            onClick={() => loadCanonicalScenario()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] text-xs font-extrabold transition shadow-sm cursor-pointer"
            title="Carga Mesa 1 con 4 comensales (Carlos, Ana, Luis, María) con pedidos exactos y advertencia de alergias"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cargar Caso Canónico (Mesa 1)</span>
          </button>
          <button
            onClick={onOpenKds}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#041E72] hover:bg-[#031758] text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
          >
            <ChefHat className="w-3.5 h-3.5 text-[#FFD318]" />
            <span>KDS Cocina/Barra</span>
            {preparingItems.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#FFD318] text-[#101828] font-black text-[10px]">
                {preparingItems.length}
              </span>
            )}
          </button>
          <button
            onClick={onOpenCash}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#041E72] hover:bg-[#031758] text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5 text-[#FFD318]" />
            <span>Caja</span>
            <span
              className={`w-2 h-2 rounded-full ${isCashOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}
              title={isCashOpen ? 'Caja Abierta' : 'Caja Cerrada'}
            />
          </button>
          <button
            onClick={onOpenPrint}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#041E72] hover:bg-[#031758] text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
            title="Impresoras y Tickets"
          >
            <Printer className="w-3.5 h-3.5 text-white/80" />
            <span className="hidden sm:inline">Impresión</span>
          </button>
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#041E72] hover:bg-[#031758] text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
            title="DirectImport (Migración POS)"
          >
            <UploadCloud className="w-3.5 h-3.5 text-white/80" />
            <span className="hidden sm:inline">DirectImport</span>
          </button>
          <button
            onClick={onOpenPlugins}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#041E72] hover:bg-[#031758] text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
            title="Plugins por Negocio"
          >
            <Puzzle className="w-3.5 h-3.5 text-[#FFD318]" />
            <span className="hidden sm:inline">Plugins</span>
          </button>
          <button
            onClick={onOpenAudit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#041E72] hover:bg-[#031758] text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
            title="Pista de Auditoría"
          >
            <FileText className="w-3.5 h-3.5 text-white/80" />
            <span className="hidden sm:inline">Auditoría</span>
          </button>
        </div>
      </div>

      {/* Actionable Live Operational Dashboard */}
      <div className="bg-[#031758] border-t border-[#041E72] px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs overflow-x-auto gap-4 no-scrollbar">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-white/70 uppercase font-bold text-[10px] tracking-wider">Ventas Activas:</span>
              <span className="font-black text-white text-sm">{totalSalesStr}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/70 uppercase font-bold text-[10px] tracking-wider">Mesas Activas:</span>
              <span className="px-2 py-0.5 rounded bg-white/15 text-white font-black">
                {occupiedTables.length} / {tables.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/70 uppercase font-bold text-[10px] tracking-wider">En Preparación:</span>
              <span className="px-2 py-0.5 rounded bg-[#EAF0FF] text-[#05268F] font-black">
                {preparingItems.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/70 uppercase font-bold text-[10px] tracking-wider">Retrasados:</span>
              <span
                className={`px-2 py-0.5 rounded font-black ${
                  overdueItems.length > 0 ? 'bg-rose-900 text-rose-100 border border-rose-500 animate-pulse' : 'bg-white/15 text-white/70'
                }`}
              >
                {overdueItems.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/70 uppercase font-bold text-[10px] tracking-wider">Caja:</span>
              <span className={`font-black ${isCashOpen ? 'text-[#FFD318]' : 'text-white/50'}`}>
                {isCashOpen ? 'ABIERTA / CUADRADA' : 'CERRADA'}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-white/80 font-medium flex items-center gap-2 shrink-0">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>REST API Backend Activo • Multi-Subcuenta Habilitado</span>
          </div>
        </div>
      </div>
    </header>
  );
};
