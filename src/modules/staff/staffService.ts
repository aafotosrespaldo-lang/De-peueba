/**
 * DIRECTAURANTE POS CORE v0.1 - Staff, Roles, Permissions & Shifts Service (FASE 10)
 * 
 * Rules & Architecture:
 * 1. User: Global identity & authentication (never duplicated per restaurant).
 * 2. RestaurantMember: Relationship between a user and a restaurant (multi-tenant).
 * 3. Role: Defines function inside restaurant (system roles protected, custom roles supported).
 * 4. Permission: Granular capabilities checked via backend RBAC.
 * 5. Shift: Operational work session for staff (links to cash sessions, tracks start/end).
 * 6. Historical integrity: Deactivating a member preserves all historical actions (sales, movements, shifts).
 * 7. Multi-tenant security: Never trust client restaurant_id blindly; resolve via membership.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  User,
  RestaurantMember,
  Role,
  Permission,
  Shift,
  ShiftStatus,
  MemberHistoryRecord,
  CurrentRestaurantContext,
  StaffSummary,
  ALL_PERMISSIONS,
} from '../../core/types';
import { audit } from '../../core/audit';
import { eventBus } from '../../core/eventBus';

export interface CreateMemberDTO {
  user_id?: string;
  email: string;
  name: string;
  phone?: string;
  role_id: string;
  display_name?: string;
  employee_code?: string;
  notes?: string;
  restaurant_id?: string;
}

export interface UpdateMemberDTO {
  role_id?: string;
  display_name?: string;
  phone?: string;
  employee_code?: string;
  notes?: string;
}

export interface CreateRoleDTO {
  name: string;
  description: string;
  permissions: Permission[];
  restaurant_id?: string;
}

export interface UpdateRoleDTO {
  name?: string;
  description?: string;
  permissions?: Permission[];
}

export interface CreateShiftDTO {
  member_id: string;
  role_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  notes?: string;
  restaurant_id?: string;
}

export interface StartShiftDTO {
  member_id: string;
  cash_shift_id?: string;
  notes?: string;
  restaurant_id?: string;
}

export interface AuthCheckResult {
  authorized: boolean;
  user?: User;
  member?: RestaurantMember;
  role?: Role;
  reason?: string;
}

export class StaffService {
  // ==========================================
  // 1. RESTAURANT MEMBERS (PERSONAL Y MEMBRESÍAS)
  // ==========================================

  public static listMembers(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: { is_active?: boolean; role_id?: string; search?: string }
  ): (RestaurantMember & { role_name: string; user_name: string })[] {
    const members = db.get('restaurant_members').filter((m) => m.restaurant_id === restaurant_id);
    const roles = db.get('roles');
    const users = db.get('users');

    let result = members.map((m) => {
      const role = roles.find((r) => r.id === m.role_id);
      const user = users.find((u) => u.id === m.user_id);
      return {
        ...m,
        role_name: role ? role.name : m.role_id,
        user_name: user ? user.name : m.display_name,
      };
    });

    if (filters?.is_active !== undefined) {
      result = result.filter((m) => m.is_active === filters.is_active);
    }

    if (filters?.role_id) {
      result = result.filter((m) => m.role_id === filters.role_id);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.display_name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.employee_code && m.employee_code.toLowerCase().includes(q)) ||
          m.role_name.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public static getMember(
    member_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): (RestaurantMember & { role_name: string; user_name: string; role?: Role }) | undefined {
    const member = db
      .get('restaurant_members')
      .find((m) => m.id === member_id && m.restaurant_id === restaurant_id);
    if (!member) return undefined;

    const role = db.get('roles').find((r) => r.id === member.role_id);
    const user = db.get('users').find((u) => u.id === member.user_id);

    return {
      ...member,
      role_name: role ? role.name : member.role_id,
      user_name: user ? user.name : member.display_name,
      role,
    };
  }

  public static getMemberByUserId(
    user_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): RestaurantMember | undefined {
    return db
      .get('restaurant_members')
      .find((m) => m.user_id === user_id && m.restaurant_id === restaurant_id);
  }

  public static createMember(
    data: CreateMemberDTO,
    actor: string = 'System Admin'
  ): RestaurantMember {
    const restaurant_id = data.restaurant_id || DEFAULT_RESTAURANT_ID;
    const now = new Date().toISOString();

    // 1. Resolve or create global user identity
    let user: User | undefined;
    const users = db.get('users');

    if (data.user_id) {
      user = users.find((u) => u.id === data.user_id);
      if (!user) {
        throw new Error(`Usuario con id ${data.user_id} no encontrado.`);
      }
    } else {
      // Find by email or create new global user
      user = users.find((u) => u.email.toLowerCase() === data.email.toLowerCase().trim());
      if (!user) {
        user = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          email: data.email.toLowerCase().trim(),
          name: data.name.trim(),
          phone: data.phone,
          created_at: now,
          updated_at: now,
        };
        users.push(user);
      }
    }

    // 2. Validate membership uniqueness within this restaurant
    const members = db.get('restaurant_members');
    const existingMember = members.find(
      (m) => m.user_id === user!.id && m.restaurant_id === restaurant_id
    );
    if (existingMember) {
      if (existingMember.is_active) {
        throw new Error(`El usuario ${user.name} ya es miembro activo de este restaurante.`);
      } else {
        // Reactivate existing membership
        existingMember.is_active = true;
        existingMember.role_id = data.role_id;
        existingMember.updated_at = now;
        db.save();

        this.recordHistory({
          member_id: existingMember.id,
          restaurant_id,
          event_type: 'reactivated',
          new_role_id: data.role_id,
          performed_by: actor,
          notes: 'Membresía reactivada al registrar de nuevo',
        });

        return existingMember;
      }
    }

    // 3. Validate Role exists
    const role = db.get('roles').find((r) => r.id === data.role_id);
    if (!role) {
      throw new Error(`El rol especificado '${data.role_id}' no existe.`);
    }

    // 4. Create new RestaurantMember
    const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newMember: RestaurantMember = {
      id: memberId,
      restaurant_id,
      user_id: user.id,
      role_id: data.role_id,
      display_name: data.display_name?.trim() || data.name.trim(),
      employee_code:
        data.employee_code?.trim() ||
        `EMP-${String(members.filter((m) => m.restaurant_id === restaurant_id).length + 1).padStart(3, '0')}`,
      email: user.email,
      phone: data.phone || user.phone,
      is_active: true,
      joined_at: now,
      notes: data.notes,
      created_at: now,
      updated_at: now,
    };

    members.push(newMember);

    // 5. Record History & Audit
    this.recordHistory({
      member_id: memberId,
      restaurant_id,
      event_type: 'joined',
      new_role_id: data.role_id,
      performed_by: actor,
      notes: `Alta de miembro con rol ${role.name}`,
    });

    audit.logAction(
      'staff.member_created',
      'staff',
      memberId,
      actor,
      `Nuevo colaborador agregado: ${newMember.display_name} (${role.name})`,
      { restaurant_id, user_id: user.id, role_id: role.id }
    );

    eventBus.emit({
      event_name: 'staff.member_created',
      event_type: 'staff_event',
      aggregate_id: memberId,
      actor_id: actor,
      data: { member: newMember, role: role.name },
    });

    db.save();
    return newMember;
  }

  public static updateMember(
    member_id: string,
    data: UpdateMemberDTO,
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): RestaurantMember {
    const member = db
      .get('restaurant_members')
      .find((m) => m.id === member_id && m.restaurant_id === restaurant_id);
    if (!member) {
      throw new Error(`Miembro con id ${member_id} no encontrado en este restaurante.`);
    }

    const now = new Date().toISOString();
    const previousRoleId = member.role_id;

    // If role is being changed
    if (data.role_id && data.role_id !== member.role_id) {
      const newRole = db.get('roles').find((r) => r.id === data.role_id);
      if (!newRole) {
        throw new Error(`El nuevo rol '${data.role_id}' no existe.`);
      }

      // Check if previous was owner and if it's the last owner
      if (previousRoleId === 'role_owner') {
        const otherOwners = db
          .get('restaurant_members')
          .filter(
            (m) =>
              m.restaurant_id === restaurant_id &&
              m.role_id === 'role_owner' &&
              m.is_active &&
              m.id !== member_id
          );
        if (otherOwners.length === 0) {
          throw new Error('No es posible cambiar el rol del único propietario activo del restaurante.');
        }
      }

      member.role_id = data.role_id;

      this.recordHistory({
        member_id,
        restaurant_id,
        event_type: 'role_changed',
        previous_role_id: previousRoleId,
        new_role_id: data.role_id,
        performed_by: actor,
        notes: `Cambio de rol de ${previousRoleId} a ${newRole.name}`,
      });

      audit.logAction(
        'staff.role_changed',
        'staff',
        member_id,
        actor,
        `Cambio de rol de ${member.display_name}: de ${previousRoleId} a ${newRole.name}`,
        { restaurant_id, previous_role_id: previousRoleId, new_role_id: data.role_id }
      );

      eventBus.emit({
        event_name: 'staff.role_changed',
        event_type: 'staff_event',
        aggregate_id: member_id,
        actor_id: actor,
        data: { member_id, previous_role_id: previousRoleId, new_role_id: data.role_id },
      });
    }

    if (data.display_name !== undefined) member.display_name = data.display_name.trim();
    if (data.phone !== undefined) member.phone = data.phone;
    if (data.employee_code !== undefined) member.employee_code = data.employee_code.trim();
    if (data.notes !== undefined) member.notes = data.notes;

    member.updated_at = now;

    audit.logAction(
      'staff.member_updated',
      'staff',
      member_id,
      actor,
      `Datos actualizados para colaborador ${member.display_name}`,
      { restaurant_id, member_id }
    );

    eventBus.emit({
      event_name: 'staff.member_updated',
      event_type: 'staff_event',
      aggregate_id: member_id,
      actor_id: actor,
      data: { member_id, updated_fields: Object.keys(data) },
    });

    db.save();
    return member;
  }

  public static deactivateMember(
    member_id: string,
    reason: string = 'Baja de personal',
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): RestaurantMember {
    const member = db
      .get('restaurant_members')
      .find((m) => m.id === member_id && m.restaurant_id === restaurant_id);
    if (!member) {
      throw new Error(`Miembro con id ${member_id} no encontrado.`);
    }

    // Safety: Protect last active owner
    if (member.role_id === 'role_owner') {
      const otherOwners = db
        .get('restaurant_members')
        .filter(
          (m) =>
            m.restaurant_id === restaurant_id &&
            m.role_id === 'role_owner' &&
            m.is_active &&
            m.id !== member_id
        );
      if (otherOwners.length === 0) {
        throw new Error('No es posible desactivar al único propietario activo del restaurante.');
      }
    }

    const now = new Date().toISOString();
    member.is_active = false;
    member.left_at = now;
    member.notes = member.notes ? `${member.notes} | Baja: ${reason}` : `Baja: ${reason}`;
    member.updated_at = now;

    // Automatically complete or cancel active shifts for this member
    const activeShifts = db
      .get('shifts')
      .filter((s) => s.member_id === member_id && s.status === 'active');
    for (const shift of activeShifts) {
      shift.status = 'completed';
      shift.actual_end = now;
      shift.notes = shift.notes ? `${shift.notes} | Cierre por baja de colaborador` : 'Cierre automático por baja';
      shift.updated_at = now;
    }

    this.recordHistory({
      member_id,
      restaurant_id,
      event_type: 'deactivated',
      performed_by: actor,
      notes: reason,
    });

    audit.logAction(
      'staff.deactivated',
      'staff',
      member_id,
      actor,
      `Colaborador ${member.display_name} desactivado. Motivo: ${reason}`,
      { restaurant_id, member_id, reason }
    );

    eventBus.emit({
      event_name: 'staff.member_deactivated',
      event_type: 'staff_event',
      aggregate_id: member_id,
      actor_id: actor,
      data: { member_id, reason },
    });

    db.save();
    return member;
  }

  public static activateMember(
    member_id: string,
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): RestaurantMember {
    const member = db
      .get('restaurant_members')
      .find((m) => m.id === member_id && m.restaurant_id === restaurant_id);
    if (!member) {
      throw new Error(`Miembro con id ${member_id} no encontrado.`);
    }

    const now = new Date().toISOString();
    member.is_active = true;
    member.left_at = undefined;
    member.updated_at = now;

    this.recordHistory({
      member_id,
      restaurant_id,
      event_type: 'reactivated',
      new_role_id: member.role_id,
      performed_by: actor,
      notes: 'Colaborador reactivado en el restaurante',
    });

    audit.logAction(
      'staff.reactivated',
      'staff',
      member_id,
      actor,
      `Colaborador ${member.display_name} reactivado exitosamente`,
      { restaurant_id, member_id }
    );

    db.save();
    return member;
  }

  public static getMemberHistory(
    member_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): MemberHistoryRecord[] {
    return db
      .get('member_history')
      .filter((h) => h.member_id === member_id && h.restaurant_id === restaurant_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  private static recordHistory(params: {
    member_id: string;
    restaurant_id: string;
    event_type: 'joined' | 'role_changed' | 'deactivated' | 'reactivated' | 'updated';
    previous_role_id?: string;
    new_role_id?: string;
    performed_by: string;
    notes?: string;
  }): void {
    const history = db.get('member_history');
    history.push({
      id: `mh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      member_id: params.member_id,
      restaurant_id: params.restaurant_id,
      event_type: params.event_type,
      previous_role_id: params.previous_role_id,
      new_role_id: params.new_role_id,
      performed_by: params.performed_by,
      notes: params.notes,
      created_at: new Date().toISOString(),
    });
  }

  // ==========================================
  // 2. ROLES Y PERMISOS (RBAC)
  // ==========================================

  public static listRoles(restaurant_id: string = DEFAULT_RESTAURANT_ID): Role[] {
    return db
      .get('roles')
      .filter((r) => r.is_active && (r.restaurant_id === restaurant_id || r.is_system));
  }

  public static getRole(
    role_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Role | undefined {
    return db
      .get('roles')
      .find((r) => r.id === role_id && (r.restaurant_id === restaurant_id || r.is_system));
  }

  public static createRole(
    data: CreateRoleDTO,
    actor: string = 'System Admin'
  ): Role {
    const restaurant_id = data.restaurant_id || DEFAULT_RESTAURANT_ID;
    const now = new Date().toISOString();

    // Validate permissions array
    const validPermissions = data.permissions.filter((p) => ALL_PERMISSIONS.includes(p));

    const roleId = `role_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRole: Role = {
      id: roleId,
      restaurant_id,
      name: data.name.trim(),
      description: data.description.trim(),
      permissions: validPermissions,
      is_system: false,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    db.get('roles').push(newRole);

    audit.logAction(
      'staff.role_created',
      'role',
      roleId,
      actor,
      `Nuevo rol personalizado creado: ${newRole.name} con ${validPermissions.length} permisos`,
      { restaurant_id, roleId, permissions_count: validPermissions.length }
    );

    db.save();
    return newRole;
  }

  public static updateRole(
    role_id: string,
    data: UpdateRoleDTO,
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Role {
    const role = db
      .get('roles')
      .find((r) => r.id === role_id && (r.restaurant_id === restaurant_id || r.is_system));
    if (!role) {
      throw new Error(`Rol con id ${role_id} no encontrado.`);
    }

    // Safety: owner role cannot have restaurant.manage removed
    if (role.id === 'role_owner' && data.permissions) {
      if (!data.permissions.includes('restaurant.manage') || !data.permissions.includes('staff.manage')) {
        throw new Error('El rol de Propietario no puede prescindir de permisos administrativos esenciales.');
      }
    }

    if (data.name !== undefined) role.name = data.name.trim();
    if (data.description !== undefined) role.description = data.description.trim();
    if (data.permissions !== undefined) {
      role.permissions = data.permissions.filter((p) => ALL_PERMISSIONS.includes(p));
    }

    role.updated_at = new Date().toISOString();

    audit.logAction(
      'staff.role_updated',
      'role',
      role_id,
      actor,
      `Rol ${role.name} actualizado por ${actor}`,
      { restaurant_id, role_id }
    );

    db.save();
    return role;
  }

  public static deleteRole(
    role_id: string,
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): boolean {
    const role = db
      .get('roles')
      .find((r) => r.id === role_id && (r.restaurant_id === restaurant_id || r.is_system));
    if (!role) {
      throw new Error(`Rol con id ${role_id} no encontrado.`);
    }

    if (role.is_system) {
      throw new Error(`No es posible eliminar el rol del sistema '${role.name}'. Está protegido.`);
    }

    // Check if any member currently has this role
    const assignedMembers = db
      .get('restaurant_members')
      .filter((m) => m.restaurant_id === restaurant_id && m.role_id === role_id && m.is_active);
    if (assignedMembers.length > 0) {
      throw new Error(
        `No es posible eliminar el rol '${role.name}' porque ${assignedMembers.length} colaborador(es) activo(s) lo tienen asignado.`
      );
    }

    role.is_active = false;
    role.updated_at = new Date().toISOString();

    audit.logAction(
      'staff.role_deleted',
      'role',
      role_id,
      actor,
      `Rol personalizado ${role.name} eliminado por ${actor}`,
      { restaurant_id, role_id }
    );

    db.save();
    return true;
  }

  public static listPermissions(): { permission: Permission; label: string; category: string; description: string }[] {
    const descriptions: Record<Permission, { label: string; category: string; description: string }> = {
      'restaurant.view': { label: 'Ver restaurante', category: 'General', description: 'Consultar configuración y datos del restaurante' },
      'restaurant.manage': { label: 'Administrar restaurante', category: 'General', description: 'Modificar configuración, sucursales y ajustes' },
      'orders.view': { label: 'Ver comandas', category: 'Comandas', description: 'Consultar tickets y comandas activas' },
      'orders.create': { label: 'Crear comandas', category: 'Comandas', description: 'Abrir nuevas comandas y agregar platillos' },
      'orders.update': { label: 'Modificar comandas', category: 'Comandas', description: 'Editar cantidades, notas y modificadores' },
      'orders.cancel': { label: 'Cancelar comandas', category: 'Comandas', description: 'Cancelar tickets o platillos con motivo' },
      'tables.view': { label: 'Ver mesas', category: 'Salón', description: 'Ver plano de mesas y estatus de ocupación' },
      'tables.manage': { label: 'Gestionar mesas', category: 'Salón', description: 'Abrir, transferir, juntar y cerrar mesas' },
      'cash.view': { label: 'Ver caja', category: 'Caja', description: 'Consultar saldo y movimientos de caja' },
      'cash.open': { label: 'Abrir turno de caja', category: 'Caja', description: 'Iniciar turno con fondo de caja' },
      'cash.close': { label: 'Cerrar turno de caja', category: 'Caja', description: 'Realizar corte y arqueo de caja' },
      'cash.adjust': { label: 'Ajustar caja', category: 'Caja', description: 'Registrar entradas, retiros y ajustes de efectivo' },
      'payments.view': { label: 'Ver pagos', category: 'Pagos y Finanzas', description: 'Consultar pagos y transacciones' },
      'payments.create': { label: 'Procesar pagos', category: 'Pagos y Finanzas', description: 'Cobrar cuentas y liquidar pagos en mesa' },
      'payments.refund': { label: 'Reembolsar pagos', category: 'Pagos y Finanzas', description: 'Efectuar reembolsos o reversiones de cobro' },
      'expenses.view': { label: 'Ver gastos', category: 'Pagos y Finanzas', description: 'Consultar gastos operativos y egresos' },
      'expenses.create': { label: 'Registrar gastos', category: 'Pagos y Finanzas', description: 'Dar de alta gastos operativos' },
      'expenses.edit': { label: 'Editar gastos', category: 'Pagos y Finanzas', description: 'Modificar o anular gastos asentados' },
      'financial.view': { label: 'Ver finanzas', category: 'Pagos y Finanzas', description: 'Consultar ledger financiero y balance operativo' },
      'reports.financial': { label: 'Reportes P&L', category: 'Reportes', description: 'Generar estado de resultados y P&L operativo' },
      'settlements.view': { label: 'Ver liquidaciones', category: 'Pagos y Finanzas', description: 'Consultar liquidaciones de repartidores y canales' },
      'settlements.manage': { label: 'Gestionar liquidaciones', category: 'Pagos y Finanzas', description: 'Procesar cortes y liquidaciones' },
      'inventory.view': { label: 'Ver inventario', category: 'Inventario', description: 'Consultar existencias y kárdex' },
      'inventory.adjust': { label: 'Ajustar inventario', category: 'Inventario', description: 'Registrar ajustes físicos y mermas' },
      'recipes.view': { label: 'Ver recetas', category: 'Recetas', description: 'Consultar fichas técnicas y escandallos' },
      'recipes.manage': { label: 'Administrar recetas', category: 'Recetas', description: 'Crear, versionar y modificar recetas y subrecetas' },
      'purchases.view': { label: 'Ver compras', category: 'Compras', description: 'Consultar catálogo de proveedores y órdenes de compra' },
      'purchases.create': { label: 'Crear compras', category: 'Compras', description: 'Generar nuevas órdenes de compra' },
      'purchases.receive': { label: 'Recibir mercancía', category: 'Compras', description: 'Ingresar mercancía y actualizar existencias' },
      'production.view': { label: 'Ver producción', category: 'Producción', description: 'Consultar órdenes de transformación y subrecetas' },
      'production.create': { label: 'Crear producción', category: 'Producción', description: 'Planear lote de transformación' },
      'production.complete': { label: 'Completar producción', category: 'Producción', description: 'Finalizar producción y dar entrada a producto' },
      'production.cancel': { label: 'Cancelar producción', category: 'Producción', description: 'Cancelar lote de producción' },
      'production.waste': { label: 'Registrar mermas', category: 'Producción', description: 'Asentar mermas durante transformación' },
      'staff.view': { label: 'Ver personal', category: 'Personal', description: 'Consultar lista de colaboradores y membresías' },
      'staff.manage': { label: 'Administrar personal', category: 'Personal', description: 'Agregar, editar, activar y desactivar colaboradores' },
      'roles.view': { label: 'Ver roles', category: 'Personal', description: 'Consultar catálogo de roles y permisos' },
      'roles.manage': { label: 'Administrar roles', category: 'Personal', description: 'Crear y editar roles personalizados' },
      'permissions.view': { label: 'Ver permisos', category: 'Personal', description: 'Consultar permisos del sistema' },
      'shifts.view': { label: 'Ver turnos', category: 'Turnos', description: 'Consultar bitácora de asistencia y turnos' },
      'shifts.manage': { label: 'Administrar turnos', category: 'Turnos', description: 'Programar, editar y cancelar turnos' },
      'shifts.start': { label: 'Iniciar turno', category: 'Turnos', description: 'Fichar entrada / inicio de turno operativo' },
      'shifts.end': { label: 'Finalizar turno', category: 'Turnos', description: 'Fichar salida / cierre de turno operativo' },
      'customers.view': { label: 'Ver clientes', category: 'Clientes y CRM', description: 'Consultar directorio de clientes y perfiles comerciales' },
      'customers.manage': { label: 'Gestionar clientes', category: 'Clientes y CRM', description: 'Crear, editar perfiles, domicilios y preferencias' },
      'loyalty.view': { label: 'Ver fidelidad', category: 'Clientes y CRM', description: 'Consultar saldo de puntos, transacciones y recompensas' },
      'loyalty.manage': { label: 'Gestionar programa loyalty', category: 'Clientes y CRM', description: 'Crear recompensas y reglas de fidelidad' },
      'loyalty.adjust': { label: 'Ajustar puntos', category: 'Clientes y CRM', description: 'Realizar ajustes manuales o compensatorios en puntos' },
      'promotions.view': { label: 'Ver promociones', category: 'Promociones', description: 'Consultar catálogo de promociones y cupones activos' },
      'promotions.manage': { label: 'Gestionar promociones', category: 'Promociones', description: 'Crear, editar, activar y desactivar promociones y cupones' },
      'reports.view': { label: 'Ver reportes', category: 'Reportes', description: 'Consultar reportes de ventas, costos y rendimiento' },
    };

    return ALL_PERMISSIONS.map((p) => ({
      permission: p,
      label: descriptions[p]?.label || p,
      category: descriptions[p]?.category || 'General',
      description: descriptions[p]?.description || p,
    }));
  }

  /**
   * Core RBAC Authorization Engine (Backend validation)
   */
  public static authorize(
    user_id: string,
    permissionOrRestaurantId: Permission | string,
    optionalPermission?: Permission
  ): AuthCheckResult {
    let restaurant_id = DEFAULT_RESTAURANT_ID;
    let requiredPermission: Permission;

    if (optionalPermission !== undefined) {
      restaurant_id = permissionOrRestaurantId;
      requiredPermission = optionalPermission;
    } else {
      requiredPermission = permissionOrRestaurantId as Permission;
    }

    // 1. Resolve User
    const user = db.get('users').find((u) => u.id === user_id);
    if (!user) {
      return { authorized: false, reason: 'Usuario no autenticado o inexistente en el sistema.' };
    }

    // Superadmin bypasses for platform operations
    if (user.is_superadmin) {
      return { authorized: true, user };
    }

    // 2. Resolve Restaurant Membership
    const member = db
      .get('restaurant_members')
      .find((m) => m.user_id === user_id && m.restaurant_id === restaurant_id);

    if (!member) {
      return {
        authorized: false,
        user,
        reason: 'El usuario no tiene una membresía asignada en este restaurante.',
      };
    }

    if (!member.is_active) {
      return {
        authorized: false,
        user,
        member,
        reason: 'La membresía del colaborador en este restaurante se encuentra desactivada.',
      };
    }

    // 3. Resolve Role
    const role = db
      .get('roles')
      .find((r) => r.id === member.role_id && (r.restaurant_id === restaurant_id || r.is_system));

    if (!role || !role.is_active) {
      return {
        authorized: false,
        user,
        member,
        reason: 'El rol asignado al colaborador no existe o está inactivo.',
      };
    }

    // 4. Verify Granular Permission
    const hasPerm = role.permissions.includes(requiredPermission);
    if (!hasPerm) {
      return {
        authorized: false,
        user,
        member,
        role,
        reason: `El rol '${role.name}' no cuenta con el permiso requerido '${requiredPermission}'.`,
      };
    }

    return {
      authorized: true,
      user,
      member,
      role,
    };
  }

  // ==========================================
  // 3. TURNOS OPERATIVOS (SHIFTS & ASISTENCIA)
  // ==========================================

  public static listShifts(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: { member_id?: string; status?: ShiftStatus; date?: string }
  ): (Shift & { member_name: string; role_name: string })[] {
    const shifts = db.get('shifts').filter((s) => s.restaurant_id === restaurant_id);
    const members = db.get('restaurant_members');
    const roles = db.get('roles');

    let result = shifts.map((s) => {
      const member = members.find((m) => m.id === s.member_id);
      const role = roles.find((r) => r.id === s.role_id);
      return {
        ...s,
        member_name: member ? member.display_name : s.member_id,
        role_name: role ? role.name : s.role_id,
      };
    });

    if (filters?.member_id) {
      result = result.filter((s) => s.member_id === filters.member_id);
    }

    if (filters?.status) {
      result = result.filter((s) => s.status === filters.status);
    }

    if (filters?.date) {
      result = result.filter(
        (s) =>
          (s.actual_start && s.actual_start.startsWith(filters.date!)) ||
          (s.scheduled_start && s.scheduled_start.startsWith(filters.date!))
      );
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public static getShift(
    shift_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): (Shift & { member_name: string; role_name: string }) | undefined {
    const shift = db
      .get('shifts')
      .find((s) => s.id === shift_id && s.restaurant_id === restaurant_id);
    if (!shift) return undefined;

    const member = db.get('restaurant_members').find((m) => m.id === shift.member_id);
    const role = db.get('roles').find((r) => r.id === shift.role_id);

    return {
      ...shift,
      member_name: member ? member.display_name : shift.member_id,
      role_name: role ? role.name : shift.role_id,
    };
  }

  public static getActiveShift(
    member_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Shift | undefined {
    return db
      .get('shifts')
      .find((s) => s.member_id === member_id && s.restaurant_id === restaurant_id && s.status === 'active');
  }

  public static createShift(
    data: CreateShiftDTO,
    actor: string = 'System Admin'
  ): Shift {
    const restaurant_id = data.restaurant_id || DEFAULT_RESTAURANT_ID;
    const member = db
      .get('restaurant_members')
      .find((m) => m.id === data.member_id && m.restaurant_id === restaurant_id);

    if (!member) {
      throw new Error(`Colaborador ${data.member_id} no encontrado en este restaurante.`);
    }

    if (!member.is_active) {
      throw new Error(`No se puede programar turno para un colaborador inactivo.`);
    }

    const now = new Date().toISOString();
    const shiftId = `shf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newShift: Shift = {
      id: shiftId,
      restaurant_id,
      member_id: member.id,
      user_id: member.user_id,
      role_id: data.role_id || member.role_id,
      scheduled_start: data.scheduled_start,
      scheduled_end: data.scheduled_end,
      status: 'scheduled',
      notes: data.notes,
      created_by: actor,
      created_at: now,
      updated_at: now,
    };

    db.get('shifts').push(newShift);

    audit.logAction(
      'shift.created',
      'shift',
      shiftId,
      actor,
      `Turno programado para ${member.display_name}`,
      { restaurant_id, member_id: member.id, shiftId }
    );

    eventBus.emit({
      event_name: 'shift.created',
      event_type: 'shift_event',
      aggregate_id: shiftId,
      actor_id: actor,
      data: { shift: newShift },
    });

    db.save();
    return newShift;
  }

  public static startShift(
    data: StartShiftDTO,
    actor: string = 'System Admin'
  ): Shift {
    const restaurant_id = data.restaurant_id || DEFAULT_RESTAURANT_ID;
    const member = db
      .get('restaurant_members')
      .find((m) => m.id === data.member_id && m.restaurant_id === restaurant_id);

    if (!member) {
      throw new Error(`Colaborador con id ${data.member_id} no encontrado.`);
    }

    if (!member.is_active) {
      throw new Error(`El colaborador ${member.display_name} está inactivo.`);
    }

    // Validation: Rule 14 - No multiple active shifts for the same employee
    const existingActive = this.getActiveShift(member.id, restaurant_id);
    if (existingActive) {
      throw new Error(
        `El colaborador ${member.display_name} ya tiene un turno activo en curso (Turno #${existingActive.id}).`
      );
    }

    const now = new Date().toISOString();
    const shiftId = `shf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const shift: Shift = {
      id: shiftId,
      restaurant_id,
      member_id: member.id,
      user_id: member.user_id,
      role_id: member.role_id,
      actual_start: now,
      status: 'active',
      cash_shift_id: data.cash_shift_id,
      notes: data.notes,
      created_by: actor,
      created_at: now,
      updated_at: now,
    };

    db.get('shifts').push(shift);

    audit.logAction(
      'shift.started',
      'shift',
      shiftId,
      actor,
      `Inicio de turno registrado para ${member.display_name}`,
      { restaurant_id, member_id: member.id, shiftId, cash_shift_id: data.cash_shift_id }
    );

    eventBus.emit({
      event_name: 'shift.started',
      event_type: 'shift_event',
      aggregate_id: shiftId,
      actor_id: actor,
      data: { shift },
    });

    db.save();
    return shift;
  }

  public static endShift(
    shift_id: string,
    notes?: string,
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Shift {
    const shift = db
      .get('shifts')
      .find((s) => s.id === shift_id && s.restaurant_id === restaurant_id);

    if (!shift) {
      throw new Error(`Turno con id ${shift_id} no encontrado.`);
    }

    if (shift.status === 'completed') {
      return shift; // Idempotent return
    }

    if (shift.status === 'cancelled') {
      throw new Error(`El turno ${shift_id} ya fue cancelado y no puede finalizarse.`);
    }

    const now = new Date().toISOString();
    shift.status = 'completed';
    shift.actual_end = now;
    if (notes) {
      shift.notes = shift.notes ? `${shift.notes} | ${notes}` : notes;
    }
    shift.updated_at = now;

    audit.logAction(
      'shift.completed',
      'shift',
      shift_id,
      actor,
      `Turno finalizado para colaborador ${shift.member_id}`,
      { restaurant_id, shift_id, actual_end: now }
    );

    eventBus.emit({
      event_name: 'shift.completed',
      event_type: 'shift_event',
      aggregate_id: shift_id,
      actor_id: actor,
      data: { shift },
    });

    db.save();
    return shift;
  }

  public static cancelShift(
    shift_id: string,
    reason: string = 'Cancelación manual',
    actor: string = 'System Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Shift {
    const shift = db
      .get('shifts')
      .find((s) => s.id === shift_id && s.restaurant_id === restaurant_id);

    if (!shift) {
      throw new Error(`Turno con id ${shift_id} no encontrado.`);
    }

    if (shift.status === 'completed') {
      throw new Error(`No es posible cancelar un turno que ya fue completado exitosamente.`);
    }

    const now = new Date().toISOString();
    shift.status = 'cancelled';
    shift.notes = shift.notes ? `${shift.notes} | Cancelado: ${reason}` : `Cancelado: ${reason}`;
    shift.updated_at = now;

    audit.logAction(
      'shift.cancelled',
      'shift',
      shift_id,
      actor,
      `Turno ${shift_id} cancelado por ${actor}. Motivo: ${reason}`,
      { restaurant_id, shift_id, reason }
    );

    eventBus.emit({
      event_name: 'shift.cancelled',
      event_type: 'shift_event',
      aggregate_id: shift_id,
      actor_id: actor,
      data: { shift_id, reason },
    });

    db.save();
    return shift;
  }

  // ==========================================
  // 4. CONTEXTO OPERATIVO (CurrentRestaurantContext)
  // ==========================================

  public static getRestaurantContext(
    user_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): CurrentRestaurantContext {
    const user = db.get('users').find((u) => u.id === user_id);
    if (!user) {
      throw new Error(`Usuario con id ${user_id} no encontrado.`);
    }

    const member = db
      .get('restaurant_members')
      .find((m) => m.user_id === user_id && m.restaurant_id === restaurant_id);

    if (!member) {
      throw new Error(`El usuario ${user.name} no pertenece al restaurante ${restaurant_id}.`);
    }

    const role = db
      .get('roles')
      .find((r) => r.id === member.role_id && (r.restaurant_id === restaurant_id || r.is_system));

    const permissions: Permission[] = role && role.is_active ? role.permissions : [];
    const activeShift = this.getActiveShift(member.id, restaurant_id);

    return {
      restaurant_id,
      user_id: user.id,
      member_id: member.id,
      display_name: member.display_name,
      role_id: member.role_id,
      role_name: role ? role.name : member.role_id,
      is_active: member.is_active,
      permissions,
      active_shift_id: activeShift?.id,
      hasPermission: (perm: Permission) => permissions.includes(perm),
    };
  }

  // ==========================================
  // 5. RESUMEN OPERACIONAL / MÉTRICAS (Section 28)
  // ==========================================

  public static getStaffSummary(restaurant_id: string = DEFAULT_RESTAURANT_ID): StaffSummary {
    const members = db.get('restaurant_members').filter((m) => m.restaurant_id === restaurant_id);
    const shifts = db.get('shifts').filter((s) => s.restaurant_id === restaurant_id);
    const roles = db.get('roles').filter((r) => r.is_active && (r.restaurant_id === restaurant_id || r.is_system));

    const todayDatePrefix = new Date().toISOString().split('T')[0];

    const activeMembers = members.filter((m) => m.is_active).length;
    const inactiveMembers = members.filter((m) => !m.is_active).length;
    const activeShiftsNow = shifts.filter((s) => s.status === 'active').length;
    const shiftsCompletedToday = shifts.filter(
      (s) => s.status === 'completed' && s.actual_end && s.actual_end.startsWith(todayDatePrefix)
    ).length;

    return {
      total_members: members.length,
      active_members: activeMembers,
      inactive_members: inactiveMembers,
      active_shifts_now: activeShiftsNow,
      shifts_completed_today: shiftsCompletedToday,
      total_roles: roles.length,
    };
  }
}
