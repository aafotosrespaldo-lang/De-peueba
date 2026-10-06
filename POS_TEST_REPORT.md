# INFORME DE PRUEBAS DE ACEPTACIÓN: DIRECTAURANTE POS CORE v0.1

**Fecha de Ejecución:** 2026-10-04  
**Ambiente:** Express + TypeScript + React 19 + Persistent File Store  
**Resultado Global:** **100 PRUEBAS AUTOMATIZADAS • 100 PASADAS (100% ÉXITO) • 0 FALLIDAS**  

## 1. JERARQUÍA DE DOMINIO Y CORRECCIÓN ARQUITECTÓNICA (FASE 1)
- **Identificadores de Dominio:** Todos los identificadores son string UUID (`table_id`, `table_session_id`, `guest_subaccount_id`, `order_id`, `order_item_id`, `payment_id`, `shift_id`).
- **TableSession como Entidad de Primer Nivel:** Cada ocupación genera un `table_session_id` explícito (`sess_...`).
- **Regla de Ocupación Única:** Se comprobó que una mesa sólo puede tener una sesión activa simultáneamente; cualquier intento duplicado es rechazado.
- **Vínculo Estricto de Subcuentas:** Los comensales pertenecen a `table_session_id` con restricción conceptual `table_session_id + seat_number` única.
- **Múltiples Comandas (#001, #002, #003):** Se verificó que múltiples tandas de pedidos pertenecen a la MISMA sesión sin crear cuentas financieras separadas ni duplicar sesiones.

## 2. CASO CANÓNICO REAL (MESA 1)
- **Mesa:** Mesa 1 abierta con 4 comensales (`1.1 Carlos`, `1.2 Ana`, `1.3 Luis`, `1.4 María`).
- **Ana con Alergia a Cacahuate:** Bloqueo determinista de productos alergénicos (Brownie) con código HTTP 409 y bypass autorizado asentado en bitácora inmutable.
- **Comandas Emitidas:**
  - `Comanda #001`: Carlos (Boneless BBQ $140.00 + Cerveza $45.00 = $185.00) + Ana (Hamburguesa $150.00)
  - `Comanda #002`: Luis (Burritos x2 = $220.00)
  - `Comanda #003`: Luis (Michelada $90.00) + María (Ensalada César $135.00)
- **Cuenta Consolidada de Sesión:** Subtotal $865.00 + IVA 16% ($138.40) = Total $1,003.40. Cuentas individuales desglosadas con precisión centavo a centavo.

## 3. UNIFIED DIRECTAURANTE SDK (FASE 2)
El SDK (`DirectauranteSDK`) unifica el consumo tipado para todos los frontends (`UI -> SDK -> Adapter -> Repository / API`), garantizando cero acceso directo a bases de datos o almacenamiento desde componentes:
- `sdk.tables`
- `sdk.guests`
- `sdk.orders`
- `sdk.bills`
- `sdk.kds`
- `sdk.cash`
- `sdk.audit`
- `sdk.plugins`

## 4. COMANDERO TÁCTIL Y KDS INTERACTIVO
- **Comandero Touch-First:** Interfaz rápida diseñada para meseros y capitanes en tablets/móviles. Selección de comensal en 1 tap (`[ 1.1 Carlos ] [ 1.2 Ana ]...`), staging de comanda y despacho con un solo toque.
- **Sincronización KDS & Comandero:** Al marcar un ítem como "Listo para Servir" (`ready`) en KDS, el Comandero despliega en tiempo real el banner sonoro/visual verde con el botón "Entregar" para llevar el platillo a la mesa.
- **Transición Controlada:** `pending` &rarr; `preparing` &rarr; `ready` &rarr; `delivered`, con duraciones operacionales en segundos y SLA semafórico.
