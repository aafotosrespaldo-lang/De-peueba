import React, { useState, useEffect, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import { KdsItemView, KdsTicketView, KdsStation } from '../../core/types';
import {
  ChefHat,
  Wine,
  Flame,
  Cake,
  ClipboardCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Check,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Settings,
  Layers,
  ListFilter,
  BarChart2,
  X,
  Sparkles,
} from 'lucide-react';

interface KdsViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KdsView: React.FC<KdsViewProps> = ({ isOpen, onClose }) => {
  const {
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
    updateItemStatus,
    playKitchenChime,
  } = usePos();

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Live timer tick every 1 second for precise restaurant timers
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Periodic poll every 5 seconds to keep synchronized with POS and other stations
  useEffect(() => {
    if (!isOpen) return;
    fetchKds(kdsStationFilter, kdsShowHistory);
    const poller = setInterval(() => {
      fetchKds(kdsStationFilter, kdsShowHistory);
    }, 5000);
    return () => clearInterval(poller);
  }, [isOpen, kdsStationFilter, kdsShowHistory, fetchKds]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  if (!isOpen) return null;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Station definitions with distinct icon & colors
  const stations: Array<{ id: string; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'Todas las Estaciones', icon: <Layers className="w-4 h-4" /> },
    { id: 'kitchen', label: 'Cocina Caliente', icon: <ChefHat className="w-4 h-4" /> },
    { id: 'bar', label: 'Barra & Bebidas', icon: <Wine className="w-4 h-4" /> },
    { id: 'grill', label: 'Parrilla & Asador', icon: <Flame className="w-4 h-4" /> },
    { id: 'desserts', label: 'Postres & Dulce', icon: <Cake className="w-4 h-4" /> },
    { id: 'expediter', label: 'Despacho & Pase', icon: <ClipboardCheck className="w-4 h-4" /> },
  ];

  // Global counts for KPI counters
  const activeTicketsList = kdsTickets.filter((t) => t.status !== 'delivered');
  const countPending = activeTicketsList.filter((t) => t.status === 'pending').length;
  const countPreparing = activeTicketsList.filter((t) => t.status === 'preparing').length;
  const countReady = activeTicketsList.filter((t) => t.status === 'ready').length;
  const countOverdue = activeTicketsList.filter((t) => t.is_overdue).length;

  // Handlers for Ticket Actions
  const handleTicketAction = async (ticket: KdsTicketView) => {
    setActionLoadingId(ticket.id);
    try {
      if (kdsShowHistory) {
        await recallTicket(ticket.order_id, ticket.destination_station);
      } else if (ticket.status === 'pending') {
        await startPreparingTicket(ticket.order_id, ticket.destination_station);
      } else if (ticket.status === 'preparing') {
        await markTicketReady(ticket.order_id, ticket.destination_station);
      } else if (ticket.status === 'ready') {
        await deliverTicket(ticket.order_id, ticket.destination_station);
      }
    } catch (e: any) {
      console.error('Error handling ticket action:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler for Item Check / Toggle
  const handleItemToggle = async (item: KdsItemView) => {
    setActionLoadingId(item.id);
    try {
      if (kdsShowHistory) {
        await recallItem(item.id);
      } else if (item.preparation_status === 'pending') {
        await updateItemStatus(item.id, 'preparing', 'Iniciado individualmente');
      } else if (item.preparation_status === 'preparing') {
        await updateItemStatus(item.id, 'ready', 'Listo individualmente');
      } else if (item.preparation_status === 'ready') {
        await updateItemStatus(item.id, 'delivered', 'Entregado');
      }
    } catch (e: any) {
      console.error('Error updating item:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F19] text-white flex flex-col overflow-hidden select-none font-sans">
      {/* 1. TOP HEADER: OPERATIONAL BAR IN DIRECTAURANTE BLUE */}
      <header className="bg-[#05268F] border-b border-[#041E72] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg z-10 shrink-0">
        {/* Brand & Active Station Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFD318] text-[#05268F] flex items-center justify-center font-black shadow-md">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white uppercase">
                DIRECTAURANTE KDS
              </h1>
              <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded bg-[#041E72] text-[#FFD318] border border-[#FFD318]/30">
                {stations.find((s) => s.id === kdsStationFilter)?.label || 'Estación'}
              </span>
            </div>
            <p className="text-xs text-white/80 font-medium">
              Control de producción multiescalón en tiempo real · Flujo táctil de alta velocidad
            </p>
          </div>
        </div>

        {/* Live Counters (SLA Semaphores) */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041E72] border border-white/10 font-bold text-zinc-200">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
            <span>Pendientes:</span>
            <strong className="text-white text-sm">{countPending}</strong>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041E72] border border-white/10 font-bold text-blue-200">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>En Preparación:</span>
            <strong className="text-cyan-300 text-sm">{countPreparing}</strong>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#041E72] border border-white/10 font-bold text-emerald-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Listos:</span>
            <strong className="text-emerald-300 text-sm">{countReady}</strong>
          </div>

          {countOverdue > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/30 border border-rose-500 font-black text-rose-200 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Retrasadas:</span>
              <strong className="text-white text-sm">{countOverdue}</strong>
            </div>
          )}
        </div>

        {/* Top Tools: Sound, Fullscreen, Refresh, Settings, Close */}
        <div className="flex items-center gap-2">
          {/* Audio Chime Toggle */}
          <button
            onClick={() => {
              const next = !kdsSettings.sound_alerts;
              updateKdsSettings({ sound_alerts: next });
              if (next) playKitchenChime();
            }}
            className={`p-2.5 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
              kdsSettings.sound_alerts
                ? 'bg-[#FFD318] text-[#101828] hover:bg-[#F0C40F]'
                : 'bg-[#041E72] text-zinc-400 hover:text-white'
            }`}
            title={kdsSettings.sound_alerts ? 'Sonido activado (clic para silenciar)' : 'Sonido silenciado'}
          >
            {kdsSettings.sound_alerts ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{kdsSettings.sound_alerts ? 'Timbre On' : 'Silencio'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-[#041E72] hover:bg-[#031758] text-white transition cursor-pointer"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa de cocina'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchKds(kdsStationFilter, kdsShowHistory)}
            className="p-2.5 rounded-xl bg-[#041E72] hover:bg-[#031758] text-white transition cursor-pointer"
            title="Refrescar órdenes ahora"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Settings Modal Toggle */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-xl bg-[#041E72] hover:bg-[#031758] text-white transition cursor-pointer"
            title="Configuración de estación"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Close KDS */}
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-[#041E72] hover:bg-rose-700 text-white transition cursor-pointer ml-1"
            title="Salir del KDS"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. SECONDARY CONTROLS BAR: STATIONS & VIEW MODES */}
      <div className="bg-[#101828] border-b border-zinc-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Large Touch Station Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {stations.map((s) => {
            const isSelected = kdsStationFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setKdsStationFilter(s.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer shrink-0 min-h-[42px] ${
                  isSelected
                    ? 'bg-[#FFD318] text-[#101828] shadow-md ring-2 ring-[#FFD318]/50'
                    : 'bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700'
                }`}
              >
                {s.icon}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* View Mode Selectors & History Switch */}
        <div className="flex items-center gap-2">
          {/* Active Queue vs Despachadas / Recall */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setKdsShowHistory(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                !kdsShowHistory ? 'bg-[#05268F] text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              En Marcha ({kdsTickets.filter((t) => t.status !== 'delivered').length})
            </button>
            <button
              onClick={() => setKdsShowHistory(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                kdsShowHistory ? 'bg-amber-500 text-black shadow-xs font-black' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Despachadas / Recall</span>
            </button>
          </div>

          {/* View Modes */}
          <div className="hidden sm:flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setKdsViewMode('tickets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                kdsViewMode === 'tickets' ? 'bg-[#05268F] text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Vista de comanda agrupada estándar"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Comandas</span>
            </button>
            <button
              onClick={() => setKdsViewMode('items')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                kdsViewMode === 'items' ? 'bg-[#05268F] text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Vista rápida ítem por ítem"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Por Platillo</span>
            </button>
            <button
              onClick={() => setKdsViewMode('summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                kdsViewMode === 'summary' ? 'bg-[#05268F] text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Resumen acumulado de producción para la plancha/freidora"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Resumen Prep</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. MAIN KDS BODY */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0B0F19]">
        {/* MODE A: COMANDAS / TICKETS VIEW (DEFAULT & STANDARD) */}
        {kdsViewMode === 'tickets' && (
          <div>
            {kdsTickets.length === 0 ? (
              <div className="h-96 flex flex-col items-center justify-center text-center text-zinc-500">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-zinc-600">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-zinc-300">
                  {kdsShowHistory ? 'Sin comandas en historial reciente' : '¡Línea de producción despejada!'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  {kdsShowHistory
                    ? 'No hay comandas finalizadas en los últimos 30 minutos.'
                    : 'No hay pedidos en cola en esta estación. Las órdenes enviadas desde el POS o comandero entrarán automáticamente aquí.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {kdsTickets.map((ticket) => {
                  const isOverdue = ticket.is_overdue;
                  const isReady = ticket.status === 'ready';
                  const isPreparing = ticket.status === 'preparing';
                  const isDelivered = ticket.status === 'delivered';

                  // Dynamic color styles based on urgency
                  let cardBorder = 'border-zinc-800';
                  let headerBg = 'bg-zinc-900';
                  let timerColor = 'text-zinc-300';

                  if (isOverdue) {
                    cardBorder = 'border-rose-500 ring-2 ring-rose-500/50';
                    headerBg = 'bg-rose-950/80';
                    timerColor = 'text-rose-400 font-black animate-pulse';
                  } else if (isReady) {
                    cardBorder = 'border-emerald-500 ring-2 ring-emerald-500/30';
                    headerBg = 'bg-emerald-950/70';
                    timerColor = 'text-emerald-300 font-black';
                  } else if (isPreparing) {
                    cardBorder = 'border-[#05268F] ring-1 ring-[#05268F]';
                    headerBg = 'bg-[#041E72]/80';
                    timerColor = 'text-cyan-300 font-black';
                  }

                  return (
                    <div
                      key={ticket.id}
                      className={`rounded-2xl border ${cardBorder} bg-[#121826] flex flex-col justify-between overflow-hidden shadow-xl transition-all duration-150`}
                    >
                      {/* Ticket Header */}
                      <div className={`${headerBg} p-3.5 border-b border-zinc-800/80`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {/* Large Table Number */}
                            <div className="flex items-center gap-2">
                              <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                {ticket.table_number}
                              </span>
                              <span className="text-xs font-mono font-bold text-[#FFD318] bg-black/40 px-2 py-0.5 rounded">
                                #{ticket.order_number}
                              </span>
                            </div>

                            {/* Diners list preview if available */}
                            {ticket.diner_subaccounts.length > 0 && (
                              <div className="text-xs font-bold text-zinc-300 mt-1 flex flex-wrap gap-1 items-center">
                                <span>Comensales:</span>
                                {ticket.diner_subaccounts.map((d, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] text-zinc-200 border border-zinc-700"
                                  >
                                    {d.seat_number} {d.guest_name ? `(${d.guest_name})` : ''}
                                  </span>
                                ))}
                              </div>
                            )}

                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {ticket.ticket_number} · {ticket.server_name}
                            </p>
                          </div>

                          {/* Live Clock Timer */}
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1 font-mono text-base font-black">
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              <span className={timerColor}>{formatElapsed(ticket.elapsed_seconds)}</span>
                            </div>
                            <span
                              className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full mt-1 ${
                                isOverdue
                                  ? 'bg-rose-500 text-white'
                                  : isReady
                                  ? 'bg-emerald-500 text-black'
                                  : isPreparing
                                  ? 'bg-cyan-500 text-black'
                                  : 'bg-zinc-700 text-zinc-300'
                              }`}
                            >
                              {isOverdue ? 'RETRASADA' : ticket.status_label}
                            </span>
                          </div>
                        </div>

                        {/* Station Tag if in multi-view */}
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-black/30 font-bold text-zinc-300">
                            Estación: {ticket.station_label}
                          </span>
                          {ticket.has_allergies && (
                            <span className="flex items-center gap-1 text-[11px] font-black text-rose-300 bg-rose-950 px-2 py-0.5 rounded border border-rose-500 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              <span>ALERGIA: {ticket.all_allergies.join(', ')}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ticket Items List */}
                      <div className="p-3.5 space-y-2.5 flex-1 divide-y divide-zinc-800/60 overflow-y-auto max-h-72">
                        {ticket.items.map((item) => {
                          const itemDone =
                            item.preparation_status === 'ready' || item.preparation_status === 'delivered';
                          const itemPreparing = item.preparation_status === 'preparing';

                          return (
                            <div
                              key={item.id}
                              onClick={() => handleItemToggle(item)}
                              className={`pt-2.5 first:pt-0 cursor-pointer group transition p-2 rounded-xl ${
                                itemDone
                                  ? 'bg-emerald-950/20 text-zinc-500 line-through'
                                  : itemPreparing
                                  ? 'bg-blue-950/30'
                                  : 'hover:bg-zinc-800/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                  <button
                                    type="button"
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border transition ${
                                      itemDone
                                        ? 'bg-emerald-500 border-emerald-400 text-black'
                                        : itemPreparing
                                        ? 'bg-[#05268F] border-cyan-400 text-white'
                                        : 'bg-zinc-800 border-zinc-700 text-transparent group-hover:border-zinc-500'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <div>
                                    <div className="text-sm font-black text-white group-hover:text-[#FFD318] transition flex items-center gap-1.5">
                                      <span className="text-[#FFD318] text-base">{item.quantity}×</span>
                                      <span className={itemDone ? 'line-through text-zinc-500' : ''}>
                                        {item.product_name}
                                      </span>
                                    </div>

                                    {/* Comensal tag per item */}
                                    {item.seat_number && (
                                      <div className="text-[11px] font-bold text-zinc-400 mt-0.5">
                                        Comensal {item.seat_number}{' '}
                                        {item.guest_name ? `· ${item.guest_name}` : ''}
                                      </div>
                                    )}

                                    {/* Modifiers */}
                                    {item.modifiers && item.modifiers.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {item.modifiers.map((mod, mi) => (
                                          <span
                                            key={mi}
                                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-300 border border-cyan-800/40"
                                          >
                                            {mod}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {/* Notes */}
                                    {item.notes && (
                                      <p className="text-xs text-[#FFD318] font-semibold italic mt-1 bg-black/40 px-2 py-0.5 rounded inline-block">
                                        Nota: "{item.notes}"
                                      </p>
                                    )}

                                    {/* Item allergen warning */}
                                    {item.diner_allergies && item.diner_allergies.length > 0 && (
                                      <p className="text-[10px] text-rose-400 font-extrabold mt-1">
                                        ⚠️ Alergia comensal: {item.diner_allergies.join(', ')}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-black shrink-0 ${
                                    itemDone
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : itemPreparing
                                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {itemDone ? 'Listo' : itemPreparing ? 'Cocina' : 'Cola'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Ticket Footer Action Bar */}
                      <div className="p-3 bg-zinc-900/90 border-t border-zinc-800">
                        <button
                          disabled={actionLoadingId === ticket.id}
                          onClick={() => handleTicketAction(ticket)}
                          className={`w-full min-h-[46px] rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-md cursor-pointer ${
                            kdsShowHistory
                              ? 'bg-amber-500 hover:bg-amber-400 text-black'
                              : ticket.status === 'pending'
                              ? 'bg-[#05268F] hover:bg-[#041E72] text-white ring-2 ring-[#05268F]/40'
                              : ticket.status === 'preparing'
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-500/40'
                              : 'bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black'
                          }`}
                        >
                          {actionLoadingId === ticket.id ? (
                            <RotateCcw className="w-4 h-4 animate-spin" />
                          ) : kdsShowHistory ? (
                            <>
                              <RotateCcw className="w-4 h-4" />
                              <span>RECALL / RECUPERAR COMANDA</span>
                            </>
                          ) : ticket.status === 'pending' ? (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>PREPARAR COMANDA</span>
                            </>
                          ) : ticket.status === 'preparing' ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>MARCAR LISTO PARA SERVIR</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>DESPACHAR A MESA</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODE B: LINE COOK INDIVIDUAL ITEM VIEW */}
        {kdsViewMode === 'items' && (
          <div>
            {kdsItems.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-zinc-500">
                <CheckCircle className="w-10 h-10 mb-2" />
                <p className="text-sm font-bold">No hay platillos pendientes en esta estación.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {kdsItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-4 border flex flex-col justify-between min-h-[220px] transition shadow-lg ${
                      item.is_overdue
                        ? 'bg-rose-950/60 border-rose-500 text-rose-100 ring-1 ring-rose-500'
                        : item.preparation_status === 'ready'
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/50'
                        : item.preparation_status === 'preparing'
                        ? 'bg-[#041E72]/40 border-[#05268F] text-blue-100 ring-1 ring-[#05268F]'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-black px-2 py-0.5 rounded bg-[#05268F] text-white">
                          {item.table_number}
                        </span>
                        <span className="text-xs font-bold text-zinc-300">
                          {item.seat_number} · {item.guest_name}
                        </span>
                      </div>
                      <div className="text-lg font-black text-white mt-1">
                        {item.quantity}× {item.product_name}
                      </div>
                      {item.notes && (
                        <p className="text-xs text-[#FFD318] italic mt-1">"{item.notes}"</p>
                      )}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <p className="text-[11px] text-cyan-300 mt-1 font-bold">
                          {item.modifiers.join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Transcurrido:</span>
                        <strong className={item.is_overdue ? 'text-rose-400 font-black' : 'text-zinc-200'}>
                          {formatElapsed(item.elapsed_seconds)}
                        </strong>
                      </div>
                      <button
                        onClick={() => handleItemToggle(item)}
                        className={`w-full py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          item.preparation_status === 'pending'
                            ? 'bg-[#05268F] hover:bg-[#041E72] text-white'
                            : item.preparation_status === 'preparing'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-[#FFD318] text-[#101828]'
                        }`}
                      >
                        {item.preparation_status === 'pending' && <span>Iniciar Preparación</span>}
                        {item.preparation_status === 'preparing' && <span>Marcar Listo</span>}
                        {item.preparation_status === 'ready' && <span>Entregar</span>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODE C: PREP SUMMARY / CONSOLIDATED PRODUCTION COUNTS */}
        {kdsViewMode === 'summary' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-[#FFD318]" />
                  <span>Resumen Acumulado de Producción (Línea de Fuego)</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Muestra cuántas unidades totales de cada platillo deben producirse en la estación activa.
                </p>
              </div>
              <span className="text-xs font-bold text-zinc-400 px-3 py-1 rounded bg-black/40">
                {kdsSummary.length} Platillos Distintos
              </span>
            </div>

            {kdsSummary.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">
                No hay productos en preparación en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {kdsSummary.map((item) => (
                  <div
                    key={item.product_id}
                    className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-sm font-black text-white">{item.product_name}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {item.preparing_qty} cocinando · {item.pending_qty} en cola
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-[#05268F] text-[#FFD318] flex items-center justify-center font-black text-xl shrink-0">
                      {item.total_active_qty}×
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. MODAL DE CONFIGURACIÓN SEPARADA (AJUSTES KDS) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#101828] border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#FFD318]" />
                <h3 className="text-lg font-black">Ajustes de Terminal KDS</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Estación por defecto para esta terminal */}
              <div>
                <label className="block font-bold text-zinc-300 mb-1">
                  Estación asignada a esta pantalla:
                </label>
                <select
                  value={kdsSettings.station_id}
                  onChange={(e) => {
                    updateKdsSettings({ station_id: e.target.value });
                    setKdsStationFilter(e.target.value);
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Fija qué estación atiende este monitor físico de cocina.
                </p>
              </div>

              {/* Tiempos SLA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-300 mb-1">
                    Aviso Amarillo (min):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={Math.round(kdsSettings.warning_threshold_seconds / 60)}
                    onChange={(e) =>
                      updateKdsSettings({
                        warning_threshold_seconds: Math.max(1, Number(e.target.value)) * 60,
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-300 mb-1">
                    Retraso Crítico (min):
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="90"
                    value={Math.round(kdsSettings.overdue_threshold_seconds / 60)}
                    onChange={(e) =>
                      updateKdsSettings({
                        overdue_threshold_seconds: Math.max(2, Number(e.target.value)) * 60,
                      })
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
              </div>

              {/* Sonido de timbre */}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">Timbre sonoro de nueva comanda</span>
                  <span className="text-[11px] text-zinc-400">
                    Emite campana de 2 tonos cuando entra un pedido nuevo.
                  </span>
                </div>
                <button
                  onClick={() => {
                    const next = !kdsSettings.sound_alerts;
                    updateKdsSettings({ sound_alerts: next });
                    if (next) playKitchenChime();
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                    kdsSettings.sound_alerts
                      ? 'bg-[#FFD318] text-[#101828]'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {kdsSettings.sound_alerts ? 'Activado' : 'Silenciado'}
                </button>
              </div>

              {/* Botón de prueba de sonido */}
              <button
                onClick={() => playKitchenChime()}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-[#FFD318]" />
                <span>Probar timbre de cocina</span>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-white font-black text-xs cursor-pointer"
              >
                Guardar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
