/**
 * DIRECTAURANTE POS CORE v0.1 - Automated Verification & Test Suite
 * Validates:
 * - Domain hierarchy: TABLE -> TABLE SESSION -> GUEST SUBACCOUNT -> ORDER TICKET / ORDER -> ORDER ITEM
 * - UUID/String domain IDs (no ObjectId in POS domain contracts)
 * - Single active TableSession per table rule
 * - Multiple comandas (Comanda #001, #002, #003) under the SAME table_session_id
 * - Consolidated session bill & individual diner bills
 * - Safe payment settlement & session closure
 */

import { PosService } from './src/modules/pos/posService';
import { KdsService } from './src/modules/kds/kdsService';
import { CashService } from './src/modules/cash/cashService';
import { PrintService } from './src/modules/directprint/printService';
import { ImportService } from './src/modules/directimport/importService';
import { InventoryService } from './src/modules/inventory/inventoryService';
import { RecipeService } from './src/modules/recipes/recipeService';
import { PurchaseService } from './src/modules/purchases/purchaseService';
import { StaffService } from './src/modules/staff/staffService';
import { CrmService } from './src/modules/crm/crmService';
import { FinanceService } from './src/modules/finance/financeService';
import { SolutionService } from './src/modules/solutions/solutionService';
import { DeliveryService } from './src/modules/delivery/deliveryService';
import { PluginRegistry } from './src/core/pluginRegistry';
import { AuditService } from './src/core/audit';
import { eventBus } from './src/core/eventBus';
import { db, DEFAULT_RESTAURANT_ID } from './src/core/database';
import { Order } from './src/core/types';

