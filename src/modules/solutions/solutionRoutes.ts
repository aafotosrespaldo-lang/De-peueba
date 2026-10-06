/**
 * DIRECTAURANTE POS CORE v0.1 - Native Solutions & Entitlements API Routes (F13)
 * Exposes endpoints for Solution Registry, Commercial Plans, and Entitlements.
 */

import { Router, Request, Response } from 'express';
import { SolutionService } from './solutionService';
import { DEFAULT_RESTAURANT_ID } from '../../core/database';

export const solutionRouter = Router();

// ==========================================
// 1. SOLUTION REGISTRY ENDPOINTS
// ==========================================

solutionRouter.get('/', (req: Request, res: Response) => {
  const { status, category, commercial_availability } = req.query;
  const solutions = SolutionService.listSolutions({
    status: status as any,
    category: category as string,
    commercial_availability: commercial_availability as any,
  });
  res.json({ success: true, solutions });
});

solutionRouter.get('/capabilities', (req: Request, res: Response) => {
  const { solution_id } = req.query;
  const capabilities = SolutionService.listCapabilities(solution_id as string);
  res.json({ success: true, capabilities });
});

solutionRouter.get('/:solution_id', (req: Request, res: Response) => {
  const { solution_id } = req.params;
  const solution = SolutionService.getSolution(solution_id);
  if (!solution) {
    return res.status(404).json({ success: false, error: `Solución '${solution_id}' no encontrada.` });
  }
  res.json({ success: true, solution });
});

solutionRouter.post('/', (req: Request, res: Response) => {
  try {
    const actor = req.body.actor || 'Master Admin';
    const solution = SolutionService.registerSolution(req.body, actor);
    res.status(201).json({ success: true, solution });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

solutionRouter.patch('/:solution_id', (req: Request, res: Response) => {
  try {
    const { solution_id } = req.params;
    const actor = req.body.actor || 'Master Admin';
    const solution = SolutionService.updateSolution(solution_id, req.body, actor);
    res.json({ success: true, solution });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. COMMERCIAL PLANS ENDPOINTS
// ==========================================

solutionRouter.get('/plans/all', (req: Request, res: Response) => {
  const onlyActive = req.query.active === 'true';
  const plans = SolutionService.listPlans(onlyActive);
  res.json({ success: true, plans });
});

solutionRouter.get('/plans/:plan_id', (req: Request, res: Response) => {
  const { plan_id } = req.params;
  const plan = SolutionService.getPlan(plan_id);
  if (!plan) {
    return res.status(404).json({ success: false, error: `Plan '${plan_id}' no encontrado.` });
  }
  res.json({ success: true, plan });
});

solutionRouter.post('/plans', (req: Request, res: Response) => {
  try {
    const actor = req.body.actor || 'Master Admin';
    const plan = SolutionService.createPlan(req.body, actor);
    res.status(201).json({ success: true, plan });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. RESTAURANT ENTITLEMENTS & ACCESS CHECK
// ==========================================

solutionRouter.get('/restaurants/:restaurant_id/entitlements', (req: Request, res: Response) => {
  const { restaurant_id } = req.params;
  const onlyActive = req.query.active !== 'false';
  const entitlements = SolutionService.getRestaurantEntitlements(restaurant_id, onlyActive);
  res.json({ success: true, entitlements });
});

solutionRouter.post('/restaurants/:restaurant_id/plans/:plan_id/assign', (req: Request, res: Response) => {
  try {
    const { restaurant_id, plan_id } = req.params;
    const { source, actor } = req.body;
    const entitlements = SolutionService.assignPlanToRestaurant(restaurant_id, plan_id, source || 'plan', actor);
    res.json({ success: true, entitlements });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

solutionRouter.post('/restaurants/:restaurant_id/entitlements', (req: Request, res: Response) => {
  try {
    const { restaurant_id } = req.params;
    const entitlement = SolutionService.grantEntitlement({
      ...req.body,
      restaurant_id,
    });
    res.status(201).json({ success: true, entitlement });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

solutionRouter.delete('/restaurants/:restaurant_id/entitlements/:id', (req: Request, res: Response) => {
  const { restaurant_id, id } = req.params;
  const actor = (req.query.actor as string) || 'Master Admin';
  const success = SolutionService.revokeEntitlement(id, restaurant_id, actor);
  if (!success) {
    return res.status(404).json({ success: false, error: `Entitlement '${id}' no encontrado.` });
  }
  res.json({ success: true, message: 'Entitlement revocado exitosamente.' });
});

solutionRouter.patch('/restaurants/:restaurant_id/entitlements/:id/suspend', (req: Request, res: Response) => {
  try {
    const { restaurant_id, id } = req.params;
    const actor = req.body.actor || 'Master Admin';
    const entitlement = SolutionService.suspendEntitlement(id, restaurant_id, actor);
    res.json({ success: true, entitlement });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

solutionRouter.patch('/restaurants/:restaurant_id/entitlements/:id/activate', (req: Request, res: Response) => {
  try {
    const { restaurant_id, id } = req.params;
    const actor = req.body.actor || 'Master Admin';
    const entitlement = SolutionService.activateEntitlement(id, restaurant_id, actor);
    res.json({ success: true, entitlement });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

solutionRouter.get('/restaurants/:restaurant_id/check', (req: Request, res: Response) => {
  const { restaurant_id } = req.params;
  const { solution_id, capability } = req.query;

  if (capability) {
    const check = SolutionService.checkCapability(restaurant_id, capability as string);
    return res.json({ success: true, check });
  }

  if (solution_id) {
    const enabled = SolutionService.isSolutionEnabled(restaurant_id, solution_id as string);
    return res.json({
      success: true,
      check: {
        has_access: enabled,
        solution_id,
        reason: enabled ? undefined : `Solución '${solution_id}' no habilitada en este restaurante.`,
      },
    });
  }

  res.status(400).json({ success: false, error: 'Debe especificar solution_id o capability para verificar.' });
});

// Dual authorization check: Entitlement + Permission
solutionRouter.post('/authorize', (req: Request, res: Response) => {
  const { user_id, restaurant_id, permission, capability } = req.body;
  const targetRestId = restaurant_id || DEFAULT_RESTAURANT_ID;

  const result = SolutionService.authorizeAction(user_id, targetRestId, permission, capability);
  if (!result.authorized) {
    return res.status(result.status_code).json({ success: false, ...result });
  }

  res.json({ success: true, ...result });
});
