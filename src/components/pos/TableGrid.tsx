import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { TableStatus } from '../../core/types';
import { Users, PlusCircle, ArrowRight } from 'lucide-react';

interface TableGridProps {
  onSelectTable: (tableId: string) => void;
}

export const TableGrid: React.FC<TableGridProps> = ({ onSelectTable }) => {
  const { tables, openTable } = usePos();
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);
  const [waiterInput, setWaiterInput] = useState('Mesero Carlos R.');
  const [guestsCount, setGuestsCount] = useState<number>(4);

  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return {
          label: 'LIBRE',
          className: 'bg-[#F4F6F8] text-[#667085] border-zinc-200',
          dot: 'bg-emerald-500',
        };
      case 'occupied':
        return {
          label: 'OCUPADA',
          className: 'bg-[#EAF0FF] text-[#05268F] border-[#05268F]/30',
          dot: 'bg-[#05268F]',
        };
      case 'bill_requested':
        return {
          label: 'ESPERANDO CUENTA',
          className: 'bg-[#FFF7D6] text-[#101828] border-[#FFD318]',
          dot: 'bg-[#FFD318] animate-pulse',
        };
      case 'paying':
        return {
          label: 'PAGANDO',
          className: 'bg-[#EAF0FF] text-[#05268F] border-[#05268F]',
          dot: 'bg-[#05268F]',
        };
      case 'closed':
      default:
        return {
          label: 'CERRADA',
          className: 'bg-zinc-100 text-zinc-500 border-zinc-200',
          dot: 'bg-zinc-400',
        };
    }
  };

  const handleOpenTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingTableId) return;

    // Generate initial comensales 1.1, 1.2, 1.3...
    const initialGuests = Array.from({ length: guestsCount }).map((_, idx) => ({
      name: idx === 0 ? 'Carlos' : idx === 1 ? 'Ana' : idx === 2 ? 'Luis' : idx === 3 ? 'María' : `Comensal ${idx + 1}`,
      allergy_ids: idx === 1 ? ['alg_cacahuate'] : [], // Ana has allergy
    }));

    await openTable(openingTableId, waiterInput || 'Mesero', initialGuests);
    const tableId = openingTableId;
    setOpeningTableId(null);
    onSelectTable(tableId);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-[#101828] tracking-tight flex items-center gap-2">
            <span>Mapa de Salón y Mesas</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EAF0FF] text-[#05268F] border border-[#05268F]/20">
              {tables.length} Mesas Totales
            </span>
          </h2>
          <p className="text-sm text-[#667085] mt-0.5">
            Flujo rápido para meseros: selecciona una mesa para agregar productos directamente a la subcuenta de cada comensal.
          </p>
        </div>

        {/* Legend with official branding tokens */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-[#667085] font-semibold">Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#05268F]"></span>
            <span className="text-[#05268F] font-bold">Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFD318]"></span>
            <span className="text-[#101828] font-bold">Esperando Cuenta</span>
          </div>
        </div>
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map((table) => {
          const badge = getStatusBadge(table.status);
          const isOccupied = table.status === 'occupied' || table.status === 'bill_requested' || table.status === 'paying';

          return (
            <div
              key={table.id}
              onClick={() => {
                if (isOccupied) {
                  onSelectTable(table.id);
                } else {
                  setOpeningTableId(table.id);
                }
              }}
              className={`group relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between h-48 select-none ${
                isOccupied
                  ? 'bg-white border-[#05268F]/30 hover:border-[#05268F] hover:shadow-md shadow-sm'
                  : 'bg-white border-zinc-200 hover:border-[#05268F]/40 hover:bg-[#EAF0FF]/20 shadow-sm'
              }`}
            >
              {/* Card Top */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-black text-[#101828] group-hover:text-[#05268F] transition">
                    {table.number}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-[#667085] mt-0.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Capacidad: {table.capacity} personas</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.className}`}>
                  <span className={`w-2 h-2 rounded-full ${badge.dot}`}></span>
                  <span>{badge.label}</span>
                </div>
              </div>

              {/* Card Middle: Active session metrics */}
              {isOccupied ? (
                <div className="space-y-1.5 my-2">
                  <div className="flex items-center justify-between text-xs text-[#667085]">
                    <span className="font-medium">Comensales activos:</span>
                    <span className="font-bold text-[#101828] px-1.5 py-0.5 rounded bg-[#F4F6F8]">
                      {table.guests_count} comensales
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#667085]">
                    <span className="font-medium">Items en comanda:</span>
                    <span className="font-bold text-[#101828]">{table.active_items_count} items</span>
                  </div>
                  {table.assigned_waiter && (
                    <div className="text-[11px] text-[#667085] truncate">
                      Mesero: <span className="text-[#101828] font-semibold">{table.assigned_waiter}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="my-auto py-2 text-center text-[#667085] text-xs flex flex-col items-center justify-center">
                  <PlusCircle className="w-7 h-7 text-[#05268F]/40 group-hover:text-[#05268F] transition mb-1" />
                  <span className="font-semibold group-hover:text-[#05268F]">Abrir mesa y asignar comensales</span>
                </div>
              )}

              {/* Card Bottom: Total Accumulator */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">Total Acumulado</span>
                  <div className="text-base font-black text-[#101828]">
                    {isOccupied ? `$${((table.total_cents || 0) / 100).toFixed(2)}` : '$0.00'}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#05268F] group-hover:translate-x-0.5 transition">
                  <span>{isOccupied ? 'Comandar' : 'Abrir'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal to Open Table - Fast Flow: TAP MESA -> ¿CUÁNTOS COMENSALES? -> ABRIR */}
      {openingTableId && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[#05268F] bg-[#EAF0FF] px-2 py-0.5 rounded-full">
                  Apertura Rápida
                </span>
                <h3 className="text-xl font-black text-[#101828] mt-1">
                  Abrir {tables.find((t) => t.id === openingTableId)?.number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpeningTableId(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenTableSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#101828] uppercase tracking-wider mb-2">
                  ¿Cuántos comensales?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGuestsCount(num)}
                      className={`py-3 rounded-2xl text-sm font-black border transition active:scale-95 cursor-pointer ${
                        guestsCount === num
                          ? 'bg-[#05268F] text-white border-[#05268F] shadow-sm ring-2 ring-[#FFD318]'
                          : 'bg-[#F4F6F8] text-[#101828] border-zinc-200 hover:bg-[#EAF0FF]'
                      }`}
                    >
                      {num} {num === 1 ? 'pax' : 'pax'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#667085] mt-2">
                  Se abrirán las subcuentas operacionales automáticas (ej. 1.1 a 1.{guestsCount}).
                  Podrá agregar más comensales dinámicamente en cualquier momento.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setOpeningTableId(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#F4F6F8] text-[#101828] hover:bg-zinc-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] shadow-sm transition active:scale-95 cursor-pointer"
                >
                  Abrir Mesa ({guestsCount} comensales)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
