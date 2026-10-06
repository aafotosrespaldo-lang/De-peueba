/**
 * DIRECTAURANTE POS CORE v0.1 - Staff, Roles & Shifts Express Routes (FASE 10)
 */

import { Router, Request, Response } from 'express';
import { StaffService } from './staffService';
import { DEFAULT_RESTAURANT_ID } from '../../core/database';
import { Permission } from '../../core/types';

export const staffRouter = Router();

// ==========================================
// 1. STAFF MEMBERS
// ==========================================

// GET /api/staff - List members
staffRouter.get('/', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;
    const roleId = req.query.role_id as string;
    const search = req.query.search as string;

    const members = StaffService.listMembers(restaurantId, { is_active: isActive, role_id: roleId, search });
    res.json({ success: true, members });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/staff/:id - Get single member
staffRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const member = StaffService.getMember(req.params.id, restaurantId);
    if (!member) {
      return res.status(404).json({ success: false, error: 'Colaborador no encontrado.' });
    }
    res.json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/staff - Register / add member
staffRouter.post('/', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const member = StaffService.createMember(req.body, actor);
    res.status(201).json({ success: true, member });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/staff/:id - Update member
staffRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const member = StaffService.updateMember(req.params.id, req.body, actor, restaurantId);
    res.json({ success: true, member });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/staff/:id/deactivate - Deactivate member (soft delete, retains all history)
staffRouter.post('/:id/deactivate', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const reason = req.body.reason || 'Baja operativa';
    const member = StaffService.deactivateMember(req.params.id, reason, actor, restaurantId);
    res.json({ success: true, member });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/staff/:id/activate - Reactivate member
staffRouter.post('/:id/activate', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const member = StaffService.activateMember(req.params.id, actor, restaurantId);
    res.json({ success: true, member });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/staff/:id/history - Audit history of member
staffRouter.get('/:id/history', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const history = StaffService.getMemberHistory(req.params.id, restaurantId);
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. ROLES & PERMISSIONS
// ==========================================

// GET /api/staff/roles/all - List roles
staffRouter.get('/roles/all', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const roles = StaffService.listRoles(restaurantId);
    res.json({ success: true, roles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/staff/roles/:id - Get role
staffRouter.get('/roles/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const role = StaffService.getRole(req.params.id, restaurantId);
    if (!role) {
      return res.status(404).json({ success: false, error: 'Rol no encontrado.' });
    }
    res.json({ success: true, role });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/staff/roles - Create custom role
staffRouter.post('/roles', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const role = StaffService.createRole(req.body, actor);
    res.status(201).json({ success: true, role });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/staff/roles/:id - Update role
staffRouter.put('/roles/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const role = StaffService.updateRole(req.params.id, req.body, actor, restaurantId);
    res.json({ success: true, role });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/staff/roles/:id - Delete custom role (with protection)
staffRouter.delete('/roles/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    StaffService.deleteRole(req.params.id, actor, restaurantId);
    res.json({ success: true, message: 'Rol eliminado con éxito.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/staff/permissions/all - List system permissions
staffRouter.get('/permissions/all', (_req: Request, res: Response) => {
  try {
    const permissions = StaffService.listPermissions();
    res.json({ success: true, permissions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/staff/authorize - RBAC authorization check
staffRouter.post('/authorize', (req: Request, res: Response) => {
  try {
    const { user_id, restaurant_id, permission } = req.body;
    if (!user_id || !permission) {
      return res.status(400).json({ success: false, error: 'user_id y permission son obligatorios.' });
    }
    const result = StaffService.authorize(user_id, restaurant_id || DEFAULT_RESTAURANT_ID, permission as Permission);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. SHIFTS (TURNOS OPERATIVOS)
// ==========================================

// GET /api/staff/shifts/all - List shifts
staffRouter.get('/shifts/all', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const memberId = req.query.member_id as string;
    const status = req.query.status as any;
    const date = req.query.date as string;

    const shifts = StaffService.listShifts(restaurantId, { member_id: memberId, status, date });
    res.json({ success: true, shifts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/staff/shifts/:id - Get single shift
staffRouter.get('/shifts/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const shift = StaffService.getShift(req.params.id, restaurantId);
    if (!shift) {
      return res.status(404).json({ success: false, error: 'Turno no encontrado.' });
    }
    res.json({ success: true, shift });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/staff/shifts/schedule - Schedule shift
staffRouter.post('/shifts/schedule', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const shift = StaffService.createShift(req.body, actor);
    res.status(201).json({ success: true, shift });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/staff/shifts/start - Start shift
staffRouter.post('/shifts/start', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const shift = StaffService.startShift(req.body, actor);
    res.status(201).json({ success: true, shift });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/staff/shifts/:id/end - End shift
staffRouter.post('/shifts/:id/end', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const notes = req.body.notes;
    const shift = StaffService.endShift(req.params.id, notes, actor, restaurantId);
    res.json({ success: true, shift });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/staff/shifts/:id/cancel - Cancel shift
staffRouter.post('/shifts/:id/cancel', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const actor = (req.headers['x-actor-name'] as string) || (req.body.actor as string) || 'System Admin';
    const reason = req.body.reason || 'Cancelación de turno';
    const shift = StaffService.cancelShift(req.params.id, reason, actor, restaurantId);
    res.json({ success: true, shift });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/staff/shifts/active/:member_id - Get active shift for member
staffRouter.get('/shifts/active/:member_id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const shift = StaffService.getActiveShift(req.params.member_id, restaurantId);
    res.json({ success: true, active_shift: shift || null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. OPERATIONAL CONTEXT & SUMMARY
// ==========================================

// GET /api/staff/context/:user_id - Get current restaurant context
staffRouter.get('/context/:user_id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const context = StaffService.getRestaurantContext(req.params.user_id, restaurantId);
    res.json({ success: true, context });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/staff/summary - Summary metrics for dashboard
staffRouter.get('/summary/metrics', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const summary = StaffService.getStaffSummary(restaurantId);
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
