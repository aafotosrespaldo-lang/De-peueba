import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { CashMovement } from '../../core/types';
import {
  DollarSign,
  X,
  Lock,
} from 'lucide-react';

interface CashModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashModal: React.FC<CashModalProps> = ({ isOpen, onClose }) => {
  const { cashData, recordCashMovement, openCashShift, closeCashShift } = usePos();
  const [movementType, setMovementType] = useState<CashMovement['type']>('expense');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDesc, setMovementDesc] = useState('');
  const [initialFloatInput, setInitialFloatInput] = useState('2000.00');
  const [closingCountInput, setClosingCountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const shift = cashData?.shift;
  const movements = cashData?.movements || [];
  const totals = cashData?.totals || { sales_cents: 0, expenses_cents: 0, withdrawals_cents: 0, net_cash_cents: 0 };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(movementAmount);
    if (!amountNum || amountNum <= 0) return;
    setIsSubmitting(true);
    try {
      await recordCashMovement(movementType, Math.round(amountNum * 100), movementDesc || 'Movimiento de caja');
      setMovementAmount('');
      setMovementDesc('');
    } catch (err: any) {
      alert(err.message || 'Error en movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(initialFloatInput);
    if (isNaN(amountNum) || amountNum < 0) return;
    setIsSubmitting(true);
    try {
      await openCashShift(Math.round(amountNum * 100), 'Apertura de turno operativo');
    } catch (err: any) {
      alert(err.message || 'Error al abrir caja');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const countNum = parseFloat(closingCountInput);
    if (isNaN(countNum) || countNum < 0) return;
    if (!confirm('¿Confirma el cierre y arqueo definitivo de la caja?')) return;
    setIsSubmitting(true);
    try {
      await closeCashShift(Math.round(countNum * 100), 'Arqueo ciego de cajero');
      setClosingCountInput('');
    } catch (err: any) {
      alert(err.message || 'Error al cerrar caja');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-[#F4F6F8]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#05268F] text-[#FFD318]">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#101828] tracking-tight">
                Control de Caja y Turnos Operativos
              </h3>
              <p className="text-xs text-[#667085]">
                Arquitectura de caja preparada: movimientos, ventas en efectivo y arqueos auditados.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#667085] hover:text-[#101828] transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {!shift ? (
            /* Caja Cerrada: Formulario de Apertura */
            <div className="bg-[#F4F6F8] rounded-2xl p-6 border border-zinc-200 text-center max-w-md mx-auto my-6">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF0FF] text-[#05268F] flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-black text-[#101828] mb-1">Caja Actualmente Cerrada</h4>
              <p className="text-xs text-[#667085] mb-4">
                Abra un nuevo turno operativo indicando el fondo inicial en efectivo para cambio.
              </p>
              <form onSubmit={handleOpenShift} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                    Fondo Inicial de Apertura ($ MXN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={initialFloatInput}
                    onChange={(e) => setInitialFloatInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-center font-black text-lg text-[#101828] focus:ring-2 focus:ring-[#05268F] focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-sm shadow-sm transition cursor-pointer"
                >
                  Abrir Turno de Caja
                </button>
              </form>
            </div>
          ) : (
            /* Caja Abierta: Dashboard de Métricas y Movimientos */
            <div className="space-y-4">
              {/* Top Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-[#F4F6F8] border border-zinc-200">
                  <span className="text-[10px] font-bold text-[#667085] uppercase">Fondo Inicial</span>
                  <div className="text-base font-black text-[#101828] mt-0.5">
                    ${(shift.initial_float_cents / 100).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Ventas Efectivo</span>
                  <div className="text-base font-black text-emerald-800 mt-0.5">
                    +${(totals.sales_cents / 100).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Gastos / Retiros</span>
                  <div className="text-base font-black text-rose-800 mt-0.5">
                    -${((totals.expenses_cents + totals.withdrawals_cents) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#05268F] text-white shadow-sm">
                  <span className="text-[10px] font-bold text-white/70 uppercase">Efectivo en Caja</span>
                  <div className="text-base font-black text-[#FFD318] mt-0.5">
                    ${(totals.net_cash_cents / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Movement Entry & Arqueo row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Movement form */}
                <div className="bg-[#F4F6F8] rounded-2xl p-4 border border-zinc-200">
                  <h4 className="text-xs font-black text-[#101828] uppercase tracking-wider mb-2">
                    Registrar Movimiento Operativo
                  </h4>
                  <form onSubmit={handleCreateMovement} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-[#667085] uppercase mb-0.5">
                          Tipo
                        </label>
                        <select
                          value={movementType}
                          onChange={(e) => setMovementType(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-bold text-[#101828] bg-white"
                        >
                          <option value="expense">Gasto de Turno</option>
                          <option value="withdrawal">Retiro Parcial</option>
                          <option value="deposit">Aporte / Depósito</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#667085] uppercase mb-0.5">
                          Monto ($ MXN)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={movementAmount}
                          onChange={(e) => setMovementAmount(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-bold text-[#101828] bg-white"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#667085] uppercase mb-0.5">
                        Concepto / Motivo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Compra de hielo, propinas..."
                        value={movementDesc}
                        onChange={(e) => setMovementDesc(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs text-[#101828] bg-white"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      Asentar Movimiento con Auditoría
                    </button>
                  </form>
                </div>

                {/* Close shift form */}
                <div className="bg-[#F4F6F8] rounded-2xl p-4 border border-zinc-200">
                  <h4 className="text-xs font-black text-[#101828] uppercase tracking-wider mb-2">
                    Cierre y Arqueo Ciego de Caja
                  </h4>
                  <p className="text-[11px] text-[#667085] mb-2">
                    El cajero ingresa el conteo físico real. El backend determina si la caja está cuadrada o
                    presenta diferencia.
                  </p>
                  <form onSubmit={handleCloseShift} className="space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-[#667085] uppercase mb-0.5">
                        Conteo Físico Real ($ MXN)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={`Sugerido: $${(totals.net_cash_cents / 100).toFixed(2)}`}
                        value={closingCountInput}
                        onChange={(e) => setClosingCountInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-bold text-[#101828] bg-white"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      Realizar Cierre de Turno
                    </button>
                  </form>
                </div>
              </div>

              {/* Recent Movements History */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-4">
                <h4 className="text-xs font-black text-[#101828] uppercase tracking-wider mb-2">
                  Historial de Movimientos del Turno
                </h4>
                <div className="divide-y divide-zinc-100 max-h-40 overflow-y-auto text-xs">
                  {movements.map((mov) => (
                    <div key={mov.id} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-[#101828]">{mov.description}</div>
                        <div className="text-[10px] text-[#667085]">
                          {new Date(mov.timestamp).toLocaleTimeString('es-MX')} • {mov.performed_by}
                        </div>
                      </div>
                      <span
                        className={`font-black ${
                          mov.type === 'sale' || mov.type === 'deposit' || mov.type === 'opening_float'
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {mov.type === 'expense' || mov.type === 'withdrawal' ? '-' : '+'}
                        ${(mov.amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
