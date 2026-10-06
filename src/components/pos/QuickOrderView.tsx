import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { Product, GuestSubaccount, OrderItemStatus } from '../../core/types';
import {
  ArrowLeft,
  Plus,
  AlertTriangle,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  Flame,
  Check,
} from 'lucide-react';

interface QuickOrderViewProps {
  onBack: () => void;
  onOpenBill: () => void;
  onTriggerAllergyModal: (data: {
    guestSubaccount: GuestSubaccount;
    product: Product;
    conflicts: any[];
  }) => void;
}

export const QuickOrderView: React.FC<QuickOrderViewProps> = ({
  onBack,
  onOpenBill,
  onTriggerAllergyModal,
}) => {
  const {
    selectedTableDetails,
    products,
    allergies,
    openTable,
    addGuest,
    createOrderTicket,
    addItemToSeat,
    updateItemStatus,
  } = usePos();

  const [selectedSeatId, setSelectedSeatId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [newGuestName, setNewGuestName] = useState('');
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [selectedAllergiesForNewGuest, setSelectedAllergiesForNewGuest] = useState<string[]>([]);
  const [itemNotes] = useState<{ [productId: string]: string }>({});

  if (!selectedTableDetails) {
    return (
      <div className="p-8 text-center text-[#667085]">
        <p>No hay mesa seleccionada.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-[#05268F] text-white font-bold rounded-xl text-sm cursor-pointer"
        >
          Volver al Mapa de Mesas
        </button>
      </div>
    );
  }

  const { table, session, subaccounts, items } = selectedTableDetails;

  if (!session) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-zinc-200 rounded-3xl shadow-sm text-center">
        <h3 className="text-xl font-black text-[#101828] mb-2">{table.number} no tiene sesión activa</h3>
        <p className="text-sm text-[#667085] mb-6">
          Esta mesa está actualmente libre. Ábrela para asignar comensales e iniciar comandas.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-[#667085] hover:bg-zinc-50 cursor-pointer"
          >
            Volver al Mapa
          </button>
          <button
            onClick={async () => {
              await openTable(table.id, 'Mesero', [
                { name: 'Carlos' },
                { name: 'Ana', allergy_ids: ['alg_cacahuate'] },
                { name: 'Luis' },
                { name: 'María' },
              ]);
            }}
            className="px-5 py-2.5 rounded-xl bg-[#05268F] text-white text-xs font-bold shadow-md hover:bg-[#05268F]/90 cursor-pointer"
          >
            Abrir Mesa Ahora
          </button>
        </div>
      </div>
    );
  }

  // Default active seat
  const currentSeat = subaccounts.find((s) => s.id === selectedSeatId) || subaccounts[0];

  const categories = ['Todos', 'Platillos', 'Bebidas', 'Entradas', 'Postres', 'Snacks'];
  const filteredProducts =
    selectedCategory === 'Todos'
      ? products
      : products.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());

  const handleProductClick = async (product: Product) => {
    if (!currentSeat) return;
    try {
      const res = await addItemToSeat(
        table.id,
        currentSeat.id,
        product.id,
        1,
        itemNotes[product.id] || undefined,
        false
      );

      if (res.allergy_warning) {
        onTriggerAllergyModal({
          guestSubaccount: currentSeat,
          product,
          conflicts: res.conflicts || [],
        });
      }
    } catch (err: any) {
      alert(err.message || 'Error al agregar producto');
    }
  };

  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) return;
    const seat = await addGuest(table.id, newGuestName, selectedAllergiesForNewGuest);
    setSelectedSeatId(seat.id);
    setNewGuestName('');
    setSelectedAllergiesForNewGuest([]);
    setShowAddGuestModal(false);
  };

  const getItemStatusBadge = (status: OrderItemStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'En Cola', bg: 'bg-[#F4F6F8] text-[#667085] border-zinc-200', icon: Clock };
      case 'preparing':
        return { label: 'En Preparación', bg: 'bg-[#EAF0FF] text-[#05268F] border-[#05268F]/30', icon: Flame };
      case 'ready':
        return { label: '¡Listo!', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300', icon: Check };
      case 'delivered':
        return { label: 'Entregado', bg: 'bg-zinc-100 text-zinc-600 border-zinc-200', icon: CheckCircle2 };
      case 'cancelled':
      default:
        return { label: 'Cancelado', bg: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle };
    }
  };

  const tableTotalCents = items.filter((i) => i.preparation_status !== 'cancelled').reduce((acc, i) => acc + i.total_price_cents, 0);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 flex flex-col h-[calc(100vh-100px)]">
      {/* Table Navigation Top Bar */}
      <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-sm flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-[#F4F6F8] hover:bg-zinc-200 text-[#101828] transition cursor-pointer"
            title="Volver a Mesas"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#101828] tracking-tight">{table.number}</h2>
              {selectedTableDetails.session && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFF7D6] text-[#101828] border border-[#FFD318]">
                  Sesión #{selectedTableDetails.session.id.slice(-6)}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF0FF] text-[#05268F] border border-[#05268F]/20">
                {subaccounts.length} Comensales
              </span>
              {selectedTableDetails.orders && selectedTableDetails.orders.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                  {selectedTableDetails.orders.length} Comandas
                </span>
              )}
              {table.assigned_waiter && (
                <span className="text-xs text-[#667085]">
                  Mesero: <strong className="text-[#101828]">{table.assigned_waiter}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global Action: Total & Ver Cuenta CTA */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">Total Sesión</span>
            <div className="text-xl font-black text-[#101828] leading-none">
              ${(tableTotalCents / 100).toFixed(2)} MXN
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const ticket = await createOrderTicket(table.id);
                alert(`Nueva ${ticket.ticket_number} agregada a esta sesión.`);
              } catch (err: any) {
                alert(err.message || 'Error al aperturar comanda');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-[#05268F]/30 hover:bg-[#EAF0FF] text-[#05268F] font-bold text-xs shadow-sm transition cursor-pointer"
            title="Aperturar comanda adicional dentro de la misma sesión de mesa"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Comanda</span>
          </button>
          <button
            onClick={onOpenBill}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-sm shadow-sm transition cursor-pointer"
          >
            <Receipt className="w-4 h-4 text-[#101828]" />
            <span>Consultar Cuentas (Individual / Global)</span>
          </button>
        </div>
      </div>

      {/* Guest Subaccounts Selector Bar in official Azul Directaurante */}
      <div className="bg-[#05268F] rounded-2xl p-3 shadow-md mb-3 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-white/80 uppercase tracking-wider shrink-0 pl-1">
            Comensal Activo:
          </span>
          {subaccounts.map((seat) => {
            const isSelected = (currentSeat?.id || '') === seat.id;
            const seatItems = items.filter((i) => i.guest_subaccount_id === seat.id && i.preparation_status !== 'cancelled');
            const seatTotalCents = seatItems.reduce((acc, i) => acc + i.total_price_cents, 0);
            const hasAllergy = seat.allergy_ids && seat.allergy_ids.length > 0;

            return (
              <button
                key={seat.id}
                onClick={() => setSelectedSeatId(seat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 border cursor-pointer ${
                  isSelected
                    ? 'bg-[#FFD318] text-[#101828] border-[#FFD318] shadow-md ring-2 ring-white/50 font-black'
                    : 'bg-[#041E72] text-white border-white/20 hover:bg-[#031758]'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="opacity-80 font-mono">{seat.seat_number}</span>
                  <span>{seat.display_name}</span>
                </div>
                {hasAllergy && (
                  <span
                    className="p-0.5 rounded-full bg-rose-600 text-white font-black"
                    title="Comensal con Alergias Registradas"
                  >
                    <AlertTriangle className="w-3 h-3" />
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                    isSelected ? 'bg-[#101828] text-white' : 'bg-white/15 text-white/90'
                  }`}
                >
                  ${(seatTotalCents / 100).toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowAddGuestModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#041E72] hover:bg-[#031758] text-[#FFD318] text-xs font-extrabold border border-white/20 transition shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Agregar Comensal</span>
        </button>
      </div>

      {/* Main Two-Column View: Catalogue (Left) & Active Orders by Seat (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Left Column: Product Catalogue (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col shadow-sm overflow-hidden">
          {/* Categories Tab */}
          <div className="flex items-center gap-1.5 pb-3 overflow-x-auto no-scrollbar border-b border-zinc-100">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#05268F] text-white shadow-sm'
                    : 'bg-[#F4F6F8] text-[#667085] hover:bg-[#EAF0FF] hover:text-[#05268F]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Active target reminder */}
          <div className="py-2.5 px-1 text-xs text-[#667085] flex items-center justify-between">
            <span>
              Haga clic para agregar a:{' '}
              <strong className="text-[#05268F] font-black">
                {currentSeat ? `${currentSeat.seat_number} - ${currentSeat.display_name}` : 'Ninguno'}
              </strong>
            </span>
            {currentSeat?.allergy_ids?.length ? (
              <span className="flex items-center gap-1 text-rose-700 font-bold text-[11px] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Protección alérgica activa
              </span>
            ) : null}
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 overflow-y-auto flex-1 pr-1">
            {filteredProducts.map((prod) => (
              <button
                key={prod.id}
                onClick={() => handleProductClick(prod)}
                className="group p-3 rounded-2xl border border-zinc-200 hover:border-[#05268F] hover:bg-[#EAF0FF]/25 text-left transition flex flex-col justify-between h-28 relative bg-white shadow-xs cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-black text-[#101828] group-hover:text-[#05268F] transition line-clamp-2">
                      {prod.name}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                        prod.destination_station === 'bar' ? 'bg-purple-100 text-purple-800' : 'bg-[#EAF0FF] text-[#05268F]'
                      }`}
                    >
                      {prod.destination_station === 'bar' ? 'Barra' : 'Cocina'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#667085] line-clamp-1 mt-0.5">{prod.description}</p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-100">
                  <span className="text-sm font-black text-[#101828]">
                    ${(prod.price_cents / 100).toFixed(2)}
                  </span>
                  <span className="w-6 h-6 rounded-lg bg-[#FFD318] text-[#101828] flex items-center justify-center font-black text-xs shadow-xs group-hover:scale-105 transition">
                    +
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Active Order Items Grouped by Subaccount (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col shadow-sm overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-base font-black text-[#101828]">Comanda de Mesa por Comensal</h3>
            <span className="text-xs text-[#667085] font-semibold">{items.length} items registrados</span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 pr-1 mt-2">
            {subaccounts.map((seat) => {
              const seatItems = items.filter((i) => i.guest_subaccount_id === seat.id);
              const seatTotalCents = seatItems
                .filter((i) => i.preparation_status !== 'cancelled')
                .reduce((acc, i) => acc + i.total_price_cents, 0);

              return (
                <div key={seat.id} className="py-3 first:pt-0">
                  {/* Seat Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded bg-[#05268F] text-white">
                        {seat.seat_number}
                      </span>
                      <span className="font-black text-sm text-[#101828]">{seat.display_name}</span>
                      {seat.allergy_ids && seat.allergy_ids.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Alergias
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-black text-[#101828]">${(seatTotalCents / 100).toFixed(2)}</span>
                  </div>

                  {/* Seat Items List */}
                  {seatItems.length === 0 ? (
                    <p className="text-xs text-[#667085] italic pl-6">Sin productos ordenados todavía.</p>
                  ) : (
                    <div className="space-y-1.5 pl-2">
                      {seatItems.map((item) => {
                        const statusBadge = getItemStatusBadge(item.preparation_status);
                        const StatusIcon = statusBadge.icon;
                        return (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1.5 transition ${
                              item.preparation_status === 'cancelled'
                                ? 'bg-[#F4F6F8] opacity-60 border-zinc-200'
                                : 'bg-white border-zinc-200 shadow-xs'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-bold text-[#101828]">
                                  {item.quantity}x {item.product_name}
                                </span>
                                {item.notes && <p className="text-[10px] text-[#667085] italic mt-0.5">"{item.notes}"</p>}
                              </div>
                              <span className="font-black text-[#101828]">
                                ${(item.total_price_cents / 100).toFixed(2)}
                              </span>
                            </div>

                            {/* Operational Status Control Bar */}
                            <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.bg}`}>
                                <StatusIcon className="w-3 h-3" />
                                <span>{statusBadge.label}</span>
                              </span>

                              {/* Quick State Transitions */}
                              {item.preparation_status !== 'cancelled' && (
                                <div className="flex items-center gap-1">
                                  {item.preparation_status === 'pending' && (
                                    <button
                                      onClick={() => updateItemStatus(item.id, 'preparing', 'Enviado a cocina')}
                                      className="px-2.5 py-0.5 rounded-lg bg-[#05268F] hover:bg-[#041E72] text-white font-bold text-[10px] transition shadow-xs cursor-pointer"
                                      title="Iniciar preparación"
                                    >
                                      Preparar
                                    </button>
                                  )}
                                  {item.preparation_status === 'preparing' && (
                                    <button
                                      onClick={() => updateItemStatus(item.id, 'ready', 'Platillo listo')}
                                      className="px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition shadow-xs cursor-pointer"
                                      title="Marcar listo"
                                    >
                                      Listo
                                    </button>
                                  )}
                                  {item.preparation_status === 'ready' && (
                                    <button
                                      onClick={() => updateItemStatus(item.id, 'delivered', 'Servido en mesa')}
                                      className="px-2.5 py-0.5 rounded-lg bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-[10px] transition shadow-xs cursor-pointer"
                                      title="Marcar entregado"
                                    >
                                      Entregar
                                    </button>
                                  )}
                                  {item.preparation_status !== 'delivered' && (
                                    <button
                                      onClick={() => {
                                        const reason = prompt('Motivo de cancelación:');
                                        if (reason) updateItemStatus(item.id, 'cancelled', reason);
                                      }}
                                      className="px-1.5 py-0.5 rounded text-[#667085] hover:text-rose-600 font-semibold text-[10px] transition cursor-pointer"
                                      title="Cancelar item con registro de auditoría"
                                    >
                                      Cancelar
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal to Add Subaccount */}
      {showAddGuestModal && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-zinc-200">
            <h4 className="text-lg font-black text-[#101828] mb-1">Agregar Comensal a {table.number}</h4>
            <p className="text-xs text-[#667085] mb-4">
              Se creará la siguiente subcuenta operacional disponible.
            </p>

            <form onSubmit={handleCreateGuest} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                  Nombre del Comensal
                </label>
                <input
                  type="text"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  placeholder="Ej: Sofia, Diego, Invitado"
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-sm font-semibold text-[#101828] focus:ring-2 focus:ring-[#05268F] focus:border-[#05268F] focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                  Alergias Conocidas (Opcional)
                </label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {allergies.map((alg) => {
                    const isChecked = selectedAllergiesForNewGuest.includes(alg.id);
                    return (
                      <label
                        key={alg.id}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer ${
                          isChecked ? 'bg-rose-50 border-rose-300 font-bold text-rose-950' : 'bg-[#F4F6F8] border-zinc-200 text-[#101828]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAllergiesForNewGuest([...selectedAllergiesForNewGuest, alg.id]);
                            } else {
                              setSelectedAllergiesForNewGuest(
                                selectedAllergiesForNewGuest.filter((id) => id !== alg.id)
                              );
                            }
                          }}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span>{alg.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddGuestModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#101828] bg-[#F4F6F8] hover:bg-zinc-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-black bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] shadow-sm cursor-pointer"
                >
                  Guardar Comensal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
