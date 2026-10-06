import React from 'react';
import { usePos } from '../../context/PosContext';
import { NavigationTarget } from './Sidebar';
import {
  Menu,
  Bell,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';

interface TopBarProps {
  currentTarget: NavigationTarget;
  onToggleMobileSidebar: () => void;
  onOpenComandero: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTarget,
  onToggleMobileSidebar,
}) => {
  const {
    readyNotifications,
    markItemDelivered,
    dismissReadyNotification,
    loadCanonicalScenario,
    loading,
  } = usePos();

  const getBreadcrumb = () => {
    switch (currentTarget) {
      case 'dashboard':
        return { section: 'Operación', title: 'Resumen Operativo' };
      case 'tables':
        return { section: 'Operación', title: 'Mesas y Salón' };
      case 'comandero':
        return { section: 'Operación', title: 'Comandero Táctil' };
      case 'kds':
        return { section: 'Operación', title: 'Cocina / KDS' };
      case 'cash':
        return { section: 'Operación', title: 'Caja y Turnos' };
      case 'print':
        return { section: 'Operación', title: 'Impresión y Tickets' };
      case 'inventory':
        return { section: 'Administración', title: 'Inventario y Stock' };
      case 'recipes':
        return { section: 'Administración', title: 'Recetas y Costeo' };
      case 'purchases':
        return { section: 'Administración', title: 'Compras y Proveedores' };
      case 'production':
        return { section: 'Administración', title: 'Producción y Mermas' };
      case 'finance':
        return { section: 'Administración', title: 'Finanzas y Gastos' };
      case 'reports':
        return { section: 'Administración', title: 'Reportes de Venta' };
      case 'customers':
        return { section: 'Clientes', title: 'Directorio de Clientes' };
      case 'loyalty':
        return { section: 'Clientes', title: 'Programa Loyalty' };
      case 'promotions':
        return { section: 'Clientes', title: 'Promociones y Descuentos' };
      case 'staff':
        return { section: 'Personal', title: 'Staff y Meseros' };
      case 'roles':
        return { section: 'Personal', title: 'Roles y Permisos' };
      case 'solutions':
        return { section: 'Configuración', title: 'Centro de Soluciones' };
      case 'import':
        return { section: 'Configuración', title: 'DirectImport (Migración)' };
      case 'printers_config':
        return { section: 'Configuración', title: 'Impresoras de Red' };
      case 'payment_methods':
        return { section: 'Configuración', title: 'Métodos de Pago' };
      case 'settings':
        return { section: 'Configuración', title: 'Parámetros del Restaurante' };
      case 'audit':
        return { section: 'Configuración', title: 'Pista de Auditoría' };
      default:
        return { section: 'Operación', title: 'Directaurante POS' };
    }
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-xs">
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Mobile hamburger & breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 rounded-xl text-[#667085] hover:text-[#101828] hover:bg-[#F4F6F8] lg:hidden cursor-pointer"
            aria-label="Abrir Menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-[#667085] font-semibold">
              <span>{breadcrumb.section}</span>
              <span>/</span>
              <span className="text-[#05268F] font-bold">{breadcrumb.title}</span>
            </div>
            <h1 className="text-lg font-black text-[#101828] tracking-tight leading-tight">
              {breadcrumb.title}
            </h1>
          </div>
        </div>

        {/* Right: Focused actions (Canonical Scenario test trigger, Ready alert) */}
        <div className="flex items-center gap-2">
          {/* Canonical Test Trigger */}
          <button
            onClick={() => loadCanonicalScenario()}
            disabled={loading}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
            title="Cargar caso canónico (Mesa 1 con 4 comensales)"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#101828]" />
            <span>Caso Canónico</span>
          </button>

          {/* Ready Alerts notification button */}
          <div className="relative">
            <button
              className="p-2 rounded-xl border border-zinc-200 hover:bg-[#F4F6F8] text-[#101828] transition relative cursor-pointer"
              title="Notificaciones de platillos listos para entrega"
            >
              <Bell className="w-4 h-4 text-[#05268F]" />
              {readyNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full ring-2 ring-white animate-bounce">
                  {readyNotifications.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Ready Alert notification banner if any item is ready in KDS */}
      {readyNotifications.length > 0 && (
        <div className="bg-emerald-600 text-white px-4 py-2 border-t border-emerald-700 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <strong className="tracking-wide">
              {readyNotifications.length} platillo(s) listos para servir:
            </strong>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {readyNotifications.map((notif) => (
              <div
                key={notif.item_id}
                className="flex items-center gap-2 px-2.5 py-1 bg-white text-[#101828] rounded-xl text-xs font-bold shrink-0 shadow-xs"
              >
                <span>
                  {notif.table_number} • {notif.seat_number} ({notif.guest_name}):{' '}
                  <strong className="text-[#05268F]">{notif.product_name}</strong>
                </span>
                <button
                  onClick={() => markItemDelivered(notif.item_id, 'Mesero')}
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
      )}
    </header>
  );
};
