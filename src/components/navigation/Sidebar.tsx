import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Smartphone,
  ChefHat,
  DollarSign,
  Printer,
  ChevronDown,
  ChevronRight,
  Boxes,
  BookOpen,
  ShoppingBag,
  TrendingDown,
  BarChart3,
  Users,
  Award,
  Tag,
  UserCheck,
  Shield,
  Puzzle,
  UploadCloud,
  Settings,
  CreditCard,
  FileText,
  X,
} from 'lucide-react';

export type NavigationTarget =
  // Operación
  | 'dashboard'
  | 'tables'
  | 'comandero'
  | 'kds'
  | 'cash'
  | 'print'
  // Administración
  | 'inventory'
  | 'recipes'
  | 'purchases'
  | 'production'
  | 'finance'
  | 'reports'
  // Clientes
  | 'customers'
  | 'loyalty'
  | 'promotions'
  // Personal
  | 'staff'
  | 'roles'
  // Configuración
  | 'solutions'
  | 'import'
  | 'printers_config'
  | 'payment_methods'
  | 'settings'
  | 'audit';

interface SidebarProps {
  currentTarget: NavigationTarget;
  onNavigate: (target: NavigationTarget) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTarget,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { tables, kdsItems, cashData } = usePos();

  // Accordion state - Operación open by default
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    operacion: true,
    administracion: false,
    clientes: false,
    personal: false,
    configuracion: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const occupiedTablesCount = tables.filter(
    (t) => t.status === 'occupied' || t.status === 'bill_requested' || t.status === 'paying'
  ).length;
  const preparingKdsCount = kdsItems.filter((i) => i.preparation_status === 'preparing').length;
  const isCashOpen = cashData?.shift?.status === 'open';

