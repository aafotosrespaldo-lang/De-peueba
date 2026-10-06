import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { Product, GuestSubaccount } from '../../core/types';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  AlertTriangle,
  Send,
  Bell,
  CheckCircle2,
  X,
  User,
  ShieldAlert,
  ChevronRight,
  Printer,
  FileText,
} from 'lucide-react';

interface StagedItem {
  id: string;
  guestSubaccount: GuestSubaccount;
  product: Product;
  quantity: number;
  notes?: string;
  modifiers: string[];
}

export const ComanderoView: React.FC = () => {
  const {
    tables,
    products,
    allergies,
    selectedTableId,
    selectedTableDetails,
    selectTable,
    addGuest,
    createOrderTicket,
    addItemToSeat,
    markItemDelivered,
    readyNotifications,
    dismissReadyNotification,
    sdk,
  } = usePos();

  // Comandero Local State
  const [selectedSeatId, setSelectedSeatId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMyTables, setFilterMyTables] = useState<boolean>(false);
  const [currentWaiterName] = useState<string>('Carlos R. (Mesero)');
  const [isPrintingBill, setIsPrintingBill] = useState<boolean>(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  // Staging Comanda (items ready to be sent to production in a single tap)
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isSendingComanda, setIsSendingComanda] = useState<boolean>(false);

  // Product Customizer Modal (Quantity, Modifiers, Notes)
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [customQuantity, setCustomQuantity] = useState<number>(1);
  const [customModifiers, setCustomModifiers] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState<string>('');

  // Allergy Warning & Override Dialog
  const [allergyConflictData, setAllergyConflictData] = useState<{
    subaccount: GuestSubaccount;
    product: Product;
    conflicts: any[];
    quantity: number;
    notes?: string;
    modifiers: string[];
  } | null>(null);
  const [overrideAuthorizedBy, setOverrideAuthorizedBy] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');

  // Ready Notifications Drawer toggle
  const [showReadyDrawer, setShowReadyDrawer] = useState<boolean>(false);

  // New Guest Quick Modal
  const [showAddGuestModal, setShowAddGuestModal] = useState<boolean>(false);
  const [newGuestName, setNewGuestName] = useState<string>('');
  const [selectedAllergiesForNewGuest, setSelectedAllergiesForNewGuest] = useState<string[]>([]);

  // Categories list
  const categories = ['Todos', 'Platillos', 'Bebidas', 'Entradas', 'Postres', 'Snacks'];

  // Current Table & Session
  const currentTable = tables.find((t) => t.id === selectedTableId);
  const subaccounts = selectedTableDetails?.subaccounts || [];
  const activeSession = selectedTableDetails?.session;

  // Active Diner
  const currentSeat = useMemo(() => {
    return subaccounts.find((s) => s.id === selectedSeatId) || subaccounts[0];
  }, [subaccounts, selectedSeatId]);

  // Active Diner Allergies
  const currentSeatAllergies = useMemo(() => {
    if (!currentSeat || !currentSeat.allergy_ids || currentSeat.allergy_ids.length === 0) {
      return [];
    }
    return currentSeat.allergy_ids
      .map((id) => allergies.find((a) => a.id === id))
      .filter(Boolean);
  }, [currentSeat, allergies]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'Todos' ? true : p.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchSearch =
        searchQuery.trim() === ''
          ? true
          : p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch && p.available;
    });
  }, [products, selectedCategory, searchQuery]);

  // Filtered Tables
  const filteredTables = useMemo(() => {
    if (!filterMyTables) return tables;
    return tables.filter(
      (t) =>
        t.status === 'occupied' &&
        t.assigned_waiter &&
        t.assigned_waiter.toLowerCase().includes('carlos')
    );
  }, [tables, filterMyTables]);

  // Handle open product customizer
  const handleOpenCustomizer = (product: Product) => {
    if (!currentSeat) {
      alert('Por favor selecciona un comensal primero.');
      return;
    }
    setCustomizingProduct(product);
    setCustomQuantity(1);
    setCustomModifiers([]);
    setCustomNotes('');
  };

  // Add customized product to staging cart
  const handleAddStagedItem = () => {
    if (!customizingProduct || !currentSeat) return;

    // Check allergy conflict deterministically
    const hasAllergyConflict = currentSeatAllergies.some((alg) => {
      if (!alg) return false;
      return alg.ingredient_ids.some((ingId) => customizingProduct.ingredient_ids.includes(ingId));
    });

    if (hasAllergyConflict) {
      const conflictingIngredients = currentSeatAllergies
        .filter((alg) => alg && alg.ingredient_ids.some((i) => customizingProduct.ingredient_ids.includes(i)))
        .map((a) => a!.name);

      setAllergyConflictData({
        subaccount: currentSeat,
        product: customizingProduct,
        conflicts: conflictingIngredients,
        quantity: customQuantity,
        notes: customNotes,
        modifiers: customModifiers,
      });
      return;
    }

    // Direct add to staging
    const newItem: StagedItem = {
      id: `staged_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      guestSubaccount: currentSeat,
      product: customizingProduct,
      quantity: customQuantity,
      notes: customNotes.trim() || undefined,
      modifiers: customModifiers,
    };

    setStagedItems((prev) => [...prev, newItem]);
    setCustomizingProduct(null);
  };

  // Authorize allergy override
  const handleAuthorizeAllergyOverride = () => {
    if (!allergyConflictData) return;
    if (!overrideAuthorizedBy.trim() || !overrideReason.trim()) {
      alert('Se requiere nombre del responsable y motivo de autorización.');
      return;
    }

    const newItem: StagedItem = {
      id: `staged_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      guestSubaccount: allergyConflictData.subaccount,
      product: allergyConflictData.product,
      quantity: allergyConflictData.quantity,
      notes: `[AUTORIZADO por ${overrideAuthorizedBy}: ${overrideReason}] ${allergyConflictData.notes || ''}`.trim(),
      modifiers: allergyConflictData.modifiers,
    };

    setStagedItems((prev) => [...prev, newItem]);
    setAllergyConflictData(null);
    setCustomizingProduct(null);
    setOverrideAuthorizedBy('');
    setOverrideReason('');
  };

  // Dispatch all staged items as a new Comanda Ticket
  const handleSendComanda = async () => {
    if (stagedItems.length === 0 || !selectedTableId) return;
    setIsSendingComanda(true);
    try {
      // 1. Create a new Comanda Ticket under the SAME table_session_id
      const newTicket = await createOrderTicket(selectedTableId, currentWaiterName);

      // 2. Add each staged item to its subaccount under this ticket
      for (const item of stagedItems) {
        await addItemToSeat(
          selectedTableId,
          item.guestSubaccount.id,
          item.product.id,
          item.quantity,
          item.notes,
          true, // allergy override handled at staging confirmation
          newTicket.id,
          item.modifiers
        );
      }

      setStagedItems([]);
    } catch (err: any) {
      alert(`Error al enviar comanda: ${err.message}`);
    } finally {
      setIsSendingComanda(false);
    }
  };

  // Imprimir cuenta directamente en el Core como PrintJob
  const handlePrintBill = async () => {
    if (!selectedTableId || !currentTable) return;
    setIsPrintingBill(true);
    setPrintFeedback(null);
    try {
      const items = selectedTableDetails?.items || [];
      const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const separator = '========================================';
      const thinSep = '----------------------------------------';

      const lines = [
        separator,
        '          DIRECTAURANTE          ',
        '       PRE-CUENTA DE CONSUMO     ',
        separator,
        `MESA:   ${currentTable.number.padEnd(16)} HORA: ${now}`,
        `MESERO: ${currentWaiterName}`,
        thinSep,
        'CANT  DESCRIPCIÓN                    TOTAL',
        thinSep,
      ];

      let subtotalCents = 0;
      items.forEach((item) => {
        const itemTotal = item.unit_price_cents * item.quantity;
        subtotalCents += itemTotal;
        const qty = `${item.quantity}x`.padEnd(5);
        const name = item.product_name.slice(0, 22).padEnd(23);
        const price = `$${(itemTotal / 100).toFixed(2)}`.padStart(10);
        lines.push(`${qty} ${name} ${price}`);
      });

      const taxCents = Math.round(subtotalCents * 0.16);
      const totalCents = subtotalCents + taxCents;

      lines.push(thinSep);
      lines.push(`SUBTOTAL:`.padEnd(28) + `$${(subtotalCents / 100).toFixed(2)}`.padStart(12));
      lines.push(`IVA TRASLADADO (16%):`.padEnd(28) + `$${(taxCents / 100).toFixed(2)}`.padStart(12));
      lines.push(separator);
      lines.push(`TOTAL A PAGAR:`.padEnd(28) + `$${(totalCents / 100).toFixed(2)} MXN`.padStart(12));
      lines.push(separator);
      lines.push('  NO ES COMPROBANTE FISCAL  ');
      lines.push('       GRACIAS POR SU VISITA       \n\n\n');

      await sdk.print.createPrintJob({
        type: 'cashier',
        station: 'cashier',
        table_id: currentTable.id,
        table_number: currentTable.number,
        order_id: activeSession?.id,
        formatted_content: lines.join('\n'),
        status: 'pending',
      });

      setPrintFeedback('¡Cuenta enviada a la impresora de caja!');
      setTimeout(() => setPrintFeedback(null), 3500);
    } catch (err: any) {
      setPrintFeedback(`Error al imprimir cuenta: ${err.message}`);
    } finally {
      setIsPrintingBill(false);
    }
  };

  // Handle add guest
  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim() || !selectedTableId) return;
    const seat = await addGuest(selectedTableId, newGuestName, selectedAllergiesForNewGuest);
    setSelectedSeatId(seat.id);
    setNewGuestName('');
    setSelectedAllergiesForNewGuest([]);
    setShowAddGuestModal(false);
  };

  // Staged Total
  const stagedTotalCents = stagedItems.reduce(
    (sum, i) => sum + i.product.price_cents * i.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#101828] flex flex-col font-sans pb-12">
      {/* Comandero Header */}
      <header className="bg-[#05268F] text-white px-4 py-3 sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {selectedTableId && (
              <button
                onClick={() => {
                  selectTable(null);
                  setStagedItems([]);
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition active:scale-95 cursor-pointer"
                title="Volver al Salón"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-[#FFD318]">DIRECTAURANTE</span>
                <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-white/15 text-white">
                  Comandero
                </span>
              </div>
              <p className="text-xs text-white/80">
                {selectedTableId ? `${currentTable?.number} • ${currentWaiterName}` : currentWaiterName}
              </p>
            </div>
          </div>

          {/* Action Header Items: Ready Bell & Quick Stats */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReadyDrawer(!showReadyDrawer)}
              className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Notificaciones de platillos listos"
            >
              <Bell className="w-5 h-5 text-[#FFD318]" />
              {readyNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-white font-black text-xs px-1.5 py-0.5 rounded-full ring-2 ring-[#05268F] animate-bounce">
                  {readyNotifications.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Ready Notifications Banner (When items are LISTO in KDS) */}
      {readyNotifications.length > 0 && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 shadow-inner">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 shrink-0">
              <span className="p-1 rounded bg-white/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
              </span>
              <strong className="text-xs tracking-wide">
                ¡{readyNotifications.length} platillo(s) listo(s) para entregar!
              </strong>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {readyNotifications.map((notif) => (
                <div
                  key={notif.item_id}
                  className="flex items-center gap-2 px-2.5 py-1 bg-white text-[#101828] rounded-xl text-xs font-bold shrink-0 shadow-sm"
                >
                  <span>
                    {notif.table_number} • {notif.seat_number} ({notif.guest_name}):{' '}
                    <strong className="text-[#05268F]">{notif.product_name}</strong>
                  </span>
                  <button
                    onClick={() => markItemDelivered(notif.item_id, currentWaiterName)}
                    className="px-2 py-0.5 bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] rounded-lg font-black text-[11px] transition active:scale-95 cursor-pointer"
                  >
                    Entregar
                  </button>
                  <button
                    onClick={() => dismissReadyNotification(notif.item_id)}
                    className="text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main View Area: Table Grid (when no table selected) OR Ordering Interface (when table selected) */}
      <main className="max-w-6xl w-full mx-auto p-3 sm:p-5 flex-1 flex flex-col">
        {!selectedTableId ? (
          /* STEP 1: Table Selection */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
              <div>
                <h2 className="text-xl font-black text-[#101828]">Seleccionar Mesa</h2>
                <p className="text-xs text-[#667085]">
                  Toca una mesa ocupada para comandar o una libre para abrir servicio
                </p>
              </div>

              {/* Filter: All vs My Tables */}
              <div className="flex items-center gap-1.5 p-1 bg-[#F4F6F8] rounded-xl border border-zinc-200">
                <button
                  onClick={() => setFilterMyTables(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    !filterMyTables
                      ? 'bg-[#05268F] text-white shadow-sm'
                      : 'text-[#667085] hover:text-[#101828]'
                  }`}
                >
                  Todas las Mesas
                </button>
                <button
                  onClick={() => setFilterMyTables(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    filterMyTables
                      ? 'bg-[#05268F] text-white shadow-sm'
                      : 'text-[#667085] hover:text-[#101828]'
                  }`}
                >
                  Mis Mesas Asignadas
                </button>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredTables.map((tbl) => {
                const isOccupied = tbl.status === 'occupied';
                const hasSession = Boolean(tbl.active_session_id);

                return (
                  <button
                    key={tbl.id}
                    onClick={() => selectTable(tbl.id)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition active:scale-95 shadow-sm min-h-[140px] cursor-pointer ${
                      isOccupied
                        ? 'bg-white border-[#05268F]/30 hover:border-[#05268F] ring-1 ring-[#05268F]/10'
                        : 'bg-white border-zinc-200 hover:border-zinc-300 opacity-90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-lg font-black text-[#101828]">{tbl.number}</span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            isOccupied
                              ? 'bg-[#EAF0FF] text-[#05268F]'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {isOccupied ? 'Ocupada' : 'Libre'}
                        </span>
                      </div>
                      {hasSession && (
                        <p className="text-xs text-[#667085]">
                          Sesión: <span className="font-mono font-bold text-[#101828]">#{tbl.active_session_id?.slice(-5)}</span>
                        </p>
                      )}
                      <p className="text-xs text-[#667085]">Capacidad: {tbl.capacity} pax</p>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                      {isOccupied ? (
                        <>
                          <span className="font-bold text-[#05268F]">
                            {tbl.guests_count || 1} comensales
                          </span>
                          <span className="font-black text-[#101828]">
                            ${((tbl.total_cents || 0) / 100).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[#05268F] font-bold flex items-center gap-1">
                          Abrir <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* STEP 2: Active Table Comandero Interface */
          <div className="space-y-3 flex-1 flex flex-col">
            {/* Top Table / Session Context Bar */}
            <div className="bg-white rounded-2xl p-3 border border-zinc-200 shadow-sm flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-[#101828]">{currentTable?.number}</span>
                {activeSession && (
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-[#FFF7D6] text-[#101828] border border-[#FFD318]">
                    Sesión #{activeSession.id.slice(-6)}
                  </span>
                )}
                <span className="text-xs text-[#667085]">
                  Mesero: <strong className="text-[#101828]">{activeSession?.server_id || currentWaiterName}</strong>
                </span>
              </div>

              {/* Quick Table Total & Imprimir Cuenta Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrintBill}
                  disabled={isPrintingBill || (currentTable?.total_cents || 0) === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#05268F] hover:bg-[#041E72] disabled:opacity-40 text-white text-xs font-black transition shadow-xs cursor-pointer"
                  title="Solicitar impresión de cuenta en caja"
                >
                  <Printer className="w-3.5 h-3.5 text-[#FFD318]" />
                  <span>{isPrintingBill ? 'Imprimiendo...' : 'Imprimir cuenta'}</span>
                </button>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">
                    Total Acumulado
                  </span>
                  <div className="text-base font-black text-[#101828] leading-none">
                    ${(((currentTable?.total_cents || 0) + stagedTotalCents) / 100).toFixed(2)} MXN
                  </div>
                </div>
              </div>
            </div>

            {printFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{printFeedback}</span>
              </div>
            )}

            {/* SELECTION OF DINER: [ 1.1 Carlos ] [ 1.2 Ana ] ... */}
            <div className="bg-[#05268F] rounded-2xl p-3 shadow-md">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-white/90">
                  Comensal Seleccionado para Ordenar:
                </span>
                <button
                  onClick={() => setShowAddGuestModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Comensal</span>
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {subaccounts.map((seat) => {
                  const isSelected = currentSeat?.id === seat.id;
                  const hasAllergies = seat.allergy_ids && seat.allergy_ids.length > 0;

                  return (
                    <button
                      key={seat.id}
                      onClick={() => setSelectedSeatId(seat.id)}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs shrink-0 transition active:scale-95 border cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFD318] text-[#101828] border-[#FFD318] shadow-md ring-2 ring-white font-black'
                          : 'bg-white/15 text-white border-white/20 hover:bg-white/25'
                      }`}
                    >
                      <User className="w-3.5 h-3.5 opacity-80" />
                      <span className="font-mono opacity-80">{seat.seat_number}</span>
                      <span>{seat.display_name}</span>
                      {hasAllergies && (
                        <span
                          className="p-0.5 rounded-full bg-rose-600 text-white font-black"
                          title="Comensal con Alergias"
                        >
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PERSISTENT ALLERGY ALERT BANNER */}
            {currentSeatAllergies.length > 0 && (
              <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-3 flex items-center gap-3 text-rose-900 shadow-sm animate-pulse">
                <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="flex-1 text-xs">
                  <strong className="block font-black text-rose-950 uppercase tracking-wide">
                    ¡ALERTA CRÍTICA DE ALERGIAS: {currentSeat?.seat_number} ({currentSeat?.display_name})!
                  </strong>
                  <span>
                    El comensal tiene alergia diagnosticada a:{' '}
                    <strong>{currentSeatAllergies.map((a) => a?.name).join(', ')}</strong>. El sistema
                    bloqueará automáticamente platillos que contengan ingredientes conflictivos.
                  </span>
                </div>
              </div>
            )}

            {/* Product Catalog Controls: Search & Categories */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
                <Search className="w-5 h-5 text-[#667085] ml-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar platillo o bebida rápida..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[#667085]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#05268F] text-white shadow-sm'
                          : 'bg-white text-[#667085] hover:text-[#101828] border border-zinc-200'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products Grid (Touch-first, large interactive cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 flex-1 overflow-y-auto max-h-[48vh] pr-1">
              {filteredProducts.map((prod) => {
                const hasAllergyConflict = currentSeatAllergies.some((alg) => {
                  if (!alg) return false;
                  return alg.ingredient_ids.some((ingId) => prod.ingredient_ids.includes(ingId));
                });

                return (
                  <button
                    key={prod.id}
                    onClick={() => handleOpenCustomizer(prod)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition active:scale-95 shadow-sm min-h-[110px] cursor-pointer ${
                      hasAllergyConflict
                        ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/40 hover:bg-rose-100/80'
                        : 'bg-white border-zinc-200 hover:border-[#05268F] hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-black text-sm text-[#101828] line-clamp-1">
                          {prod.name}
                        </span>
                        {hasAllergyConflict && (
                          <span className="p-1 rounded bg-rose-600 text-white shrink-0" title="Conflicto de Alergia">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#667085] line-clamp-2 leading-tight">
                        {prod.description}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-zinc-100 mt-2">
                      <span className="font-black text-sm text-[#05268F]">
                        ${(prod.price_cents / 100).toFixed(2)}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          prod.destination_station === 'bar'
                            ? 'bg-[#EAF0FF] text-[#05268F]'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {prod.destination_station === 'bar' ? 'Barra' : 'Cocina'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* STAGED COMANDA BAR */}
            <div className="bg-white rounded-2xl p-3 border-2 border-[#FFD318] shadow-lg space-y-2 mt-auto">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black uppercase text-[#101828]">
                    Comanda en Preparación para Enviar:
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#EAF0FF] text-[#05268F]">
                    {stagedItems.length} {stagedItems.length === 1 ? 'ítem' : 'ítems'}
                  </span>
                </div>
                {stagedItems.length > 0 && (
                  <button
                    onClick={() => setStagedItems([])}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    Descartar todo
                  </button>
                )}
              </div>

              {/* Staged Items List */}
              {stagedItems.length > 0 ? (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {stagedItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#F4F6F8] rounded-xl text-xs border border-zinc-200 shrink-0 font-bold"
                    >
                      <span className="font-mono text-[#05268F]">
                        {item.guestSubaccount.seat_number}
                      </span>
                      <span>
                        {item.quantity}x {item.product.name}
                      </span>
                      {item.modifiers.length > 0 && (
                        <span className="text-[10px] text-[#667085]">
                          ({item.modifiers.join(', ')})
                        </span>
                      )}
                      <button
                        onClick={() =>
                          setStagedItems((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="text-zinc-400 hover:text-rose-600 ml-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#667085] italic py-1">
                  Toca cualquier producto arriba para agregarlo a esta comanda.
                </p>
              )}

              {/* BIG DISPATCH CTA IN AMARILLO DIRECTAURANTE */}
              <button
                disabled={stagedItems.length === 0 || isSendingComanda}
                onClick={handleSendComanda}
                className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition shadow-md active:scale-98 ${
                  stagedItems.length > 0 && !isSendingComanda
                    ? 'bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] cursor-pointer'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4 text-[#101828]" />
                <span>
                  {isSendingComanda
                    ? 'Enviando comanda a cocina/barra...'
                    : `Enviar Comanda a Producción (${stagedItems.length} ítems • $${(stagedTotalCents / 100).toFixed(2)} MXN)`}
                </span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Product Customizer (Quantity, Modifiers, Notes) */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-zinc-200 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#05268F]">
                  Comensal: {currentSeat?.seat_number} - {currentSeat?.display_name}
                </span>
                <h3 className="text-xl font-black text-[#101828]">{customizingProduct.name}</h3>
                <p className="text-xs text-[#667085]">{customizingProduct.description}</p>
              </div>
              <button
                onClick={() => setCustomizingProduct(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between bg-[#F4F6F8] p-3 rounded-2xl border border-zinc-200">
              <span className="text-xs font-black uppercase text-[#101828]">Cantidad:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCustomQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-xl bg-white border border-zinc-300 font-black flex items-center justify-center text-[#101828] hover:bg-zinc-100 active:scale-95 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-black text-lg w-6 text-center">{customQuantity}</span>
                <button
                  onClick={() => setCustomQuantity((q) => q + 1)}
                  className="w-9 h-9 rounded-xl bg-white border border-zinc-300 font-black flex items-center justify-center text-[#101828] hover:bg-zinc-100 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modifiers selector */}
            {customizingProduct.available_modifiers && customizingProduct.available_modifiers.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-black uppercase text-[#101828]">Modificadores Rápidos:</span>
                <div className="flex flex-wrap gap-1.5">
                  {customizingProduct.available_modifiers.map((mod) => {
                    const isSelected = customModifiers.includes(mod);
                    return (
                      <button
                        key={mod}
                        onClick={() => {
                          if (isSelected) {
                            setCustomModifiers((prev) => prev.filter((m) => m !== mod));
                          } else {
                            setCustomModifiers((prev) => [...prev, mod]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#05268F] text-white border-[#05268F]'
                            : 'bg-white text-[#667085] border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        {mod}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Item Specific Notes */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-[#101828]">
                Nota especial de cocina / barra:
              </label>
              <input
                type="text"
                placeholder="Ej. Sin cebolla, poco picante, cortar a la mitad..."
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white font-medium outline-none focus:border-[#05268F]"
              />
            </div>

            {/* Add Action Button */}
            <button
              onClick={handleAddStagedItem}
              className="w-full py-3.5 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-sm shadow-md transition active:scale-98 cursor-pointer"
            >
              Agregar {customQuantity}x a Comanda (${((customizingProduct.price_cents * customQuantity) / 100).toFixed(2)} MXN)
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Deterministic Allergy Conflict Blocking & Audit Override */}
      {allergyConflictData && (
        <div className="fixed inset-0 z-50 bg-[#101828]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-rose-500 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-3 rounded-2xl bg-rose-100">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-rose-950">BLOQUEO DE SEGURIDAD ALIMENTARIA</h3>
                <p className="text-xs text-rose-700">Detección médica determinista de alergenos</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
              <p>
                El comensal <strong>{allergyConflictData.subaccount.seat_number} ({allergyConflictData.subaccount.display_name})</strong> tiene alergia diagnosticada a:
              </p>
              <div className="font-black text-rose-950">
                {allergyConflictData.conflicts.join(', ')}
              </div>
              <p>
                Y el platillo <strong>{allergyConflictData.product.name}</strong> contiene dichos ingredientes.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-zinc-100">
              <p className="text-xs font-bold text-[#101828]">
                Para anular esta advertencia bajo expresa responsabilidad del cliente:
              </p>
              <input
                type="text"
                placeholder="Nombre de quien autoriza (ej. Capitán Roberto)"
                value={overrideAuthorizedBy}
                onChange={(e) => setOverrideAuthorizedBy(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 font-semibold"
              />
              <input
                type="text"
                placeholder="Motivo (ej. Cliente solicitó expresamente sin cacahuate)"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setAllergyConflictData(null)}
                className="py-2.5 rounded-xl border border-zinc-300 font-bold text-xs text-[#101828] hover:bg-zinc-100 cursor-pointer"
              >
                Cancelar Platillo
              </button>
              <button
                onClick={handleAuthorizeAllergyOverride}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md cursor-pointer"
              >
                Autorizar con Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Quick Add Guest to Session */}
      {showAddGuestModal && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateGuest}
            className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-zinc-200"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[#101828]">Agregar Comensal a Mesa</h3>
              <button
                type="button"
                onClick={() => setShowAddGuestModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-black uppercase text-[#101828] block mb-1">
                Nombre del Comensal:
              </label>
              <input
                type="text"
                placeholder="Ej. Roberto, Sofía..."
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-sm font-semibold outline-none focus:border-[#05268F]"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase text-[#101828] block mb-1">
                Alergias o Restricciones (Opcional):
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {allergies.map((alg) => {
                  const isChecked = selectedAllergiesForNewGuest.includes(alg.id);
                  return (
                    <label
                      key={alg.id}
                      className="flex items-center gap-2 p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAllergiesForNewGuest((prev) => [...prev, alg.id]);
                          } else {
                            setSelectedAllergiesForNewGuest((prev) =>
                              prev.filter((id) => id !== alg.id)
                            );
                          }
                        }}
                        className="rounded text-[#05268F]"
                      />
                      <span className="font-semibold text-[#101828]">{alg.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={!newGuestName.trim()}
              className="w-full py-3 rounded-xl bg-[#05268F] text-white font-black text-sm shadow transition disabled:opacity-50 cursor-pointer"
            >
              Confirmar Comensal
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