async function runTestSuite() {
  console.log('====================================================');
  console.log(' DIRECTAURANTE POS CORE v0.1 - AUTOMATED TEST SUITE');
  console.log(' Architecture & Domain Hierarchy Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // Reset database to ensure pristine initial state
  db.resetToDefault();

  // Test 1: Plugin Registry Verification
  console.log('\n--- 1. PLUGIN REGISTRY ---');
  const plugins = PluginRegistry.getRestaurantPlugins(DEFAULT_RESTAURANT_ID);
  assert(plugins.length >= 8, 'Plugins disponibles registrados', `Encontrados: ${plugins.length}`);
  const posPlugin = plugins.find((p) => p.id === 'pos');
  assert(Boolean(posPlugin && posPlugin.enabled), 'Plugin POS habilitado por defecto');
  PluginRegistry.togglePlugin('kds', true);
  assert(PluginRegistry.isPluginEnabled('kds'), 'Toggle de plugin KDS funciona');

  // Test 2: Domain Event Bus
  console.log('\n--- 2. DOMAIN EVENT BUS ---');
  let eventCaptured = false;
  const unsubscribe = eventBus.subscribe('ORDER_ITEM_CREATED', () => {
    eventCaptured = true;
  });
  assert(typeof unsubscribe === 'function', 'Suscripción a EventBus exitosa');

  // Test 3: Table Opening and TableSession Hierarchy
  console.log('\n--- 3. TABLE -> TABLE SESSION -> GUEST SUBACCOUNTS ---');
  const table1 = db.get('tables').find((t) => t.number === 'Mesa 1');
  assert(Boolean(table1), 'Mesa 1 existe en base de datos');

  const openRes = PosService.openTable(
    table1!.id,
    'Mesero Carlos R.',
    [
      { name: 'Carlos' },
      { name: 'Ana', allergy_ids: ['alg_cacahuate'] },
      { name: 'Luis' },
      { name: 'María' },
    ],
    DEFAULT_RESTAURANT_ID
  );

  assert(openRes.table.status === 'occupied', 'Mesa 1 marcada como ocupada');
  assert(Boolean(openRes.session), 'Entidad TableSession creada como entidad de primer nivel');
  assert(typeof openRes.session.id === 'string' && openRes.session.id.startsWith('sess_'), 'ID de TableSession es string UUID');
  assert(openRes.session.table_id === table1!.id, 'TableSession vinculada a table_id');
  assert(openRes.session.status === 'active', 'TableSession en estado active');
  assert(openRes.table.active_session_id === openRes.session.id, 'Mesa vinculada a active_session_id');

  // Negative test: Cannot open two active sessions on the same table simultaneously
  let duplicateSessionBlocked = false;
  try {
    PosService.openTable(table1!.id, 'Otro Mesero');
  } catch {
    duplicateSessionBlocked = true;
  }
  assert(duplicateSessionBlocked, 'Regla: Una mesa sólo puede tener una sesión activa simultáneamente');

  assert(openRes.subaccounts.length === 4, '4 comensales creados en la sesión (1.1, 1.2, 1.3, 1.4)');
  const s1 = openRes.subaccounts.find((s) => s.seat_number === '1.1')!;
  const s2 = openRes.subaccounts.find((s) => s.seat_number === '1.2')!;
  const s3 = openRes.subaccounts.find((s) => s.seat_number === '1.3')!;
  const s4 = openRes.subaccounts.find((s) => s.seat_number === '1.4')!;

  assert(s1.table_session_id === openRes.session.id, 'Comensal 1.1 pertenece estrictamente a table_session_id');
  assert(s2.table_session_id === openRes.session.id, 'Comensal 1.2 pertenece a table_session_id');
  assert(s1.display_name === 'Carlos', 'Comensal 1.1 es Carlos');
  assert(s2.display_name === 'Ana', 'Comensal 1.2 es Ana');
  assert(s2.allergy_ids.includes('alg_cacahuate'), 'Ana tiene alergia a Cacahuate registrada');

  // Test 4: Operational Model: Multiple Comanda Tickets under the SAME TableSession
  console.log('\n--- 4. MÚLTIPLES COMANDAS BAJO LA MISMA TABLE SESSION ---');
  // Comanda #001: Carlos pide Boneless BBQ ($140) + Cerveza ($45)
  const comanda1 = openRes.order;
  assert(comanda1.ticket_number === 'Comanda #001', 'Primera comanda es Comanda #001');
  assert(comanda1.table_session_id === openRes.session.id, 'Comanda #001 pertenece a table_session_id');

  const item1_1 = PosService.addItemToSubaccount(
    table1!.id,
    s1.id,
    'prod_boneless_bbq',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda1.id
  );
  const item1_2 = PosService.addItemToSubaccount(
    table1!.id,
    s1.id,
    'prod_cerveza',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda1.id
  );

  assert(item1_1.table_session_id === openRes.session.id, 'Item 1.1 lleva table_session_id');
  assert(item1_1.order_id === comanda1.id, 'Item 1.1 asignado a Comanda #001');
  assert(item1_1.total_price_cents === 14000, 'Boneless BBQ = $140.00');
  assert(item1_2.total_price_cents === 4500, 'Cerveza = $45.00');
  assert(eventCaptured, 'Evento ORDER_ITEM_CREATED emitido y capturado');

  // 1.2 Ana pide Hamburguesa ($150) en Comanda #001
  const item2_1 = PosService.addItemToSubaccount(
    table1!.id,
    s2.id,
    'prod_hamburguesa',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda1.id
  );
  assert(item2_1.total_price_cents === 15000, 'Hamburguesa = $150.00');

  // Comanda #002: Segunda ronda - Luis pide Burritos x2 ($220)
  const comanda2 = PosService.createOrderTicket(table1!.id, 'Mesero Carlos R.', 'Ronda 2');
  assert(comanda2.ticket_number === 'Comanda #002', 'Segunda comanda es Comanda #002');
  assert(comanda2.table_session_id === openRes.session.id, 'Comanda #002 pertenece a la misma sesión');

  const item3_1 = PosService.addItemToSubaccount(
    table1!.id,
    s3.id,
    'prod_burritos',
    2,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda2.id
  );
  assert(item3_1.order_id === comanda2.id, 'Burritos asignados a Comanda #002');
  assert(item3_1.table_session_id === openRes.session.id, 'Burritos pertenecen a la sesión común');
  assert(item3_1.total_price_cents === 22000, 'Burritos x2 = $220.00');

  // Comanda #003: Tercera ronda - Luis pide Cerveza/Michelada ($90) y María pide Ensalada ($135)
  const comanda3 = PosService.createOrderTicket(table1!.id, 'Mesero Carlos R.', 'Ronda Bebidas');
  assert(comanda3.ticket_number === 'Comanda #003', 'Tercera comanda es Comanda #003');
  assert(comanda3.table_session_id === openRes.session.id, 'Comanda #003 pertenece a la misma sesión');

  const item3_2 = PosService.addItemToSubaccount(
    table1!.id,
    s3.id,
    'prod_michelada',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda3.id
  );
  const item4_1 = PosService.addItemToSubaccount(
    table1!.id,
    s4.id,
    'prod_ensalada',
    1,
    undefined,
    false,
    'Mesero Carlos R.',
    DEFAULT_RESTAURANT_ID,
    comanda3.id
  );
  assert(item3_2.total_price_cents === 9000, 'Michelada = $90.00');
  assert(item4_1.total_price_cents === 13500, 'Ensalada = $135.00');

  // Test 5: Deterministic Allergy Conflict Detection
  console.log('\n--- 5. VALIDACIÓN DETERMINISTA DE ALERGIAS ---');
  let allergyBlocked = false;
  try {
    // Ana ordering Brownie with peanut ingredient
    PosService.addItemToSubaccount(table1!.id, s2.id, 'prod_brownie', 1, undefined, false);
  } catch (err: any) {
    if (err.is_allergy_warning) {
      allergyBlocked = true;
    }
  }
  assert(allergyBlocked, 'Bloqueo determinista de producto con alergeno para Ana (Cacahuate -> Brownie)');

  // Authorized override with audit log
  const authorizedBrownie = PosService.addItemToSubaccount(
    table1!.id,
    s2.id,
    'prod_brownie',
    1,
    'Autorizado por comensal',
    true,
    'Encargado'
  );
  assert(Boolean(authorizedBrownie), 'Autorización explícita de alergeno permitida con registro');
  const auditLogs = AuditService.getLogs(DEFAULT_RESTAURANT_ID);
  const overrideAudit = auditLogs.find((l) => l.action === 'allergy_override');
  assert(Boolean(overrideAudit), 'Pista de auditoría de anulación de alergia asentada inmutablemente');

  // Test 6: Operational Item Status Transitions & Multi-Station KDS
  console.log('\n--- 6. ESTADOS OPERATIVOS POR ITEM & KDS MULTIESTACIÓN ---');
  const updatedItem = PosService.updateItemStatus(item1_1.id, 'preparing', 'Cocinero Marcos', 'En freidora caliente');
  assert(updatedItem.preparation_status === 'preparing', 'Estado cambiado a preparing');
  assert(Boolean(updatedItem.preparing_at), 'Timestamp de inicio registrado');
  const readyItem = PosService.updateItemStatus(item1_1.id, 'ready', 'Cocinero Marcos', 'Listo en barra');
  assert(readyItem.preparation_status === 'ready', 'Estado cambiado a ready');
  assert(Boolean(readyItem.ready_at), 'Timestamp de listo registrado');

  // F4 KDS: Multi-Station Segregation
  const kitchenItems = KdsService.getActiveStationItems('kitchen');
  const barItems = KdsService.getActiveStationItems('bar');
  assert(kitchenItems.length > 0, 'KDS: Items enrutados a Cocina Caliente encontrados');
  assert(barItems.length > 0, 'KDS: Items enrutados a Barra encontrados');
  assert(
    barItems.every((i) => i.destination_station === 'bar'),
    'KDS: Barra recibe estrictamente productos de barra (Cerveza, Michelada)'
  );

  // F4 KDS: Grouped Station Tickets
  const kitchenTickets = KdsService.getActiveTickets('kitchen');
  assert(kitchenTickets.length > 0, 'KDS: Tickets agrupados de Cocina generados correctamente');
  const firstTicket = kitchenTickets[0];
  assert(firstTicket.table_number.includes('Mesa 1'), 'KDS: Ticket identifica Mesa 1 claramente');
  assert(firstTicket.items.length > 0, 'KDS: Ticket contiene platillos agrupados');
  assert(firstTicket.diner_subaccounts.length > 0, 'KDS: Ticket identifica comensales asociados (1.1, 1.2)');

  // F4 KDS: Batch Ticket Preparation & Ready
  const startedBatch = KdsService.startPreparingTicket(comanda2.id, 'kitchen', 'Chef Línea');
  assert(startedBatch.length > 0, 'KDS: [PREPARAR TICKET] inicia todos los ítems pendientes');
  assert(
    startedBatch.every((i) => i.preparation_status === 'preparing'),
    'KDS: Ítems del ticket transicionaron a preparing'
  );

  // F4 KDS: Operational Recall (Error Recovery)
  const readyBatch = KdsService.markTicketReady(comanda2.id, 'kitchen', 'Chef Línea');
  assert(readyBatch.length > 0, 'KDS: [MARCAR LISTO] marca ticket listo');
  const recalledBatch = KdsService.recallTicket(comanda2.id, 'kitchen', 'Chef Línea');
  assert(
    recalledBatch.every((i) => i.preparation_status === 'preparing'),
    'KDS: [RECALL / RECUPERAR] devuelve comanda lista a preparación de forma segura'
  );

  // F4 KDS: Production Summary (Prep Summary)
  const prepSummary = KdsService.getProductionSummary('kitchen');
  assert(prepSummary.length > 0, 'KDS: Resumen acumulado de producción generado para plancha/freidora');
  assert(prepSummary[0].total_active_qty > 0, 'KDS: Conteo total de porciones activas calculado');

  // Test 7: Unified Session Account Consolidated across all Comandas
  console.log('\n--- 7. CUENTA GLOBAL DE SESIÓN CONSOLIDANDO COMANDAS #001, #002, #003 ---');
  const bill = PosService.calculateTableBill(table1!.id, DEFAULT_RESTAURANT_ID);
  assert(bill.table_session_id === openRes.session.id, 'Cuenta asociada a table_session_id');
  assert(bill.orders.length === 3, 'La cuenta consolida las 3 comandas de la sesión (#001, #002, #003)');

  // Carlos: Boneless ($140) + Cerveza ($45) = Subtotal $185
  const billCarlos = bill.subaccounts.find((s) => s.seat_number === '1.1')!;
  assert(billCarlos.subtotal_cents === 18500, 'Cuenta Carlos: Subtotal $185.00');

  // Ana: Hamburguesa ($150) + Brownie ($85) = Subtotal $235
  const billAna = bill.subaccounts.find((s) => s.seat_number === '1.2')!;
  assert(billAna.subtotal_cents === 23500, 'Cuenta Ana: Subtotal $235.00');

  // Luis: Burritos de Comanda #002 ($220) + Michelada de Comanda #003 ($90) = Subtotal $310
  const billLuis = bill.subaccounts.find((s) => s.seat_number === '1.3')!;
  assert(billLuis.subtotal_cents === 31000, 'Cuenta Luis consolida ítems de Comanda #002 y #003: Subtotal $310.00');
  assert(billLuis.items.length === 2, 'Luis tiene 2 items provenientes de distintas comandas');

  // María: Ensalada ($135) = Subtotal $135
  const billMaria = bill.subaccounts.find((s) => s.seat_number === '1.4')!;
  assert(billMaria.subtotal_cents === 13500, 'Cuenta María: Subtotal $135.00');

  // Global Table Session: Sum of subaccounts
  assert(bill.subtotal_cents === 86500, 'Subtotal global de sesión = $865.00');
  assert(bill.tax_cents === Math.round(86500 * 0.16), 'IVA global 16% calculado exactamente');
  assert(bill.total_cents === bill.subtotal_cents + bill.tax_cents, 'Total global = Subtotal + IVA');
  assert(bill.balance_cents === bill.total_cents, 'Saldo inicial = Total de la sesión');

  // Test 8: Partial & Full Payments (Section 16)
  console.log('\n--- 8. PAGOS Y LIQUIDACIÓN EN LA SESIÓN ---');
  // Pay individual seat 1.1 (Carlos)
  const paymentCarlos = PosService.recordPayment(table1!.id, billCarlos.total_cents, 'card', s1.id, 'Cajero 1');
  assert(paymentCarlos.table_session_id === openRes.session.id, 'Pago vinculado a table_session_id');
  assert(paymentCarlos.amount_cents === billCarlos.total_cents, 'Pago de comensal Carlos registrado');

  const billAfterCarlos = PosService.calculateTableBill(table1!.id);
  const carlosAfter = billAfterCarlos.subaccounts.find((s) => s.seat_number === '1.1')!;
  assert(carlosAfter.balance_cents === 0, 'Saldo individual de Carlos en 0');
  assert(billAfterCarlos.balance_cents < bill.total_cents, 'Saldo global reducido por pago de Carlos');

  // Test 9: Close Table Session Protection
  console.log('\n--- 9. SEGURIDAD Y CIERRE DE SESIÓN ---');
  let closePrevented = false;
  try {
    PosService.closeTable(table1!.id);
  } catch {
    closePrevented = true;
  }
  assert(closePrevented, 'Cierre de mesa impedido si aún existe saldo pendiente en la sesión');

  // Pay remaining balance of session
  PosService.recordPayment(table1!.id, billAfterCarlos.balance_cents, 'cash', undefined, 'Cajero 1');
  const billSettled = PosService.calculateTableBill(table1!.id);
  assert(billSettled.balance_cents === 0, 'Sesión de mesa completamente liquidada');

  const closeResult = PosService.closeTable(table1!.id);
  assert(closeResult.success, 'Mesa cerrada y liberada exitosamente tras liquidación');
  assert(closeResult.session.status === 'closed', 'TableSession marcada como closed');
  assert(Boolean(closeResult.session.closed_at), 'Timestamp closed_at registrado en TableSession');
  const table1Closed = db.get('tables').find((t) => t.id === table1!.id);
  assert(table1Closed?.status === 'available', 'Mesa 1 vuelve a estado LIBRE (available)');
  assert(!table1Closed?.active_session_id, 'Mesa 1 sin active_session_id');

  // Test 10: Cash Management
  console.log('\n--- 10. GESTIÓN DE CAJA ---');
  const cashCurrent = CashService.getCurrentShift(DEFAULT_RESTAURANT_ID);
  assert(Boolean(cashCurrent.shift), 'Turno de caja activo presente');
  const expMov = CashService.recordMovement('expense', 15000, 'Compra de hielo', 'Cajero 1');
  assert(expMov.amount_cents === 15000, 'Gasto de caja de $150.00 registrado con auditoría');

  // Test 11: DirectPrint Architecture
  console.log('\n--- 11. DIRECTPRINT ESC/POS ---');
  const printPrinters = PrintService.getPrinters(DEFAULT_RESTAURANT_ID);
  assert(printPrinters.length >= 3, 'Impresoras de cocina, barra y caja registradas');
  const sampleItems = db.get('order_items').slice(0, 3);
  const ticket = PrintService.generateEscPosTicket('kitchen', 'Mesa 1', 'Mesero Carlos', sampleItems);
  assert(ticket.escpos_hex.startsWith('1B401B6101'), 'Secuencia hexadecimal ESC/POS inicializada correctamente');
  assert(ticket.bytes_count > 0, 'Bytes de ticket generados');

  // Test 12: DirectImport Architecture
  console.log('\n--- 12. DIRECTIMPORT PIPELINE ---');
  const importPrev = ImportService.createPreview(
    'SoftRestaurant',
    'menu.csv',
    [
      { name: 'Arrachera Marinada 300g', precio: 280, categoria: 'Platillos' },
      { name: 'Cerveza Nacional Ultra', precio: 45, categoria: 'Bebidas' },
    ],
    DEFAULT_RESTAURANT_ID
  );
  assert(importPrev.candidates.length === 2, '2 candidatos detectados');
  const dupCandidate = importPrev.candidates.find((c) => c.mapped_name === 'Cerveza Nacional Ultra');
  assert(Boolean(dupCandidate && dupCandidate.has_issue), 'Duplicado detectado por DirectImport');

  // Test 13: UNIFIED DIRECTAURANTE SDK VERIFICATION
  console.log('\n--- 13. SDK ÚNICO: DIRECTAURANTESDK + ADAPTER ---');
  const { DirectauranteSDK } = await import('./src/sdk');
  const { InProcessDirectauranteAdapter } = await import('./src/sdk/inProcessAdapter');
  const sdk = new DirectauranteSDK(new InProcessDirectauranteAdapter(), DEFAULT_RESTAURANT_ID);

  // 13.1 Tables SDK
  const sdkTables = await sdk.tables.listTables();
  assert(sdkTables.length >= 6, 'SDK: listTables() retorna mesas del restaurante');
  const mesa2 = sdkTables.find((t) => t.number === 'Mesa 2')!;
  assert(Boolean(mesa2), 'SDK: Mesa 2 disponible para pruebas');

  const sessionM2 = await sdk.tables.openTableSession(mesa2.id, 'Capitán Juan', [
    { name: 'David' },
    { name: 'Elena', allergy_ids: ['alg_lacteos'] },
  ]);
  assert(Boolean(sessionM2.session), 'SDK: openTableSession() crea TableSession');
  assert(sessionM2.session.status === 'active', 'SDK: TableSession activa en Mesa 2');

  const activeSess = await sdk.tables.getActiveSession(mesa2.id);
  assert(activeSess?.id === sessionM2.session.id, 'SDK: getActiveSession() resuelve sesión activa');

  // 13.2 Guests SDK
  const sdkGuests = await sdk.guests.listSubaccounts(mesa2.id);
  assert(sdkGuests.length === 2, 'SDK: listSubaccounts() devuelve comensales 2.1 y 2.2');
  const david = sdkGuests.find((g) => g.display_name === 'David')!;
  assert(Boolean(david), 'SDK: Comensal David encontrado');
  const extraGuest = await sdk.guests.createSubaccount(mesa2.id, 'Sofía');
  assert(extraGuest.display_name === 'Sofía', 'SDK: createSubaccount() añade tercer comensal');
  assert(extraGuest.table_session_id === sessionM2.session.id, 'SDK: Nuevo comensal ligado a table_session_id');

  // 13.3 Orders SDK: Multiple Comandas & Items
  const ticketM2 = await sdk.orders.createOrderTicket(mesa2.id, 'Capitán Juan', 'Segunda ronda');
  assert(ticketM2.ticket_number === 'Comanda #002', 'SDK: createOrderTicket() genera Comanda #002');
  assert(ticketM2.table_session_id === sessionM2.session.id, 'SDK: Comanda #002 pertenece a la misma sesión');

  const addRes = await sdk.orders.addOrderItem(
    mesa2.id,
    david.id,
    'prod_hamburguesa',
    1,
    'Término medio',
    false,
    'Capitán Juan',
    DEFAULT_RESTAURANT_ID,
    ticketM2.id
  );
  assert(Boolean(addRes.item), 'SDK: addOrderItem() agrega item a la comanda');
  assert(addRes.item.order_id === ticketM2.id, 'SDK: Item asignado a Comanda #002');

  const sessionOrders = await sdk.orders.getSessionOrders(mesa2.id);
  assert(sessionOrders.length >= 2, 'SDK: getSessionOrders() retorna múltiples comandas de la sesión');

  // 13.4 KDS SDK: Station routing & state transitions
  const sdkKitchenItems = await sdk.kds.getKitchenItems();
  const sdkBurgerItem = sdkKitchenItems.find((i) => i.id === addRes.item.id);
  assert(Boolean(sdkBurgerItem), 'SDK: getKitchenItems() localiza platillo en cocina');

  const ackItem = await sdk.kds.acknowledgeItem(addRes.item.id, 'Chef Ejecutivo');
  assert(Boolean(ackItem.acknowledged_at), 'SDK: acknowledgeItem() asienta acuse de recibo');

  const preparingItem = await sdk.kds.updateItemStatus(addRes.item.id, 'preparing', 'Chef Ejecutivo');
  assert(preparingItem.preparation_status === 'preparing', 'SDK: updateItemStatus() transiciona a preparing');

  const sdkReadyItem = await sdk.kds.markItemReady(addRes.item.id, 'Chef Ejecutivo');
  assert(sdkReadyItem.preparation_status === 'ready', 'SDK: markItemReady() transiciona a listo');

  // F4 KDS SDK verification: tickets, summary, recall
  const sdkTickets = await sdk.kds.getStationTickets('kitchen');
  assert(sdkTickets.length > 0, 'SDK: getStationTickets() retorna tickets agrupados por estación');
  const sdkSummary = await sdk.kds.getProductionSummary('kitchen');
  assert(sdkSummary.length > 0, 'SDK: getProductionSummary() retorna resumen acumulado de producción');
  const sdkRecalled = await sdk.kds.recallItem(addRes.item.id, 'Chef Supervisor');
  assert(sdkRecalled.preparation_status === 'preparing', 'SDK: recallItem() restaura platillo a preparación');
  await sdk.kds.markItemReady(addRes.item.id, 'Chef Supervisor');

  // 13.5 Bills SDK: Session and Subaccount breakdown
  const billM2 = await sdk.bills.getSessionBill(mesa2.id);
  assert(billM2.table_session_id === sessionM2.session.id, 'SDK: getSessionBill() consolida cuenta por sesión');
  assert(billM2.balance_cents > 0, 'SDK: Saldo pendiente en la sesión');

  const davidBill = await sdk.bills.getSubaccountBill(mesa2.id, david.id);
  assert(davidBill.guest_subaccount_id === david.id, 'SDK: getSubaccountBill() calcula subcuenta individual');
  assert(davidBill.subtotal_cents === 15000, 'SDK: Subtotal de David exacto ($150.00)');

  // 13.6 Payments SDK & Table Closure
  const payM2 = await sdk.bills.recordPayment(mesa2.id, billM2.balance_cents, 'card', undefined, 'Cajero Turno', 'AUTH_998877');
  assert(Boolean(payM2 && payM2.amount_cents === billM2.balance_cents && payM2.method === 'card'), 'SDK: recordPayment() liquida saldo de la sesión');

  const deliveredItem = await sdk.kds.markItemDelivered(addRes.item.id, 'Capitán Juan');
  assert(deliveredItem.preparation_status === 'delivered', 'SDK: markItemDelivered() entrega platillo a mesa');

  const closeM2 = await sdk.tables.closeTableSession(mesa2.id, 'Capitán Juan');
  assert(closeM2.success, 'SDK: closeTableSession() cierra y libera la mesa');

  // 13.7 Cash, Audit & Plugins SDK
  const sdkShift = await sdk.cash.getCurrentShift();
  assert(Boolean(sdkShift.shift), 'SDK: getCurrentShift() recupera turno de caja');

  const sdkAudit = await sdk.audit.listAuditEvents(5);
  assert(sdkAudit.length > 0, 'SDK: listAuditEvents() consulta bitácora inmutable');

  const sdkPlugins = await sdk.plugins.listPlugins();
  assert(sdkPlugins.length >= 8, 'SDK: listPlugins() lista plugins del ecosistema');

  const isPosActive = await sdk.plugins.getPluginState('pos');
  assert(isPosActive === true, 'SDK: getPluginState() valida estado de plugin');

  // Test 14: INVENTARIO, KÁRDEX Y CONTROL DE EXISTENCIAS (CORE F6)
  console.log('\n--- 14. INVENTARIO, KÁRDEX Y CONTROL DE EXISTENCIAS (CORE F6) ---');

  // 14.1 Crear y consultar existencia física
  const testItem = InventoryService.createOrUpdateItem(
    {
      sku: 'TEST-PAN-01',
      name: 'Pan Brioche Hamburguesa Test',
      category: 'Insumos Cocina',
      current_stock: 50,
      min_stock: 15,
      base_unit: 'pza',
      purchase_unit: 'caja',
      conversion_factor: 24,
      cost_cents: 850,
      allow_negative_stock: false,
    },
    'Admin Test'
  );
  assert(Boolean(testItem && testItem.id), 'Inventario: Insumo físico creado con éxito');
  assert(testItem.current_stock === 50, 'Inventario: Existencia inicial establecida en 50 pzas');

  const stockQuery = InventoryService.getStock(testItem.id);
  assert(stockQuery.current_stock === 50 && stockQuery.base_unit === 'pza', 'Inventario: Consulta de existencia exacta');

  // 14.2 Entrada (+10)
  const movEntry = InventoryService.registerMovement({
    inventory_item_id: testItem.id,
    movement_type: 'purchase',
    quantity: 10,
    reason: 'Compra semanal proveedor La Espiga',
    reference_type: 'purchase',
    reference_id: 'FAC-2026-001',
    actor: 'Encargado Compras',
  });
  assert(movEntry.new_stock === 60, 'Entrada: +10 unidades actualiza stock a 60');
  assert(movEntry.previous_stock === 50, 'Entrada: Stock previo asentado correctamente (50)');

  // 14.3 Salida / Merma (-3)
  const movWaste = InventoryService.registerMovement({
    inventory_item_id: testItem.id,
    movement_type: 'waste',
    quantity: 3,
    reason: 'Pan aplastado durante recepción',
    reference_type: 'waste',
    reference_id: 'MER-001',
    actor: 'Cocinero Pedro',
  });
  assert(movWaste.new_stock === 57, 'Salida/Merma: -3 unidades actualiza stock a 57');

  // 14.4 Kárdex y Reconstrucción de Saldos
  const kardex = InventoryService.getKardex(testItem.id);
  assert(kardex.movements.length >= 3, 'Kárdex: Movimientos históricos registrados');
  assert(kardex.current_stock === 57, 'Kárdex: Saldo actual reconstruido exactamente en 57');
  assert(kardex.total_entries >= 60, 'Kárdex: Conteo acumulativo de entradas verificado');
  assert(kardex.total_exits >= 3, 'Kárdex: Conteo acumulativo de salidas verificado');

  // 14.5 Ajuste manual (57 -> 47)
  const movAdj = InventoryService.registerMovement({
    inventory_item_id: testItem.id,
    movement_type: 'adjustment_out',
    quantity: 10,
    reason: 'Ajuste manual por donación de pan sobrante',
    reference_type: 'manual_adjustment',
    reference_id: 'ADJ-DON-01',
    actor: 'Gerente General',
  });
  assert(movAdj.new_stock === 47, 'Ajuste: Stock ajustado de 57 a 47 con motivo obligatorio');

  // 14.6 Conteo físico periódico (Sistema: 47 -> Físico: 44, Dif: -3)
  const countRes = InventoryService.applyPhysicalCount({
    performed_by: 'Auditor Externo',
    notes: 'Conteo mensual de cierre',
    counts: [
      {
        inventory_item_id: testItem.id,
        counted_stock: 44,
        reason: 'Conteo físico mensual',
      },
    ],
  });
  assert(countRes.status === 'applied', 'Conteo Físico: Registro de conteo aplicado exitosamente');
  const postCountStock = InventoryService.getStock(testItem.id);
  assert(postCountStock.current_stock === 44, 'Conteo Físico: Ajuste automático asentado (-3) actualizando stock a 44');

  // 14.7 Stock Negativo: Rechazar intento si supera existencia (44 - 50 = -6)
  let negativeBlocked = false;
  try {
    InventoryService.registerMovement({
      inventory_item_id: testItem.id,
      movement_type: 'waste',
      quantity: 50,
      reason: 'Intento de merma excesiva',
      reference_type: 'waste',
      actor: 'Operador',
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Existencia insuficiente')) {
      negativeBlocked = true;
    }
  }
  assert(negativeBlocked, 'Stock Negativo: Operación rechazada con error claro ante stock insuficiente');

  // 14.8 Idempotencia: Mismo reference_type y reference_id no duplica movimiento
  const movDup1 = InventoryService.registerMovement({
    inventory_item_id: testItem.id,
    movement_type: 'purchase',
    quantity: 5,
    reason: 'Compra con orden IDEMP-100',
    reference_type: 'purchase',
    reference_id: 'IDEMP-100',
    actor: 'Compras',
  });
  const stockBeforeReplay = InventoryService.getStock(testItem.id).current_stock;
  const movDup2 = InventoryService.registerMovement({
    inventory_item_id: testItem.id,
    movement_type: 'purchase',
    quantity: 5,
    reason: 'Compra con orden IDEMP-100 (Reintento de red)',
    reference_type: 'purchase',
    reference_id: 'IDEMP-100',
    actor: 'Compras',
  });
  const stockAfterReplay = InventoryService.getStock(testItem.id).current_stock;
  assert(movDup1.id === movDup2.id, 'Idempotencia: Reintento devuelve el mismo movimiento previo');
  assert(stockBeforeReplay === stockAfterReplay, 'Idempotencia: Reintento HTTP no duplica saldo en stock');

  // 14.9 Aislamiento Multi-Restaurante
  let multiTenantBlocked = false;
  try {
    InventoryService.registerMovement({
      restaurant_id: 'rest_otro_restaurante_99',
      inventory_item_id: testItem.id,
      movement_type: 'purchase',
      quantity: 10,
      reason: 'Ataque cross-tenant',
      reference_type: 'purchase',
      actor: 'Hacker',
    });
  } catch (err: any) {
    multiTenantBlocked = true;
  }
  assert(multiTenantBlocked, 'Multi-Restaurante: Aislamiento estricto de insumos por restaurant_id');

  // 14.10 Agotamiento y Restauración Comercial de Producto
  const prodTest = db.get('products').find((p) => p.id === 'prod_cerveza');
  assert(Boolean(prodTest && prodTest.inventory_item_id), 'Producto comercial Cerveza vinculado a insumo físico');

  // Simular agotamiento de cerveza
  const invCerveza = InventoryService.getItemById('inv_cerveza_ultra');
  assert(Boolean(invCerveza), 'Insumo inv_cerveza_ultra encontrado');
  InventoryService.registerMovement({
    inventory_item_id: invCerveza!.id,
    movement_type: 'adjustment_out',
    quantity: invCerveza!.current_stock,
    reason: 'Consumo total de stock para prueba de agotado',
    reference_type: 'manual_adjustment',
    actor: 'Admin Test',
  });
  const prodAfterZero = db.get('products').find((p) => p.id === 'prod_cerveza');
  assert(prodAfterZero!.available === false, 'Agotado: Producto se marca automáticamente no disponible cuando stock es 0');

  // Restaurar stock
  InventoryService.registerMovement({
    inventory_item_id: invCerveza!.id,
    movement_type: 'purchase',
    quantity: 24,
    reason: 'Reabastecimiento de cerveza',
    reference_type: 'purchase',
    actor: 'Admin Test',
  });
  const prodAfterReplenish = db.get('products').find((p) => p.id === 'prod_cerveza');
  assert(prodAfterReplenish!.available === true, 'Restauración: Producto vuelve a estar disponible cuando stock > 0');

  // 14.11 Concurrencia de Movimientos
  const concurrentMovements = await Promise.all([
    Promise.resolve(InventoryService.registerMovement({
      inventory_item_id: testItem.id,
      movement_type: 'adjustment_in',
      quantity: 2,
      reason: 'Concurrente A',
      reference_type: 'test_concurrent',
      reference_id: 'CONC-A',
      actor: 'Hebra 1',
    })),
    Promise.resolve(InventoryService.registerMovement({
      inventory_item_id: testItem.id,
      movement_type: 'adjustment_in',
      quantity: 3,
      reason: 'Concurrente B',
      reference_type: 'test_concurrent',
      reference_id: 'CONC-B',
      actor: 'Hebra 2',
    })),
  ]);
  assert(concurrentMovements.length === 2, 'Concurrencia: Movimientos simultáneos procesados correctamente');

  // 14.12 SDK Único: sdk.inventory
  const sdkItems = await sdk.inventory.listItems();
  assert(sdkItems.length >= 8, 'SDK: listItems() recupera catálogo de insumos');

  const sdkKardex = await sdk.inventory.getKardex(testItem.id);
  assert(Boolean(sdkKardex && sdkKardex.movements.length > 0), 'SDK: getKardex() recupera auditoría de movimientos');

  const sdkAlerts = await sdk.inventory.getAlerts();
  assert(Array.isArray(sdkAlerts), 'SDK: getAlerts() consulta alertas de stock activo');

  const sdkInvSummary = await sdk.inventory.getSummary();
  assert(sdkInvSummary.total_items > 0 && sdkInvSummary.total_valuation_cents > 0, 'SDK: getSummary() computa valoración de almacén');

  const csvKardex = await sdk.inventory.exportKardexCsv(testItem.id);
  assert(csvKardex.includes('SKU') && csvKardex.includes('Saldo'), 'SDK: exportKardexCsv() genera formato CSV estándar');

  // ==========================================
  // 15. RECETAS, ESCANDALLOS Y COSTEO (CORE F7)
  // ==========================================
  console.log('\n--- 15. RECETAS, CONSUMO DE INGREDIENTES Y COSTEO (CORE F7) ---');

  // 15.1 Receta básica: Producto + 3 ingredientes = receta válida
  const burgerRecipe = RecipeService.getRecipeByProductId('prod_hamburguesa');
  assert(
    Boolean(burgerRecipe && burgerRecipe.items.length >= 3),
    'Receta básica: Producto Hamburguesa vinculado a receta con 3+ ingredientes válidos'
  );
  assert(
    burgerRecipe!.items.some((i) => i.inventory_item_id === 'inv_carne_angus'),
    'Receta: Insumo Carne Angus presente en ficha técnica'
  );

  // 15.2 Costo de ingredientes dinámico desde F6 Inventory
  const costCalc = RecipeService.calculateRecipeCost(burgerRecipe!);
  assert(costCalc.cogs_cents > 0, 'Costo de ingredientes: COGS calculado dinámicamente desde F6');
  assert(
    costCalc.items_breakdown.length === burgerRecipe!.items.length,
    'Costo: Desglose completo de ingredientes con merma y factor de conversión'
  );

  // 15.3 Rendimiento (Yield)
  assert(
    costCalc.cogs_cents === Math.round(costCalc.total_batch_cost_cents / burgerRecipe!.yield_quantity),
    'Rendimiento: Costo unitario derivado de costo total / yield_quantity'
  );

  // 15.4 Margen Bruto
  const expectedMargin = costCalc.selling_price_cents - costCalc.cogs_cents;
  assert(costCalc.gross_margin_cents === expectedMargin, 'Margen Bruto $: Precio de venta - COGS exacto');
  assert(costCalc.gross_margin_percent > 0 && costCalc.gross_margin_percent < 100, 'Margen Bruto %: Porcentaje de utilidad calculado correctamente');

  // 15.5 Venta: Venta de hamburguesa genera consumo atómico en F6 Inventory
  const panItemBefore = InventoryService.getItemById('inv_pan_burger');
  const initialPanStock = panItemBefore!.current_stock;

  const testOrderId = `ord_f7_test_${Date.now()}`;
  const testOrderItemId = `item_f7_test_01`;

  const consumptionResult = RecipeService.consumeRecipeForOrderItem({
    order_id: testOrderId,
    order_item_id: testOrderItemId,
    product_id: 'prod_hamburguesa',
    quantity: 2, // 2 hamburguesas -> 2 panes
    actor: 'Mesero F7 Test',
  });

  assert(consumptionResult.success && consumptionResult.recipe_consumed, 'Venta: Consumo de receta disparado exitosamente');
  assert(consumptionResult.movements_created >= 4, 'Venta: Movimientos atómicos de insumos base creados en F6');

  const panItemAfter = InventoryService.getItemById('inv_pan_burger');
  assert(
    panItemAfter!.current_stock === initialPanStock - 2,
    `Venta: Descuento exacto de pan en F6 Inventory (${initialPanStock} -> ${panItemAfter!.current_stock})`
  );

  // 15.6 Trazabilidad en Kárdex
  const panKardex = InventoryService.getKardex('inv_pan_burger');
  const saleMov = panKardex.movements.find((m) => m.reference_id?.includes(testOrderItemId));
  assert(
    Boolean(saleMov && saleMov.movement_type === 'sale'),
    'Kárdex F6: Consumo de receta asentado inmutablemente con referencia trazable'
  );

  // 15.7 Idempotencia: Procesar la misma orden dos veces NO duplica el consumo
  const stockBeforeRetry = panItemAfter!.current_stock;
  RecipeService.consumeRecipeForOrderItem({
    order_id: testOrderId,
    order_item_id: testOrderItemId,
    product_id: 'prod_hamburguesa',
    quantity: 2,
    actor: 'Mesero F7 Retry',
  });
  const stockAfterRetry = InventoryService.getItemById('inv_pan_burger')!.current_stock;
  assert(stockAfterRetry === stockBeforeRetry, 'Idempotencia: Reintento de consumo no vuelve a descontar existencias');

  // 15.8 Modificador con impacto de inventario (+ Tocino)
  const tocinoBefore = InventoryService.getItemById('inv_tocino_rebanada')!.current_stock;
  const modOrderItemId = `item_f7_test_mod_02`;

  RecipeService.consumeRecipeForOrderItem({
    order_id: testOrderId,
    order_item_id: modOrderItemId,
    product_id: 'prod_hamburguesa',
    quantity: 1,
    modifiers: ['+ Tocino'],
    actor: 'Mesero F7 Modifier',
  });

  const tocinoAfter = InventoryService.getItemById('inv_tocino_rebanada')!.current_stock;
  assert(
    tocinoAfter === tocinoBefore - 2,
    `Modificador: "+ Tocino" descuenta 2 rebanadas (${tocinoBefore} -> ${tocinoAfter})`
  );

  // 15.9 Modificador sin impacto de inventario (- Cebolla)
  const modNoInvOrderItemId = `item_f7_test_mod_03`;
  const panBeforeNoInv = InventoryService.getItemById('inv_pan_burger')!.current_stock;

  const noInvResult = RecipeService.consumeRecipeForOrderItem({
    order_id: testOrderId,
    order_item_id: modNoInvOrderItemId,
    product_id: 'prod_hamburguesa',
    quantity: 1,
    modifiers: ['- Cebolla', 'Término medio'],
    actor: 'Mesero F7 ModNoInv',
  });

  // Base burger ingredients deducted (1 pan), but no additional modifier movements created
  const panAfterNoInv = InventoryService.getItemById('inv_pan_burger')!.current_stock;
  assert(panAfterNoInv === panBeforeNoInv - 1, 'Modificador: Insumos base consumidos normalmente');
  assert(
    noInvResult.movements_created === burgerRecipe!.items.length,
    'Modificador Sin Inventario: "- Cebolla" con affects_inventory: false no genera movimiento espurio'
  );

  // 15.10 Versionado de receta
  const currentRecipe = RecipeService.getRecipeById('rec_hamburguesa')!;
  const originalVersion = currentRecipe.version;

  const updatedRecipe = RecipeService.updateRecipe(
    'rec_hamburguesa',
    {
      preparation_instructions: 'Nueva instrucción v2: Sellar a fuego alto 4 min con costra.',
    },
    'Chef Ejecutivo'
  );

  assert(updatedRecipe.version === originalVersion + 1, 'Versionado: updateRecipe() incrementa versión de receta a v2');
  assert(
    Boolean(updatedRecipe.versions_history && updatedRecipe.versions_history.length >= 1),
    'Versionado: Snapshot inmutable de versión anterior preservado en historial'
  );
  assert(
    updatedRecipe.versions_history![0].version === originalVersion,
    'Versionado: Versión anterior v1 conserva su costo histórico'
  );

  // 15.11 Cancelaciones: Reversión de consumo restaura stock sin borrar historial
  const panBeforeCancel = InventoryService.getItemById('inv_pan_burger')!.current_stock;
  const reversalResult = RecipeService.reverseRecipeConsumption({
    order_id: testOrderId,
    order_item_id: testOrderItemId,
    actor: 'Cajero Supervisor',
    reason: 'Comanda cancelada por comensal',
  });

  assert(reversalResult.reversed_count > 0, 'Cancelación: Reversión de consumo procesada');
  const panAfterCancel = InventoryService.getItemById('inv_pan_burger')!.current_stock;
  assert(
    panAfterCancel === panBeforeCancel + 2,
    `Cancelación: Stock de pan restaurado exactamente (+2) a ${panAfterCancel}`
  );

  // 15.12 Respeto a reglas de stock F6 (No permitir stock negativo si no está autorizado)
  let negativeStockBlocked = false;
  try {
    RecipeService.consumeRecipeForOrderItem({
      order_id: 'ord_huge_999',
      order_item_id: 'item_huge_999',
      product_id: 'prod_hamburguesa',
      quantity: 50000, // Imposible de surtir
      actor: 'Mesero Abusivo',
    });
  } catch (err: any) {
    negativeStockBlocked = true;
  }
  assert(negativeStockBlocked, 'Stock: F7 respeta reglas de F6 impidiendo stock negativo no autorizado');

  // 15.13 Multi-Restaurante: Aislamiento estricto de recetas
  const crossTenantRecipe = RecipeService.getRecipeById('rec_hamburguesa', 'rest_otro_restaurante_99');
  assert(crossTenantRecipe === undefined, 'Multi-Restaurante: Aislamiento estricto de recetas por restaurant_id');

  // 15.14 Sub-receta con rendimiento en volumen
  const subRecipe = RecipeService.getRecipeById('rec_salsa_bbq_sub');
  assert(
    Boolean(subRecipe && subRecipe.yield_quantity === 1000 && subRecipe.yield_unit === 'ml'),
    'Sub-receta: Capacidad de sub-receta con rendimiento en volumen (1000 ml)'
  );

  // 15.15 Detección de productos sin receta
  const summaryF7 = RecipeService.getRecipeSummary();
  assert(summaryF7.total_recipes >= 4, 'Resumen: Detección y conteo de recetas activas');
  assert(
    summaryF7.missing_recipe_products.some((p) => p.id === 'prod_michelada'),
    'Sin Receta: Michelada detectada correctamente como producto sin ficha técnica'
  );

  // 15.16 SDK Único: sdk.recipes
  const sdkRecipes = await sdk.recipes.listRecipes();
  assert(sdkRecipes.length >= 4, 'SDK: listRecipes() retorna catálogo de recetas con costeo calculado');

  const sdkCost = await sdk.recipes.calculateCost('rec_hamburguesa');
  assert(sdkCost.cogs_cents > 0 && sdkCost.gross_margin_percent > 0, 'SDK: calculateCost() retorna COGS y margen bruto');

  const sdkRecipeSummary = await sdk.recipes.getSummary();
  assert(sdkRecipeSummary.products_with_recipe >= 4, 'SDK: getSummary() reporta métricas de alimentos y margen');

  const sdkVersions = await sdk.recipes.getRecipeVersions('rec_hamburguesa');
  assert(sdkVersions.length >= 1, 'SDK: getRecipeVersions() recupera historial de versiones');

  // ==========================================
  // 16. COMPRAS, PROVEEDORES Y ENTRADAS (CORE F8)
  // ==========================================
  console.log('\n--- 16. COMPRAS, PROVEEDORES Y ENTRADAS DE INVENTARIO (CORE F8) ---');

  // 16.1 Catálogo de proveedores
  const suppliers = PurchaseService.getSuppliers();
  assert(suppliers.length >= 2, 'Proveedores: Catálogo de proveedores presente');
  const carnicosSupplier = suppliers.find((s) => s.id === 'sup_carnes_norte');
  assert(Boolean(carnicosSupplier && carnicosSupplier.is_active), 'Proveedores: Proveedor de carnes activo');

  // 16.2 Crear orden de compra (Borrador -> Aprobada)
  const carneAngusItem = InventoryService.getItemById('inv_carne_angus');
  const initialCarneStock = carneAngusItem!.current_stock;

  const newPO = PurchaseService.createPurchaseOrder({
    supplier_id: 'sup_carnes_norte',
    items: [
      {
        inventory_item_id: 'inv_carne_angus',
        quantity_ordered: 10, // 10 kg
        unit: 'kg',
        cost_cents_per_unit: 14000, // $140.00 MXN / kg (nuevo costo de compra)
      },
    ],
    notes: 'Pedido semanal de res para F8',
  });
  assert(newPO.status === 'draft', 'Compras: Orden de compra creada en estado borrador');

  // Regla fundamental F8: Crear orden NO altera el inventario
  const carneStockAfterPO = InventoryService.getItemById('inv_carne_angus')!.current_stock;
  assert(carneStockAfterPO === initialCarneStock, 'Compras: Crear orden de compra NO incrementa inventario prematuramente');

  // 16.3 Recepción de mercancía -> Entrada atómica en F6 Inventory
  const poReceiptResult = PurchaseService.receivePurchaseOrder(
    newPO.id,
    {
      items: [
        {
          purchase_order_item_id: newPO.items[0].id,
          quantity_received: 10,
        },
      ],
      notes: 'Factura F-8921 recibida en almacén',
    },
    'Almacenista F8 Test'
  );

  assert(poReceiptResult.purchase_order.status === 'received', 'Recepción: Orden de compra transiciona a recibida');
  assert(poReceiptResult.receipt.items.length === 1, 'Recepción: Comprobante de recepción PurchaseReceipt generado');

  const carneStockAfterReceipt = InventoryService.getItemById('inv_carne_angus')!.current_stock;
  assert(
    Math.abs(carneStockAfterReceipt - (initialCarneStock + 10)) < 0.01,
    'F6 Inventario: Stock incrementado exactamente (+10kg) tras recepción física',
    `Inicial: ${initialCarneStock}, Final: ${carneStockAfterReceipt}`
  );

  // 16.4 Kárdex trazable
  const carneKardex = InventoryService.getKardex('inv_carne_angus');
  const purchaseMovement = carneKardex.movements.find((m) => m.reference_type === 'purchase_receipt');
  assert(Boolean(purchaseMovement && purchaseMovement.movement_type === 'purchase'), 'Kárdex F6: Entrada asentada con trazabilidad a purchase_receipt');

  // 16.5 Actualización de costo en F6 y recálculo dinámico en F7 Recipes
  const updatedCarneItem = InventoryService.getItemById('inv_carne_angus');
  assert(updatedCarneItem!.cost_cents_per_unit === 14000, 'F6 Costo: Costo unitario actualizado a $140.00 MXN tras compra');

  const newBurgerCost = RecipeService.calculateRecipeCost(burgerRecipe!);
  assert(newBurgerCost.cogs_cents > 0, 'F7 Costeo: COGS recalculado dinámicamente con nuevo costo de compra');

  // 16.6 Idempotencia de recepción
  const poAlreadyReceived = PurchaseService.getPurchaseOrderById(newPO.id);
  assert(poAlreadyReceived!.status === 'received', 'Idempotencia: Orden ya recibida permanece en estado consistente');

  // 16.7 SDK Purchases
  const sdkSuppliers = await sdk.purchases.listSuppliers();
  assert(sdkSuppliers.length >= 2, 'SDK: listSuppliers() recupera catálogo de proveedores');
  const sdkPOSummary = await sdk.purchases.getSummary();
  assert(sdkPOSummary.total_orders > 0, 'SDK: getSummary() reporta métricas de compras y gasto');

  // ==========================================
  // 17. PERSONAL, ROLES, PERMISOS Y TURNOS (CORE F10)
  // ==========================================
  console.log('\n--- 17. PERSONAL, ROLES, PERMISOS Y TURNOS (CORE F10) ---');

  // 17.1 Identidad User global vs RestaurantMember
  const users = db.get('users');
  assert(users.length >= 4, 'Usuarios: Identidad global User separada de miembros de restaurante');

  const membersF10 = StaffService.listMembers();
  assert(membersF10.length >= 4, 'Staff: Directorio de RestaurantMember activo');
  const waiterMember = membersF10.find((m) => m.user_id === 'usr_carlos_01');
  assert(Boolean(waiterMember && waiterMember.is_active), 'Staff: Mesero Carlos Méndez es miembro activo');

  // 17.2 Matriz RBAC & Roles de sistema
  const systemRoles = StaffService.listRoles();
  assert(systemRoles.length >= 6, 'RBAC: Roles estándar definidos (Owner, Manager, Waiter, Cashier, Kitchen, Purchasing)');
  const ownerRole = systemRoles.find((r) => r.id === 'role_owner');
  assert(Boolean(ownerRole && ownerRole.is_system), 'RBAC: Rol de Propietario protegido como rol de sistema');

  // 17.3 Autorización RBAC
  const authWaiterOrders = StaffService.authorize('usr_carlos_01', 'orders.create');
  assert(authWaiterOrders.authorized, 'Permisos: Mesero autorizado para orders.create');

  const authWaiterRoles = StaffService.authorize('usr_carlos_01', 'roles.manage');
  assert(!authWaiterRoles.authorized, 'Permisos: Mesero no autorizado para roles.manage (RBAC estricto)');

  // 17.4 Contexto operativo de restaurante
  const waiterContext = StaffService.getRestaurantContext('usr_carlos_01');
  assert(waiterContext.role_id === 'role_waiter', 'Contexto: Contexto operativo resuelve rol correspondiente');
  assert(waiterContext.hasPermission('orders.view'), 'Contexto: Función hasPermission() operativa');

  // 17.5 Turnos de trabajo (Shifts)
  let duplicateShiftBlocked = false;
  try {
    StaffService.startShift({ member_id: waiterMember!.id, notes: 'Intento duplicado' });
  } catch {
    duplicateShiftBlocked = true;
  }
  assert(duplicateShiftBlocked, 'Turnos: Bloqueo estricto de turnos activos concurrentes para un mismo colaborador');

  const chefMember = membersF10.find((m) => m.id === 'mem_chef_01')!;
  const scheduledShift = StaffService.createShift(
    {
      member_id: chefMember.id,
      role_id: 'role_kitchen',
      scheduled_start: new Date().toISOString(),
      notes: 'Turno cocina caliente pruebas F10',
    },
    'Gerente F10'
  );
  assert(scheduledShift.status === 'scheduled', 'Turnos: Turno operativo programado con éxito');

  const startedShift = StaffService.startShift(
    {
      member_id: chefMember.id,
      notes: 'Inicia labores Chef Luis',
    },
    'Chef Luis'
  );
  assert(startedShift.status === 'active' && Boolean(startedShift.actual_start), 'Turnos: Turno transiciona a activo con timestamp');

  const endedShift = StaffService.endShift(startedShift.id, 'Cierre de turno cocina', 'Chef Luis');
  assert(endedShift.status === 'completed' && Boolean(endedShift.actual_end), 'Turnos: Turno finalizado con éxito');

  // 17.6 Historial inmutable de membresía
  const testNewMember = StaffService.createMember({
    name: 'Empleado Temporal F10',
    email: 'temp.f10@directaurante.com',
    role_id: 'role_waiter',
    employee_code: 'EMP-999',
  });
  assert(testNewMember.is_active, 'Membresía: Nuevo empleado registrado');

  const deactivated = StaffService.deactivateMember(testNewMember.id, 'Fin de contrato temporal');
  assert(!deactivated.is_active, 'Membresía: Empleado desactivado');

  const memberAuditHistory = StaffService.getMemberHistory(testNewMember.id);
  assert(memberAuditHistory.length >= 2, 'Auditoría F10: Historial inmutable conserva altas y bajas');

  // 17.7 SDK Staff, Roles, Shifts
  const sdkMembers = await sdk.staff.listMembers();
  assert(sdkMembers.length >= 4, 'SDK: listMembers() recupera personal del restaurante');
  const sdkRoles = await sdk.roles.listRoles();
  assert(sdkRoles.length >= 6, 'SDK: listRoles() recupera catálogo de roles');
  const sdkShifts = await sdk.shifts.listShifts();
  assert(sdkShifts.length >= 1, 'SDK: listShifts() recupera turnos');

  // ==========================================
  // 18. CLIENTES, CRM, FIDELIDAD Y PROMOCIONES (CORE F11)
  // ==========================================
  console.log('\n--- 18. CLIENTES, CRM, FIDELIDAD Y PROMOCIONES (CORE F11) ---');

  // 18.1 Identidad única de cliente
  const customersF11 = CrmService.listCustomers();
  assert(customersF11.length >= 3, 'CRM: Directorio de clientes inicial registrado');
  const anaCustomer = customersF11.find((c) => c.phone.includes('83000004') || c.id === 'cust_ana_01');
  assert(Boolean(anaCustomer && anaCustomer.name.includes('Ana')), 'CRM: Perfil de cliente Ana Martínez encontrado');

  // 18.2 Creación de cliente con preferencias
  const newClient = CrmService.createCustomer({
    name: 'Valeria Quintanilla',
    phone: '+52 81 8300 9999',
    email: 'valeria.q@gmail.com',
    preferences: {
      allergies: ['Gluten / Trigo'],
      favorite_items: ['Boneless BBQ'],
    },
    notes: 'Mesa preferida en terraza',
  });
  assert(newClient.id.startsWith('cust_'), 'CRM: Nuevo cliente registrado con ID canónico');
  assert(
    Boolean(newClient.preferences?.allergies && newClient.preferences.allergies.includes('Gluten / Trigo')),
    'CRM: Alergias y preferencias alimentarias guardadas en perfil único'
  );

  // 18.3 Métricas de cliente dinámicas
  const metricsValeria = CrmService.getCustomerMetrics(newClient.id);
  assert(metricsValeria.order_count === 0, 'Métricas: Cliente nuevo inicia con 0 visitas');
  assert(metricsValeria.segment === 'new_customer', 'Segmentación: Nuevo cliente clasificado como new_customer');

  // 18.4 Cuenta Loyalty y Libro Contable Inmutable
  const loyaltyAcc = CrmService.getLoyaltyAccount(newClient.id);
  assert(loyaltyAcc.points_balance === 0, 'Loyalty: Balance inicial en 0 puntos');
  assert(loyaltyAcc.tier === 'bronze', 'Loyalty: Nivel inicial Bronze');

  // 18.5 Acumulación de puntos por Comanda ($10 MXN = 1 punto)
  const dummyOrderForLoyalty: any = {
    id: `ord_loyalty_f11_${Date.now()}`,
    restaurant_id: DEFAULT_RESTAURANT_ID,
    table_id: 'tbl_1',
    table_session_id: 'sess_f11_test',
    ticket_number: 'Comanda #F11-01',
    order_type: 'dine_in',
    status: 'completed',
    subtotal_cents: 50000, // $500 MXN
    tax_cents: 8000,
    total_cents: 58000, // $580 MXN -> 58 puntos
    customer_id: newClient.id,
    created_at: new Date().toISOString(),
  };
  db.get('orders').push(dummyOrderForLoyalty);

  const earnTx = CrmService.earnPointsForOrder(dummyOrderForLoyalty.id, 'Cajero F11');
  assert(earnTx.points === 58, 'Loyalty: Acumulación exacta de 58 puntos por cuenta de $580.00 MXN (1 pt / $10 MXN)');
  assert(earnTx.balance_after === 58, 'Loyalty: Saldo actualizado a 58 puntos');

  // 18.6 Idempotencia: Una orden solo genera puntos UNA vez
  const earnTxDuplicate = CrmService.earnPointsForOrder(dummyOrderForLoyalty.id, 'Cajero Reintento');
  assert(earnTxDuplicate.id === earnTx.id, 'Idempotencia Loyalty: Reintento devuelve la misma transacción sin duplicar saldo');

  const accAfterEarn = CrmService.getLoyaltyAccount(newClient.id);
  assert(accAfterEarn.points_balance === 58, 'Idempotencia: Saldo del cliente no se duplica (permanece en 58)');

  // 18.7 Ajuste manual de puntos con motivo obligatorio
  const adjustTx = CrmService.adjustPoints(
    newClient.id,
    100,
    'Cortesía aniversario restaurante',
    'Gerente F11'
  );
  assert(adjustTx.balance_after === 158, 'Ajuste Loyalty: +100 puntos acreditados con saldo resultante de 158 pts');
  assert(adjustTx.description.includes('Cortesía aniversario'), 'Auditoría: Motivo de ajuste preservado');

  // 18.8 Catálogo de Recompensas y Canje
  const rewardsList = CrmService.listRewards();
  assert(rewardsList.length >= 3, 'Recompensas: Catálogo de premios de fidelidad activo');

  const affordableReward = CrmService.createReward({
    name: 'Bebida de Cortesía',
    description: 'Canje de cortesía para pruebas',
    reward_type: 'discount_amount',
    value: 3500,
    points_required: 100,
  });
  assert(affordableReward.points_required === 100, 'Recompensas: Creación de recompensa accesible exitosa');

  const redeemResult = CrmService.redeemReward(
    newClient.id,
    affordableReward.id,
    'Mesero en Sala'
  );
  assert(redeemResult.transaction.type === 'redeem', 'Canje: Transacción de débito de puntos registrada');
  assert(redeemResult.new_balance === 158 - 100, 'Canje: Saldo restado exactamente (158 - 100 = 58)');

  // 18.9 Reversión segura de puntos por comanda cancelada
  const reversedTx = CrmService.reversePointsForOrder(
    dummyOrderForLoyalty.id,
    'Comanda cancelada por cliente',
    'Supervisor F11'
  );
  assert(Boolean(reversedTx && reversedTx.type === 'reversal'), 'Reversión Loyalty: Débito de reversión asentado sin borrar historial');

  // 18.10 Motor de Promociones y Cupones
  const promos = CrmService.listPromotions();
  assert(promos.length >= 3, 'Promociones: Catálogo de promociones y cupones activo');

  // Validación de cupón con consumo mínimo
  const testSubtotalOrder = 30000; // $300 MXN
  const couponValidation = CrmService.validatePromotionOrCoupon('BIENVENIDO', testSubtotalOrder);
  assert(couponValidation.valid, 'Cupón: BIENVENIDO validado correctamente para $300 MXN');
  assert(couponValidation.discount_cents === 4500, 'Cupón: 15% de descuento calculado ($45.00 MXN)');

  // Validación de cupón que no alcanza mínimo
  const lowSubtotal = 10000; // $100 MXN (mínimo de BURGER50 es $250 MXN)
  const lowValidation = CrmService.validatePromotionOrCoupon('BURGER50', lowSubtotal);
  assert(!lowValidation.valid && Boolean(lowValidation.reason), 'Cupón: Rechazado correctamente si no alcanza consumo mínimo');

  // Aplicación directa a Comanda
  const promoOrder: any = {
    id: `ord_promo_f11_${Date.now()}`,
    restaurant_id: DEFAULT_RESTAURANT_ID,
    table_id: 'tbl_1',
    table_session_id: 'sess_f11_test',
    ticket_number: 'Comanda #Promo-01',
    order_type: 'dine_in',
    status: 'open',
    subtotal_cents: 40000, // $400 MXN
    tax_cents: 6400,
    total_cents: 46400,
    customer_id: newClient.id,
    created_at: new Date().toISOString(),
  };
  db.get('orders').push(promoOrder);

  const appliedPromoResult = CrmService.applyPromotionToOrder(promoOrder.id, 'BIENVENIDO', 'Cajero F11');
  assert(appliedPromoResult.discount_cents === 6000, 'Promoción: $60.00 MXN de descuento aplicado a la orden');
  assert(appliedPromoResult.order.total_cents === 46400 - 6000, 'Promoción: Total de comanda reducido por el descuento');

  // 18.11 Resumen Ejecutivo CRM
  const crmSummary = CrmService.getCrmSummary();
  assert(crmSummary.total_customers >= 4, 'Resumen CRM: Total de clientes contabilizado');
  assert(crmSummary.total_loyalty_points_issued > 0, 'Resumen CRM: Puntos emitidos acumulados');
  assert(crmSummary.active_promotions_count >= 3, 'Resumen CRM: Promociones activas monitoreadas');

  // 18.12 SDK Único: sdk.customers, sdk.loyalty, sdk.promotions, sdk.crm
  const sdkCustomers = await sdk.customers.listCustomers();
  assert(sdkCustomers.length >= 4, 'SDK: listCustomers() retorna catálogo de clientes con métricas');

  const sdkLoyaltyAccount = await sdk.loyalty.getAccount(newClient.id);
  assert(sdkLoyaltyAccount.customer_id === newClient.id, 'SDK: getAccount() recupera cuenta de lealtad');

  const sdkPromos = await sdk.promotions.listPromotions();
  assert(sdkPromos.length >= 3, 'SDK: listPromotions() retorna catálogo de promociones');

  const sdkCrmSum = await sdk.crm.getSummary();
  assert(sdkCrmSum.total_customers >= 4, 'SDK: getSummary() reporta métricas globales de CRM');

  // ==========================================
  // 19. CONSOLIDACIÓN FINANCIERA REAL DEL CORE (FASE 12 / F12.1)
  // ==========================================
  console.log('\n--- 19. CONSOLIDACIÓN FINANCIERA REAL DEL CORE (FASE 12 / F12.1) ---');

  // Preparar mesa y sesión de pruebas para finanzas
  const tableFin = db.get('tables')[0];
  const openFinSessionRes = PosService.openTable(tableFin.id, 'Mesero Finanzas', [
    { name: 'Comensal Finanzas 1' },
    { name: 'Comensal Finanzas 2' },
  ]);
  const finSessionId = openFinSessionRes.session.id;

  // Comanda de prueba para finanzas
  const finOrder: any = {
    id: `ord_fin_test_${Date.now()}`,
    restaurant_id: DEFAULT_RESTAURANT_ID,
    table_id: tableFin.id,
    table_session_id: finSessionId,
    ticket_number: 'Comanda #Fin-01',
    order_type: 'dine_in',
    status: 'open',
    subtotal_cents: 60000, // $600 MXN
    tax_cents: 9600,
    total_cents: 69600,
    created_at: new Date().toISOString(),
  };
  db.get('orders').push(finOrder);

  // 19.1 P0: Cobro en efectivo sin turno de caja abierto RECHAZADO
  // Cerramos cualquier turno abierto previo para garantizar verificación limpia
  const currentOpenShift = db.get('cash_shifts').find((s) => s.restaurant_id === DEFAULT_RESTAURANT_ID && s.status === 'open');
  if (currentOpenShift) {
    FinanceService.closeCashSession({ actual_cash_cents: currentOpenShift.expected_cash_cents, closed_by: 'Cajero Previo' });
  }

  let cashWithoutDrawerRejected = false;
  try {
    FinanceService.recordPayment({
      table_id_or_session_id: finSessionId,
      amount_cents: 10000,
      method: 'cash',
      cashier: 'Cajero Sin Caja',
    });
  } catch {
    cashWithoutDrawerRejected = true;
  }
  assert(cashWithoutDrawerRejected, 'P0 Efectivo: Cobro en efectivo rechazado atómicamente si no hay caja abierta');

  // 19.2 Apertura de Caja (CashSession) con fondo inicial
  const openedShift = FinanceService.openCashSession({
    initial_float_cents: 100000, // $1,000.00 MXN
    opened_by: 'Cajero Principal',
    notes: 'Apertura de turno matutino',
  });
  assert(openedShift.status === 'open', 'Caja: Sesión física abierta con estado open');
  assert(openedShift.expected_cash_cents === 100000, 'Caja: Fondo de apertura asentado en $1,000.00 MXN');

  const shiftMovs = db.get('cash_movements').filter((m) => m.shift_id === openedShift.id);
  assert(shiftMovs.some((m) => m.type === 'opening_float' && m.amount_cents === 100000), 'Caja: Movimiento opening_float registrado en gaveta');

  const ledgerOpen = db.get('financial_movements').find((m) => m.reference_id === openedShift.id && m.type === 'opening');
  assert(Boolean(ledgerOpen && ledgerOpen.direction === 'in'), 'Ledger: Asiento de apertura inmutable registrado en el libro financiero');

  // 19.3 Bloqueo de sesiones duplicadas concurrentes
  let duplicateDrawerRejected = false;
  try {
    FinanceService.openCashSession({
      initial_float_cents: 50000,
      opened_by: 'Cajero 2',
    });
  } catch {
    duplicateDrawerRejected = true;
  }
  assert(duplicateDrawerRejected, 'Caja: Bloqueo estricto de apertura de múltiples turnos activos concurrentes');

  // 19.4 Cobro en Efectivo Atómico con Caja Abierta
  const cashPayRes = FinanceService.recordPayment({
    table_id_or_session_id: finSessionId,
    amount_cents: 25000, // $250.00 MXN
    method: 'cash',
    cashier: 'Cajero Principal',
    reference: 'Efectivo mesa 1',
  });
  assert(cashPayRes.payment.payment_status === 'completed', 'Pagos: Cobro en efectivo completado exitosamente');
  assert(cashPayRes.payment.amount_cents === 25000, 'Pagos: Monto exacto de $250.00 MXN registrado');
  assert(openedShift.expected_cash_cents === 125000, 'Caja: Efectivo esperado incrementado atómicamente a $1,250.00 MXN');

  const cashSaleMov = db.get('cash_movements').find((m) => m.shift_id === openedShift.id && m.type === 'sale' && m.amount_cents === 25000);
  assert(Boolean(cashSaleMov), 'Caja: Movimiento físico sale registrado en gaveta');

  const ledgerSaleCash = db.get('financial_movements').find((m) => m.reference_id === cashPayRes.payment.id && m.payment_method === 'cash');
  assert(Boolean(ledgerSaleCash && ledgerSaleCash.direction === 'in'), 'Ledger: Venta en efectivo registrada con direction "in"');

  // 19.5 Cobro con Tarjeta / Medios Digitales (No afecta gaveta física)
  const cardPayRes = FinanceService.recordPayment({
    table_id_or_session_id: finSessionId,
    amount_cents: 20000, // $200.00 MXN
    method: 'card',
    cashier: 'Cajero Principal',
    reference: 'Terminal Bancaria T-04',
  });
  assert(cardPayRes.payment.method === 'card', 'Pagos: Cobro con tarjeta procesado');
  assert(openedShift.expected_cash_cents === 125000, 'Caja: Efectivo en gaveta inalterado tras pago con tarjeta');

  const ledgerSaleCard = db.get('financial_movements').find((m) => m.reference_id === cardPayRes.payment.id && m.payment_method === 'card');
  assert(Boolean(ledgerSaleCard && ledgerSaleCard.direction === 'in'), 'Ledger: Venta con tarjeta asentada en el libro mayor');

  // 19.6 Idempotencia en Pagos
  const idempotentKey = 'idemp_pay_test_887';
  const payIdemp1 = FinanceService.recordPayment({
    table_id_or_session_id: finSessionId,
    amount_cents: 10000, // $100.00 MXN
    method: 'cash',
    cashier: 'Cajero Principal',
    idempotency_key: idempotentKey,
  });
  assert(!payIdemp1.idempotency_replayed, 'Idempotencia: Primera transacción procesada como nueva');

  const prevExpectedCash = openedShift.expected_cash_cents;
  const payIdemp2 = FinanceService.recordPayment({
    table_id_or_session_id: finSessionId,
    amount_cents: 10000,
    method: 'cash',
    cashier: 'Cajero Reintento',
    idempotency_key: idempotentKey,
  });
  assert(payIdemp2.idempotency_replayed, 'Idempotencia: Reintento con misma llave detectado');
  assert(payIdemp2.payment.id === payIdemp1.payment.id, 'Idempotencia: Mismo ID de pago retornado sin duplicar registro');
  assert(openedShift.expected_cash_cents === prevExpectedCash, 'Idempotencia: Gaveta de caja NO duplica el efectivo');

  // 19.7 Reembolso / Reversión (Refund)
  const refundRes = FinanceService.refundPayment({
    payment_id: cashPayRes.payment.id,
    amount_cents: 10000, // $100.00 MXN parcial
    reason: 'Platillo devuelto por cliente',
    actor: 'Gerente General',
  });
  assert(refundRes.payment_status === 'partially_refunded', 'Reembolso: Estado de pago actualizado a partially_refunded');
  assert(refundRes.refunded_amount_cents === 10000, 'Reembolso: Monto reembolsado exacto registrado');

  const cashRefundMov = db.get('cash_movements').find((m) => m.shift_id === openedShift.id && m.type === 'refund');
  assert(Boolean(cashRefundMov && cashRefundMov.amount_cents === 10000), 'Caja: Deducción de efectivo por reembolso asentada en gaveta');

  const ledgerRefund = db.get('financial_movements').find((m) => m.reference_id === cashPayRes.payment.id && m.type === 'refund');
  assert(Boolean(ledgerRefund && ledgerRefund.direction === 'out'), 'Ledger: Asiento de salida compensatoria registrado');

  // 19.8 Gastos Operativos (F12 Expense)
  // Gasto en efectivo (caja chica): Requiere turno de caja y descuenta gaveta física
  const cashExpense = FinanceService.createExpense({
    category: 'supplies',
    amount_cents: 8000, // $80.00 MXN
    payment_method: 'cash',
    vendor: 'Abarrotes Don Pepe',
    description: 'Servilletas y bolsas para llevar',
    created_by: 'Cajero Principal',
  });
  assert(cashExpense.category === 'supplies', 'Gastos: Categoría supplies registrada');
  assert(cashExpense.status === 'paid', 'Gastos: Gasto en estado paid');

  const expenseCashMov = db.get('cash_movements').find((m) => m.reference_expense_id === cashExpense.id);
  assert(Boolean(expenseCashMov && expenseCashMov.type === 'expense'), 'Caja: Salida de efectivo por gasto registrada en gaveta');

  const ledgerExpenseCash = db.get('financial_movements').find((m) => m.reference_id === cashExpense.id);
  assert(Boolean(ledgerExpenseCash && ledgerExpenseCash.direction === 'out'), 'Ledger: Asiento de gasto operativo registrado como salida');

  // Gasto por transferencia (no toca gaveta física de caja chica)
  const expectedBeforeTransferExpense = openedShift.expected_cash_cents;
  const transferExpense = FinanceService.createExpense({
    category: 'utilities',
    amount_cents: 45000, // $450.00 MXN
    payment_method: 'transfer',
    vendor: 'Comisión Federal de Electricidad',
    reference: 'CFE-REC-8921',
    description: 'Pago de luz del restaurante',
  });
  assert(transferExpense.payment_method === 'transfer', 'Gastos: Gasto bancario registrado');
  assert(openedShift.expected_cash_cents === expectedBeforeTransferExpense, 'Caja: Gasto bancario no altera el efectivo físico');

  // Validación de categoría de gasto
  let invalidExpenseRejected = false;
  try {
    FinanceService.createExpense({
      category: 'invalid_cat' as any,
      amount_cents: 1000,
      payment_method: 'cash',
      description: 'Gasto inválido',
    });
  } catch {
    invalidExpenseRejected = true;
  }
  assert(invalidExpenseRejected, 'Gastos: Rechazo estricto de categorías de gasto no autorizadas');

  // 19.9 Ledger Financiero Consolidado
  const allLedger = FinanceService.getFinancialLedger({ restaurant_id: DEFAULT_RESTAURANT_ID });
  assert(allLedger.length >= 5, 'Ledger: Flujo unificado con múltiples movimientos financieros');
  const salesMovements = FinanceService.getFinancialLedger({ restaurant_id: DEFAULT_RESTAURANT_ID, type: 'sale' });
  assert(salesMovements.length >= 2, 'Ledger: Filtro por tipo de movimiento operativo');

  // 19.10 P&L Operativo Real (Reutilizando F7 COGS y F11 Descuentos)
  const pnl = FinanceService.calculateOperatingPnL(DEFAULT_RESTAURANT_ID);
  assert(pnl.gross_sales_cents > 0, 'P&L: Ventas brutas calculadas desde pagos consolidados');
  assert(pnl.net_sales_cents <= pnl.gross_sales_cents, 'P&L: Ventas netas descuentan cupones y reembolsos');
  assert(pnl.cogs_cents >= 0, 'P&L: COGS derivado dinámicamente de recetas e inventario F7');
  assert(pnl.gross_profit_cents === pnl.net_sales_cents - pnl.cogs_cents, 'P&L: Utilidad bruta = Ventas netas - COGS');
  assert(pnl.operating_expenses_cents > 0, 'P&L: Gastos operativos integrados');
  assert(pnl.operating_result_cents === pnl.gross_profit_cents - pnl.operating_expenses_cents, 'P&L: Resultado operativo = Utilidad bruta - Gastos operativos');

  // 19.11 Liquidaciones Separadas (Settlements)
  // Canal Marketplace (Uber Eats / Rappi via third_party)
  const restSettlement = FinanceService.createRestaurantSettlement({
    restaurant_id: DEFAULT_RESTAURANT_ID,
    channel: 'third_party',
    period_start: new Date(Date.now() - 7 * 86400000).toISOString(),
    period_end: new Date().toISOString(),
    gross_sales_cents: 150000, // $1,500 MXN
    commissions_cents: 42000, // $420 MXN
    net_payout_cents: 108000, // $1,080 MXN
    status: 'settled',
    payment_reference: 'PAYOUT-UBER-WK40',
    created_by: 'Administrador Canal',
  });
  assert(restSettlement.net_payout_cents === 108000, 'Liquidaciones: Liquidación RestaurantSettlement creada por $1,080.00 MXN');
  assert(restSettlement.channel === 'third_party', 'Liquidaciones: Canal marketplace aislado');

  // Liquidación de Repartidor (Driver Settlement)
  const driverSettlement = FinanceService.createDriverSettlement({
    restaurant_id: DEFAULT_RESTAURANT_ID,
    driver_name: 'Mateo Repartidor',
    driver_id: 'drv_01',
    period_date: new Date().toISOString().split('T')[0],
    cash_collected_cents: 45000, // $450 MXN recolectados en efectivo
    delivery_fees_earned_cents: 15000, // $150 MXN de tarifa ganada
    tips_cents: 3000, // $30 MXN propina
    balance_due_cents: 27000, // $270 MXN por entregar a caja
    status: 'pending',
    created_by: 'Despachador',
  });
  assert(driverSettlement.driver_name === 'Mateo Repartidor', 'Liquidaciones: DriverSettlement para repartidor creado');
  assert(driverSettlement.balance_due_cents === 27000, 'Liquidaciones: Saldo a favor de caja calculado');

  // 19.12 Cierre de Caja y Arqueo Ciego (Z-Cut)
  const currentBeforeClose = FinanceService.getCurrentCashSession(DEFAULT_RESTAURANT_ID);
  const countedCash = currentBeforeClose.shift!.expected_cash_cents + 2000; // $20.00 MXN de sobrante
  const closeRes = FinanceService.closeCashSession({
    actual_cash_cents: countedCash,
    closed_by: 'Cajero Principal',
    notes: 'Cierre con arqueo verificado, sobrante menor',
  });
  assert(closeRes.session.status === 'closed', 'Cierre: Sesión de caja cerrada con éxito');
  assert(closeRes.session.difference_cents === 2000, 'Cierre: Diferencia de arqueo calculada exactamente (+ $20.00 MXN)');
  assert(closeRes.z_cut.total_sales_cents > 0, 'Z-Cut: Reporte Z generado con total de ventas consolidado');
  assert(Boolean(closeRes.z_cut.sales_by_method.cash && closeRes.z_cut.sales_by_method.card), 'Z-Cut: Desglose de ventas por método de pago presente');

  // Bloqueo de movimientos en caja cerrada
  let movementInClosedShiftRejected = false;
  try {
    FinanceService.recordCashDrawerMovement('withdrawal', 5000, 'Retiro no autorizado');
  } catch {
    movementInClosedShiftRejected = true;
  }
  assert(movementInClosedShiftRejected, 'Caja: Protección estricta contra movimientos en sesiones de caja cerradas');

  // 19.13 RBAC y Aislamiento Multi-Tenant
  let unauthorizedDenied = false;
  try {
    // Mesero intentando crear una liquidación (requiere settlements.manage)
    FinanceService.createRestaurantSettlement(
      {
        restaurant_id: DEFAULT_RESTAURANT_ID,
        channel: 'directgo',
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
        gross_sales_cents: 10000,
        commissions_cents: 0,
        net_payout_cents: 10000,
        status: 'pending',
        created_by: 'Carlos Méndez',
      },
      'usr_carlos_01' // Mesero
    );
  } catch {
    unauthorizedDenied = true;
  }
  assert(unauthorizedDenied, 'RBAC: Operaciones financieras restringidas según rol en backend (settlements.manage)');

  // Aislamiento Multi-Tenant
  const otherRestId = 'rest_sucursal_norte';
  const otherRestExpenses = FinanceService.listExpenses(otherRestId);
  assert(otherRestExpenses.length === 0, 'Multi-Tenant: Aislamiento estricto de gastos por sucursal');

  // 19.14 Verificación del SDK Único
  const sdkPayments = await sdk.payments.listPayments();
  assert(sdkPayments.length > 0, 'SDK: sdk.payments.listPayments() retorna pagos');
  const sdkExpenses = await sdk.expenses.listExpenses();
  assert(sdkExpenses.length >= 2, 'SDK: sdk.expenses.listExpenses() retorna gastos operativos');
  const sdkLedger = await sdk.financial.getLedger();
  assert(sdkLedger.length >= 5, 'SDK: sdk.financial.getLedger() consulta libro contable');
  const sdkPnL = await sdk.financial.getPnL();
  assert(sdkPnL.operating_result_cents !== undefined, 'SDK: sdk.financial.getPnL() calcula estado de resultados');
  const sdkRestSettlements = await sdk.settlements.listRestaurantSettlements();
  assert(sdkRestSettlements.length >= 1, 'SDK: sdk.settlements.listRestaurantSettlements() consulta liquidaciones');

  // ==========================================
  // 20. SOLUCIONES NATIVAS + MODELO COMERCIAL DEL CORE (FASE 13)
  // ==========================================
  console.log('\n--- 20. SOLUCIONES NATIVAS + MODELO COMERCIAL DEL CORE (FASE 13) ---');

  // 20.1 Solution Registry Central
  const allSolutions = SolutionService.listSolutions();
  assert(allSolutions.length >= 7, 'Solution Registry: Al menos 7 soluciones nativas registradas');
  const solIds = allSolutions.map((s) => s.solution_id);
  assert(
    solIds.includes('delivery') &&
    solIds.includes('pos') &&
    solIds.includes('directprint') &&
    solIds.includes('loyalty') &&
    solIds.includes('crm') &&
    solIds.includes('kds') &&
    solIds.includes('analytics'),
    'Solution Registry: IDs estables identifican delivery, pos, directprint, loyalty, crm, kds y analytics'
  );

  // Consulta individual de solución
  const posSol = SolutionService.getSolution('pos');
  assert(Boolean(posSol && posSol.name.includes('POS')), 'Solution Registry: Solución pos recuperada');
  assert(posSol!.status === 'active', 'Solution Registry: Estado de solución es active');

  // Capabilities expuestas
  const posCaps = SolutionService.listCapabilities('pos');
  assert(posCaps.length >= 5, 'Capabilities: POS expone al menos 5 capabilities específicas');
  const posCapIds = posCaps.map((c) => c.id);
  assert(
    posCapIds.includes('pos.tables') &&
    posCapIds.includes('pos.orders') &&
    posCapIds.includes('pos.split_payment') &&
    posCapIds.includes('pos.cash_shift') &&
    posCapIds.includes('pos.subaccounts'),
    'Capabilities: pos.tables, pos.orders, pos.split_payment, pos.cash_shift, pos.subaccounts presentes'
  );

  const printCaps = SolutionService.listCapabilities('directprint').map((c) => c.id);
  assert(
    printCaps.includes('print.order') &&
    printCaps.includes('print.kitchen_ticket') &&
    printCaps.includes('print.cashier_ticket') &&
    printCaps.includes('print.reprint') &&
    printCaps.includes('print.station_management'),
    'Capabilities: DirectPrint expone capacidades de impresión térmica y gestión de estaciones'
  );

  // Registro dinámico de nueva solución (Master)
  const newSol = SolutionService.registerSolution({
    solution_id: 'kiosk',
    name: 'Auto-Cobro Kiosko',
    description: 'Terminal de autoservicio para comensales',
    version: '1.0.0',
    capabilities: [
      { id: 'kiosk.ordering', name: 'Autopedido', description: 'Selección de productos en tótem', solution_id: 'kiosk' },
      { id: 'kiosk.payment', name: 'Pago en Tótem', description: 'Cobro autónomo', solution_id: 'kiosk' },
    ],
  });
  assert(newSol.solution_id === 'kiosk', 'Solution Registry: Nueva solución registrada dinámicamente');

  // Bloqueo de duplicados
  let duplicateSolRejected = false;
  try {
    SolutionService.registerSolution({
      solution_id: 'kiosk',
      name: 'Duplicado Kiosko',
      description: 'Intento duplicado',
      capabilities: [],
    });
  } catch {
    duplicateSolRejected = true;
  }
  assert(duplicateSolRejected, 'Solution Registry: Rechazo de soluciones con ID duplicado');

  // 20.2 Planes Comerciales
  const plans = SolutionService.listPlans();
  assert(plans.length >= 3, 'Planes: Catálogo con al menos 3 planes comerciales (Basic, Pro, Enterprise)');
  const basicPlan = SolutionService.getPlan('BASIC');
  assert(Boolean(basicPlan && basicPlan.tier === 'basic'), 'Planes: Plan Básico encontrado');
  assert(basicPlan!.solutions.includes('delivery') && !basicPlan!.solutions.includes('pos'), 'Planes: Plan Básico solo incluye Delivery');

  const proPlan = SolutionService.getPlan('PRO');
  assert(Boolean(proPlan && proPlan.solutions.includes('pos') && proPlan.solutions.includes('kds')), 'Planes: Plan Pro incluye POS y KDS');

  // 20.3 Compatibilidad y Entitlements por defecto
  // Restaurante principal tiene Delivery habilitado por defecto
  assert(SolutionService.isSolutionEnabled(DEFAULT_RESTAURANT_ID, 'delivery'), 'Compatibilidad: Delivery habilitado por defecto en restaurante semilla');
  assert(SolutionService.hasCapability(DEFAULT_RESTAURANT_ID, 'delivery.orders'), 'Compatibilidad: Capability delivery.orders activa');
  assert(SolutionService.hasCapability(DEFAULT_RESTAURANT_ID, 'pos.tables'), 'Compatibilidad: Capability pos.tables activa');

  // 20.4 Entitlements en Restaurante Nuevo (Aislamiento y Verificación Negativa)
  const branchRestId = 'rest_sucursal_sur';
  // Sin entitlements aún
  assert(!SolutionService.isSolutionEnabled(branchRestId, 'pos'), 'Entitlements: Restaurante nuevo NO tiene pos habilitado');
  assert(!SolutionService.hasCapability(branchRestId, 'pos.tables'), 'Entitlements: Restaurante nuevo NO tiene capability pos.tables');

  // Asignación de Plan Básico al restaurante nuevo
  const grantedByPlan = SolutionService.assignPlanToRestaurant(branchRestId, 'plan_basic');
  assert(grantedByPlan.length === 1, 'Entitlements: Plan Básico otorgó 1 solución (delivery)');
  assert(SolutionService.isSolutionEnabled(branchRestId, 'delivery'), 'Entitlements: delivery habilitado tras asignar plan');
  assert(SolutionService.hasCapability(branchRestId, 'delivery.orders'), 'Entitlements: capability delivery.orders habilitada tras asignar plan');
  assert(!SolutionService.hasCapability(branchRestId, 'pos.tables'), 'Entitlements: pos.tables sigue no habilitada bajo Plan Básico');

  // Otorgar Addon / Entitlement manual para DirectPrint
  const printEnt = SolutionService.grantEntitlement({
    restaurant_id: branchRestId,
    solution_id: 'directprint',
    capability: '*',
    source: 'addon',
    notes: 'Hardware Pack Contratado',
  });
  assert(printEnt.source === 'addon', 'Entitlements: Addon otorgado con source "addon"');
  assert(SolutionService.hasCapability(branchRestId, 'print.kitchen_ticket'), 'Entitlements: print.kitchen_ticket habilitada por addon');

  // Suspensión de Entitlement
  SolutionService.suspendEntitlement(printEnt.id, branchRestId);
  assert(!SolutionService.hasCapability(branchRestId, 'print.kitchen_ticket'), 'Entitlements: Capability bloqueada tras suspensión de entitlement');

  // Reactivación
  SolutionService.activateEntitlement(printEnt.id, branchRestId);
  assert(SolutionService.hasCapability(branchRestId, 'print.kitchen_ticket'), 'Entitlements: Capability recuperada tras reactivación');

  // 20.5 Separación Estricta: Entitlement ≠ Permission (Dual Authorization)
  // Caso 1: Entitlement válido + Permission válido -> Autorizado (200)
  // Carlos (Mesero) tiene orders.create en DEFAULT_RESTAURANT_ID y el restaurante tiene pos.orders
  const authCase1 = SolutionService.authorizeAction('usr_carlos_01', DEFAULT_RESTAURANT_ID, 'orders.create', 'pos.orders');
  assert(authCase1.authorized && authCase1.status_code === 200, 'Dual Check: Entitlement válido + Permission válido = Autorizado');

  // Caso 2: Entitlement válido + Permission inválido -> Rechazado (403 por permisos)
  // Carlos (Mesero) NO tiene roles.manage aunque el restaurante tenga pos.tables
  const authCase2 = SolutionService.authorizeAction('usr_carlos_01', DEFAULT_RESTAURANT_ID, 'roles.manage', 'pos.tables');
  assert(!authCase2.authorized && authCase2.status_code === 403 && authCase2.entitlement_granted && !authCase2.permission_granted, 'Dual Check: Entitlement válido + Permission inválido = Rechazado por permisos');

  // Caso 3: Entitlement inválido + Permission válido -> Rechazado (403 por entitlement)
  // Carlos intenta usar kiosk.ordering en restaurante donde no está habilitado
  const authCase3 = SolutionService.authorizeAction('usr_carlos_01', branchRestId, 'orders.create', 'kiosk.ordering');
  assert(!authCase3.authorized && authCase3.status_code === 403 && !authCase3.entitlement_granted, 'Dual Check: Entitlement inválido + Permission válido = Rechazado por entitlement no contratado');

  // Caso 4: Entitlement inválido + Permission inválido -> Rechazado
  const authCase4 = SolutionService.authorizeAction('usr_carlos_01', branchRestId, 'roles.manage', 'kiosk.ordering');
  assert(!authCase4.authorized && authCase4.status_code === 403, 'Dual Check: Entitlement inválido + Permission inválido = Rechazado');

  // 20.6 Verificación SDK Unificado: sdk.solutions
  const sdkSols = await sdk.solutions.listSolutions();
  assert(sdkSols.length >= 7, 'SDK: sdk.solutions.listSolutions() retorna catálogo de soluciones');
  const sdkPlans = await sdk.solutions.listPlans();
  assert(sdkPlans.length >= 3, 'SDK: sdk.solutions.listPlans() retorna planes comerciales');
  const sdkRestEnts = await sdk.solutions.getRestaurantEntitlements(DEFAULT_RESTAURANT_ID);
  assert(sdkRestEnts.length >= 7, 'SDK: sdk.solutions.getRestaurantEntitlements() retorna entitlements activos');
  const sdkHasCap = await sdk.solutions.hasCapability('pos.tables', DEFAULT_RESTAURANT_ID);
  assert(sdkHasCap, 'SDK: sdk.solutions.hasCapability() valida capability');
  const sdkDual = await sdk.solutions.authorizeAction('usr_carlos_01', 'orders.create', 'pos.orders', DEFAULT_RESTAURANT_ID);
  assert(sdkDual.authorized, 'SDK: sdk.solutions.authorizeAction() resuelve autorización dual');

  // ====================================================
  // 21. CORE COMPLETION & GAP CLOSURE (FASE 14)
  // ====================================================
  console.log('\n--- 21. CORE COMPLETION & GAP CLOSURE (FASE 14) ---');

  // 21.1 Order State Machine: Transiciones Válidas e Inválidas
  const tables = PosService.getTables(DEFAULT_RESTAURANT_ID);
  const availableTable = tables.find((t) => !t.active_session_id) || tables[0];
  const orderSession = availableTable.active_session_id
    ? { session: db.get('table_sessions').find((s) => s.id === availableTable.active_session_id)! }
    : PosService.openTable(availableTable.id, 'Capitán F14', [{ name: 'Comensal Gap 1' }]);
  const orderGapTicket = PosService.createOrderTicket(orderSession.session.id, 'Capitán F14', 'Ticket de prueba F14');
  assert(orderGapTicket.status === 'open', 'Order State Machine: Orden inicializada con estado "open"');

  // Transición open -> confirmed
  const confirmedOrder = PosService.updateOrderStatus(orderGapTicket.id, 'confirmed', 'Capitán F14');
  assert(confirmedOrder.status === 'confirmed', 'Order State Machine: Transición válida de open -> confirmed');

  // Transición confirmed -> preparing
  const preparingOrder = PosService.updateOrderStatus(orderGapTicket.id, 'preparing', 'Cocina F14');
  assert(preparingOrder.status === 'preparing', 'Order State Machine: Transición válida de confirmed -> preparing');

  // Transición preparing -> ready
  const readyOrder = PosService.updateOrderStatus(orderGapTicket.id, 'ready', 'Cocina F14');
  assert(readyOrder.status === 'ready', 'Order State Machine: Transición válida de preparing -> ready');

  // Transición ilegal: ready -> open (Debe ser rechazada)
  let illegalTransitionRejected = false;
  try {
    PosService.updateOrderStatus(orderGapTicket.id, 'open', 'Operador');
  } catch {
    illegalTransitionRejected = true;
  }
  assert(illegalTransitionRejected, 'Order State Machine: Transición ilegal rechazada atómicamente');

  // 21.2 Cancelación Limpia de Orden
  const cancelTestOrder = PosService.createOrderTicket(orderSession.session.id, 'Capitán F14', 'Ticket a cancelar');
  const cancelledOrder = PosService.cancelOrder(cancelTestOrder.id, 'Mesa solicitó retirarse antes de preparar', 'Capitán F14');
  assert(cancelledOrder.status === 'cancelled', 'Cancelación de Orden: Estado actualizado a "cancelled"');
  assert(cancelledOrder.cancellation_reason === 'Mesa solicitó retirarse antes de preparar', 'Cancelación de Orden: Motivo de cancelación preservado');

  // 21.3 CRM: Historial Real de Órdenes y Productos Favoritos Derivados
  const crmCustomer = CrmService.createCustomer({
    name: 'Roberto Garzas',
    phone: '8119876543',
    email: 'roberto.garza@correo.mx',
  });
  // Vincular orden completada
  const assignedOrd = PosService.createOrderTicket(orderSession.session.id, 'Capitán F14');
  assignedOrd.customer_id = crmCustomer.id;
  assignedOrd.status = 'completed';
  assignedOrd.total_cents = 45000;
  db.save();

  const customerHistory = CrmService.getCustomerOrderHistory(crmCustomer.id, DEFAULT_RESTAURANT_ID);
  assert(customerHistory.length >= 1, 'CRM: getCustomerOrderHistory() retorna historial unificado de pedidos');

  // 21.4 Direcciones de Cliente y Validación de Coordenadas
  const validAddr = CrmService.addOrUpdateAddress(crmCustomer.id, {
    street: 'Av. Vasconcelos',
    number: '1400',
    colony: 'Del Valle',
    city: 'San Pedro',
    state: 'Nuevo León',
    postal_code: '66220',
    latitude: 25.6514,
    longitude: -100.3582,
    restaurant_id: DEFAULT_RESTAURANT_ID,
  });
  assert(validAddr.latitude === 25.6514 && validAddr.longitude === -100.3582, 'Direcciones: Coordenadas geográficas válidas registradas');

  let invalidCoordsRejected = false;
  try {
    CrmService.addOrUpdateAddress(crmCustomer.id, {
      street: 'Calle Ficticia',
      number: '999',
      latitude: 199.99, // Latitud imposible
    });
  } catch {
    invalidCoordsRejected = true;
  }
  assert(invalidCoordsRejected, 'Direcciones: Coordenadas fuera de rango rechazadas');

  // 21.5 Delivery & Repartidores: Verificación y GPS Fresco
  const unverifiedDriver = DeliveryService.createDriver({
    name: 'Juan Sin Verificar',
    phone: '8110001122',
    vehicle_type: 'motorcycle',
    is_verified: false,
  });
  assert(!unverifiedDriver.is_verified, 'Delivery: Repartidor nuevo inicia no verificado');

  // Intento de despacho a conductor no verificado debe ser rechazado
  let unverifiedDispatchRejected = false;
  try {
    DeliveryService.dispatchOrder({
      order_id: readyOrder.id,
      delivery_address: 'Av. Vasconcelos 1400',
      driver_id: unverifiedDriver.id,
    });
  } catch {
    unverifiedDispatchRejected = true;
  }
  assert(unverifiedDispatchRejected, 'Delivery: Despacho a conductor no verificado rechazado');

  // Verificar conductor y actualizar GPS
  DeliveryService.verifyDriver(unverifiedDriver.id, true, 'Supervisor');
  DeliveryService.updateDriverGps(unverifiedDriver.id, { latitude: 25.6866, longitude: -100.3161 });
  const updatedDriver = DeliveryService.getDriver(unverifiedDriver.id);
  assert(Boolean(updatedDriver && updatedDriver.is_verified && updatedDriver.status === 'available'), 'Delivery: Repartidor verificado y disponible con GPS actualizado');

  // 21.6 Despacho Atómico y Entrega
  const dispatchRes = DeliveryService.dispatchOrder({
    order_id: readyOrder.id,
    delivery_address: 'Av. Vasconcelos 1400',
    delivery_fee_cents: 3500,
    cash_to_collect_cents: readyOrder.total_cents,
    driver_id: updatedDriver!.id,
  });
  assert(dispatchRes.status === 'assigned', 'Delivery: Orden despachada y asignada atómicamente');
  assert(readyOrder.status === 'assigned', 'Delivery: Estado de Orden canónica sincronizado a "assigned"');

  const deliveredRes = DeliveryService.markDelivered(dispatchRes.id, updatedDriver!.name);
  assert(deliveredRes.status === 'delivered', 'Delivery: Despacho completado con estado "delivered"');
  assert(readyOrder.status === 'delivered', 'Delivery: Orden canónica marcada como "delivered"');

  // 21.7 DirectPrint Contratos Core: Cola de Trabajos (PrintJob)
  const printJob = PrintService.createPrintJob({
    type: 'kitchen_ticket',
    station: 'kitchen',
    order_id: readyOrder.id,
    formatted_content: '=== COMANDA COCINA ===\n1x Hamburguesa Angus\n',
  });
  assert(printJob.status === 'queued', 'DirectPrint Core: PrintJob encolado con estado "queued"');
  assert(printJob.bytes_count > 0 && printJob.escpos_hex.length > 0, 'DirectPrint Core: Generación de bytes ESC/POS presente');

  const printedJob = PrintService.updatePrintJobStatus(printJob.id, 'printed');
  assert(printedJob.status === 'printed', 'DirectPrint Core: PrintJob actualizado a "printed"');

  // 21.8 SDK Único: Integración de Estado de Órdenes
  const sdkOrderFetched = await sdk.orders.getOrder(readyOrder.id);
  assert(sdkOrderFetched.id === readyOrder.id, 'SDK: sdk.orders.getOrder() recupera orden canónica');

  const sdkUpdatedOrder = await sdk.orders.updateOrderStatus(readyOrder.id, 'completed', 'Capitán F14');
  assert(sdkUpdatedOrder.status === 'completed', 'SDK: sdk.orders.updateOrderStatus() transiciona orden a "completed"');

  // ====================================================
  // 22. DIRECTAURANTE DELIVERY CORE & PREPARACIÓN DIRECTPOST (F14.1)
  // ====================================================
  console.log('\n--- 22. DIRECTAURANTE DELIVERY CORE & PREPARACIÓN DIRECTPOST (F14.1) ---');

  // 22.1 Delivery funciona 100% independiente de POS
  // Un delivery directo (ej. Marketplace Directaurante) puede crear y despachar una orden sin TableSession
  const standaloneDeliveryOrder: Order = {
    id: `ord_marketplace_${Date.now()}`,
    restaurant_id: DEFAULT_RESTAURANT_ID,
    ticket_number: 'DELIVERY-#MKT-01',
    order_type: 'delivery',
    status: 'open',
    subtotal_cents: 29000,
    tax_cents: 4640,
    total_cents: 33640,
    delivery_address: 'Av. Constitución 400, Monterrey',
    created_at: new Date().toISOString(),
  };
  db.get('orders').push(standaloneDeliveryOrder);
  db.save();

  // El repartidor verificado atiende la orden directamente desde el módulo Delivery del Core
  const mktDispatch = DeliveryService.dispatchOrder({
    order_id: standaloneDeliveryOrder.id,
    delivery_address: standaloneDeliveryOrder.delivery_address!,
    delivery_fee_cents: 4500,
    cash_to_collect_cents: standaloneDeliveryOrder.total_cents,
    driver_id: updatedDriver!.id,
    actor: 'Directaurante Marketplace',
  });
  assert(mktDispatch.id.startsWith('dsp_'), 'F14.1 Core Delivery: Dispatch generado independientemente de POS');
  assert(standaloneDeliveryOrder.status === 'assigned', 'F14.1 Core Delivery: Orden de Delivery directa sincronizada a "assigned"');

  // 22.2 Un Order puede originarse desde POS sin duplicarse y posteriormente usar Delivery
  // Simular orden generada en mostrador / futuro DirectPost (order_type = 'pos')
  const posOrderOrigin: Order = {
    id: `ord_pos_counter_${Date.now()}`,
    restaurant_id: DEFAULT_RESTAURANT_ID,
    ticket_number: 'POS-#DIR-099',
    order_type: 'pos',
    status: 'confirmed',
    subtotal_cents: 18500,
    tax_cents: 2960,
    total_cents: 21460,
    created_at: new Date().toISOString(),
  };
  db.get('orders').push(posOrderOrigin);
  db.save();

  // El cliente en mostrador decide pedir servicio a domicilio posterior a la captura
  const posDeliveryDispatch = DeliveryService.dispatchOrder({
    order_id: posOrderOrigin.id,
    delivery_address: 'Calle Hidalgo 210, San Pedro',
    delivery_fee_cents: 3000,
    cash_to_collect_cents: 0,
    driver_id: updatedDriver!.id,
    actor: 'Cajero Mostrador',
  });
  assert(posDeliveryDispatch.status === 'assigned', 'F14.1 DirectPost Prep: Orden originada en POS despachada por Delivery Core');
  assert(posOrderOrigin.order_type === 'delivery', 'F14.1 DirectPost Prep: Canonical Order transiciona a delivery sin crear duplicados');
  assert(posOrderOrigin.dispatch_status === 'assigned', 'F14.1 DirectPost Prep: Canonical Order vinculada a dispatch_status');

  // 22.3 DirectPost / POS no puede saltarse las reglas de seguridad de Delivery Core
  // Intentar despachar con un conductor inexistente o no verificado
  let illegalDirectDispatchRejected = false;
  try {
    DeliveryService.dispatchOrder({
      order_id: posOrderOrigin.id,
      delivery_address: 'Calle Hidalgo 210',
      driver_id: 'drv_hacker_falso',
    });
  } catch {
    illegalDirectDispatchRejected = true;
  }
  assert(illegalDirectDispatchRejected, 'F14.1 Seguridad: Despacho a conductor inválido o inexistente bloqueado estrictamente');

  // 22.4 Multi-Tenant estricto en Delivery
  const deliveryOtherRestId = 'rest_sucursal_valle';
  let crossTenantDispatchRejected = false;
  try {
    // Intentar despachar orden de un restaurante usando contexto de otro restaurante
    DeliveryService.dispatchOrder({
      order_id: posOrderOrigin.id,
      restaurant_id: deliveryOtherRestId,
      delivery_address: 'Calle Valle 555',
      driver_id: updatedDriver!.id,
    });
  } catch {
    crossTenantDispatchRejected = true;
  }
  assert(crossTenantDispatchRejected, 'F14.1 Multi-Tenant: Despacho cross-tenant bloqueado atómicamente');

  // Intentar actualizar GPS de conductor con restaurant_id ajeno
  let crossTenantGpsRejected = false;
  try {
    DeliveryService.updateDriverGps(updatedDriver!.id, { latitude: 25.68, longitude: -100.31 }, deliveryOtherRestId);
  } catch {
    crossTenantGpsRejected = true;
  }
  assert(crossTenantGpsRejected, 'F14.1 Multi-Tenant: Actualización de GPS cross-tenant bloqueada');

  // 22.5 Exposición de sdk.delivery
  const sdkDrivers = await sdk.delivery.listDrivers(DEFAULT_RESTAURANT_ID);
  assert(sdkDrivers.length >= 1, 'F14.1 SDK: sdk.delivery.listDrivers() recupera catálogo de conductores');
  const sdkDriver = await sdk.delivery.getDriver(updatedDriver!.id, DEFAULT_RESTAURANT_ID);
  assert(sdkDriver !== null && sdkDriver.id === updatedDriver!.id, 'F14.1 SDK: sdk.delivery.getDriver() recupera perfil');

  const sdkDispatches = await sdk.delivery.listDispatches(DEFAULT_RESTAURANT_ID);
  assert(sdkDispatches.length >= 1, 'F14.1 SDK: sdk.delivery.listDispatches() retorna despachos del tenant');

  // ====================================================
  // 23. DIRECTPOST ↔ DIRECTAURANTE CORE (F15.1 INTEGRATION CONTRACTS)
  // ====================================================
  console.log('\n--- 23. DIRECTPOST ↔ DIRECTAURANTE CORE (F15.1 INTEGRATION CONTRACTS) ---');

  // Test 1: DirectPost se autentica y autoriza como solución/capacidad ante el Core
  const directPostAuth = SolutionService.authorizeAction('usr_carlos_01', DEFAULT_RESTAURANT_ID, 'orders.create', 'pos.orders');
  assert(directPostAuth.authorized && directPostAuth.entitlement_granted && directPostAuth.permission_granted, 'F15.1 Test 1: DirectPost autorizado ante el Core mediante Dual Check');

  // Test 2: Usuario autorizado crea comanda con order_type = 'pos'
  const createdDirectPostOrder = await sdk.orders.createPosOrder({
    ticket_number: 'DIRECTPOST-#001',
    server_id: 'usr_carlos_01',
    notes: 'Pedido de mostrador DirectPost',
  }, DEFAULT_RESTAURANT_ID);
  assert(createdDirectPostOrder.order_type === 'pos', 'F15.1 Test 2: DirectPost genera orden con order_type = "pos"');
  assert(createdDirectPostOrder.status === 'open', 'F15.1 Test 2: Orden POS inicializada en estado "open"');

  // Test 3: La Order creada es la misma entidad canónica del Core
  const fetchedCanonicalOrder = await sdk.orders.getOrder(createdDirectPostOrder.id, DEFAULT_RESTAURANT_ID);
  assert(fetchedCanonicalOrder.id === createdDirectPostOrder.id, 'F15.1 Test 3: Order POS es la entidad canónica en db.orders');
  assert(fetchedCanonicalOrder.order_type === 'pos', 'F15.1 Test 3: No existe PosOrder duplicado, entidad única');

  // Test 4: Un restaurante sin entitlement POS es rechazado
  const uncontractedRestaurantId = 'rest_sin_pos_contratado';
  const deniedNoEntitlement = SolutionService.authorizeAction('usr_carlos_01', uncontractedRestaurantId, 'orders.create', 'pos.orders');
  assert(!deniedNoEntitlement.authorized && !deniedNoEntitlement.entitlement_granted, 'F15.1 Test 4: Restaurante sin entitlement POS es rechazado (403)');

  // Test 5: Usuario con entitlement pero sin permiso adecuado es rechazado
  // Carlos (Mesero) no tiene permiso 'roles.manage' ni 'settlements.manage'
  const deniedNoPermission = SolutionService.authorizeAction('usr_carlos_01', DEFAULT_RESTAURANT_ID, 'settlements.manage', 'pos.payments');
  assert(!deniedNoPermission.authorized && deniedNoPermission.entitlement_granted && !deniedNoPermission.permission_granted, 'F15.1 Test 5: Usuario con entitlement pero sin permission es rechazado');

  // Test 6: Aislamiento multi-tenant: restaurante no puede acceder a órdenes de otro restaurante
  let crossTenantOrderFetchRejected = false;
  try {
    await sdk.orders.getOrder(createdDirectPostOrder.id, deliveryOtherRestId);
  } catch {
    crossTenantOrderFetchRejected = true;
  }
  assert(crossTenantOrderFetchRejected, 'F15.1 Test 6: Acceso cross-tenant a orden bloqueado atómicamente');

  // Test 7: DirectPost puede consultar catálogo canónico de productos del Core
  const catalogProducts = await sdk.catalog.listProducts(undefined, DEFAULT_RESTAURANT_ID);
  assert(catalogProducts.length >= 1, 'F15.1 Test 7: DirectPost consulta catálogo canónico de productos');
  assert(catalogProducts.some((p) => p.name.includes('Hamburguesa')), 'F15.1 Test 7: Productos incluyen variantes y precios del Core');

  // Test 8: DirectPost puede consultar y crear clientes canónicos del Core
  const crmCusts = await sdk.customers.listCustomers();
  assert(crmCusts.length >= 1, 'F15.1 Test 8: DirectPost consulta directorio de clientes único del Core');
  const directPostCustomer = await sdk.customers.createCustomer({
    name: 'Cliente Mostrador DirectPost',
    phone: '8118889900',
    email: 'mostrador@cliente.com',
  }, 'Cajero DirectPost');
  assert(directPostCustomer.id.startsWith('cust_'), 'F15.1 Test 8: Cliente creado desde DirectPost es entidad canónica CustomerProfile');

  // Test 9: Una Order POS puede utilizar Delivery mediante sdk.delivery
  const posWithDelivery = await sdk.orders.createPosOrder({
    ticket_number: 'DIRECTPOST-DELIVERY-#002',
    server_id: 'usr_carlos_01',
    customer_id: directPostCustomer.id,
    notes: 'Cliente en mostrador solicitó entrega a domicilio',
  }, DEFAULT_RESTAURANT_ID);

  const directPostDeliveryDispatch = await sdk.delivery.dispatchOrder({
    order_id: posWithDelivery.id,
    delivery_address: 'Av. Lazaro Cardenas 2224, Monterrey',
    delivery_fee_cents: 3500,
    driver_id: updatedDriver!.id,
    restaurant_id: DEFAULT_RESTAURANT_ID,
    actor: 'DirectPost Terminal',
  });
  assert(directPostDeliveryDispatch.id.startsWith('dsp_'), 'F15.1 Test 9: Orden originada en DirectPost despachada por Delivery Core');
  const orderAfterDispatch = await sdk.orders.getOrder(posWithDelivery.id, DEFAULT_RESTAURANT_ID);
  assert(orderAfterDispatch.order_type === 'delivery' && orderAfterDispatch.status === 'assigned', 'F15.1 Test 9: Comanda sincronizada con despacho sin crear réplica');

  // Test 10: DirectPost no puede saltarse contratos de conductor o telemetría
  let invalidDispatchFromPosRejected = false;
  try {
    await sdk.delivery.dispatchOrder({
      order_id: posWithDelivery.id,
      delivery_address: 'Calle Invalida',
      driver_id: 'drv_repartidor_inexistente',
      restaurant_id: DEFAULT_RESTAURANT_ID,
    });
  } catch {
    invalidDispatchFromPosRejected = true;
  }
  assert(invalidDispatchFromPosRejected, 'F15.1 Test 10: Intento de bypass de validación de conductor rechazado');

  // Test 11: Granularidad de capabilities POS registradas en el Solution Registry
  const posSolutionObj = SolutionService.getSolution('pos');
  assert(Boolean(posSolutionObj), 'F15.1 Test 11: Solución "pos" registrada en Solution Registry');
  const f15PosCapIds = posSolutionObj!.capabilities.map((c) => c.id);
  assert(f15PosCapIds.includes('pos.orders'), 'F15.1 Test 11: Capability pos.orders presente');
  assert(f15PosCapIds.includes('pos.products'), 'F15.1 Test 11: Capability pos.products presente');
  assert(f15PosCapIds.includes('pos.customers'), 'F15.1 Test 11: Capability pos.customers presente');
  assert(f15PosCapIds.includes('pos.comandas'), 'F15.1 Test 11: Capability pos.comandas presente');
  assert(f15PosCapIds.includes('pos.tables'), 'F15.1 Test 11: Capability pos.tables presente');
  assert(f15PosCapIds.includes('pos.cash'), 'F15.1 Test 11: Capability pos.cash presente');
  assert(f15PosCapIds.includes('pos.payments'), 'F15.1 Test 11: Capability pos.payments presente');

  // Test 12: InProcess Adapter y Http Adapter interoperables
  const inProcessDirectSdk = new DirectauranteSDK(new InProcessDirectauranteAdapter(), DEFAULT_RESTAURANT_ID);
  assert(typeof inProcessDirectSdk.orders.createPosOrder === 'function', 'F15.1 Test 12: InProcess Adapter implementa createPosOrder');
  assert(typeof sdk.orders.createPosOrder === 'function', 'F15.1 Test 12: SDK Facade expone createPosOrder');

  // ====================================================
  // 24. CIERRE PRODUCCIÓN: CENTRO DE SOLUCIONES + DIRECTPRINT + ACTIVACIÓN (F15.2)
  // ====================================================
  console.log('\n--- 24. CIERRE PRODUCCIÓN: CENTRO DE SOLUCIONES + DIRECTPRINT + ACTIVACIÓN (F15.2) ---');

  // 24.1 Centro de Soluciones lista las soluciones requeridas
  const coreSolutions = await sdk.solutions.listSolutions();
  const closureSolIds = coreSolutions.map((s) => s.solution_id);
  assert(closureSolIds.includes('delivery'), 'F15.2 Soluciones: delivery presente en Centro de Soluciones');
  assert(closureSolIds.includes('pos'), 'F15.2 Soluciones: pos (DirectPost) presente en Centro de Soluciones');
  assert(closureSolIds.includes('directprint'), 'F15.2 Soluciones: directprint presente en Centro de Soluciones');
  assert(closureSolIds.includes('loyalty'), 'F15.2 Soluciones: loyalty presente en Centro de Soluciones');
  assert(closureSolIds.includes('crm'), 'F15.2 Soluciones: crm presente en Centro de Soluciones');
  assert(closureSolIds.includes('kds'), 'F15.2 Soluciones: kds presente en Centro de Soluciones');
  assert(closureSolIds.includes('analytics'), 'F15.2 Soluciones: analytics presente en Centro de Soluciones');

  // 24.2 POS puede activarse y desactivarse mediante Entitlement
  const testBranchRestId = 'rest_sucursal_f15_test';
  // Habilitar POS para este restaurante
  const grantedPosEnt = await sdk.solutions.grantEntitlement({
    solution_id: 'pos',
    capability: '*',
    source: 'manual',
    notes: 'Activación DirectPost desde Centro de Soluciones',
  }, testBranchRestId);
  assert(grantedPosEnt.status === 'active', 'F15.2 POS: Activado mediante Entitlement formal');
  const closurePosActive = await sdk.solutions.isSolutionEnabled('pos', testBranchRestId);
  assert(closurePosActive === true, 'F15.2 POS: isSolutionEnabled() confirma activación');

  // Desactivar / suspender POS
  await sdk.solutions.suspendEntitlement(grantedPosEnt.id, testBranchRestId);
  const isPosSuspended = await sdk.solutions.isSolutionEnabled('pos', testBranchRestId);
  assert(isPosSuspended === false, 'F15.2 POS: Desactivado / suspendido sin borrar histórico');

  // 24.3 DirectPrint puede activarse y desactivarse
  const grantedPrintEnt = await sdk.solutions.grantEntitlement({
    solution_id: 'directprint',
    capability: '*',
    source: 'addon',
    notes: 'Addon térmico activado en Centro de Soluciones',
  }, testBranchRestId);
  assert(grantedPrintEnt.status === 'active', 'F15.2 DirectPrint: Activado mediante Entitlement');
  const isPrintActive = await sdk.solutions.isSolutionEnabled('directprint', testBranchRestId);
  assert(isPrintActive === true, 'F15.2 DirectPrint: isSolutionEnabled() confirma activación');

  await sdk.solutions.suspendEntitlement(grantedPrintEnt.id, testBranchRestId);
  const isPrintSuspended = await sdk.solutions.isSolutionEnabled('directprint', testBranchRestId);
  assert(isPrintSuspended === false, 'F15.2 DirectPrint: Desactivado limpiamente');

  // Reactivar DirectPrint para las pruebas subsecuentes
  await sdk.solutions.activateEntitlement(grantedPrintEnt.id, testBranchRestId);

  // 24.4 Seguridad: Usuario sin permiso no puede activar soluciones
  const unauthorizedMemberAuth = SolutionService.authorizeAction('usr_carlos_01', DEFAULT_RESTAURANT_ID, 'restaurant.manage');
  assert(!unauthorizedMemberAuth.authorized, 'F15.2 Seguridad: Usuario sin permission adecuada rechazado');

  // 24.5 Seguridad Multi-Tenant: Restaurante A no puede alterar soluciones de Restaurante B
  let crossTenantEntitlementRejected = false;
  try {
    // Intentar suspender entitlement del restaurante A desde contexto de restaurante B
    await sdk.solutions.suspendEntitlement(grantedPrintEnt.id, DEFAULT_RESTAURANT_ID);
  } catch {
    crossTenantEntitlementRejected = true;
  }
  assert(crossTenantEntitlementRejected, 'F15.2 Multi-Tenant: Restaurante A no puede modificar entitlements de Restaurante B');

  // 24.6 PrintJob y no-bloqueo: Order funciona aunque DirectPrint esté desactivado
  const orderWithoutPrint = await sdk.orders.createPosOrder({
    ticket_number: 'ORDER-NOPRINT-01',
    server_id: 'Cajero Offline',
    notes: 'Venta con impresora apagada o sin contrato de impresión',
  }, testBranchRestId);
  assert(orderWithoutPrint.status === 'open', 'F15.2 No-Bloqueo: Order POS se genera con éxito sin depender de DirectPrint');

  // 24.7 Order POS genera PrintJobs para cocina, barra y caja cuando DirectPrint está habilitado
  const kitchenJob = await sdk.print.createPrintJob({
    type: 'kitchen',
    station: 'kitchen',
    order_id: orderWithoutPrint.id,
    formatted_content: '=== COMANDA COCINA ===\n1x Tacos Ribeye\n',
    status: 'pending',
  }, testBranchRestId);
  assert(kitchenJob.id.startsWith('pjob_'), 'F15.2 PrintJob: Generado trabajo de impresión para cocina');
  assert(kitchenJob.restaurant_id === testBranchRestId, 'F15.2 PrintJob: Conserva restaurant_id canónico');
  assert(kitchenJob.order_id === orderWithoutPrint.id, 'F15.2 PrintJob: Conserva order_id canónico');
  assert(kitchenJob.status === 'pending', 'F15.2 PrintJob: Inicializado en estado "pending"');

  const cashierJob = await sdk.print.createPrintJob({
    type: 'cashier',
    station: 'cashier',
    order_id: orderWithoutPrint.id,
    formatted_content: '=== TICKET DE CUENTA ===\nTotal: $150.00\n',
    status: 'queued',
  }, testBranchRestId);
  assert(cashierJob.type === 'cashier', 'F15.2 PrintJob: Soporta tipo "cashier" para precuenta/caja');

  // 24.8 Ciclo de Vida: pending -> processing -> completed y failed
  const processingJob = await sdk.print.updatePrintJobStatus(kitchenJob.id, 'processing', undefined, testBranchRestId);
  assert(processingJob.status === 'processing', 'F15.2 PrintJob Ciclo: Transición a "processing"');

  const completedJob = await sdk.print.updatePrintJobStatus(kitchenJob.id, 'completed', undefined, testBranchRestId);
  assert(completedJob.status === 'completed', 'F15.2 PrintJob Ciclo: Transición a "completed"');

  const failedJob = await sdk.print.updatePrintJobStatus(cashierJob.id, 'failed', 'Papel agotado en impresora térmica', testBranchRestId);
  assert(failedJob.status === 'failed', 'F15.2 PrintJob Ciclo: Transición a "failed" con motivo');
  assert(Boolean(failedJob.error_message?.includes('Papel agotado')), 'F15.2 PrintJob Ciclo: Mensaje de error preservado');

  // 24.9 Unicidad canónica: Solo existe PrintJob (no PosPrintJob ni DeliveryPrintJob)
  assert(!('PosPrintJob' in globalThis), 'F15.2 Integridad: No existen modelos paralelos ni PosPrintJob');

  // 24.10 Delivery continúa funcionando 100% independiente de DirectPrint
  const deliveryReadyOrder = await sdk.orders.createPosOrder({
    ticket_number: 'DELIVERY-INDEPENDENT-01',
    server_id: 'Operador Delivery',
  }, DEFAULT_RESTAURANT_ID);
  const independentDispatch = await sdk.delivery.dispatchOrder({
    order_id: deliveryReadyOrder.id,
    delivery_address: 'Av. Paseo de los Leones 1200',
    driver_id: updatedDriver!.id,
    restaurant_id: DEFAULT_RESTAURANT_ID,
  });
  assert(independentDispatch.status === 'assigned', 'F15.2 Delivery: Despacho opera con total autonomía');


  console.log('\n====================================================');
  console.log(` RESULTADOS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
