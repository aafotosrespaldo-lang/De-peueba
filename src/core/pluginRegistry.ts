/**
 * DIRECTAURANTE POS CORE v0.1 - Plugin Registry & Tenant Activation
 * Controls modular capabilities per restaurant.
 */

import { db, DEFAULT_RESTAURANT_ID } from './database';
import { PluginDefinition, RestaurantPluginConfig } from './types';
import { eventBus } from './eventBus';
import { AuditService } from './audit';

export const CORE_PLUGINS: PluginDefinition[] = [
  {
    id: 'pos',
    name: 'Directaurante POS',
    version: '0.1.0',
    description: 'Gestión operativa de mesas, comensales, pedidos y cobro rápido.',
    isCore: true,
    category: 'operations',
    icon: 'UtensilsCrossed',
    defaultEnabled: true,
    capabilities: ['tables', 'subaccounts', 'fast_order', 'split_bill', 'global_bill'],
  },
  {
    id: 'kds',
    name: 'Kitchen Display System (KDS)',
    version: '0.1.0',
    description: 'Pantalla de producción para cocina y barra con semáforos y tiempos.',
    isCore: false,
    category: 'kitchen',
    icon: 'ChefHat',
    defaultEnabled: true,
    capabilities: ['kitchen_view', 'bar_view', 'elapsed_timers', 'status_transitions'],
  },
  {
    id: 'cash',
    name: 'Caja y Turnos (Cash Control)',
    version: '0.1.0',
    description: 'Apertura de turno, fondo inicial, control de efectivo, gastos y arqueo.',
    isCore: false,
    category: 'finance',
    icon: 'DollarSign',
    defaultEnabled: true,
    capabilities: ['shifts', 'movements', 'cash_closure', 'audit_reconciliation'],
  },
  {
    id: 'directprint',
    name: 'DirectPrint (ESC/POS)',
    version: '0.1.0',
    description: 'Enrutamiento de comandas a impresoras térmicas de cocina, barra y caja.',
    isCore: false,
    category: 'hardware',
    icon: 'Printer',
    defaultEnabled: true,
    capabilities: ['esc_pos_generator', 'station_routing', 'hardware_status'],
  },
  {
    id: 'directimport',
    name: 'DirectImport (Migración POS)',
    version: '0.1.0',
    description: 'Asistente de migración desde SoftRestaurant, Toast, Square y hojas de cálculo.',
    isCore: false,
    category: 'migration',
    icon: 'UploadCloud',
    defaultEnabled: true,
    capabilities: ['csv_excel_parse', 'schema_mapping', 'issue_preview', 'revert_snapshot'],
  },
  {
    id: 'inventory',
    name: 'Control de Inventario y Existencias',
    version: '0.1.0',
    description: 'Control de stock físico, entradas, salidas, mermas, kárdex y conteos.',
    isCore: false,
    category: 'operations',
    icon: 'Boxes',
    defaultEnabled: true,
    capabilities: ['stock_deduction', 'physical_counts', 'low_stock_alerts', 'kardex_audit'],
  },
  {
    id: 'recipes',
    name: 'Recetas, Escandallos y Costeo (COGS)',
    version: '0.1.0',
    description: 'Fichas técnicas estandarizadas, consumo de insumos por venta, cálculo de COGS y márgenes brutos.',
    isCore: false,
    category: 'operations',
    icon: 'BookOpen',
    defaultEnabled: true,
    capabilities: ['recipe_bom', 'cogs_calculation', 'ingredient_consumption', 'waste_tracking', 'historical_costing'],
  },
  {
    id: 'purchases',
    name: 'Compras y Proveedores',
    version: '0.1.0',
    description: 'Órdenes de compra, recepción de mercancía, entradas al Kárdex de F6, costos y proveedores.',
    isCore: false,
    category: 'operations',
    icon: 'ShoppingBag',
    defaultEnabled: true,
    capabilities: ['purchase_orders', 'supplier_management', 'receiving_kardex', 'price_history', 'cost_valuation'],
  },
  {
    id: 'loyalty',
    name: 'Programa de Lealtad y Clientes',
    version: '0.1.0',
    description: 'Acumulación de puntos por comensal y promociones personalizadas.',
    isCore: false,
    category: 'operations',
    icon: 'Award',
    defaultEnabled: false,
    capabilities: ['customer_profiles', 'points_accrual', 'rewards'],
  },
  {
    id: 'ai',
    name: 'Asistente Inteligente de Turno',
    version: '0.1.0',
    description: 'Predicción de demanda y resúmenes de turno asistidos por IA.',
    isCore: false,
    category: 'intelligence',
    icon: 'Sparkles',
    defaultEnabled: false,
    capabilities: ['turn_forecast', 'shift_summary'],
  },
];

export class PluginRegistry {
  public static getAllAvailable(): PluginDefinition[] {
    return CORE_PLUGINS;
  }

  public static getRestaurantPlugins(restaurant_id: string = DEFAULT_RESTAURANT_ID): Array<PluginDefinition & { enabled: boolean; settings: Record<string, any> }> {
    const configs = db.get('restaurant_plugins').filter((c) => c.restaurant_id === restaurant_id);
    return CORE_PLUGINS.map((plugin) => {
      const config = configs.find((c) => c.plugin_id === plugin.id);
      return {
        ...plugin,
        enabled: config ? config.enabled : plugin.defaultEnabled,
        settings: config ? config.settings : {},
      };
    });
  }

  public static isPluginEnabled(plugin_id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): boolean {
    const config = db.get('restaurant_plugins').find((c) => c.restaurant_id === restaurant_id && c.plugin_id === plugin_id);
    if (config) {
      return config.enabled;
    }
    const def = CORE_PLUGINS.find((p) => p.id === plugin_id);
    return def ? def.defaultEnabled : false;
  }

  public static togglePlugin(
    plugin_id: string,
    enabled: boolean,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Administrador'
  ): RestaurantPluginConfig {
    const configs = db.get('restaurant_plugins');
    let config = configs.find((c) => c.restaurant_id === restaurant_id && c.plugin_id === plugin_id);
    const prevEnabled = config ? config.enabled : false;

    if (!config) {
      config = {
        restaurant_id,
        plugin_id,
        enabled,
        version: '0.1.0',
        settings: {},
        updated_at: new Date().toISOString(),
      };
      configs.push(config);
    } else {
      config.enabled = enabled;
      config.updated_at = new Date().toISOString();
    }

    db.save();

    AuditService.log(
      'plugin_toggled',
      'plugin',
      plugin_id,
      actor,
      { enabled: prevEnabled },
      { enabled },
      `Plugin ${plugin_id} ${enabled ? 'habilitado' : 'deshabilitado'}`,
      restaurant_id
    );

    eventBus.publish('PLUGIN_TOGGLED', restaurant_id, actor, {
      plugin_id,
      enabled,
    });

    return config;
  }
}
