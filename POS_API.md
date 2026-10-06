# DIRECTAURANTE POS CORE v0.1 - ESPECIFICACIÓN DE API REST

**Servidor Base:** `/api`  
**Convención:** JSON REST, Códigos de estado HTTP estándar, montado en Express full-stack.

## 1. ENDPOINTS DE PLUGINS Y SISTEMA

### `GET /api/health`
Verificación de estado del servidor.
- **Respuesta 200 OK:**
  ```json
  {
    "status": "ok",
    "module": "Directaurante POS Core",
    "version": "0.1.0",
    "timestamp": "2026-10-04T10:00:00.000Z"
  }
  ```

### `GET /api/plugins`
Lista todos los plugins disponibles y su estado de activación para el restaurante.

### `POST /api/plugins/:id/toggle`
Habilita o deshabilita un módulo para el negocio.
- **Body:** `{ "enabled": boolean, "actor": string }`
- **Respuesta 200 OK:** `{ "success": true, "plugin": { ... } }`

## 2. ENDPOINTS DE MESAS Y SUBCUENTAS (POS)

### `GET /api/pos/tables`
Obtiene la lista de mesas del restaurante con métricas operacionales consolidadas.

### `GET /api/pos/tables/:id`
Detalle completo de la mesa, comensales (subcuentas), órdenes activas e items.

### `POST /api/pos/tables/:id/open`
Abre una mesa e inicializa las subcuentas operacionales automáticas (1.1, 1.2, etc.).

### `POST /api/pos/tables/:id/seats`
Añade una subcuenta de comensal adicional (`1.5`, etc.).

### `POST /api/pos/tables/:id/tickets`
Apertura una nueva comanda (`Comanda #002`, `#003`) vinculada a la misma sesión.

## 3. ENDPOINTS DE PRODUCTOS, ITEMS Y ALERGIAS

### `GET /api/pos/products?category=Platillos`
Catálogo de productos con ingredientes y estación asignada (`kitchen` o `bar`).

### `POST /api/pos/allergies/check`
Verificación previa determinista de alergias.

### `POST /api/pos/tables/:id/items`
Asigna un producto ordenado estrictamente a una subcuenta. Retorna 409 si hay choque de alergia sin override.

### `PATCH /api/pos/items/:itemId/status`
Transición de estado operativo del item con registro de auditoría (`pending` -> `preparing` -> `ready` -> `delivered`).

## 4. ENDPOINTS DE CUENTAS, PAGOS Y CIERRE

### `GET /api/pos/tables/:id/bill`
Cálculo de la cuenta global de la mesa y desglose individual por comensal.

### `POST /api/pos/tables/:id/pay`
Registra un pago para toda la mesa o para una subcuenta individual vía `cash`, `card` o `transfer`.

### `POST /api/pos/tables/:id/close`
Cierra la sesión de servicio y libera la mesa (valida saldo en cero).

## 5. KDS, CAJA, AUDITORÍA, PRINT E IMPORT
- `GET /api/pos/kds?station=kitchen` (Items activos, semáforos, timers)
- `GET /api/cash/current` (Turno activo, ventas, movimientos)
- `POST /api/cash/open` (Apertura de caja con fondo inicial)
- `POST /api/cash/movement` (Gastos, retiros, aportes)
- `POST /api/cash/close` (Arqueo y cierre de caja)
- `GET /api/audit/logs` (Pista inmutable de auditoría)
- `POST /api/print/ticket-preview` (Generador ESC/POS)
- `POST /api/import/preview` & `POST /api/import/execute` (Migración de catálogo)
- `POST /api/pos/load-canonical-scenario` (Carga del caso canónico Mesa 1 con 4 comensales)

## 6. INVENTARIO & RECETAS (CORE F6 & F7)
- `GET /api/inventory/items` (Catálogo físico de almacén)
- `GET /api/inventory/kardex/:id` (Movimientos y saldo de insumo)
- `POST /api/inventory/movements` & `/adjustments` (Ajustes con motivo)
- `GET /api/recipes` & `POST /api/recipes` (Escandallos y fichas técnicas)
- `GET /api/recipes/:id/cost` (COGS dinámico y margen de venta)

## 7. COMPRAS, PROVEEDORES Y ENTRADAS (CORE F8)
- `GET /api/purchases/suppliers` & `POST /api/purchases/suppliers` (Catálogo de proveedores)
- `GET /api/purchases/orders` & `POST /api/purchases/orders` (Órdenes de compra)
- `POST /api/purchases/orders/:id/receive` (Recepción física -> Entrada atómica a F6 Inventory -> Nuevo COGS en F7)
- `GET /api/purchases/summary` (Métricas de compras y gasto)

## 8. PERSONAL, ROLES, PERMISOS Y TURNOS (CORE F10)
- `GET /api/staff/members` & `POST /api/staff/members` (Directorio de RestaurantMember)
- `PATCH /api/staff/members/:id/deactivate` & `/activate` (Gestión de membresías)
- `GET /api/staff/roles` & `POST /api/staff/roles` (Roles de sistema y personalizados)
- `GET /api/staff/permissions` (Matriz RBAC granular)
- `POST /api/staff/shifts/start` & `POST /api/staff/shifts/:id/end` (Turnos operativos)

## 9. CLIENTES, CRM, FIDELIDAD Y PROMOCIONES (CORE F11)
- `GET /api/customers` & `POST /api/customers` (Perfiles y directorio unificado)
- `GET /api/customers/:id/metrics` (Métricas dinámicas: gasto total, frecuencia, ticket promedio)
- `GET /api/loyalty/account/:customerId` (Saldo de puntos y nivel tier)
- `POST /api/loyalty/orders/:orderId/earn` (Acumulación de puntos $10 MXN = 1 pt con idempotencia)
- `POST /api/loyalty/rewards` & `POST /api/loyalty/redeem` (Catálogo y canje de recompensas)
- `POST /api/loyalty/adjust` (Ajuste manual de puntos con motivo obligatorio para auditoría)
- `GET /api/promotions` & `POST /api/promotions` (Cupones y promociones)
- `POST /api/promotions/validate` (Validación en tiempo real con mínimos y fechas)
- `POST /api/promotions/apply-to-order` (Aplicación de descuento a comanda y registro de canje)
- `GET /api/crm/summary` (Resumen ejecutivo y KPIs de clientes)
