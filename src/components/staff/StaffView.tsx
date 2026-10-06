import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  UserCheck,
  Shield,
  Clock,
  Plus,
  Search,
  ArrowLeft,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Briefcase,
  Users,
  ShieldCheck,
  Award,
  ChevronRight,
  UserX,
  Play,
  Square,
  History,
} from 'lucide-react';
import {
  RestaurantMember,
  Role,
  Permission,
  Shift,
  ShiftStatus,
  StaffSummary,
  ALL_PERMISSIONS,
} from '../../core/types';

interface StaffViewProps {
  initialTab?: 'members' | 'roles' | 'shifts';
  onBack: () => void;
}

export const StaffView: React.FC<StaffViewProps> = ({ initialTab = 'members', onBack }) => {
  const { sdk } = usePos();

  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'shifts'>(initialTab);
  const [loading, setLoading] = useState(false);

  // Data Lists
  const [members, setMembers] = useState<(RestaurantMember & { role_name: string; user_name: string })[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [shifts, setShifts] = useState<(Shift & { member_name: string; role_name: string })[]>([]);
  const [summary, setSummary] = useState<StaffSummary | null>(null);

  // Selection
  const [selectedMember, setSelectedMember] = useState<(RestaurantMember & { role_name: string; user_name: string }) | null>(null);
  const [memberHistory, setMemberHistory] = useState<any[]>([]);

  // Modals
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false);
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);

  // Forms
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    role_id: '',
    employee_code: '',
  });

  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[],
  });

  const [shiftForm, setShiftForm] = useState({
    member_id: '',
    role_id: '',
    notes: '',
  });

  const refreshData = async () => {
    setLoading(true);
    try {
      const [membersList, rolesList, shiftsList, staffSum] = await Promise.all([
        sdk.staff.listMembers(),
        sdk.roles.listRoles(),
        sdk.shifts.listShifts(),
        sdk.staff.getSummary(),
      ]);

      setMembers(membersList);
      setRoles(rolesList);
      setShifts(shiftsList);
      setSummary(staffSum);

      if (rolesList.length > 0 && !memberForm.role_id) {
        setMemberForm((prev) => ({ ...prev, role_id: rolesList[0].id }));
      }
    } catch (err) {
      console.error('Error refreshing staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleSelectMember = async (mem: RestaurantMember & { role_name: string; user_name: string }) => {
    setSelectedMember(mem);
    try {
      const hist = await sdk.staff.getMemberHistory(mem.id);
      setMemberHistory(hist);
    } catch (err) {
      console.error('Error fetching member history:', err);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.name || !memberForm.email || !memberForm.role_id) return;

    try {
      await sdk.staff.createMember({
        name: memberForm.name,
        email: memberForm.email,
        phone: memberForm.phone || undefined,
        role_id: memberForm.role_id,
        employee_code: memberForm.employee_code || undefined,
      });

      setIsNewMemberModalOpen(false);
      setMemberForm({
        name: '',
        email: '',
        phone: '',
        role_id: roles[0]?.id || '',
        employee_code: '',
      });
      await refreshData();
    } catch (err: any) {
      alert(`Error creando miembro: ${err.message}`);
    }
  };

  const handleToggleMemberActive = async (mem: RestaurantMember) => {
    const action = mem.is_active ? 'desactivar' : 'activar';
    if (!confirm(`¿Estás seguro de ${action} a ${mem.display_name}?`)) return;

    try {
      if (mem.is_active) {
        await sdk.staff.deactivateMember(mem.id, 'Desactivado por administración');
      } else {
        await sdk.staff.activateMember(mem.id);
      }
      await refreshData();
      if (selectedMember?.id === mem.id) {
        const hist = await sdk.staff.getMemberHistory(mem.id);
        setMemberHistory(hist);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name) return;

    try {
      await sdk.roles.createRole({
        name: roleForm.name,
        description: roleForm.description,
        permissions: roleForm.permissions,
      });

      setIsNewRoleModalOpen(false);
      setRoleForm({ name: '', description: '', permissions: [] });
      await refreshData();
    } catch (err: any) {
      alert(`Error creando rol: ${err.message}`);
    }
  };

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.member_id) return;

    try {
      await sdk.shifts.startShift({
        member_id: shiftForm.member_id,
        notes: shiftForm.notes || undefined,
      });

      setIsStartShiftModalOpen(false);
      setShiftForm({ member_id: '', role_id: '', notes: '' });
      await refreshData();
    } catch (err: any) {
      alert(`Error iniciando turno: ${err.message}`);
    }
  };

  const handleEndShift = async (shiftId: string) => {
    if (!confirm('¿Deseas finalizar este turno de trabajo?')) return;
    try {
      await sdk.shifts.endShift(shiftId, 'Finalizado por el usuario');
      await refreshData();
    } catch (err: any) {
      alert(`Error finalizando turno: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F6F8] text-[#101828]">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-zinc-500 hover:text-[#05268F] hover:bg-[#EAF0FF] transition"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-[#05268F] text-white flex items-center justify-center shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-[#101828]">
                Personal, Roles & Turnos
              </h1>
              <span className="text-[10px] bg-[#EAF0FF] text-[#05268F] px-2 py-0.5 rounded-full font-black uppercase">
                Core F10
              </span>
            </div>
            <p className="text-xs text-[#667085] font-medium">
              Membresías de restaurante, seguridad RBAC y asistencia operativa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[#F4F6F8] p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => setActiveTab('members')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-white text-[#05268F] shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Personal ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'roles'
                  ? 'bg-white text-[#05268F] shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Roles & Permisos
            </button>
            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'shifts'
                  ? 'bg-white text-[#05268F] shadow-xs'
                  : 'text-[#667085] hover:text-[#101828]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Turnos en Vivo
            </button>
          </div>

          <button
            onClick={refreshData}
            disabled={loading}
            className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:text-[#05268F] hover:bg-[#EAF0FF] transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        {/* TAB 1: MEMBERS */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-12 gap-6 h-full">
            {/* List */}
            <div className="col-span-7 bg-white rounded-2xl border border-zinc-200 shadow-xs flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
                <span className="text-xs font-black uppercase text-[#667085] tracking-wider">
                  Directorio de Empleados
                </span>
                <button
                  onClick={() => setIsNewMemberModalOpen(true)}
                  className="px-3 py-1.5 bg-[#05268F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-[#041d6e]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Alta de Personal
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
                {members.map((mem) => {
                  const isSelected = selectedMember?.id === mem.id;
                  return (
                    <div
                      key={mem.id}
                      onClick={() => handleSelectMember(mem)}
                      className={`p-4 cursor-pointer transition flex items-center justify-between hover:bg-zinc-50 ${
                        isSelected ? 'bg-[#EAF0FF]/60 border-l-4 border-l-[#05268F]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#05268F]/10 text-[#05268F] font-black flex items-center justify-center text-sm">
                          {mem.display_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-[#101828]">{mem.display_name}</h4>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                mem.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-zinc-100 text-zinc-500'
                              }`}
                            >
                              {mem.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#667085] mt-0.5">
                            {mem.role_name} • {mem.employee_code || 'Sin código'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMemberActive(mem);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition ${
                            mem.is_active
                              ? 'border-zinc-200 text-zinc-600 hover:bg-rose-50 hover:text-rose-600'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {mem.is_active ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Member Details */}
            <div className="col-span-5 bg-white rounded-2xl border border-zinc-200 shadow-xs flex flex-col h-full overflow-hidden">
              {selectedMember ? (
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                  <div>
                    <h2 className="text-base font-black text-[#101828]">
                      {selectedMember.display_name}
                    </h2>
                    <p className="text-xs text-[#667085] mt-0.5">
                      Rol: <strong>{selectedMember.role_name}</strong>
                    </p>
                    <div className="mt-3 text-xs space-y-1 text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                      <p>Email: {selectedMember.email}</p>
                      <p>Tel: {selectedMember.phone || 'No registrado'}</p>
                      <p>Ingreso: {new Date(selectedMember.joined_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black uppercase text-[#667085] tracking-wider mb-2 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      Historial Inmutable de Membresía
                    </h3>
                    <div className="space-y-2">
                      {memberHistory.map((h) => (
                        <div
                          key={h.id}
                          className="p-3 bg-white border border-zinc-200 rounded-xl text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#05268F] uppercase text-[10px]">
                              {h.event_type}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {new Date(h.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-zinc-600">{h.notes || 'Evento de membresía registrado'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                  <UserCheck className="w-12 h-12 mb-3 text-zinc-300" />
                  <p className="text-xs">Selecciona un miembro para ver su historial completo.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ROLES */}
        {activeTab === 'roles' && (
          <div className="h-full flex flex-col space-y-6 overflow-y-auto">
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#101828]">Roles y Matriz de Permisos (RBAC)</h2>
                <p className="text-xs text-[#667085]">
                  Protección de roles de sistema y asignación granular de capacidades
                </p>
              </div>
              <button
                onClick={() => setIsNewRoleModalOpen(true)}
                className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs hover:bg-[#041d6e]"
              >
                <Plus className="w-4 h-4" />
                Nuevo Rol
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[#101828]">{r.name}</h3>
                    {r.is_system && (
                      <span className="text-[9px] font-black uppercase bg-[#EAF0FF] text-[#05268F] px-2 py-0.5 rounded-full">
                        Sistema
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#667085]">{r.description}</p>
                  <div className="pt-3 border-t border-zinc-100">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">
                      {r.permissions.length} Permisos asignados
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {r.permissions.map((p) => (
                        <span
                          key={p}
                          className="text-[9px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded-md font-mono"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SHIFTS */}
        {activeTab === 'shifts' && (
          <div className="h-full flex flex-col space-y-6 overflow-y-auto">
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#101828]">Turnos Operativos en Sala & Cocina</h2>
                <p className="text-xs text-[#667085]">
                  Seguimiento de entrada, salida y vinculación con turnos de caja
                </p>
              </div>
              <button
                onClick={() => setIsStartShiftModalOpen(true)}
                className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs hover:bg-[#041d6e]"
              >
                <Play className="w-4 h-4" />
                Iniciar Turno
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {shifts.map((s) => (
                <div
                  key={s.id}
                  className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-[#101828]">{s.member_name}</h3>
                      <p className="text-xs text-[#667085]">{s.role_name}</p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                        s.status === 'active'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                    <p>Inicio: {s.actual_start ? new Date(s.actual_start).toLocaleTimeString() : 'N/A'}</p>
                    {s.actual_end && (
                      <p>Fin: {new Date(s.actual_end).toLocaleTimeString()}</p>
                    )}
                  </div>

                  {s.status === 'active' && (
                    <button
                      onClick={() => handleEndShift(s.id)}
                      className="w-full py-2 bg-zinc-100 hover:bg-rose-50 text-zinc-700 hover:text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Finalizar Turno
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: NUEVO MIEMBRO */}
      {isNewMemberModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-[#05268F] text-white">
              <h3 className="font-black text-sm">Alta de Personal en Restaurante</h3>
              <button onClick={() => setIsNewMemberModalOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  placeholder="Ej. Sofia Morales"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  placeholder="sofia@directaurante.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">Rol Asignado *</label>
                  <select
                    value={memberForm.role_id}
                    onChange={(e) => setMemberForm({ ...memberForm, role_id: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#101828] block mb-1">Código Empleado</label>
                  <input
                    type="text"
                    value={memberForm.employee_code}
                    onChange={(e) => setMemberForm({ ...memberForm, employee_code: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                    placeholder="EMP-007"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsNewMemberModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#041d6e]"
                >
                  Dar de Alta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INICIAR TURNO */}
      {isStartShiftModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-[#05268F] text-white">
              <h3 className="font-black text-sm">Iniciar Turno Operativo</h3>
              <button onClick={() => setIsStartShiftModalOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartShift} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">Miembro de Personal *</label>
                <select
                  required
                  value={shiftForm.member_id}
                  onChange={(e) => setShiftForm({ ...shiftForm, member_id: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                >
                  <option value="">Selecciona un empleado...</option>
                  {members.filter((m) => m.is_active).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name} ({m.role_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#101828] block mb-1">Notas de Turno</label>
                <input
                  type="text"
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-[#05268F]"
                  placeholder="Turno vespertino salón principal"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsStartShiftModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#05268F] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#041d6e]"
                >
                  Comenzar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
