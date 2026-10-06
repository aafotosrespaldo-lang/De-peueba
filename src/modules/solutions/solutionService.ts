/**
 * DIRECTAURANTE POS CORE v0.1 - Native Solutions & Entitlements Registry (F13)
 * Core architectural service managing:
 * 1. Solution Registry: Central stable catalog of native Core solutions & capabilities.
 * 2. Commercial Plans: Plan definitions granting solution & capability bundles.
 * 3. Entitlements Engine: Restaurant-level license rights (Solution & Capability access).
 * 4. Dual Authorization: Enforces (Entitlement valid && Permission valid) at backend level.
 * 5. Backward Compatibility: Default entitlements guarantee legacy Delivery & POS operability.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  Solution,
  Capability,
  CommercialPlan,
  Entitlement,
  EntitlementCheckResult,
  ActionAuthorizationResult,
  SolutionStatus,
  CommercialAvailability,
  EntitlementSource,
  Permission,
} from '../../core/types';
import { StaffService } from '../staff/staffService';
import { AuditService } from '../../core/audit';
import { eventBus } from '../../core/eventBus';

export interface RegisterSolutionDTO {
  solution_id: string;
  name: string;
  description: string;
  version?: string;
  status?: SolutionStatus;
  category?: Solution['category'];
  dependencies?: string[];
  capabilities: Capability[];
  required_permissions?: Permission[];
  commercial_availability?: CommercialAvailability;
  icon?: string;
  metadata?: Record<string, any>;
}

export interface CreatePlanDTO {
  name: string;
  code: string;
  description: string;
  tier: CommercialPlan['tier'];
  solutions: string[];
  included_capabilities?: string[];
  is_active?: boolean;
  price_cents_monthly?: number;
  currency?: string;
}

export interface GrantEntitlementDTO {
  restaurant_id?: string;
  solution_id: string;
  capability?: string;
  source?: EntitlementSource;
  plan_id?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
  metadata?: Record<string, any>;
  actor?: string;
}

export class SolutionService {
  // ==========================================
  // 1. SOLUTION REGISTRY
  // ==========================================

  public static listSolutions(filters?: {
    status?: SolutionStatus;
    category?: string;
    commercial_availability?: CommercialAvailability;
  }): Solution[] {
    let solutions = db.get('solutions');
    if (filters?.status) {
      solutions = solutions.filter((s) => s.status === filters.status);
    }
    if (filters?.category) {
      solutions = solutions.filter((s) => s.category === filters.category);
    }
    if (filters?.commercial_availability) {
      solutions = solutions.filter((s) => s.commercial_availability === filters.commercial_availability);
    }
    return solutions;
  }

  public static getSolution(solution_id: string): Solution | undefined {
    return db.get('solutions').find((s) => s.solution_id === solution_id);
  }

  public static registerSolution(dto: RegisterSolutionDTO, actor: string = 'Master System'): Solution {
    if (!dto.solution_id || dto.solution_id.trim() === '') {
      throw new Error('El ID de la solución (solution_id) es obligatorio y debe ser estable.');
    }
    const cleanId = dto.solution_id.trim().toLowerCase();
    const existing = db.get('solutions').find((s) => s.solution_id === cleanId);
    if (existing) {
      throw new Error(`La solución con ID '${cleanId}' ya se encuentra registrada en el Core.`);
    }

    const solution: Solution = {
      solution_id: cleanId,
      name: dto.name,
      description: dto.description,
      version: dto.version || '1.0.0',
      status: dto.status || 'active',
      category: dto.category || 'operations',
      dependencies: dto.dependencies || [],
      capabilities: dto.capabilities || [],
      required_permissions: dto.required_permissions || [],
      commercial_availability: dto.commercial_availability || 'available',
      icon: dto.icon,
      metadata: dto.metadata,
    };

    db.get('solutions').push(solution);
    db.save();

    AuditService.log(
      'solution_registered',
      'solution',
      solution.solution_id,
      actor,
      null,
      solution,
      `Solución nativa '${solution.name}' registrada en Solution Registry.`
    );

    eventBus.publish('SOLUTION_REGISTERED', DEFAULT_RESTAURANT_ID, actor, solution);
    return solution;
  }

  public static updateSolution(
    solution_id: string,
    updates: Partial<Omit<Solution, 'solution_id'>>,
    actor: string = 'Master System'
  ): Solution {
    const solution = this.getSolution(solution_id);
    if (!solution) {
      throw new Error(`Solución '${solution_id}' no encontrada en el registro central.`);
    }

    const prevState = { ...solution };
    Object.assign(solution, updates);
    db.save();

    AuditService.log(
      'solution_updated',
      'solution',
      solution.solution_id,
      actor,
      prevState,
      solution,
      `Solución '${solution.name}' actualizada.`
    );

    return solution;
  }

  public static listCapabilities(solution_id?: string): Capability[] {
    const solutions = db.get('solutions');
    if (solution_id) {
      const sol = solutions.find((s) => s.solution_id === solution_id);
      return sol ? sol.capabilities : [];
    }
    return solutions.flatMap((s) => s.capabilities);
  }

  public static getCapability(capability_id: string): Capability | undefined {
    return this.listCapabilities().find((c) => c.id === capability_id);
  }

  // ==========================================
  // 2. COMMERCIAL PLANS
  // ==========================================

  public static listPlans(only_active: boolean = false): CommercialPlan[] {
    const plans = db.get('commercial_plans');
    if (only_active) {
      return plans.filter((p) => p.is_active);
    }
    return plans;
  }

  public static getPlan(plan_id_or_code: string): CommercialPlan | undefined {
    const clean = plan_id_or_code.trim().toLowerCase();
    return db
      .get('commercial_plans')
      .find((p) => p.id.toLowerCase() === clean || p.code.toLowerCase() === clean);
  }

  public static createPlan(dto: CreatePlanDTO, actor: string = 'Master Admin'): CommercialPlan {
    const cleanCode = dto.code.trim().toUpperCase();
    const existing = db.get('commercial_plans').find((p) => p.code.toUpperCase() === cleanCode);
    if (existing) {
      throw new Error(`Ya existe un plan comercial con el código '${cleanCode}'.`);
    }

    const now = new Date().toISOString();
    const plan: CommercialPlan = {
      id: `plan_${cleanCode.toLowerCase()}_${Date.now().toString(36)}`,
      name: dto.name,
      code: cleanCode,
      description: dto.description,
      tier: dto.tier,
      solutions: dto.solutions,
      included_capabilities: dto.included_capabilities || ['*'],
      is_active: dto.is_active !== undefined ? dto.is_active : true,
      price_cents_monthly: dto.price_cents_monthly,
      currency: dto.currency || 'MXN',
      created_at: now,
    };

    db.get('commercial_plans').push(plan);
    db.save();

    AuditService.log(
      'commercial_plan_created',
      'commercial_plan',
      plan.id,
      actor,
      null,
      plan,
      `Plan comercial '${plan.name}' (${plan.code}) creado exitosamente.`
    );

    return plan;
  }

  // ==========================================
  // 3. ENTITLEMENTS (DERECHOS DE CONTRATACIÓN)
  // ==========================================

  public static getRestaurantEntitlements(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    only_active: boolean = false
  ): Entitlement[] {
    let entitlements = db.get('entitlements').filter((e) => e.restaurant_id === restaurant_id);
    if (only_active) {
      const now = new Date().toISOString();
      entitlements = entitlements.filter(
        (e) => e.status === 'active' && (!e.end_date || e.end_date >= now)
      );
    }
    return entitlements;
  }

  public static grantEntitlement(dto: GrantEntitlementDTO): Entitlement {
    const restaurant_id = dto.restaurant_id || DEFAULT_RESTAURANT_ID;
    const solution = this.getSolution(dto.solution_id);
    if (!solution) {
      throw new Error(`No se puede otorgar entitlement: Solución '${dto.solution_id}' no existe en el Core.`);
    }

    // Verify capability if specific one provided
    if (dto.capability && dto.capability !== '*') {
      const capExists = solution.capabilities.some((c) => c.id === dto.capability);
      if (!capExists) {
        throw new Error(
          `La capability '${dto.capability}' no pertenece a la solución '${solution.name}'.`
        );
      }
    }

    const now = new Date().toISOString();
    const existing = db.get('entitlements').find(
      (e) =>
        e.restaurant_id === restaurant_id &&
        e.solution_id === dto.solution_id &&
        (e.capability === dto.capability || (!e.capability && !dto.capability))
    );

    if (existing) {
      existing.status = 'active';
      existing.source = dto.source || existing.source;
      existing.plan_id = dto.plan_id || existing.plan_id;
      existing.start_date = dto.start_date || existing.start_date;
      existing.end_date = dto.end_date !== undefined ? dto.end_date : existing.end_date;
      existing.updated_at = now;
      if (dto.notes) existing.notes = dto.notes;
      db.save();
      return existing;
    }

    const entitlement: Entitlement = {
      id: `ent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id,
      solution_id: dto.solution_id,
      capability: dto.capability || '*',
      status: 'active',
      source: dto.source || 'manual',
      plan_id: dto.plan_id,
      start_date: dto.start_date || now,
      end_date: dto.end_date,
      notes: dto.notes,
      metadata: dto.metadata,
      created_at: now,
      updated_at: now,
    };

    db.get('entitlements').push(entitlement);
    db.save();

    AuditService.log(
      'entitlement_granted',
      'entitlement',
      entitlement.id,
      dto.actor || 'System',
      null,
      entitlement,
      `Entitlement otorgado a restaurante '${restaurant_id}' para '${dto.solution_id}' (${entitlement.capability}).`,
      restaurant_id
    );

    eventBus.publish('ENTITLEMENT_GRANTED', restaurant_id, dto.actor || 'System', entitlement);
    return entitlement;
  }

  public static revokeEntitlement(
    entitlement_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Master System'
  ): boolean {
    const entitlements = db.get('entitlements');
    const index = entitlements.findIndex(
      (e) => e.id === entitlement_id && (restaurant_id ? e.restaurant_id === restaurant_id : true)
    );
    if (index === -1) return false;

    const [removed] = entitlements.splice(index, 1);
    db.save();

    AuditService.log(
      'entitlement_revoked',
      'entitlement',
      removed.id,
      actor,
      removed,
      null,
      `Entitlement '${removed.solution_id}' revocado para restaurante '${removed.restaurant_id}'.`,
      removed.restaurant_id
    );

    eventBus.publish('ENTITLEMENT_REVOKED', removed.restaurant_id, actor, removed);
    return true;
  }

  public static suspendEntitlement(
    entitlement_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Master System'
  ): Entitlement {
    const entitlement = db
      .get('entitlements')
      .find((e) => e.id === entitlement_id && (restaurant_id ? e.restaurant_id === restaurant_id : true));
    if (!entitlement) {
      throw new Error(`Entitlement '${entitlement_id}' no encontrado.`);
    }

    entitlement.status = 'suspended';
    entitlement.updated_at = new Date().toISOString();
    db.save();

    AuditService.log(
      'entitlement_suspended',
      'entitlement',
      entitlement.id,
      actor,
      null,
      entitlement,
      `Entitlement suspendido para restaurante '${entitlement.restaurant_id}'.`,
      entitlement.restaurant_id
    );

    return entitlement;
  }

  public static activateEntitlement(
    entitlement_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    actor: string = 'Master System'
  ): Entitlement {
    const entitlement = db
      .get('entitlements')
      .find((e) => e.id === entitlement_id && (restaurant_id ? e.restaurant_id === restaurant_id : true));
    if (!entitlement) {
      throw new Error(`Entitlement '${entitlement_id}' no encontrado.`);
    }

    entitlement.status = 'active';
    entitlement.updated_at = new Date().toISOString();
    db.save();

    return entitlement;
  }

  public static assignPlanToRestaurant(
    restaurant_id: string,
    plan_id: string,
    source: EntitlementSource = 'plan',
    actor: string = 'Master Admin'
  ): Entitlement[] {
    const plan = this.getPlan(plan_id);
    if (!plan) {
      throw new Error(`Plan comercial '${plan_id}' no encontrado.`);
    }

    const granted: Entitlement[] = [];
    const now = new Date().toISOString();

    for (const solId of plan.solutions) {
      const ent = this.grantEntitlement({
        restaurant_id,
        solution_id: solId,
        capability: '*',
        source,
        plan_id: plan.id,
        start_date: now,
        notes: `Asignado por contratación de ${plan.name} (${plan.code})`,
        actor,
      });
      granted.push(ent);
    }

    return granted;
  }

  // ==========================================
  // 4. CORE VERIFICATION & DUAL AUTHORIZATION
  // ==========================================

  public static isSolutionEnabled(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    solution_id: string
  ): boolean {
    const activeEntitlements = this.getRestaurantEntitlements(restaurant_id, true);
    return activeEntitlements.some((e) => e.solution_id === solution_id);
  }

  public static hasCapability(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    capability: string
  ): boolean {
    const result = this.checkCapability(restaurant_id, capability);
    return result.has_access;
  }

  public static checkCapability(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    capability: string
  ): EntitlementCheckResult {
    // 1. Identify which solution owns this capability
    const allCaps = this.listCapabilities();
    const capDef = allCaps.find((c) => c.id === capability);
    if (!capDef) {
      return {
        has_access: false,
        reason: `La capacidad '${capability}' no existe en el catálogo de soluciones del Core.`,
        capability,
      };
    }

    const solution = this.getSolution(capDef.solution_id);
    if (!solution || solution.status !== 'active') {
      return {
        has_access: false,
        reason: `La solución '${solution?.name || capDef.solution_id}' está inactiva o en mantenimiento.`,
        solution_id: capDef.solution_id,
        capability,
      };
    }

    // 2. Check if restaurant has an active entitlement for this solution or exact capability
    const activeEntitlements = this.getRestaurantEntitlements(restaurant_id, true);
    const matchingEntitlement = activeEntitlements.find(
      (e) =>
        e.solution_id === capDef.solution_id &&
        (e.capability === '*' || !e.capability || e.capability === capability)
    );

    if (!matchingEntitlement) {
      return {
        has_access: false,
        reason: `El restaurante '${restaurant_id}' no tiene contratada la solución '${solution.name}' ni la capacidad '${capability}'.`,
        solution_id: capDef.solution_id,
        capability,
      };
    }

    return {
      has_access: true,
      solution_id: capDef.solution_id,
      capability,
      entitlement: matchingEntitlement,
    };
  }

  /**
   * DUAL AUTHORIZATION ENGINE:
   * Orthogonal check:
   * 1. Entitlement check (Restaurant level: Is the capability contracted/enabled?)
   * 2. Permission check (User level: Does this specific user have the role/permission to execute it?)
   */
  public static authorizeAction(
    user_id: string | undefined,
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    permission?: Permission,
    capability?: string
  ): ActionAuthorizationResult {
    let entitlement_granted = true;
    let entitlement_reason: string | undefined;

    if (capability) {
      const entCheck = this.checkCapability(restaurant_id, capability);
      entitlement_granted = entCheck.has_access;
      entitlement_reason = entCheck.reason;
    }

    let permission_granted = true;
    let permission_reason: string | undefined;

    if (permission && user_id) {
      const auth = StaffService.authorize(user_id, restaurant_id, permission);
      permission_granted = auth.authorized;
      permission_reason = auth.reason;
    }

    if (!entitlement_granted) {
      return {
        authorized: false,
        entitlement_granted: false,
        permission_granted,
        status_code: 403,
        reason: entitlement_reason || `Capacidad '${capability}' no contratada por el restaurante.`,
      };
    }

    if (!permission_granted) {
      return {
        authorized: false,
        entitlement_granted: true,
        permission_granted: false,
        status_code: 403,
        reason: permission_reason || `Usuario no cuenta con el permiso '${permission}' requerido.`,
      };
    }

    return {
      authorized: true,
      entitlement_granted: true,
      permission_granted: true,
      status_code: 200,
      reason: 'Acceso autorizado exitosamente por Entitlement y Permiso.',
    };
  }
}
