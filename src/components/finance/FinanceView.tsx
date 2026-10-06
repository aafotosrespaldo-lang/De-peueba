import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Receipt,
  FileText,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Printer,
  ChevronRight,
  Percent,
  Layers,
  Truck,
  Building,
} from 'lucide-react';
import {
  Payment,
  Expense,
  FinancialMovement,
  OperatingPnL,
  ZCutReport,
  ExpenseCategory,
  PaymentMethod,
  RestaurantSettlement,
  DriverSettlement,
} from '../../core/types';

interface FinanceViewProps {
  onBack?: () => void;
  initialTab?: 'resumen' | 'caja' | 'pagos' | 'gastos' | 'ledger' | 'liquidaciones';
}

export const FinanceView: React.FC<FinanceViewProps> = ({ onBack, initialTab = 'resumen' }) => {
  const { sdk } = usePos();
  const [activeTab, setActiveTab] = useState<'resumen' | 'caja' | 'pagos' | 'gastos' | 'ledger' | 'liquidaciones'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data States
  const [pnl, setPnl] = useState<OperatingPnL | null>(null);
  const [cashSessionData, setCashSessionData] = useState<any | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledger, setLedger] = useState<FinancialMovement[]>([]);
  const [restaurantSettlements, setRestaurantSettlements] = useState<RestaurantSettlement[]>([]);
  const [driverSettlements, setDriverSettlements] = useState<DriverSettlement[]>([]);

  // Modals & Inputs
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'supplies' as ExpenseCategory,
    amount_dollars: '',
    payment_method: 'cash' as PaymentMethod,
    vendor: '',
    reference: '',
    description: '',
  });

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmountDollars, setRefundAmountDollars] = useState('');

  const [isCashDrawerModalOpen, setIsCashDrawerModalOpen] = useState(false);
  const [cashDrawerForm, setCashDrawerForm] = useState({
    type: 'expense' as 'expense' | 'withdrawal' | 'deposit' | 'adjustment',
    amount_dollars: '',
    description: '',
  });

  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [countedCashDollars, setCountedCashDollars] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [lastZCut, setLastZCut] = useState<ZCutReport | null>(null);

  const loadFinancialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        pnlData,
        cashData,
        paymentsData,
        expensesData,
        ledgerData,
        restSettlementsData,
        drvSettlementsData,
      ] = await Promise.all([
        sdk.reports.getOperatingPnL(),
        sdk.cash.getCurrentShift(),
        sdk.payments.listPayments(),
        sdk.expenses.listExpenses(),
        sdk.financial.getLedger(),
        sdk.settlements.listRestaurantSettlements(),
        sdk.settlements.listDriverSettlements(),
      ]);

      setPnl(pnlData);
      setCashSessionData(cashData);
      setPayments(paymentsData);
      setExpenses(expensesData);
      setLedger(ledgerData);
      setRestaurantSettlements(restSettlementsData);
      setDriverSettlements(drvSettlementsData);
    } catch (err: any) {
      console.error('Error cargando finanzas:', err);
      setError(err.message || 'Error al cargar información financiera');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(expenseForm.amount_dollars) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      alert('Ingresa un monto válido mayor a $0.00');
      return;
    }
    if (!expenseForm.description.trim()) {
      alert('La descripción del gasto es obligatoria');
      return;
    }

    try {
      await sdk.expenses.createExpense({
        category: expenseForm.category,
        amount_cents: amountCents,
        payment_method: expenseForm.payment_method,
        vendor: expenseForm.vendor || undefined,
        reference: expenseForm.reference || undefined,
        description: expenseForm.description,
      });

      setIsExpenseModalOpen(false);
      setExpenseForm({
        category: 'supplies',
        amount_dollars: '',
        payment_method: 'cash',
        vendor: '',
        reference: '',
        description: '',
      });
      await loadFinancialData();
    } catch (err: any) {
      alert(err.message || 'Error al registrar gasto');
    }
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForRefund) return;
    if (!refundReason.trim()) {
      alert('El motivo del reembolso es obligatorio');
      return;
    }

    const refundCents = refundAmountDollars.trim()
      ? Math.round(parseFloat(refundAmountDollars) * 100)
      : undefined;

    try {
      await sdk.payments.refundPayment({
        payment_id: selectedPaymentForRefund.id,
        amount_cents: refundCents,
        reason: refundReason,
      });

      setIsRefundModalOpen(false);
      setSelectedPaymentForRefund(null);
      setRefundReason('');
      setRefundAmountDollars('');
      await loadFinancialData();
    } catch (err: any) {
      alert(err.message || 'Error al procesar reembolso');
    }
  };

  const handleRecordDrawerMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(cashDrawerForm.amount_dollars) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      alert('Monto inválido');
      return;
    }

    try {
      await sdk.cash.recordMovement(
        cashDrawerForm.type,
        amountCents,
        cashDrawerForm.description || `Movimiento ${cashDrawerForm.type}`
      );
      setIsCashDrawerModalOpen(false);
      setCashDrawerForm({
        type: 'expense',
        amount_dollars: '',
        description: '',
      });
      await loadFinancialData();
    } catch (err: any) {
      alert(err.message || 'Error en movimiento de caja');
    }
  };

  const handleCloseCashShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const countCents = Math.round(parseFloat(countedCashDollars) * 100);
    if (isNaN(countCents) || countCents < 0) {
      alert('Ingresa el conteo físico en centavos/pesos válido');
      return;
    }

    try {
      const closed = await sdk.cash.closeShift(countCents, 'Cajero Principal', closeNotes);
      setIsCloseShiftModalOpen(false);
      setCountedCashDollars('');
      setCloseNotes('');
      await loadFinancialData();
      alert(`Turno de caja cerrado exitosamente. Diferencia calculada: $${((closed.difference_cents || 0) / 100).toFixed(2)} MXN.`);
    } catch (err: any) {
      alert(err.message || 'Error al cerrar turno de caja');
    }
  };

  return (
    <div className="min-h-full bg-[#F4F6F8] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#EAF0FF] text-[#05268F] border border-[#05268F]/20 uppercase tracking-wider">
              Core F12 & F12.1 Consolidado
            </span>
            <span className="text-xs text-[#667085]">• Multi-tenant & Inmutable</span>
          </div>
          <h1 className="text-2xl font-black text-[#101828] tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-[#05268F]" />
            Caja, Pagos, Gastos y Ledger Financiero
          </h1>
          <p className="text-sm text-[#667085]">
            Fuente única de verdad financiera: conciliación de gaveta, cobros atómicos, egresos y P&L con COGS de F7.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadFinancialData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold text-[#101828] hover:bg-zinc-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#05268F]' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#05268F] hover:bg-[#031B68] text-white text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FFD318]" />
            Registrar Gasto
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-zinc-200/60 rounded-2xl w-fit overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveTab('resumen')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === 'resumen'
              ? 'bg-white text-[#05268F] shadow-xs'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          P&L Operativo
        </button>

        <button
          onClick={() => setActiveTab('caja')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === 'caja'
              ? 'bg-white text-[#05268F] shadow-xs'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <Lock className="w-4 h-4" />
          Caja y Turnos
        </button>

        <button
          onClick={() => setActiveTab('pagos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === 'pagos'
              ? 'bg-white text-[#05268F] shadow-xs'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Pagos ({payments.length})
        </button>

        <button
          onClick={() => setActiveTab('gastos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === 'gastos'
              ? 'bg-white text-[#05268F] shadow-xs'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <ArrowDownRight className="w-4 h-4" />
          Gastos ({expenses.length})
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-white text-[#05268F] shadow-xs'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Libro Mayor ({ledger.length})
        </button>

        <button
          onClick={() => setActiveTab('liquidaciones')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === 'liquidaciones'
              ? 'bg-white text-[#05268F] shadow-xs'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          <Truck className="w-4 h-4" />
          Liquidaciones
        </button>
      </div>

      {/* TAB 1: P&L OPERATIVO */}
      {activeTab === 'resumen' && pnl && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs">
              <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">Ventas Netas</span>
              <p className="text-2xl font-black text-[#101828] mt-1">
                ${(pnl.net_sales_cents / 100).toFixed(2)} <span className="text-xs font-semibold text-zinc-500">MXN</span>
              </p>
              <div className="mt-2 text-xs text-[#667085] flex items-center justify-between">
                <span>Brutas: ${(pnl.gross_sales_cents / 100).toFixed(2)}</span>
                <span className="text-rose-600">Reemb: -${(pnl.refunds_cents / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs">
              <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">COGS (Costo Insumos F7)</span>
              <p className="text-2xl font-black text-rose-600 mt-1">
                -${(pnl.cogs_cents / 100).toFixed(2)} <span className="text-xs font-semibold text-zinc-500">MXN</span>
              </p>
              <p className="text-xs text-[#667085] mt-2">
                Food Cost: {pnl.net_sales_cents > 0 ? ((pnl.cogs_cents / pnl.net_sales_cents) * 100).toFixed(1) : 0}% de venta neta
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs">
              <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">Utilidad Bruta</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                ${(pnl.gross_profit_cents / 100).toFixed(2)} <span className="text-xs font-semibold text-zinc-500">MXN</span>
              </p>
              <p className="text-xs text-[#667085] mt-2 font-bold">
                Margen Bruto: {pnl.gross_margin_percent}%
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-xs">
              <span className="text-xs font-bold text-[#667085] uppercase tracking-wider">Resultado Operativo</span>
              <p className={`text-2xl font-black mt-1 ${pnl.operating_result_cents >= 0 ? 'text-[#05268F]' : 'text-rose-600'}`}>
                ${(pnl.operating_result_cents / 100).toFixed(2)} <span className="text-xs font-semibold text-zinc-500">MXN</span>
              </p>
              <p className="text-xs text-[#667085] mt-2 font-bold">
                Margen Operativo: {pnl.operating_margin_percent}%
              </p>
            </div>
          </div>

          {/* Detailed Waterfall Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs space-y-4">
              <h3 className="text-lg font-black text-[#101828] tracking-tight">
                Estado de Resultados Operativo (Waterfall P&L)
              </h3>
              <div className="divide-y divide-zinc-100 text-sm">
                <div className="py-2.5 flex items-center justify-between font-bold text-zinc-800">
                  <span>(+) Ventas Brutas Totales ({pnl.payments_count} cobros)</span>
                  <span>${(pnl.gross_sales_cents / 100).toFixed(2)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-rose-700">
                  <span>(−) Descuentos y Promociones (F11)</span>
                  <span>-${(pnl.discounts_cents / 100).toFixed(2)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-rose-700">
                  <span>(−) Reembolsos y Devoluciones</span>
                  <span>-${(pnl.refunds_cents / 100).toFixed(2)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between font-black text-[#05268F] bg-[#F4F6F8] px-3 rounded-xl">
                  <span>(=) VENTAS NETAS</span>
                  <span>${(pnl.net_sales_cents / 100).toFixed(2)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-rose-700">
                  <span>(−) Costo de Alimentos y Bebidas (COGS recetas F7)</span>
                  <span>-${(pnl.cogs_cents / 100).toFixed(2)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between font-black text-emerald-700 bg-emerald-50 px-3 rounded-xl">
                  <span>(=) UTILIDAD BRUTA</span>
                  <span>${(pnl.gross_profit_cents / 100).toFixed(2)}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between text-rose-700">
                  <span>(−) Gastos Operativos de Administración (F12)</span>
                  <span>-${(pnl.operating_expenses_cents / 100).toFixed(2)}</span>
                </div>
                <div className="py-3 flex items-center justify-between font-black text-white bg-[#05268F] px-4 rounded-xl text-base">
                  <span>(=) RESULTADO OPERATIVO NETO</span>
                  <span>${(pnl.operating_result_cents / 100).toFixed(2)} MXN</span>
                </div>
              </div>
            </div>

            {/* Expenses breakdown by category */}
            <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs space-y-4">
              <h3 className="text-lg font-black text-[#101828] tracking-tight">
                Gastos por Categoría
              </h3>
              <div className="space-y-3">
                {Object.entries(pnl.expenses_by_category).map(([cat, cents]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#101828]">
                      <span className="capitalize">{cat}</span>
                      <span>${(cents / 100).toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#05268F] h-2 rounded-full"
                        style={{
                          width: `${
                            pnl.operating_expenses_cents > 0 ? (cents / pnl.operating_expenses_cents) * 100 : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAJA Y TURNOS */}
      {activeTab === 'caja' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                    cashSessionData?.shift?.status === 'open'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {cashSessionData?.shift?.status === 'open' ? 'TURNO ACTIVO' : 'CAJA CERRADA'}
                </span>
                {cashSessionData?.shift && (
                  <span className="text-xs text-[#667085] font-mono">
                    ID: {cashSessionData.shift.id}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-[#101828]">
                Control Físico de Gaveta de Efectivo
              </h2>
              <p className="text-xs text-[#667085]">
                Toda venta en efectivo exige turno abierto. Cierre ciego con detección automática de sobrante/faltante.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {cashSessionData?.shift?.status === 'open' ? (
                <>
                  <button
                    onClick={() => setIsCashDrawerModalOpen(true)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-[#101828] hover:bg-zinc-50 transition cursor-pointer"
                  >
                    Movimiento Gaveta
                  </button>
                  <button
                    onClick={() => setIsCloseShiftModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition cursor-pointer shadow-xs"
                  >
                    Cierre y Arqueo Ciego
                  </button>
                </>
              ) : (
                <button
                  onClick={async () => {
                    const amountStr = prompt('Monto del fondo inicial en pesos (ej. 2000.00):', '2000.00');
                    if (!amountStr) return;
                    const amountCents = Math.round(parseFloat(amountStr) * 100);
                    if (isNaN(amountCents) || amountCents < 0) return;
                    try {
                      await sdk.cash.openShift(amountCents, 'Cajero Principal', 'Apertura de turno operativo');
                      await loadFinancialData();
                    } catch (err: any) {
                      alert(err.message);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition cursor-pointer shadow-xs"
                >
                  Abrir Turno de Caja
                </button>
              )}
            </div>
          </div>

          {cashSessionData?.shift && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-bold text-[#667085] uppercase">Fondo Inicial</span>
                <p className="text-2xl font-black text-[#101828] mt-1">
                  ${(cashSessionData.shift.initial_float_cents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-[#667085] mt-1">Apertura: {new Date(cashSessionData.shift.opened_at).toLocaleTimeString('es-MX')}</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-bold text-[#667085] uppercase">Ventas Efectivo</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  +${(cashSessionData.totals.sales_cents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-[#667085] mt-1">Ingresadas directo al cajón</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-bold text-[#667085] uppercase">Egresos / Gastos</span>
                <p className="text-2xl font-black text-rose-600 mt-1">
                  -${(cashSessionData.totals.expenses_cents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-[#667085] mt-1">Salidas de caja chica</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-bold text-[#667085] uppercase">Efectivo Esperado</span>
                <p className="text-2xl font-black text-[#05268F] mt-1">
                  ${(cashSessionData.totals.net_cash_cents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-[#667085] mt-1">Debe haber físicamente</p>
              </div>
            </div>
          )}

          {/* Movements table */}
          <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-black text-[#101828] text-base">
                Movimientos del Turno Actual ({cashSessionData?.movements?.length || 0})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F4F6F8] text-[#667085] text-xs font-bold uppercase">
                  <tr>
                    <th className="px-5 py-3">Hora</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Descripción</th>
                    <th className="px-5 py-3">Usuario</th>
                    <th className="px-5 py-3 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-800">
                  {cashSessionData?.movements?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-zinc-50/50">
                      <td className="px-5 py-3 font-mono text-xs text-[#667085]">
                        {new Date(m.timestamp).toLocaleTimeString('es-MX')}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-zinc-100 text-zinc-700">
                          {m.type}
                        </span>
                      </td>
                      <td className="px-5 py-3">{m.description}</td>
                      <td className="px-5 py-3 text-xs text-[#667085]">{m.performed_by}</td>
                      <td className={`px-5 py-3 font-mono font-bold text-right ${
                        m.type === 'sale' || m.type === 'deposit' || m.type === 'opening_float'
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}>
                        {m.type === 'sale' || m.type === 'deposit' || m.type === 'opening_float' ? '+' : '-'}
                        ${(m.amount_cents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {(!cashSessionData?.movements || cashSessionData.movements.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#667085]">
                        No hay movimientos registrados en este turno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PAGOS */}
      {activeTab === 'pagos' && (
        <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-black text-[#101828] text-base">
              Registro Central de Pagos Realizados ({payments.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F4F6F8] text-[#667085] text-xs font-bold uppercase">
                <tr>
                  <th className="px-5 py-3">Folio</th>
                  <th className="px-5 py-3">Fecha y Hora</th>
                  <th className="px-5 py-3">Sesión / Mesa</th>
                  <th className="px-5 py-3">Método</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Importe</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/50">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-[#05268F]">{p.id}</td>
                    <td className="px-5 py-3 text-xs text-[#667085]">
                      {new Date(p.created_at).toLocaleString('es-MX')}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      Mesa {p.table_id} {p.guest_subaccount_id ? `(Comensal ${p.guest_subaccount_id})` : '(Global)'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-[#EAF0FF] text-[#05268F]">
                        {p.method}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                          p.payment_status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.payment_status === 'refunded'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.payment_status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono font-bold text-zinc-900">
                      ${(p.amount_cents / 100).toFixed(2)}
                      {p.refunded_amount_cents && p.refunded_amount_cents > 0 ? (
                        <span className="text-xs text-rose-600 block">
                          Reemb: -${(p.refunded_amount_cents / 100).toFixed(2)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.payment_status !== 'refunded' && (
                        <button
                          onClick={() => {
                            setSelectedPaymentForRefund(p);
                            setIsRefundModalOpen(true);
                          }}
                          className="px-3 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                        >
                          Reembolsar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: GASTOS */}
      {activeTab === 'gastos' && (
        <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-black text-[#101828] text-base">
              Gastos Operativos Registrados ({expenses.length})
            </h3>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#05268F] text-white text-xs font-bold cursor-pointer hover:bg-[#031B68]"
            >
              + Nuevo Gasto
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F4F6F8] text-[#667085] text-xs font-bold uppercase">
                <tr>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Categoría</th>
                  <th className="px-5 py-3">Descripción</th>
                  <th className="px-5 py-3">Proveedor / Ref</th>
                  <th className="px-5 py-3">Método</th>
                  <th className="px-5 py-3 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-50/50">
                    <td className="px-5 py-3 text-xs text-[#667085]">
                      {new Date(e.created_at).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-zinc-100 text-zinc-700">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold">{e.description}</td>
                    <td className="px-5 py-3 text-xs text-[#667085]">
                      {e.vendor || 'N/A'} {e.reference ? `(${e.reference})` : ''}
                    </td>
                    <td className="px-5 py-3 text-xs uppercase font-mono">{e.payment_method}</td>
                    <td className="px-5 py-3 font-mono font-bold text-rose-700 text-right">
                      -${(e.amount_cents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: LIBRO MAYOR (LEDGER) */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-zinc-100">
            <h3 className="font-black text-[#101828] text-base">
              Libro Mayor Financiero Consolidado (Ledger Inmutable)
            </h3>
            <p className="text-xs text-[#667085]">
              Secuencia atómica de todo flujo de dinero: ventas, retiros, compras, reembolsos y liquidaciones.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F4F6F8] text-[#667085] text-xs font-bold uppercase">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Dirección</th>
                  <th className="px-5 py-3">Método</th>
                  <th className="px-5 py-3">Descripción</th>
                  <th className="px-5 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800">
                {ledger.map((mov) => (
                  <tr key={mov.id} className="hover:bg-zinc-50/50">
                    <td className="px-5 py-3 font-mono text-xs text-[#667085]">
                      {new Date(mov.created_at).toLocaleString('es-MX')}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs font-bold uppercase">{mov.type}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          mov.direction === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {mov.direction === 'in' ? 'ENTRADA' : 'SALIDA'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs uppercase font-mono">{mov.payment_method}</td>
                    <td className="px-5 py-3">{mov.description}</td>
                    <td
                      className={`px-5 py-3 font-mono font-bold text-right ${
                        mov.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {mov.direction === 'in' ? '+' : '-'}${(mov.amount_cents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: LIQUIDACIONES */}
      {activeTab === 'liquidaciones' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs">
            <h3 className="font-black text-[#101828] text-base mb-1">
              Liquidaciones de Plataformas y Canales (Restaurant Settlements)
            </h3>
            <p className="text-xs text-[#667085] mb-4">
              Separadas estrictamente de pagos de comensales. Liquidaciones por DirectGo y delivery.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F4F6F8] text-[#667085] text-xs font-bold uppercase">
                  <tr>
                    <th className="px-5 py-3">Canal</th>
                    <th className="px-5 py-3">Periodo</th>
                    <th className="px-5 py-3">Venta Bruta</th>
                    <th className="px-5 py-3">Comisiones</th>
                    <th className="px-5 py-3">Pago Neto</th>
                    <th className="px-5 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {restaurantSettlements.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 font-bold uppercase text-[#05268F]">{s.channel}</td>
                      <td className="px-5 py-3 text-xs text-[#667085]">
                        {new Date(s.period_start).toLocaleDateString('es-MX')} al{' '}
                        {new Date(s.period_end).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-5 py-3 font-mono">${(s.gross_sales_cents / 100).toFixed(2)}</td>
                      <td className="px-5 py-3 font-mono text-rose-600">-${(s.commissions_cents / 100).toFixed(2)}</td>
                      <td className="px-5 py-3 font-mono font-bold text-emerald-700">
                        ${(s.net_payout_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-emerald-100 text-emerald-800">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-xs">
            <h3 className="font-black text-[#101828] text-base mb-1">
              Liquidaciones de Repartidores (Driver Settlements)
            </h3>
            <p className="text-xs text-[#667085] mb-4">
              Control de efectivo cobrado en entrega vs tarifas y propinas generadas.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F4F6F8] text-[#667085] text-xs font-bold uppercase">
                  <tr>
                    <th className="px-5 py-3">Repartidor</th>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Efectivo Cobrado</th>
                    <th className="px-5 py-3">Tarifas Ganadas</th>
                    <th className="px-5 py-3">Propinas</th>
                    <th className="px-5 py-3">Saldo a Entregar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {driverSettlements.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-3 font-bold">{d.driver_name}</td>
                      <td className="px-5 py-3 text-xs text-[#667085]">{d.period_date}</td>
                      <td className="px-5 py-3 font-mono">${(d.cash_collected_cents / 100).toFixed(2)}</td>
                      <td className="px-5 py-3 font-mono">${(d.delivery_fees_earned_cents / 100).toFixed(2)}</td>
                      <td className="px-5 py-3 font-mono">${(d.tips_cents / 100).toFixed(2)}</td>
                      <td className="px-5 py-3 font-mono font-bold text-[#05268F]">
                        ${(d.balance_due_cents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO GASTO */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200">
            <h3 className="text-xl font-black text-[#101828] mb-1">Registrar Gasto Operativo</h3>
            <p className="text-xs text-[#667085] mb-4">
              Si se paga en efectivo, afectará la gaveta del turno activo y restará el efectivo esperado.
            </p>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Categoría</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                >
                  <option value="supplies">Insumos y Consumibles (supplies)</option>
                  <option value="utilities">Servicios Básicos / Luz / Agua (utilities)</option>
                  <option value="maintenance">Mantenimiento y Reparaciones (maintenance)</option>
                  <option value="rent">Renta / Alquiler (rent)</option>
                  <option value="marketing">Publicidad y Marketing (marketing)</option>
                  <option value="transport">Transporte y Envíos (transport)</option>
                  <option value="services">Servicios Contratados (services)</option>
                  <option value="other">Otros Egresos (other)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Importe ($ MXN)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="150.00"
                    required
                    value={expenseForm.amount_dollars}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount_dollars: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Método de Pago</label>
                  <select
                    value={expenseForm.payment_method}
                    onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value as PaymentMethod })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                  >
                    <option value="cash">Efectivo de Caja Chica</option>
                    <option value="transfer">Transferencia Bancaria</option>
                    <option value="card">Tarjeta de Débito/Crédito</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Ej. Compra de 2 garrafones de agua"
                  required
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Proveedor</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={expenseForm.vendor}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#101828] uppercase mb-1">No. Factura / Ticket</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={expenseForm.reference}
                    onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-[#667085] hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#05268F] text-white text-sm font-bold hover:bg-[#031B68]"
                >
                  Registrar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REEMBOLSO */}
      {isRefundModalOpen && selectedPaymentForRefund && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200">
            <h3 className="text-xl font-black text-[#101828] mb-1">Procesar Reembolso / Reversión</h3>
            <p className="text-xs text-[#667085] mb-4">
              Folio: {selectedPaymentForRefund.id} • Monto Original: $
              {(selectedPaymentForRefund.amount_cents / 100).toFixed(2)} MXN
            </p>
            <form onSubmit={handleProcessRefund} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                  Monto a reembolsar ($ MXN - dejar vacío para total)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={(selectedPaymentForRefund.amount_cents / 100).toFixed(2)}
                  value={refundAmountDollars}
                  onChange={(e) => setRefundAmountDollars(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Motivo obligatorio</label>
                <textarea
                  required
                  placeholder="Ej. Cobro duplicado por error de terminal o cancelación autorizada"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-[#667085] hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700"
                >
                  Confirmar Reembolso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MOVIMIENTO GAVETA */}
      {isCashDrawerModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200">
            <h3 className="text-xl font-black text-[#101828] mb-1">Ajuste de Gaveta de Caja</h3>
            <form onSubmit={handleRecordDrawerMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Tipo de Movimiento</label>
                <select
                  value={cashDrawerForm.type}
                  onChange={(e) => setCashDrawerForm({ ...cashDrawerForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                >
                  <option value="expense">Salida / Gasto Menor</option>
                  <option value="withdrawal">Retiro Parcial de Efectivo</option>
                  <option value="deposit">Aporte / Entrada de Efectivo</option>
                  <option value="adjustment">Ajuste de Saldo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Importe ($ MXN)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="100.00"
                  value={cashDrawerForm.amount_dollars}
                  onChange={(e) => setCashDrawerForm({ ...cashDrawerForm, amount_dollars: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Concepto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cambio para feria de monedas"
                  value={cashDrawerForm.description}
                  onChange={(e) => setCashDrawerForm({ ...cashDrawerForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCashDrawerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-[#667085] hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#05268F] text-white text-sm font-bold hover:bg-[#031B68]"
                >
                  Aplicar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE Y ARQUEO CIEGO */}
      {isCloseShiftModalOpen && cashSessionData?.shift && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200">
            <h3 className="text-xl font-black text-[#101828] mb-1">Cierre y Arqueo Ciego de Turno</h3>
            <p className="text-xs text-[#667085] mb-4">
              Ingresa el efectivo total contado físicamente en la gaveta para calcular el corte Z.
            </p>
            <form onSubmit={handleCloseCashShift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                  Efectivo Contado Físico ($ MXN)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ej. 2450.00"
                  value={countedCashDollars}
                  onChange={(e) => setCountedCashDollars(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm font-mono font-black text-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">Notas de Cierre</label>
                <textarea
                  placeholder="Observaciones de monedas, billetes o turno..."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-[#667085] hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700"
                >
                  Confirmar y Cerrar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
