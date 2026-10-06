import React, { useState, useEffect, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import {
  Users,
  Award,
  Tag,
  Gift,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Star,
  ChevronRight,
  X,
  Trash2,
  Calendar,
  Layers,
  TrendingUp,
  Percent,
  Check,
  CreditCard,
  Heart,
  BadgePercent,
  Coins,
  History,
} from 'lucide-react';
import {
  CustomerProfile,
  CustomerAddress,
  CustomerMetrics,
  CustomerSegment,
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyReward,
  Promotion,
  PromotionType,
  CrmSummary,
} from '../../core/types';

interface CrmViewProps {
  initialTab?: 'customers' | 'loyalty' | 'promotions';
  onBack: () => void;
}

export const CrmView: React.FC<CrmViewProps> = ({ initialTab = 'customers', onBack }) => {
  const { sdk } = usePos();

  const [activeTab, setActiveTab] = useState<'customers' | 'loyalty' | 'promotions' | 'summary'>(
    initialTab
  );

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');

  // Core Data Lists
  const [customers, setCustomers] = useState<(CustomerProfile & { metrics: CustomerMetrics })[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<(CustomerProfile & { metrics: CustomerMetrics }) | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loyaltyAccount, setLoyaltyAccount] = useState<LoyaltyAccount | null>(null);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [summary, setSummary] = useState<CrmSummary | null>(null);

  // Modals & Action States
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [isAdjustPointsModalOpen, setIsAdjustPointsModalOpen] = useState(false);
  const [isNewRewardModalOpen, setIsNewRewardModalOpen] = useState(false);
  const [isNewPromoModalOpen, setIsNewPromoModalOpen] = useState(false);
  const [isCouponTesterOpen, setIsCouponTesterOpen] = useState(false);

  // Forms
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    birth_date: '',
    notes: '',
    marketing_opt_in: true,
    allergies: '',
    favorite_items: '',
  });

  const [pointsAdjustForm, setPointsAdjustForm] = useState({
    delta: 100,
    reason: 'Cortesía de gerencia por visita frecuente',
  });

  const [rewardForm, setRewardForm] = useState({
    name: '',
    description: '',
    reward_type: 'discount_amount' as 'discount_amount' | 'discount_percent' | 'free_product',
    value: 5000, // 50 MXN
    points_required: 150,
  });

  const [promoForm, setPromoForm] = useState({
    name: '',
    description: '',
    type: 'coupon' as PromotionType,
    coupon_code: '',
    discount_percent: 15,
    discount_amount_cents: 0,
    min_order_cents: 20000, // $200 MXN
    max_discount_cents: 10000, // $100 MXN max
    max_uses_per_customer: 1,
    stackable_with_loyalty: false,
  });

  const [testCouponCode, setTestCouponCode] = useState('BIENVENIDO10');
  const [testSubtotal, setTestSubtotal] = useState(350);
  const [testResult, setTestResult] = useState<any>(null);

  // Load Data
  const refreshData = async () => {
    setLoading(true);
    try {
      const [custList, rewardsList, promoList, crmSum] = await Promise.all([
        sdk.customers.listCustomers(),
        sdk.loyalty.listRewards(),
        sdk.promotions.listPromotions(),
        sdk.crm.getSummary(),
      ]);

      setCustomers(custList);
      setRewards(rewardsList);
      setPromotions(promoList);
      setSummary(crmSum);

      if (selectedCustomer) {
        const refreshedCust = custList.find((c) => c.id === selectedCustomer.id);
        if (refreshedCust) {
          setSelectedCustomer(refreshedCust);
          loadCustomerDetails(refreshedCust.id);
        }
      }
    } catch (err) {
      console.error('Error refreshing CRM data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const loadCustomerDetails = async (customerId: string) => {
    try {
      const [orders, account, txs] = await Promise.all([
        sdk.customers.getOrders(customerId),
        sdk.loyalty.getAccount(customerId),
        sdk.loyalty.getTransactions(customerId),
      ]);
      setCustomerOrders(orders);
      setLoyaltyAccount(account);
      setLoyaltyTransactions(txs);
    } catch (err) {
      console.error('Error loading customer details:', err);
    }
  };

  const handleSelectCustomer = (cust: CustomerProfile & { metrics: CustomerMetrics }) => {
    setSelectedCustomer(cust);
    loadCustomerDetails(cust.id);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name || !customerForm.phone) return;

    try {
      const newCust = await sdk.customers.createCustomer({
        name: customerForm.name,
        phone: customerForm.phone,
        email: customerForm.email,
        birth_date: customerForm.birth_date || undefined,
        notes: customerForm.notes || undefined,
        marketing_opt_in: customerForm.marketing_opt_in,
        preferences: {
          allergies: customerForm.allergies
            ? customerForm.allergies.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          favorite_items: customerForm.favorite_items
            ? customerForm.favorite_items.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        },
      });

      setIsNewCustomerModalOpen(false);
      setCustomerForm({
        name: '',
        phone: '',
        email: '',
        birth_date: '',
        notes: '',
        marketing_opt_in: true,
        allergies: '',
        favorite_items: '',
      });

      await refreshData();
      const updated = await sdk.customers.getCustomer(newCust.id);
      if (updated) handleSelectCustomer(updated);
    } catch (err: any) {
      alert(`Error creando cliente: ${err.message}`);
    }
  };

  const handleAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      await sdk.loyalty.adjustPoints(
        selectedCustomer.id,
        pointsAdjustForm.delta,
        pointsAdjustForm.reason,
        'Gerente General'
      );
      setIsAdjustPointsModalOpen(false);
      await refreshData();
      await loadCustomerDetails(selectedCustomer.id);
    } catch (err: any) {
      alert(`Error ajustando puntos: ${err.message}`);
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardForm.name) return;

    try {
      await sdk.loyalty.createReward({
        name: rewardForm.name,
        description: rewardForm.description,
        reward_type: rewardForm.reward_type,
        value: rewardForm.value,
        points_required: rewardForm.points_required,
      });
      setIsNewRewardModalOpen(false);
      setRewardForm({
        name: '',
        description: '',
        reward_type: 'discount_amount',
        value: 5000,
        points_required: 150,
      });
      await refreshData();
    } catch (err: any) {
      alert(`Error creando recompensa: ${err.message}`);
    }
  };

  const handleRedeemReward = async (reward: LoyaltyReward) => {
    if (!selectedCustomer) {
      alert('Selecciona primero un cliente para canjear la recompensa.');
      return;
    }
    if ((loyaltyAccount?.points_balance || 0) < reward.points_required) {
      alert('Puntos insuficientes para canjear esta recompensa.');
      return;
    }

    if (!confirm(`¿Confirmar canje de '${reward.name}' por ${reward.points_required} pts?`)) return;

    try {
      await sdk.loyalty.redeemReward(selectedCustomer.id, reward.id, 'Mesero en Sala');
      await refreshData();
      await loadCustomerDetails(selectedCustomer.id);
      alert(`¡Recompensa '${reward.name}' canjeada con éxito!`);
    } catch (err: any) {
      alert(`Error al canjear recompensa: ${err.message}`);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.name) return;

    try {
      await sdk.promotions.createPromotion({
        name: promoForm.name,
        description: promoForm.description,
        type: promoForm.type,
        coupon_code: promoForm.coupon_code || undefined,
        discount_percent: promoForm.type === 'percentage' || promoForm.type === 'coupon' ? promoForm.discount_percent : undefined,
        discount_amount_cents: promoForm.type === 'fixed_amount' ? promoForm.discount_amount_cents : undefined,
        min_order_cents: promoForm.min_order_cents,
        max_discount_cents: promoForm.max_discount_cents,
        max_uses_per_customer: promoForm.max_uses_per_customer,
        stackable_with_loyalty: promoForm.stackable_with_loyalty,
      });
      setIsNewPromoModalOpen(false);
      await refreshData();
    } catch (err: any) {
      alert(`Error creando promoción: ${err.message}`);
    }
  };

  const handleTestCoupon = async () => {
    if (!testCouponCode) return;
    try {
      const res = await sdk.promotions.validateCoupon(
        testCouponCode,
        Math.round(testSubtotal * 100),
        selectedCustomer?.id
      );
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ valid: false, reason: err.message, discount_cents: 0 });
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSegment = segmentFilter === 'all' || c.metrics.segment === segmentFilter;
      return matchesSearch && matchesSegment;
    });
  }, [customers, searchQuery, segmentFilter]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'platinum':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'gold':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'silver':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-orange-50 text-orange-800 border-orange-200';
    }
  };

  const getSegmentBadge = (segment: CustomerSegment) => {
    switch (segment) {
      case 'high_value_customer':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'frequent_customer':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'new_customer':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const formatSegment = (segment: CustomerSegment) => {
    switch (segment) {
      case 'high_value_customer':
        return 'VIP / Alto Valor';
      case 'frequent_customer':
        return 'Frecuente';
      case 'new_customer':
        return 'Nuevo';
      case 'active_customer':
        return 'Activo';
      case 'inactive_customer':
        return 'Inactivo';
      default:
        return segment;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F6F8] text-[#101828]">
      {/* Top Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-zinc-500 hover:text-[#05268F] hover:bg-[#EAF0FF] transition"
            title="Volver al Salón"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-[#05268F] text-white flex items-center justify-center shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-[#101828]">
                Clientes, CRM & Fidelidad
              </h1>
              <span className="text-[10px] bg-[#EAF0FF] text-[#05268F] px-2 py-0.5 rounded-full font-black uppercase">
                Core F11
              </span>
            </div>
            <p className="text-xs text-[#667085] font-medium">
              Identidad unificada, historial de consumo, programa loyalty y promociones
            </p>
          </div>
        </div>

        {/* Global Tab Selector */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#F4F6F8] p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'customers'
                  ? 'bg-white text-[#05268F] shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Directorio
            </button>
            <button
              onClick={() => setActiveTab('loyalty')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'loyalty'
                  ? 'bg-white text-[#05268F] shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Programa Loyalty
            </button>
            <button
              onClick={() => setActiveTab('promotions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'promotions'
                  ? 'bg-white text-[#05268F] shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Promociones
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'summary'
                  ? 'bg-white text-[#05268F] shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              KPIs & Métricas
            </button>
          </div>

          <button
            onClick={refreshData}
            disabled={loading}
            className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:text-[#05268F] hover:bg-[#EAF0FF] transition"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-6">
        {/* ======================================================== */}
        {/* TAB 1: CLIENTES & DIRECTORIO CRM */}
        {/* ======================================================== */}
        {activeTab === 'customers' && (
          <div className="grid grid-cols-12 gap-6 h-full">
            {/* Left Column: Customer Directory List (5 cols) */}
            <div className="col-span-5 bg-white rounded-2xl border border-zinc-200 shadow-xs flex flex-col h-full overflow-hidden">
              {/* Directory Filter Bar */}
              <div className="p-4 border-b border-zinc-200 space-y-3 bg-zinc-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-[#667085] tracking-wider">
                    {filteredCustomers.length} Clientes Registrados
                  </span>
                  <button
                    onClick={() => setIsNewCustomerModalOpen(true)}
                    className="px-3 py-1.5 bg-[#05268F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#041d6e] transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nuevo Cliente
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, teléfono o email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-[#05268F]"
                    />
                  </div>
                  <select
                    value={segmentFilter}
                    onChange={(e) => setSegmentFilter(e.target.value)}
                    className="bg-white border border-zinc-200 text-xs rounded-xl px-2.5 py-2 font-medium focus:outline-hidden"
                  >
                    <option value="all">Todos</option>
                    <option value="high_value_customer">VIP</option>
                    <option value="frequent_customer">Frecuente</option>
                    <option value="new_customer">Nuevo</option>
                  </select>
                </div>
              </div>

              {/* Scrollable Customer List */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
                {filteredCustomers.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No se encontraron clientes coincidentes.</p>
                  </div>
                ) : (
                  filteredCustomers.map((cust) => {
                    const isSelected = selectedCustomer?.id === cust.id;
                    return (
                      <div
                        key={cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        className={`p-4 cursor-pointer transition flex items-center justify-between hover:bg-zinc-50 ${
                          isSelected ? 'bg-[#EAF0FF]/60 border-l-4 border-l-[#05268F]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#05268F]/10 text-[#05268F] font-black flex items-center justify-center text-sm">
                            {cust.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-[#101828]">{cust.name}</h4>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${getSegmentBadge(
                                  cust.metrics.segment
                                )}`}
                              >
                                {formatSegment(cust.metrics.segment)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-[#667085] mt-0.5">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-zinc-400" />
                                {cust.phone}
                              </span>
                              <span>•</span>
                              <span>{cust.metrics.order_count} visitas</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-black border uppercase ${getTierBadge(
                              cust.metrics.tier
                            )}`}
                          >
                            {cust.metrics.tier}
                          </span>
                          <p className="text-[11px] font-black text-[#05268F] mt-1">
                            {cust.metrics.points_balance} pts
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Customer Deep Profile & History (7 cols) */}
            <div className="col-span-7 bg-white rounded-2xl border border-zinc-200 shadow-xs flex flex-col h-full overflow-hidden">
              {selectedCustomer ? (
                <div className="flex-1 flex flex-col overflow-y-auto">
                  {/* Customer Banner Header */}
                  <div className="p-6 border-b border-zinc-200 bg-linear-to-r from-[#05268F]/5 to-transparent">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#05268F] text-[#FFD318] font-black text-xl flex items-center justify-center shadow-xs">
                          {selectedCustomer.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-black text-[#101828]">
                              {selectedCustomer.name}
                            </h2>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-black border uppercase ${getTierBadge(
                                selectedCustomer.metrics.tier
                              )}`}
                            >
                              Tier {selectedCustomer.metrics.tier}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[#667085] mt-1">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {selectedCustomer.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {selectedCustomer.email}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsAdjustPointsModalOpen(true)}
                          className="px-3 py-1.5 bg-[#FFD318] text-[#05268F] rounded-xl text-xs font-black shadow-xs hover:bg-[#fed100] transition flex items-center gap-1.5"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          Ajustar Puntos
                        </button>
                      </div>
                    </div>

                    {/* Customer Metric KPI Cards */}
                    <div className="grid grid-cols-4 gap-3 mt-6">
                      <div className="bg-white p-3 rounded-xl border border-zinc-200">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">
                          Saldo Puntos
                        </span>
                        <p className="text-lg font-black text-[#05268F]">
                          {selectedCustomer.metrics.points_balance} pts
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-zinc-200">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">
                          Gasto Total
                        </span>
                        <p className="text-lg font-black text-emerald-700">
                          ${(selectedCustomer.metrics.total_spend_cents / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-zinc-200">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">
                          Ticket Promedio
                        </span>
                        <p className="text-lg font-black text-[#101828]">
                          ${(selectedCustomer.metrics.average_order_value_cents / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-zinc-200">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">
                          Comandas Pagadas
                        </span>
                        <p className="text-lg font-black text-[#101828]">
                          {selectedCustomer.metrics.order_count} visitas
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Preferences & Notes */}
                  <div className="p-6 border-b border-zinc-200 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-[#101828] flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        Preferencias & Alergias
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCustomer.preferences?.allergies &&
                        selectedCustomer.preferences.allergies.length > 0 ? (
                          selectedCustomer.preferences.allergies.map((all, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold"
                            >
                              Alergia: {all}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-400">Sin alergias registradas</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-[#101828] flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-500" />
                        Favoritos Recurrentes
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCustomer.metrics.favorite_product_names &&
                        selectedCustomer.metrics.favorite_product_names.length > 0 ? (
                          selectedCustomer.metrics.favorite_product_names.map((fav, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold"
                            >
                              {fav}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-400">Aún sin favoritos detectados</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer Orders & Loyalty Transaction Ledger */}
                  <div className="p-6 flex-1 space-y-6">
                    {/* Orders History */}
                    <div>
                      <h4 className="text-xs font-black uppercase text-[#667085] tracking-wider mb-3">
                        Historial de Comandas ({customerOrders.length})
                      </h4>
                      {customerOrders.length === 0 ? (
                        <p className="text-xs text-zinc-400">No hay comandas registradas aún.</p>
                      ) : (
                        <div className="space-y-2">
                          {customerOrders.map((ord) => (
                            <div
                              key={ord.id}
                              className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-[#101828]">
                                  {ord.ticket_number || ord.id}
                                </span>
                                <span className="text-zinc-400 ml-2">
                                  {new Date(ord.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                {ord.discount_cents && ord.discount_cents > 0 ? (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                                    Desc. -${(ord.discount_cents / 100).toFixed(2)}
                                  </span>
                                ) : null}
                                <span className="font-black text-[#101828]">
                                  ${((ord.total_cents || 0) / 100).toFixed(2)} MXN
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Immutable Points Ledger */}
                    <div>
                      <h4 className="text-xs font-black uppercase text-[#667085] tracking-wider mb-3 flex items-center justify-between">
                        <span>Libro Contable de Puntos (KárdeX Loyalty)</span>
                        <span className="text-zinc-400 font-normal">Inmutable</span>
                      </h4>
                      {loyaltyTransactions.length === 0 ? (
                        <p className="text-xs text-zinc-400">Sin movimientos de puntos aún.</p>
                      ) : (
                        <div className="space-y-2">
                          {loyaltyTransactions.map((tx) => (
                            <div
                              key={tx.id}
                              className="p-3 bg-white border border-zinc-200 rounded-xl flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-black ${
                                      tx.points > 0 ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                                  </span>
                                  <span className="text-[#101828] font-medium">{tx.description}</span>
                                </div>
                                <span className="text-[10px] text-zinc-400">
                                  {new Date(tx.created_at).toLocaleString()} • Por {tx.created_by}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[11px] font-bold text-zinc-500">
                                  Saldo: {tx.balance_after} pts
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                  <Users className="w-12 h-12 mb-3 text-zinc-300" />
                  <h3 className="text-sm font-bold text-zinc-600">Selecciona un cliente</h3>
                  <p className="text-xs max-w-xs mt-1">
                    Haz clic en cualquier cliente del directorio para ver su perfil completo,
                    historial de consumo y estado de puntos.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PROGRAMA LOYALTY & RECOMPENSAS */}
        {/* ======================================================== */}
        {activeTab === 'loyalty' && (
          <div className="h-full flex flex-col space-y-6 overflow-y-auto">
            {/* Header info bar */}
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#101828]">
                  Catálogo de Recompensas por Puntos
                </h2>
                <p className="text-xs text-[#667085]">
                  Regla de acumulación: 1 punto por cada $10 MXN consumidos en comandas cerradas
                </p>
              </div>
              <button
                onClick={() => setIsNewRewardModalOpen(true)}
                className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs hover:bg-[#041d6e] transition"
              >
                <Plus className="w-4 h-4" />
                Nueva Recompensa
              </button>
            </div>

            {/* Loyalty Rewards Grid */}
            <div className="grid grid-cols-3 gap-4">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between hover:border-[#05268F] transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-[#FFD318]/20 text-[#05268F] px-2.5 py-0.5 rounded-full">
                        {reward.points_required} PUNTOS
                      </span>
                      <Award className="w-5 h-5 text-amber-500" />
                    </div>
                    <h3 className="text-sm font-black text-[#101828] mt-2">{reward.name}</h3>
                    <p className="text-xs text-[#667085] leading-relaxed">{reward.description}</p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">
                        Beneficio
                      </span>
                      <span className="text-xs font-black text-emerald-700">
                        {reward.reward_type === 'discount_amount'
                          ? `$${(reward.value / 100).toFixed(2)} MXN Descuento`
                          : reward.reward_type === 'discount_percent'
                          ? `${reward.value}% Descuento`
                          : 'Platillo Gratis'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRedeemReward(reward)}
                      className="px-3 py-1.5 bg-[#05268F] text-white rounded-xl text-xs font-bold hover:bg-[#041d6e] transition shadow-xs"
                    >
                      Canjear
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: PROMOCIONES, CUPONES Y DESCUENTOS */}
        {/* ======================================================== */}
        {activeTab === 'promotions' && (
          <div className="h-full flex flex-col space-y-6 overflow-y-auto">
            {/* Header with Tester Button */}
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#101828]">
                  Motor de Promociones & Cupones
                </h2>
                <p className="text-xs text-[#667085]">
                  Cupones de apertura, descuentos porcentuales y validación en tiempo real
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsCouponTesterOpen(!isCouponTesterOpen)}
                  className="px-4 py-2 border border-zinc-200 bg-zinc-50 text-[#101828] rounded-xl text-xs font-bold hover:bg-zinc-100 transition flex items-center gap-2"
                >
                  <Tag className="w-4 h-4 text-[#05268F]" />
                  Simulador de Cupones
                </button>
                <button
                  onClick={() => setIsNewPromoModalOpen(true)}
                  className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs hover:bg-[#041d6e] transition"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Promoción
                </button>
              </div>
            </div>

            {/* Interactive Coupon Tester Panel */}
            {isCouponTesterOpen && (
              <div className="bg-[#EAF0FF]/50 border border-[#05268F]/20 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-[#05268F] tracking-wider flex items-center gap-1.5">
                    <BadgePercent className="w-4 h-4" />
                    Simulador / Validador de Cupones en Comanda
                  </h3>
                  <button
                    onClick={() => setIsCouponTesterOpen(false)}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="text-[10px] font-bold text-[#667085] uppercase block mb-1">
                      Código de Cupón
                    </label>
                    <input
                      type="text"
                      value={testCouponCode}
                      onChange={(e) => setTestCouponCode(e.target.value.toUpperCase())}
                      placeholder="Ej. BIENVENIDO10"
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-black focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#667085] uppercase block mb-1">
                      Subtotal Simulado ($ MXN)
                    </label>
                    <input
                      type="number"
                      value={testSubtotal}
                      onChange={(e) => setTestSubtotal(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <button
                      onClick={handleTestCoupon}
                      className="w-full py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#041d6e] transition"
                    >
                      Validar Cupón
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                      testResult.valid
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.valid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>
                        {testResult.valid
                          ? `Cupón válido: Aplica descuento de $${(
                              testResult.discount_cents / 100
                            ).toFixed(2)} MXN`
                          : `Rechazado: ${testResult.reason}`}
                      </span>
                    </div>
                    {testResult.valid && (
                      <span className="text-[11px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                        Total Final: ${(testSubtotal - testResult.discount_cents / 100).toFixed(2)} MXN
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Promotions List */}
            <div className="grid grid-cols-3 gap-4">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between hover:border-[#05268F] transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        {promo.coupon_code || promo.type.toUpperCase()}
                      </span>
                      <span className="text-xs font-black text-zinc-400">
                        {promo.current_uses_count} usos
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-[#101828] mt-2">{promo.name}</h3>
                    <p className="text-xs text-[#667085] leading-relaxed">{promo.description}</p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-zinc-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>Descuento:</span>
                      <span className="font-black text-[#05268F]">
                        {promo.discount_percent
                          ? `${promo.discount_percent}%`
                          : `$${((promo.discount_amount_cents || 0) / 100).toFixed(2)} MXN`}
                      </span>
                    </div>
                    {promo.min_order_cents ? (
                      <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                        <span>Consumo Mínimo:</span>
                        <span>${(promo.min_order_cents / 100).toFixed(2)} MXN</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: KPIS & RESUMEN CRM */}
        {/* ======================================================== */}
        {activeTab === 'summary' && summary && (
          <div className="h-full flex flex-col space-y-6 overflow-y-auto">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-bold text-[#667085] uppercase">Total Clientes</span>
                <p className="text-2xl font-black text-[#101828] mt-1">{summary.total_customers}</p>
                <span className="text-[11px] text-emerald-700 font-bold mt-2 block">
                  +{summary.new_customers_this_month} nuevos este mes
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-bold text-[#667085] uppercase">Clientes Frecuentes</span>
                <p className="text-2xl font-black text-[#05268F] mt-1">
                  {summary.frequent_customers}
                </p>
                <span className="text-[11px] text-[#667085] font-medium mt-2 block">
                  3+ visitas registradas
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-bold text-[#667085] uppercase">Puntos Emitidos</span>
                <p className="text-2xl font-black text-amber-600 mt-1">
                  {summary.total_loyalty_points_issued.toLocaleString()} pts
                </p>
                <span className="text-[11px] text-zinc-500 font-medium mt-2 block">
                  Acumulado histórico
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-bold text-[#667085] uppercase">Puntos Canjeados</span>
                <p className="text-2xl font-black text-rose-600 mt-1">
                  {summary.total_loyalty_points_redeemed.toLocaleString()} pts
                </p>
                <span className="text-[11px] text-zinc-500 font-medium mt-2 block">
                  Recompensas otorgadas
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL: NUEVO CLIENTE */}
      {/* ======================================================== */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-[#05268F] text-white">
              <h3 className="font-black text-sm">Registrar Nuevo Cliente en Core CRM</h3>
              <button
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  placeholder="Ej. Roberto Garza"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">Teléfono *</label>
                  <input
                    type="tel"
                    required
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                    placeholder="+52 81 1234 5678"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">Email</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                    placeholder="cliente@ejemplo.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">Alergias (separadas por coma)</label>
                <input
                  type="text"
                  value={customerForm.allergies}
                  onChange={(e) => setCustomerForm({ ...customerForm, allergies: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  placeholder="Ej. Cacahuate, Mariscos"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="optin"
                  checked={customerForm.marketing_opt_in}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, marketing_opt_in: e.target.checked })
                  }
                  className="rounded text-[#05268F]"
                />
                <label htmlFor="optin" className="text-xs text-[#667085] font-medium">
                  Acepta recibir promociones y notificaciones Loyalty
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#041d6e]"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: AJUSTE MANUAL DE PUNTOS */}
      {/* ======================================================== */}
      {isAdjustPointsModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-[#05268F] text-white">
              <h3 className="font-black text-sm">Ajuste Manual de Puntos Loyalty</h3>
              <button
                onClick={() => setIsAdjustPointsModalOpen(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustPoints} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">
                  Cliente: {selectedCustomer.name}
                </label>
                <p className="text-xs text-[#667085]">
                  Saldo Actual: <strong>{selectedCustomer.metrics.points_balance} pts</strong>
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">
                  Puntos a Modificar (+ o -)
                </label>
                <input
                  type="number"
                  required
                  value={pointsAdjustForm.delta}
                  onChange={(e) =>
                    setPointsAdjustForm({ ...pointsAdjustForm, delta: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-black focus:ring-2 focus:ring-[#05268F]"
                  placeholder="Ej. 100 o -50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">
                  Motivo Obligatorio (Auditoría Inmutable) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={pointsAdjustForm.reason}
                  onChange={(e) =>
                    setPointsAdjustForm({ ...pointsAdjustForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  placeholder="Indica la justificación operativa del ajuste..."
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustPointsModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#041d6e]"
                >
                  Asentar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NUEVA RECOMPENSA */}
      {/* ======================================================== */}
      {isNewRewardModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-[#05268F] text-white">
              <h3 className="font-black text-sm">Nueva Recompensa del Programa Loyalty</h3>
              <button
                onClick={() => setIsNewRewardModalOpen(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReward} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={rewardForm.name}
                  onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  placeholder="Ej. Postre Helado de Cortesía"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">Descripción</label>
                <input
                  type="text"
                  value={rewardForm.description}
                  onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  placeholder="Válido en cualquier visita"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">Puntos Requeridos *</label>
                  <input
                    type="number"
                    required
                    value={rewardForm.points_required}
                    onChange={(e) =>
                      setRewardForm({ ...rewardForm, points_required: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-black focus:ring-2 focus:ring-[#05268F]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">Tipo de Beneficio</label>
                  <select
                    value={rewardForm.reward_type}
                    onChange={(e: any) => setRewardForm({ ...rewardForm, reward_type: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  >
                    <option value="discount_amount">Descuento en $ (Monto fijo)</option>
                    <option value="discount_percent">Porcentaje de Descuento</option>
                    <option value="free_product">Producto Gratis</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsNewRewardModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#041d6e]"
                >
                  Guardar Recompensa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: NUEVA PROMOCIÓN */}
      {/* ======================================================== */}
      {isNewPromoModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-[#05268F] text-white">
              <h3 className="font-black text-sm">Crear Promoción o Cupón</h3>
              <button
                onClick={() => setIsNewPromoModalOpen(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePromo} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">Nombre Promoción *</label>
                <input
                  type="text"
                  required
                  value={promoForm.name}
                  onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  placeholder="Ej. Cupón Bienvenida 20%"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">
                  Código de Cupón (Opcional, en mayúsculas)
                </label>
                <input
                  type="text"
                  value={promoForm.coupon_code}
                  onChange={(e) =>
                    setPromoForm({ ...promoForm, coupon_code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-black uppercase focus:ring-2 focus:ring-[#05268F]"
                  placeholder="BIENVENIDA20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">
                    % Descuento
                  </label>
                  <input
                    type="number"
                    value={promoForm.discount_percent}
                    onChange={(e) =>
                      setPromoForm({ ...promoForm, discount_percent: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#05268F]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">
                    Consumo Mín. ($ MXN)
                  </label>
                  <input
                    type="number"
                    value={promoForm.min_order_cents / 100}
                    onChange={(e) =>
                      setPromoForm({
                        ...promoForm,
                        min_order_cents: Math.round(Number(e.target.value) * 100),
                      })
                    }
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#05268F]"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsNewPromoModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#041d6e]"
                >
                  Crear Promoción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
