/**
 * DIRECTAURANTE POS CORE v0.1 - DirectPrint Module (ESC/POS)
 * Multi-station ticket printer routing and ESC/POS byte sequence generation.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import { Printer, PrinterRoutingRule, OrderItem } from '../../core/types';

export class PrintService {
  public static getPrinters(restaurant_id: string = DEFAULT_RESTAURANT_ID): Printer[] {
    return db.get('printers').filter((p) => p.restaurant_id === restaurant_id);
  }

  public static getRoutingRules(restaurant_id: string = DEFAULT_RESTAURANT_ID): PrinterRoutingRule[] {
    return db.get('printer_routing_rules').filter((r) => r.restaurant_id === restaurant_id);
  }

  /**
   * Generates formatted text & simulated ESC/POS hexadecimal command sequence
   */
  public static generateEscPosTicket(
    station: 'kitchen' | 'bar' | 'cashier',
    table_number: string,
    waiter: string,
    items: OrderItem[],
    restaurant_name: string = 'Directaurante'
  ): { formatted_ticket: string; escpos_hex: string; bytes_count: number } {
    const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const separator = '='.repeat(38);
    const thinSeparator = '-'.repeat(38);

    const lines: string[] = [];
    lines.push(separator);
    lines.push(`   ${restaurant_name.toUpperCase()}`);
    lines.push(`   COMANDA DE ${station.toUpperCase()} - MODO ESC/POS`);
    lines.push(separator);
    lines.push(`MESA: ${table_number.padEnd(16)} HORA: ${now}`);
    lines.push(`MESERO: ${waiter.padEnd(14)} ESTACIÓN: ${station.toUpperCase()}`);
    lines.push(thinSeparator);
    lines.push(`CANT  DESCRIPCIÓN              COMENSAL`);
    lines.push(thinSeparator);

    items.forEach((item) => {
      const qty = `${item.quantity}x`.padEnd(5);
      const name = item.product_name.slice(0, 22).padEnd(23);
      const seat = `${item.seat_number} ${item.guest_name.slice(0, 6)}`;
      lines.push(`${qty} ${name} ${seat}`);
      if (item.notes) {
        lines.push(`      * NOTA: ${item.notes}`);
      }
    });

    lines.push(thinSeparator);
    lines.push(`TOTAL ARTÍCULOS: ${items.reduce((acc, i) => acc + i.quantity, 0)}`);
    lines.push(separator);
    lines.push(`\n\n\n`); // Feed lines for cutter

    const formatted_ticket = lines.join('\n');

    // Simulate ESC/POS byte sequence:
    // ESC @ (Init: 1B 40)
    // ESC a 1 (Center: 1B 61 01)
    // ESC ! 38 (Double height & width: 1B 21 38)
    // GS V 66 00 (Cut: 1D 56 42 00)
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(formatted_ticket);
    const escpos_hex = `1B401B6101${Array.from(textBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}1D564200`;

    return {
      formatted_ticket,
      escpos_hex,
      bytes_count: textBytes.length + 10,
    };
  }

  /**
   * Generates Pre-cuenta / Pre-check ticket (Read-only financial consumer)
   */
  public static generatePreCheckTicket(
    bill: {
      table_number: string;
      subtotal_cents: number;
      tax_cents: number;
      total_cents: number;
      paid_cents: number;
      balance_cents: number;
      subaccounts?: Array<{ seat_number: string; display_name: string; total_cents: number }>;
    },
    restaurant_name: string = 'Directaurante'
  ): { formatted_ticket: string; escpos_hex: string; bytes_count: number } {
    const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const separator = '='.repeat(38);
    const thinSeparator = '-'.repeat(38);

    const lines: string[] = [];
    lines.push(separator);
    lines.push(`   ${restaurant_name.toUpperCase()}`);
    lines.push(`         PRE-CUENTA DE CONSUMO`);
    lines.push(separator);
    lines.push(`MESA: ${bill.table_number.padEnd(16)} HORA: ${now}`);
    lines.push(`* ESTE DOCUMENTO NO ES COMPROBANTE FISCAL *`);
    lines.push(thinSeparator);

    if (bill.subaccounts && bill.subaccounts.length > 0) {
      lines.push(`DESGLOSE POR COMENSAL:`);
      bill.subaccounts.forEach((s) => {
        const name = `${s.seat_number} ${s.display_name}`.slice(0, 24).padEnd(25);
        const amt = `$${(s.total_cents / 100).toFixed(2)}`.padStart(11);
        lines.push(`${name} ${amt}`);
      });
      lines.push(thinSeparator);
    }

    lines.push(`SUBTOTAL:`.padEnd(26) + `$${(bill.subtotal_cents / 100).toFixed(2)}`.padStart(12));
    lines.push(`I.V.A. (16%):`.padEnd(26) + `$${(bill.tax_cents / 100).toFixed(2)}`.padStart(12));
    lines.push(separator);
    lines.push(`TOTAL CUENTA:`.padEnd(26) + `$${(bill.total_cents / 100).toFixed(2)}`.padStart(12));
    if (bill.paid_cents > 0) {
      lines.push(`PAGADO:`.padEnd(26) + `$${(bill.paid_cents / 100).toFixed(2)}`.padStart(12));
      lines.push(`PENDIENTE:`.padEnd(26) + `$${(bill.balance_cents / 100).toFixed(2)}`.padStart(12));
    }
    lines.push(separator);
    lines.push(`      ¡GRACIAS POR SU PREFERENCIA!`);
    lines.push(`\n\n\n`);

    const formatted_ticket = lines.join('\n');
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(formatted_ticket);
    const escpos_hex = `1B401B6101${Array.from(textBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}1D564200`;

    return { formatted_ticket, escpos_hex, bytes_count: textBytes.length + 10 };
  }

  /**
   * Generates Payment Receipt ticket (Read-only financial consumer)
   */
  public static generateFinancialReceipt(
    payment: {
      id: string;
      amount_cents: number;
      method: string;
      table_id: string;
      cashier: string;
      created_at: string;
      reference?: string;
    },
    restaurant_name: string = 'Directaurante'
  ): { formatted_ticket: string; escpos_hex: string; bytes_count: number } {
    const separator = '='.repeat(38);
    const thinSeparator = '-'.repeat(38);

    const lines: string[] = [];
    lines.push(separator);
    lines.push(`   ${restaurant_name.toUpperCase()}`);
    lines.push(`       RECIBO DE PAGO DE CUENTA`);
    lines.push(separator);
    lines.push(`FOLIO PAGO: ${payment.id}`);
    lines.push(`FECHA: ${new Date(payment.created_at).toLocaleString('es-MX')}`);
    lines.push(`CAJERO: ${payment.cashier.padEnd(16)} MESA: ${payment.table_id}`);
    lines.push(`MÉTODO: ${payment.method.toUpperCase()}`);
    if (payment.reference) {
      lines.push(`REF/AUT: ${payment.reference}`);
    }
    lines.push(thinSeparator);
    lines.push(`IMPORTE COBRADO:`.padEnd(24) + `$${(payment.amount_cents / 100).toFixed(2)}`.padStart(14));
    lines.push(separator);
    lines.push(`        PAGO LIQUIDADO EXITOSAMENTE`);
    lines.push(`\n\n\n`);

    const formatted_ticket = lines.join('\n');
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(formatted_ticket);
    const escpos_hex = `1B401B6101${Array.from(textBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}1D564200`;

    return { formatted_ticket, escpos_hex, bytes_count: textBytes.length + 10 };
  }

  /**
   * Generates Z-Cut / Cash Drawer Closure ticket (Read-only financial consumer)
   */
  public static generateZCutTicket(
    zCut: {
      shift_id: string;
      opened_at: string;
      closed_at: string;
      opened_by: string;
      closed_by: string;
      initial_float_cents: number;
      total_sales_cents: number;
      sales_by_method: Record<string, number>;
      total_expenses_cents: number;
      expected_cash_cents: number;
      counted_cash_cents: number;
      difference_cents: number;
    },
    restaurant_name: string = 'Directaurante'
  ): { formatted_ticket: string; escpos_hex: string; bytes_count: number } {
    const separator = '='.repeat(38);
    const thinSeparator = '-'.repeat(38);

    const lines: string[] = [];
    lines.push(separator);
    lines.push(`   ${restaurant_name.toUpperCase()}`);
    lines.push(`         CORTE Z - CIERRE DE TURNO`);
    lines.push(separator);
    lines.push(`TURNO: ${zCut.shift_id}`);
    lines.push(`APERTURA: ${new Date(zCut.opened_at).toLocaleTimeString('es-MX')} (${zCut.opened_by})`);
    lines.push(`CIERRE:   ${new Date(zCut.closed_at).toLocaleTimeString('es-MX')} (${zCut.closed_by})`);
    lines.push(thinSeparator);
    lines.push(`VENTAS POR MÉTODO:`);
    Object.entries(zCut.sales_by_method).forEach(([method, cents]) => {
      if (cents > 0) {
        lines.push(`  ${method.toUpperCase().padEnd(16)} $${(cents / 100).toFixed(2).padStart(14)}`);
      }
    });
    lines.push(thinSeparator);
    lines.push(`TOTAL VENTAS:`.padEnd(24) + `$${(zCut.total_sales_cents / 100).toFixed(2)}`.padStart(14));
    lines.push(`FONDO INICIAL:`.padEnd(24) + `$${(zCut.initial_float_cents / 100).toFixed(2)}`.padStart(14));
    lines.push(`GASTOS DE CAJA:`.padEnd(24) + `-$${(zCut.total_expenses_cents / 100).toFixed(2)}`.padStart(14));
    lines.push(separator);
    lines.push(`EFECTIVO ESPERADO:`.padEnd(24) + `$${(zCut.expected_cash_cents / 100).toFixed(2)}`.padStart(14));
    lines.push(`EFECTIVO CONTADO:`.padEnd(24) + `$${(zCut.counted_cash_cents / 100).toFixed(2)}`.padStart(14));
    const diffSign = zCut.difference_cents >= 0 ? '+' : '';
    lines.push(`DIFERENCIA:`.padEnd(24) + `${diffSign}$${(zCut.difference_cents / 100).toFixed(2)}`.padStart(14));
    lines.push(separator);
    lines.push(`         ARQUEO AUDITADO EN CORE`);
    lines.push(`\n\n\n`);

    const formatted_ticket = lines.join('\n');
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(formatted_ticket);
    const escpos_hex = `1B401B6101${Array.from(textBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}1D564200`;

    return { formatted_ticket, escpos_hex, bytes_count: textBytes.length + 10 };
  }
}
