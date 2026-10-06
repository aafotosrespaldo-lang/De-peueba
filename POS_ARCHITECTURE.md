# DIRECTAURANTE - ARQUITECTURA DE DOMINIO Y MONOLITO MODULAR (POS CORE v0.1)

**Versión:** 0.1.0  
**Fecha:** 2026-10-04  
**Autor:** Senior Software Architect & POS Systems Engineer  

## 1. VISIÓN GENERAL Y PRINCIPIO ARQUITECTÓNICO

Directaurante evoluciona de ser una aplicación de entrega a convertirse en una **plataforma modular de soluciones para negocios gastronómicos**. El principio de diseño fundamental es el **Monolito Modular**:

> **"Un solo ecosistema de datos, una sola fuente financiera, capacidades activables bajo demanda."**

DirectGo (canal de venta y recepción de pedidos externos) y Directaurante POS (operación de salón, comensales y caja) operan sobre el mismo núcleo de datos: productos unificados, inventario compartido, auditoría financiera y eventos de dominio transversales.

```
DIRECTAURANTE CORE
├── Core Data Layer (MongoDB/BSON Schema Compatible)
│   ├── Restaurants & Branches (Multi-tenancy)
│   ├── Products, Ingredients & Allergies
│   ├── Tables & Guest Subaccounts (Identidad Operacional)
│   ├── Orders & OrderItems (Estados operativos)
│   ├── Payments & Financial Reconciliations
│   └── Immutable Audit Trail (Sin borrados físicos)
├── Domain Event Bus (In-Process Dispatcher)
│   ├── TABLE_OPENED / TABLE_CLOSED
│   ├── SUBACCOUNT_CREATED / SUBACCOUNT_UPDATED
│   ├── ORDER_CREATED / ORDER_ITEM_CREATED
│   ├── ORDER_ITEM_PREPARING / ORDER_ITEM_READY / ORDER_ITEM_DELIVERED
│   ├── PAYMENT_CREATED / SALE_CANCELLED
│   ├── SHIFT_OPENED / SHIFT_CLOSED / EXPENSE_CREATED
│   └── ALLERGY_WARNING_OVERRIDDEN
└── Plugin Architecture (Módulos Nativos Activables por Negocio)
    ├── POS (Mesas, subcuentas, cuentas individuales y globales) [Core]
    ├── KDS (Cocina y barra, semáforos, tiempos transcurridos) [Preparado]
    ├── Cash Control (Turnos, gastos, retiros, arqueo ciego) [Preparado]
    ├── DirectPrint (Enrutamiento ESC/POS de comandas y tickets) [Preparado]
    ├── DirectImport (Migración asistida desde SoftRestaurant, Toast, Square) [Preparado]
    └── Extensiones Futuras: Inventory, Costing, Loyalty, AI Assistant
```

## 2. EL CONCEPTO CLAVE: SUBCUENTAS POR COMENSAL

Una subcuenta (`GuestSubaccount`) **no es un simple split payment**. Es la **identidad operacional del comensal dentro de una mesa**.

### Modelo Conceptual
```
Mesa (Table) -> Sesión de Mesa (TableSession)
  ├── Subcuenta 1.1 - Carlos
  │     ├── Boneless BBQ (Platillo -> Cocina, $140.00)
  │     └── Cerveza (Bebida -> Barra, $45.00)
  ├── Subcuenta 1.2 - Ana (⚠️ Alergia: Cacahuate)
  │     └── Hamburguesa Clásica (Platillo -> Cocina, $150.00)
  ├── Subcuenta 1.3 - Luis
  │     ├── Burritos de Res x2 (Platillo -> Cocina, $220.00)
  │     └── Michelada Especial (Bebida -> Barra, $90.00)
  └── Subcuenta 1.4 - María
        └── Ensalada César (Platillo -> Cocina, $135.00)
```

Cada comensal puede tener:
- Identificador visual estructurado (`1.1`, `1.2`, `1.3`, `1.4`).
- Nombre de visualización (`Carlos`, `Ana`, `Luis`, `María`).
- Perfil de alergias vinculadas a ingredientes del catálogo.
- Notas específicas de servicio.
- Subtotal individual calculado en el backend.
- Pagos individuales asociados o participación en la cuenta global.

## 3. ESTADOS OPERATIVOS POR ITEM (KDS PREPARATION)

El estado operativo no reside únicamente en la cabecera de la orden. Cada `OrderItem` posee su propio ciclo de vida operacional:

```
[ PENDING ] ──(Iniciar)──> [ PREPARING ] ──(Listo)──> [ READY ] ──(Servir)──> [ DELIVERED ]
     │                           │                         │
     └───────────────────────────┴─────────────────────────┴────(Cancelar)──> [ CANCELLED ]
```

### Semáforo Operativo (Accesibilidad Total)
El KDS no depende exclusivamente de colores:
1. **PENDING:** Gris / Ícono Reloj / "En cola"
2. **PREPARING:** Azul / Ícono Fuego / "En preparación"
3. **READY:** Verde / Ícono Campana-Check / "¡Listo para servir!"
4. **OVERDUE (>15 min):** Rojo pulsante / Ícono Alerta / "Retrasado"
5. **DELIVERED:** Púrpura tenue / Ícono Check-Doble / "Entregado"

## 4. PREVENCIÓN DETERMINISTA DE ALERGIAS

**Regla de Seguridad:** Ningún modelo probabilístico o lógica de frontend decide silenciosamente si un platillo es apto para un comensal con alergias.

```
GuestSubaccount ──(has)──> Allergy ──(contains)──> Ingredient
                                                        │ (Intersección determinista)
OrderItem ──────(maps)──> Product ──(contains)──> Ingredient
```

Si existe intersección entre los `ingredient_ids` de la alergia y los del producto:
1. El backend arroja una excepción HTTP 409 con detalle médico de conflicto.
2. La interfaz POS interrumpe el flujo y muestra el diálogo modal de alerta crítica.
3. El mesero/encargado puede:
   - **Cancelar:** El comensal queda protegido.
   - **Autorizar con Pista de Auditoría:** Requiere confirmación expresa, emitiendo el evento `ALLERGY_WARNING_OVERRIDDEN` y guardando en `audit_logs` qué encargado autorizó la excepción.