  const handleItemClick = (target: NavigationTarget) => {
    onNavigate(target);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-[#101828]/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-zinc-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-[#05268F] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFD318] text-[#05268F] flex items-center justify-center font-black text-lg shadow-xs">
              D
            </div>
            <div>
              <span className="font-black text-sm tracking-tight text-white block leading-tight">
                DIRECTAURANTE
              </span>
              <span className="text-[10px] text-[#FFD318] font-bold block uppercase tracking-wider">
                POS Core v0.1
              </span>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-white/70 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Shift Status Strip */}
        <div className="px-4 py-2 bg-[#F4F6F8] border-b border-zinc-200 flex items-center justify-between text-[11px]">
          <span className="text-[#667085] font-semibold">Caja en Salón:</span>
          <span
            className={`font-black flex items-center gap-1.5 ${
              isCashOpen ? 'text-emerald-700' : 'text-zinc-500'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isCashOpen ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
              }`}
            />
            {isCashOpen ? 'Abierta' : 'Cerrada'}
          </span>
        </div>

        {/* Scrollable Navigation Sections */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
          {/* SECTION 1: OPERACIÓN (Primary Workhorse) */}
          <div className="border-b border-zinc-100 pb-2">
            <button
              onClick={() => toggleSection('operacion')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[#667085] hover:text-[#101828] font-black uppercase text-[10px] tracking-wider rounded-lg transition"
            >
              <span>Operación</span>
              {openSections.operacion ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openSections.operacion && (
              <div className="mt-1 space-y-0.5">
                <button
                  onClick={() => handleItemClick('dashboard')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'dashboard'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Resumen Operativo</span>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                      currentTarget === 'dashboard' ? 'bg-[#FFD318] text-[#101828]' : 'bg-zinc-100 text-[#667085]'
                    }`}
                  >
                    HOME
                  </span>
                </button>

                <button
                  onClick={() => handleItemClick('tables')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'tables'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4" />
                    <span>Mesas y Salón</span>
                  </div>
                  {occupiedTablesCount > 0 && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        currentTarget === 'tables' ? 'bg-[#FFD318] text-[#101828]' : 'bg-[#EAF0FF] text-[#05268F]'
                      }`}
                    >
                      {occupiedTablesCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleItemClick('comandero')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'comandero'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span>Comandero Táctil</span>
                  </div>
                  <span className="text-[10px] text-[#667085] font-normal">Mesero</span>
                </button>

                <button
                  onClick={() => handleItemClick('kds')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'kds'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ChefHat className="w-4 h-4" />
                    <span>Cocina / KDS</span>
                  </div>
                  {preparingKdsCount > 0 && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        currentTarget === 'kds' ? 'bg-[#FFD318] text-[#101828]' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {preparingKdsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleItemClick('cash')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'cash'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>Caja y Turnos</span>
                  </div>
                </button>

                <button
                  onClick={() => handleItemClick('print')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'print'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    <span>DirectPrint ESC/POS</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: ADMINISTRACIÓN (Accordion) */}
          <div className="border-b border-zinc-100 pb-2 pt-1">
            <button
              onClick={() => toggleSection('administracion')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[#667085] hover:text-[#101828] font-black uppercase text-[10px] tracking-wider rounded-lg transition"
            >
              <span>Administración</span>
              {openSections.administracion ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openSections.administracion && (
              <div className="mt-1 space-y-0.5">
                <button
                  onClick={() => handleItemClick('inventory')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'inventory'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                  <span>Inventario y Stock</span>
                </button>

                <button
                  onClick={() => handleItemClick('recipes')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'recipes'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Recetas y Costeo</span>
                </button>

                <button
                  onClick={() => handleItemClick('purchases')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'purchases'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Compras y Proveedores</span>
                </button>

                <button
                  onClick={() => handleItemClick('production')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'production'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>Producción y Mermas</span>
                </button>

                <button
                  onClick={() => handleItemClick('finance')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'finance'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Finanzas y Gastos</span>
                </button>

                <button
                  onClick={() => handleItemClick('reports')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'reports'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Reportes de Venta</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 3: CLIENTES (Accordion) */}
          <div className="border-b border-zinc-100 pb-2 pt-1">
            <button
              onClick={() => toggleSection('clientes')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[#667085] hover:text-[#101828] font-black uppercase text-[10px] tracking-wider rounded-lg transition"
            >
              <span>Clientes</span>
              {openSections.clientes ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openSections.clientes && (
              <div className="mt-1 space-y-0.5">
                <button
                  onClick={() => handleItemClick('customers')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'customers'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Directorio de Clientes</span>
                </button>

                <button
                  onClick={() => handleItemClick('loyalty')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'loyalty'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>Programa Loyalty</span>
                </button>

                <button
                  onClick={() => handleItemClick('promotions')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'promotions'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  <span>Promociones y Descuentos</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 4: PERSONAL (Accordion) */}
          <div className="border-b border-zinc-100 pb-2 pt-1">
            <button
              onClick={() => toggleSection('personal')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[#667085] hover:text-[#101828] font-black uppercase text-[10px] tracking-wider rounded-lg transition"
            >
              <span>Personal</span>
              {openSections.personal ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openSections.personal && (
              <div className="mt-1 space-y-0.5">
                <button
                  onClick={() => handleItemClick('staff')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'staff'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Staff y Meseros</span>
                </button>

                <button
                  onClick={() => handleItemClick('roles')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'roles'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Roles y Permisos</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 5: CONFIGURACIÓN (Accordion) */}
          <div className="pt-1">
            <button
              onClick={() => toggleSection('configuracion')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[#667085] hover:text-[#101828] font-black uppercase text-[10px] tracking-wider rounded-lg transition"
            >
              <span>Configuración</span>
              {openSections.configuracion ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {openSections.configuracion && (
              <div className="mt-1 space-y-0.5">
                <button
                  onClick={() => handleItemClick('solutions')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'solutions'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Puzzle className="w-4 h-4 text-[#05268F]" />
                    <span>Centro de Soluciones</span>
                  </div>
                  <span className="text-[10px] text-[#05268F] font-black bg-[#EAF0FF] px-1.5 py-0.5 rounded">
                    Módulos
                  </span>
                </button>

                <button
                  onClick={() => handleItemClick('import')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'import'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>DirectImport (Migración)</span>
                </button>

                <button
                  onClick={() => handleItemClick('printers_config')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'printers_config'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>Impresoras de Red</span>
                </button>

                <button
                  onClick={() => handleItemClick('payment_methods')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'payment_methods'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Métodos de Pago</span>
                </button>

                <button
                  onClick={() => handleItemClick('audit')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'audit'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Pista de Auditoría</span>
                </button>

                <button
                  onClick={() => handleItemClick('settings')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition text-left ${
                    currentTarget === 'settings'
                      ? 'bg-[#05268F] text-white shadow-xs'
                      : 'text-[#101828] hover:bg-[#F4F6F8]'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Parámetros del Restaurante</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Footer User Info */}
        <div className="p-3 border-t border-zinc-200 bg-[#F4F6F8] flex items-center justify-between text-xs">
          <div className="truncate">
            <span className="font-bold text-[#101828] block truncate">Carlos R. (Mesero)</span>
            <span className="text-[10px] text-[#667085] truncate block">Directaurante Grill & Bar</span>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" title="Online" />
        </div>
      </aside>
    </>
  );
};
