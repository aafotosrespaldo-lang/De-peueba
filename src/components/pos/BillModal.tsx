import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { SubaccountBill } from '../../core/types';
import {
  X,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  Receipt,
  User,
  Users,
  Printer,
} from 'lucide-react';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrintTicket: (subaccount?: SubaccountBill) => void;
}

export const BillModal: React.FC<BillModalProps> = ({ isOpen, onClose, onPrintTicket }) => {
  const { activeBill, recordPayment, closeTable, selectedTableId } = usePos();
  const [activeTab, setActiveTab] = useState<'global' | 'individual'>('global');
  const [selectedSubaccountSeat, setSelectedSubaccountSeat] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !activeBill) return null;

  const currentIndividualBill =
    activeBill.subaccounts.find((s) => s.seat_number === selectedSubaccountSeat) ||
    activeBill.subaccounts[0];

  const handlePay = async (target: 'global' | 'individual') => {
    if (!selectedTableId) return;
    setIsProcessing(true);
    setSuccessMessage(null);

    try {
      if (target === 'global') {
        const amountToPay = activeBill.balance_cents;
        if (amountToPay <= 0) {
          alert('La mesa ya no tiene saldo pendiente.');
          setIsProcessing(false);
          return;
        }
        await recordPayment(selectedTableId, amountToPay, paymentMethod);
        setSuccessMessage(`Cobro de $${(amountToPay / 100).toFixed(2)} registrado exitosamente vía ${paymentMethod}.`);
      } else {
        if (!currentIndividualBill) return;
        const amountToPay = currentIndividualBill.balance_cents;
        if (amountToPay <= 0) {
          alert(`El comensal ${currentIndividualBill.display_name} no tiene saldo pendiente.`);
          setIsProcessing(false);
          return;
        }
        await recordPayment(
          selectedTableId,
          amountToPay,
          paymentMethod,
          currentIndividualBill.guest_subaccount_id
        );
        setSuccessMessage(
          `Pago de $${(amountToPay / 100).toFixed(2)} para ${currentIndividualBill.seat_number} (${currentIndividualBill.display_name}) completado.`
        );
      }
    } catch (err: any) {
      alert(err.message || 'Error al procesar pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseTableSession = async () => {
    if (!selectedTableId) return;
    if (activeBill.balance_cents > 0) {
      alert(`No se puede cerrar la mesa: hay un saldo pendiente de $${(activeBill.balance_cents / 100).toFixed(2)}.`);
      return;
    }
    try {
      await closeTable(selectedTableId);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al cerrar mesa');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-[#F4F6F8]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#05268F] text-white">
              <Receipt className="w-5 h-5 text-[#FFD318]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#101828] tracking-tight flex flex-wrap items-center gap-2">
                <span>Cuentas de {activeBill.table_number}</span>
                {activeBill.table_session_id && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFF7D6] text-[#101828] border border-[#FFD318]">
                    Sesión #{activeBill.table_session_id.slice(-6)}
                  </span>
                )}
                {activeBill.orders && activeBill.orders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#EAF0FF] text-[#05268F] border border-[#05268F]/20">
                    {activeBill.orders.length} Comandas consolidadas
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#667085]">
                Cálculo financiero unificado por TableSession con desglose por comensal y comanda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#667085] hover:text-[#101828] hover:bg-zinc-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector: Global vs Individual */}
        <div className="px-5 pt-3 flex items-center gap-2 border-b border-zinc-100">
          <button
            onClick={() => {
              setActiveTab('global');
              setSuccessMessage(null);
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'global'
                ? 'border-[#05268F] text-[#05268F]'
                : 'border-transparent text-[#667085] hover:text-[#101828]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cuenta Global de la Mesa</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#EAF0FF] text-[#05268F]">
              ${(activeBill.total_cents / 100).toFixed(2)}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('individual');
              setSuccessMessage(null);
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'individual'
                ? 'border-[#05268F] text-[#05268F]'
                : 'border-transparent text-[#667085] hover:text-[#101828]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Cuentas Individuales por Comensal</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F4F6F8] text-[#101828]">
              {activeBill.subaccounts.length} comensales
            </span>
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'global' ? (
            /* TAB 1: CUENTA GLOBAL DE LA MESA */
            <div className="space-y-4">
              {/* Breakdown by Subaccount */}
              <div className="bg-[#F4F6F8] rounded-2xl p-4 border border-zinc-200">
                <h4 className="text-xs font-black text-[#667085] uppercase tracking-wider mb-2">
                  Desglose Consolidado por Comensal (Mesa {activeBill.table_number})
                </h4>
                <div className="divide-y divide-zinc-200">
                  {activeBill.subaccounts.map((sub) => (
                    <div key={sub.guest_subaccount_id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded bg-[#05268F] text-white">
                          {sub.seat_number}
                        </span>
                        <div>
                          <span className="font-bold text-sm text-[#101828]">{sub.display_name}</span>
                          <span className="text-xs text-[#667085] ml-2">({sub.items.length} items)</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm text-[#101828]">
                          ${(sub.total_cents / 100).toFixed(2)}
                        </div>
                        {sub.paid_cents > 0 && (
                          <div className="text-[10px] text-emerald-600 font-bold">
                            Pagado: ${(sub.paid_cents / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs space-y-2">
                <div className="flex justify-between text-xs text-[#667085]">
                  <span>Subtotal Alimentos y Bebidas:</span>
                  <span className="font-bold text-[#101828]">
                    ${(activeBill.subtotal_cents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-[#667085]">
                  <span>IVA Trasladado (16%):</span>
                  <span className="font-bold text-[#101828]">${(activeBill.tax_cents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#101828] pt-2 border-t border-zinc-100">
                  <span>TOTAL CUENTA GLOBAL:</span>
                  <span className="text-xl text-[#05268F] font-black">
                    ${(activeBill.total_cents / 100).toFixed(2)} MXN
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-600">
                  <span>Abonos / Pagos Recibidos:</span>
                  <span>-${(activeBill.paid_cents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#101828] pt-1 border-t border-zinc-100">
                  <span>SALDO PENDIENTE:</span>
                  <span className={`text-base ${activeBill.balance_cents === 0 ? 'text-emerald-600' : 'text-rose-600 font-black'}`}>
                    ${(activeBill.balance_cents / 100).toFixed(2)} MXN
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: CUENTAS INDIVIDUALES POR COMENSAL */
            <div className="space-y-4">
              {/* Subaccount Selector Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {activeBill.subaccounts.map((sub) => {
                  const isCur = (currentIndividualBill?.seat_number || '') === sub.seat_number;
                  return (
                    <button
                      key={sub.guest_subaccount_id}
                      onClick={() => {
                        setSelectedSubaccountSeat(sub.seat_number);
                        setSuccessMessage(null);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 cursor-pointer ${
                        isCur
                          ? 'bg-[#05268F] text-white border-[#05268F] shadow-xs'
                          : 'bg-[#F4F6F8] text-[#101828] border-zinc-200 hover:bg-[#EAF0FF]'
                      }`}
                    >
                      <span className="font-mono">{sub.seat_number}</span>
                      <span>{sub.display_name}</span>
                      <span className="opacity-80">(${(sub.total_cents / 100).toFixed(2)})</span>
                    </button>
                  );
                })}
              </div>

              {/* Individual Ticket Card */}
              {currentIndividualBill && (
                <div className="bg-[#F4F6F8] rounded-2xl p-5 border border-zinc-200">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-[#05268F] text-white">
                          Comensal {currentIndividualBill.seat_number}
                        </span>
                        <h4 className="text-lg font-black text-[#101828]">
                          {currentIndividualBill.display_name}
                        </h4>
                      </div>
                      <p className="text-[11px] text-[#667085] mt-0.5">
                        Ticket individual con items asignados deterministamente en backend.
                      </p>
                    </div>
                    <button
                      onClick={() => onPrintTicket(currentIndividualBill)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-[#EAF0FF] text-[#101828] text-xs font-bold transition shadow-xs cursor-pointer"
                      title="Imprimir ticket individual ESC/POS"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#05268F]" />
                      <span>Ticket Individual</span>
                    </button>
                  </div>

                  {/* Items list */}
                  <div className="py-3 divide-y divide-zinc-200">
                    {currentIndividualBill.items.map((item) => (
                      <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#101828]">{item.quantity}x</span>
                          <span className="font-semibold text-[#101828]">{item.product_name}</span>
                          {item.notes && <span className="text-[#667085] italic">({item.notes})</span>}
                        </div>
                        <span className="font-bold text-[#101828]">
                          ${(item.total_price_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Individual totals */}
                  <div className="pt-3 border-t border-zinc-200 space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#667085]">
                      <span>Subtotal Consumo:</span>
                      <span className="font-bold text-[#101828]">${(currentIndividualBill.subtotal_cents / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[#667085]">
                      <span>IVA (16%):</span>
                      <span className="font-bold text-[#101828]">${(currentIndividualBill.tax_cents / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-[#101828] pt-1 border-t border-zinc-200">
                      <span>TOTAL DE {currentIndividualBill.display_name.toUpperCase()}:</span>
                      <span className="text-base text-[#05268F] font-black">
                        ${(currentIndividualBill.total_cents / 100).toFixed(2)} MXN
                      </span>
                    </div>
                    {currentIndividualBill.paid_cents > 0 && (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Pagado por comensal:</span>
                        <span>-${(currentIndividualBill.paid_cents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-[#101828] pt-1">
                      <span>SALDO RESTANTE:</span>
                      <span
                        className={
                          currentIndividualBill.balance_cents === 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-black'
                        }
                      >
                        ${(currentIndividualBill.balance_cents / 100).toFixed(2)} MXN
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="mt-4 pt-4 border-t border-zinc-200">
            <label className="block text-xs font-black text-[#101828] uppercase tracking-wider mb-2">
              Método de Pago
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-[#05268F] text-white border-[#05268F] shadow-sm'
                    : 'bg-[#F4F6F8] text-[#101828] border-zinc-200 hover:bg-[#EAF0FF]'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Efectivo</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'bg-[#05268F] text-white border-[#05268F] shadow-sm'
                    : 'bg-[#F4F6F8] text-[#101828] border-zinc-200 hover:bg-[#EAF0FF]'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Tarjeta TPV</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  paymentMethod === 'transfer'
                    ? 'bg-[#05268F] text-white border-[#05268F] shadow-sm'
                    : 'bg-[#F4F6F8] text-[#101828] border-zinc-200 hover:bg-[#EAF0FF]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Transferencia</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 bg-[#F4F6F8] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => onPrintTicket()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-[#101828] text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#05268F]" />
            <span>Imprimir cuenta</span>
          </button>
          <div className="flex items-center gap-2">
            {activeTab === 'global' ? (
              <button
                onClick={() => handlePay('global')}
                disabled={isProcessing || activeBill.balance_cents === 0}
                className="px-5 py-2.5 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] disabled:opacity-50 text-[#101828] text-xs font-black shadow-sm transition cursor-pointer"
              >
                {activeBill.balance_cents === 0
                  ? 'Cuenta Liquidada'
                  : `Cobrar Toda la Mesa ($${(activeBill.balance_cents / 100).toFixed(2)})`}
              </button>
            ) : (
              <button
                onClick={() => handlePay('individual')}
                disabled={isProcessing || !currentIndividualBill || currentIndividualBill.balance_cents === 0}
                className="px-5 py-2.5 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] disabled:opacity-50 text-[#101828] text-xs font-black shadow-sm transition cursor-pointer"
              >
                {!currentIndividualBill || currentIndividualBill.balance_cents === 0
                  ? 'Subcuenta Liquidada'
                  : `Cobrar a ${currentIndividualBill.display_name} ($${(currentIndividualBill.balance_cents / 100).toFixed(2)})`}
              </button>
            )}

            {activeBill.balance_cents === 0 && (
              <button
                onClick={handleCloseTableSession}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm transition flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Cerrar y Liberar Mesa</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
