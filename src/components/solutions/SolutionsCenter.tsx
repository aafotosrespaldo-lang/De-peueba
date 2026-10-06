import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  UtensilsCrossed,
  ChefHat,
  Printer,
  Award,
  Sparkles,
  TrendingUp,
  Truck,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Search,
  Layers,
  CreditCard,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Lock,
  Unlock,
  Check,
  X,
} from 'lucide-react';
import {
  Solution,
  Capability,
  CommercialPlan,
  Entitlement,
  EntitlementSource,
} from '../../core/types';

export const SolutionsCenter: React.FC = () => {
  const { sdk } = usePos();
  const [activeTab, setActiveTab] = useState<'solutions' | 'plans' | 'entitlements'>('solutions');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Core Data
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);

  // Modal Grant Entitlement
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantSolId, setGrantSolId] = useState('');
  const [grantCap, setGrantCap] = useState('*');
  const [grantSource, setGrantSource] = useState<EntitlementSource>('manual');

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [sols, pls, ents] = await Promise.all([
        sdk.solutions.listSolutions(),
        sdk.solutions.listPlans(),
        sdk.solutions.getRestaurantEntitlements(),
      ]);
      setSolutions(sols);
      setPlans(pls);
      setEntitlements(ents);
    } catch (err) {
      console.error('Error cargando soluciones y entitlements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const getSolutionIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Truck':
        return <Truck className="w-5 h-5 text-amber-600" />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed className="w-5 h-5 text-indigo-600" />;
      case 'Printer':
        return <Printer className="w-5 h-5 text-blue-600" />;
      case 'Award':
        return <Award className="w-5 h-5 text-yellow-600" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-purple-600" />;
      case 'ChefHat':
        return <ChefHat className="w-5 h-5 text-rose-600" />;
      case 'TrendingUp':
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      default:
        return <Layers className="w-5 h-5 text-zinc-600" />;
    }
  };

  const handleToggleSolutionEntitlement = async (sol: Solution) => {
    const existing = entitlements.find((e) => e.solution_id === sol.solution_id && e.status === 'active');
    try {
      if (existing) {
        await sdk.solutions.suspendEntitlement(existing.id);
      } else {
        await sdk.solutions.grantEntitlement({
          solution_id: sol.solution_id,
          capability: '*',
          source: 'manual',
          notes: 'Activado desde Centro de Soluciones',
        });
      }
      await loadAllData();
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  };

  const handleAssignPlan = async (plan: CommercialPlan) => {
    if (!confirm(`¿Confirmas la asignación del ${plan.name} para este restaurante? Otorgará todas las soluciones y capabilities correspondientes.`)) {
      return;
    }
    try {
      await sdk.solutions.assignPlan(plan.id);
      alert(`¡${plan.name} asignado exitosamente!`);
      await loadAllData();
    } catch (err: any) {
      alert(`Error asignando plan: ${err.message}`);
    }
  };

  const handleGrantCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantSolId) return;
    try {
      await sdk.solutions.grantEntitlement({
        solution_id: grantSolId,
        capability: grantCap || '*',
        source: grantSource,
      });
      setIsGrantModalOpen(false);
      setGrantSolId('');
      setGrantCap('*');
      await loadAllData();
    } catch (err: any) {
      alert(`Error otorgando entitlement: ${err.message}`);
    }
  };

  const filteredSolutions = solutions.filter((sol) => {
    const matchesSearch =
      sol.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sol.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sol.solution_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || sol.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex-1 bg-[#F4F6F8] p-6 overflow-y-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-zinc-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#05268F] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              FASE 13 CORE
            </span>
            <span className="text-zinc-500 text-xs font-semibold">Arquitectura & Modelo Comercial</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 mt-1">Soluciones Nativas & Entitlements</h1>
          <p className="text-sm text-zinc-500">
            Registro central de capacidades nativas del Core comercializables por planes y suscripciones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 rounded-xl font-bold text-xs text-zinc-700 hover:bg-zinc-50 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={() => setIsGrantModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#05268F] text-white rounded-xl font-bold text-xs hover:bg-[#031B68] transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Entitlement</span>
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 mt-6 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('solutions')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-sm transition ${
            activeTab === 'solutions'
              ? 'border-[#05268F] text-[#05268F]'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Soluciones & Capabilities ({solutions.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-sm transition ${
            activeTab === 'plans'
              ? 'border-[#05268F] text-[#05268F]'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Planes Comerciales ({plans.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('entitlements')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-sm transition ${
            activeTab === 'entitlements'
              ? 'border-[#05268F] text-[#05268F]'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Entitlements Activos ({entitlements.filter((e) => e.status === 'active').length})</span>
        </button>
      </div>

      {/* TAB 1: SOLUTIONS & CAPABILITIES */}
      {activeTab === 'solutions' && (
        <div className="mt-6 space-y-6">
          {/* SEARCH & FILTERS */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar solución o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#05268F]"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {['all', 'operations', 'logistics', 'kitchen', 'hardware', 'growth', 'intelligence'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                    selectedCategory === cat
                      ? 'bg-[#05268F] text-white'
                      : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {cat === 'all' ? 'Todas' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* GRID OF SOLUTIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSolutions.map((sol) => {
              const isEntitled = entitlements.some(
                (e) => e.solution_id === sol.solution_id && e.status === 'active'
              );

              return (
                <div
                  key={sol.solution_id}
                  className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-5 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                        {getSolutionIcon(sol.icon)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600">
                          v{sol.version}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            isEntitled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}
                        >
                          {isEntitled ? 'Habilitado' : 'No Contratado'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-zinc-900">{sol.name}</h3>
                      </div>
                      <p className="text-xs font-mono text-zinc-400 mt-0.5">ID: {sol.solution_id}</p>
                      <p className="text-xs text-zinc-600 mt-2 line-clamp-2">{sol.description}</p>
                    </div>

                    {/* CAPABILITIES PREVIEW */}
                    <div className="mt-4 pt-4 border-t border-zinc-100">
                      <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider mb-2">
                        Capacidades Nativas ({sol.capabilities.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {sol.capabilities.slice(0, 3).map((cap) => (
                          <span
                            key={cap.id}
                            className="text-[11px] font-semibold bg-zinc-50 text-zinc-700 px-2 py-0.5 rounded-md border border-zinc-100"
                          >
                            {cap.name}
                          </span>
                        ))}
                        {sol.capabilities.length > 3 && (
                          <span className="text-[11px] font-bold text-zinc-400 px-1 py-0.5">
                            +{sol.capabilities.length - 3} más
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CARD ACTIONS */}
                  <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedSolution(sol)}
                      className="text-xs font-bold text-[#05268F] hover:underline flex items-center gap-1"
                    >
                      <span>Ver Capabilities</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleSolutionEntitlement(sol)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                        isEntitled
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {isEntitled ? (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Suspender</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3" />
                          <span>Habilitar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COMMERCIAL PLANS */}
      {activeTab === 'plans' && (
        <div className="mt-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
            <div>
              <span className="font-bold">Modelo Comercial en Core:</span> Los planes son paquetes comerciales que
              otorgan conjuntos de Entitlements sobre Soluciones y Capabilities. En F13 no se procesan cobros bancarios
              reales; la asignación es un derecho de uso directo.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#05268F]/10 text-[#05268F]">
                      TIER {plan.tier.toUpperCase()}
                    </span>
                    <span className="text-xs font-mono font-bold text-zinc-400">{plan.code}</span>
                  </div>

                  <h3 className="text-xl font-black text-zinc-900 mt-3">{plan.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{plan.description}</p>

                  <div className="mt-4 pb-4 border-b border-zinc-100">
                    <span className="text-2xl font-black text-zinc-900">
                      ${((plan.price_cents_monthly || 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-semibold text-zinc-400 ml-1">MXN / mes (catálogo)</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-zinc-700">Soluciones Incluidas:</p>
                    {plan.solutions.map((solId) => {
                      const solObj = solutions.find((s) => s.solution_id === solId);
                      return (
                        <div key={solId} className="flex items-center gap-2 text-xs text-zinc-600">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-semibold">{solObj?.name || solId}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => handleAssignPlan(plan)}
                  className="mt-6 w-full py-2.5 bg-[#05268F] text-white rounded-xl font-bold text-xs hover:bg-[#031B68] transition shadow-xs text-center"
                >
                  Asignar Plan al Restaurante
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RESTAURANT ENTITLEMENTS */}
      {activeTab === 'entitlements' && (
        <div className="mt-6 space-y-6">
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-zinc-900">Entitlements Activos del Restaurante</h3>
                <p className="text-xs text-zinc-500">
                  Derechos de uso activos por plan o activación manual para este restaurante.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-zinc-200 text-zinc-500 uppercase font-black text-[10px]">
                  <tr>
                    <th className="px-6 py-3">Solución</th>
                    <th className="px-6 py-3">Capacidad</th>
                    <th className="px-6 py-3">Origen</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3">Fecha Inicio</th>
                    <th className="px-6 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {entitlements.map((ent) => {
                    const sol = solutions.find((s) => s.solution_id === ent.solution_id);
                    return (
                      <tr key={ent.id} className="hover:bg-zinc-50 transition">
                        <td className="px-6 py-3.5">
                          <div className="font-extrabold text-zinc-900">{sol?.name || ent.solution_id}</div>
                          <div className="font-mono text-[10px] text-zinc-400">{ent.solution_id}</div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded-md text-[11px] text-zinc-700">
                            {ent.capability === '*' ? 'Todas las capabilities (*)' : ent.capability}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 capitalize font-semibold text-zinc-600">
                          {ent.source}
                          {ent.plan_id ? ` (${ent.plan_id})` : ''}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              ent.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {ent.status === 'active' ? 'Activo' : 'Suspendido'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-zinc-500 font-mono text-[11px]">
                          {new Date(ent.start_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-2">
                          {ent.status === 'active' ? (
                            <button
                              onClick={async () => {
                                await sdk.solutions.suspendEntitlement(ent.id);
                                await loadAllData();
                              }}
                              className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold text-[11px] hover:bg-amber-100"
                            >
                              Suspender
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                await sdk.solutions.activateEntitlement(ent.id);
                                await loadAllData();
                              }}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-[11px] hover:bg-emerald-100"
                            >
                              Activar
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (confirm('¿Revocar permanentemente este entitlement?')) {
                                await sdk.solutions.revokeEntitlement(ent.id);
                                await loadAllData();
                              }
                            }}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg font-bold text-[11px] hover:bg-rose-100"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: SOLUTION CAPABILITIES */}
      {selectedSolution && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-zinc-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center">
                  {getSolutionIcon(selectedSolution.icon)}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-zinc-900">{selectedSolution.name}</h3>
                  <p className="text-xs text-zinc-500 font-mono">ID: {selectedSolution.solution_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSolution(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-zinc-600">{selectedSolution.description}</p>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
                  Capacidades Expuestas ({selectedSolution.capabilities.length})
                </h4>
                <div className="space-y-2">
                  {selectedSolution.capabilities.map((cap) => (
                    <div key={cap.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-zinc-900">{cap.name}</span>
                        <span className="font-mono text-[10px] text-zinc-400">{cap.id}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{cap.description}</p>
                      {cap.required_permissions && cap.required_permissions.length > 0 && (
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-[10px] text-zinc-400 font-semibold">Permiso requerido:</span>
                          <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-700">
                            {cap.required_permissions.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setSelectedSolution(null)}
                className="px-4 py-2 bg-zinc-800 text-white rounded-xl font-bold text-xs hover:bg-zinc-900 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GRANT ENTITLEMENT */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleGrantCustom}
            className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-xl overflow-hidden"
          >
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-zinc-900">Otorgar Entitlement Manual</h3>
              <button
                type="button"
                onClick={() => setIsGrantModalOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Solución Core</label>
                <select
                  value={grantSolId}
                  onChange={(e) => setGrantSolId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#05268F]"
                >
                  <option value="">Seleccionar Solución...</option>
                  {solutions.map((s) => (
                    <option key={s.solution_id} value={s.solution_id}>
                      {s.name} ({s.solution_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Capacidad Específica</label>
                <input
                  type="text"
                  value={grantCap}
                  onChange={(e) => setGrantCap(e.target.value)}
                  placeholder="* para toda la solución"
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#05268F]"
                />
                <p className="text-[10px] text-zinc-400 mt-1">Usa * para habilitar todas las capabilities de la solución.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Origen (Source)</label>
                <select
                  value={grantSource}
                  onChange={(e) => setGrantSource(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#05268F]"
                >
                  <option value="manual">Manual</option>
                  <option value="trial">Prueba (Trial)</option>
                  <option value="addon">Addon</option>
                  <option value="promotional">Promocional</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsGrantModalOpen(false)}
                className="px-3 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#05268F] text-white rounded-xl font-bold text-xs hover:bg-[#031B68]"
              >
                Otorgar Entitlement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
