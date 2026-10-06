import React from 'react';
import { NavigationTarget } from '../navigation/Sidebar';
import {
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
  CreditCard,
  Settings,
  ArrowLeft,
  Sparkles,
  Download,
  Plus,
} from 'lucide-react';

interface ModulePlaceholderProps {
  target: NavigationTarget;
  onBackToDashboard: () => void;
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  target,
  onBackToDashboard,
}) => {
  const getModuleInfo = () => {
    switch (target) {
      case 'inventory':
        return {
          title: 'Inventario y Existencias',
          category: 'Administración',
          icon: Boxes,
          description: 'Control de stock por insumo, mermas y alertas de reabastecimiento.',
          stats: [
            { label: 'Insumos Monitoreados', value: '48 items' },
            { label: 'Stock Crítico', value: '2 alertas', alert: true },
            { label: 'Valoración en Almacén', value: '$34,800 MXN' },
          ],
        };
      case 'recipes':
        return {
          title: 'Recetas y Escandallos',
          category: 'Administración',
          icon: BookOpen,
          description: 'Fichas técnicas de platillos, costos por porción y márgenes brutos.',
          stats: [
            { label: 'Platillos con Receta', value: '9 platillos' },
            { label: 'Costo Promedio Alimentos', value: '28.4%' },
            { label: 'Margen Bruto Estimado', value: '71.6%' },
          ],
        };
      case 'purchases':
        return {
          title: 'Compras y Proveedores',
          category: 'Administración',
          icon: ShoppingBag,
          description: 'Recepción de mercancía, facturación de proveedores y precios históricos.',
          stats: [
            { label: 'Proveedores Activos', value: '12 empresas' },
            { label: 'Órdenes de Compra Mes', value: '24 órdenes' },
            { label: 'Gasto Mensual', value: '$84,500 MXN' },
          ],
        };
      case 'production':
        return {
          title: 'Producción y Mermas',
          category: 'Administración',
          icon: TrendingDown,
          description: 'Preparación de salsas base, porcionamiento de carnes y registro de desperdicios.',
          stats: [
            { label: 'Batch Activo', value: 'Salsa BBQ Ahumada' },
            { label: 'Merma Semanal', value: '1.8%' },
            { label: 'Rendimiento Promedio', value: '98.2%' },
          ],
        };
      case 'finance':
        return {
          title: 'Finanzas y Gastos',
          category: 'Administración',
          icon: BarChart3,
          description: 'Egresos de caja chica, gastos fijos y conciliación bancaria.',
          stats: [
            { label: 'Ingresos Turno', value: '$2,450.00 MXN' },
            { label: 'Gastos Menores Asentados', value: '$150.00 MXN' },
            { label: 'Efectivo Conciliado', value: '100% Cuadrado' },
          ],
        };
      case 'reports':
        return {
          title: 'Reportes de Ventas',
          category: 'Administración',
          icon: BarChart3,
          description: 'Ventas por hora, platillos más vendidos (Pareto) y ticket promedio por mesa.',
          stats: [
            { label: 'Ticket Promedio', value: '$250.85 MXN' },
            { label: 'Platillo Estrella', value: 'Boneless BBQ' },
            { label: 'Rotación de Mesas', value: '1.8 vueltas/turno' },
          ],
        };
      case 'customers':
        return {
          title: 'Directorio de Clientes (CRM)',
          category: 'Clientes',
          icon: Users,
          description: 'Historial de visitas, preferencias gastronómicas y perfiles de alergias.',
          stats: [
            { label: 'Clientes Registrados', value: '142 personas' },
            { label: 'Clientes Frecuentes', value: '38 personas' },
            { label: 'Preferencias Guardadas', value: '100%' },
          ],
        };
      case 'loyalty':
        return {
          title: 'Programa de Lealtad (Loyalty)',
          category: 'Clientes',
          icon: Award,
          description: 'Reglas de acumulación de puntos y canje de recompensas por consumo.',
          stats: [
            { label: 'Puntos Emitidos', value: '12,400 pts' },
            { label: 'Premios Canjeados', value: '18 recompensas' },
            { label: 'Tasa de Retención', value: '64%' },
          ],
        };
      case 'promotions':
        return {
          title: 'Promociones y Descuentos',
          category: 'Clientes',
          icon: Tag,
          description: 'Happy Hour en bebidas, cupones y descuentos automáticos por horario.',
          stats: [
            { label: 'Promociones Activas', value: 'Happy Hour Cerveza 2x1' },
            { label: 'Horario Aplicable', value: '17:00 - 20:00' },
            { label: 'Impacto en Ventas', value: '+22% volumen' },
          ],
        };
      case 'staff':
        return {
          title: 'Staff y Meseros',
          category: 'Personal',
          icon: UserCheck,
          description: 'Control de meseros en turno, propinas y desempeño operativo.',
          stats: [
            { label: 'Meseros en Turno', value: 'Carlos R., Sofia M.' },
            { label: 'Mesas Asignadas', value: 'Mesa 1 a 8' },
            { label: 'Tiempos Promedio Atención', value: '2.4 min' },
          ],
        };
      case 'roles':
        return {
          title: 'Roles y Permisos',
          category: 'Personal',
          icon: Shield,
          description: 'Permisos granulares: Mesero, Cajero, Cocinero, Encargado y Administrador.',
          stats: [
            { label: 'Roles Definidos', value: '5 roles' },
            { label: 'Usuarios Activos', value: '8 credenciales' },
            { label: 'Pista Inmutable', value: 'Activa' },
          ],
        };
      case 'payment_methods':
        return {
          title: 'Métodos de Pago y TPV',
          category: 'Configuración',
          icon: CreditCard,
          description: 'Terminales bancarias, cobro QR, efectivo y transferencias SPEI.',
          stats: [
            { label: 'Efectivo en Salón', value: 'Habilitado' },
            { label: 'Terminales TPV Integradas', value: '2 terminales' },
            { label: 'Comisión Promedio', value: '1.8%' },
          ],
        };
      case 'settings':
        return {
          title: 'Parámetros del Restaurante',
          category: 'Configuración',
          icon: Settings,
          description: 'Razón social, RFC, IVA (16%), moneda (MXN) y dirección de sucursal.',
          stats: [
            { label: 'Razón Social', value: 'Directaurante Operadora SAPI de CV' },
            { label: 'Moneda', value: 'MXN ($)' },
            { label: 'Tasa Impositiva', value: '16% IVA' },
          ],
        };
      default:
        return {
          title: 'Módulo Administrativo',
          category: 'Gestión',
          icon: Settings,
          description: 'Configuración de restaurante en el monolito modular.',
          stats: [],
        };
    }
  };

  const info = getModuleInfo();
  const Icon = info.icon;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2.5 rounded-2xl bg-[#F4F6F8] hover:bg-zinc-200 text-[#101828] transition cursor-pointer"
            title="Volver al Resumen Operativo"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#05268F]">
                {info.category}
              </span>
              <span className="text-xs text-[#667085]">• Segregado de Operación</span>
            </div>
            <h2 className="text-2xl font-black text-[#101828] tracking-tight">
              {info.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert(`Acción disponible para ${info.title}`)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#05268F] hover:bg-[#041E72] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Registro</span>
          </button>
          <button
            onClick={() => alert('Exportando datos...')}
            className="p-2 rounded-2xl border border-zinc-200 hover:bg-[#F4F6F8] text-[#101828] transition cursor-pointer"
            title="Exportar Reporte"
          >
            <Download className="w-4 h-4 text-[#667085]" />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {info.stats.map((s, idx) => (
          <div
            key={idx}
            className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex flex-col justify-between"
          >
            <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">
              {s.label}
            </span>
            <div
              className={`text-2xl font-black mt-2 ${
                s.alert ? 'text-rose-600' : 'text-[#101828]'
              }`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Description & Information Card */}
      <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#EAF0FF] text-[#05268F]">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#101828]">
              Arquitectura de Gestión: {info.title}
            </h3>
            <p className="text-xs text-[#667085]">{info.description}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#F4F6F8] border border-zinc-200 text-xs text-[#101828] space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#05268F]">
            <Sparkles className="w-4 h-4" />
            <span>Principio Arquitectónico: "Management Second"</span>
          </div>
          <p className="text-[#667085] leading-relaxed">
            Esta área administrativa está diseñada para gerentes y contadores. Opera de forma
            desacoplada del flujo de alta velocidad del mesero en salón, compartiendo el mismo
            núcleo de datos y transacciones financieras.
          </p>
        </div>
      </div>
    </div>
  );
};
