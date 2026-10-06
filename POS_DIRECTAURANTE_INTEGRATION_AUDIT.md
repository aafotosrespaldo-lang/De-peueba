# DIRECTAURANTE POS - AUDITORÍA DE INTEGRACIÓN CON BACKEND EXISTENTE

## Modelo Definitivo: Transición del Laboratorio al Monolito Modular FastAPI + MongoDB

**Fecha:** 2026-10-04  
**Rol:** Arquitecto Senior de Software, Product Engineer y Especialista en Sistemas POS  
**Estado:** Arquitectura Corregida • **FASE 1 Y 2 COMPLETADAS Y HOMOLOGADAS**  

## 1. PRINCIPIOS ESTRUCTURALES Y REGLAS DE DOMINIO POS

Esta auditoría corrige y establece con rigor absoluto el modelo de dominio del POS de Directaurante:

### 1.1 Identificadores de Dominio (UUID / Strings)
* **Prohibición de `ObjectId` en el dominio:** En los contratos API, DTOs de Pydantic, eventos y estado del POS se utiliza exclusivamente **`str` (UUIDv4)**.
* **Estandarización de claves:**
  * `table_id: str`
  * `table_session_id: str`
  * `guest_subaccount_id: str`
  * `order_id: str` (Comanda Ticket ID)
  * `payment_id: str`
  * `cash_shift_id: str`
* MongoDB mantiene `_id` internamente según la infraestructura del ODM, pero todas las referencias operacionales y contratos externos exponen `id` como string UUID.

### 1.2 TableSession: Entidad de Primer Nivel Obligatoria
* Una mesa física (`Table`) **no** se vincula directamente a comensales ni a pagos.
* La ocupación y servicio en salón está encapsulada en una entidad de primer nivel: **`TableSession`**.
* **Regla de concurrencia:** Una mesa puede tener un historial ilimitado de sesiones pasadas, pero **estrictamente una sola sesión activa** simultáneamente (`table.active_session_id == session.id` y `session.status != 'closed'`).
* **Campos mínimos del modelo:**
  * `id: str` (UUID)
  * `restaurant_id: str`
  * `branch_id: Optional[str]`
  * `table_id: str`
  * `status: 'active' | 'bill_requested' | 'paying' | 'closed'`
  * `opened_at: datetime`
  * `closed_at: Optional[datetime]`
  * `server_id: str` (Mesero asignado)
  * `guest_count: int`
  * `version: int`
  * `created_at: datetime`
  * `updated_at: datetime`

### 1.3 Jerarquía Operacional Definitiva
El flujo de restaurante en salón obedece estrictamente a:

```
TABLE (Mesa física 1)
 └── TABLE SESSION (Sesión de servicio #842)
      ├── GUEST SUBACCOUNTS (Comensales 1.1 Carlos, 1.2 Ana, 1.3 Luis, 1.4 María)
      └── ORDER TICKETS / COMANDAS
           ├── Comanda #001 (Ronda 1) ──> Items: [Carlos: Boneless BBQ, Ana: Hamburguesa]
           ├── Comanda #002 (Ronda 2) ──> Items: [Luis: Burritos x2]
           └── Comanda #003 (Ronda 3) ──> Items: [Luis: Michelada, María: Ensalada]
                 └── ORDER ITEMS (Cada ítem referencia a order_id, table_session_id y guest_subaccount_id)
```

**Regla Financiera Crucial:**  
Las tres comandas (#001, #002, #003) pertenecen a la **misma `table_session_id`**. Generan **una sola cuenta global consolidada de la sesión** y permiten liquidación individual por comensal (`1.1`, `1.2`, `1.3`, `1.4`).  
**Bajo ninguna circunstancia se crea una cuenta financiera independiente por cada comanda o ticket.**
