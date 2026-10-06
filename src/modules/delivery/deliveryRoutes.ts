/**
 * DIRECTAURANTE POS CORE v0.1 - Delivery & Dispatch Express Routes (FASE 14.1)
 * 
 * Directaurante Core is the sole owner of delivery operations:
 * Drivers, DriverProfile, GPS, dispatch lifecycle, eligibility, settlements and events.
 * Connectable consumers (such as DirectPost) interact strictly through these Core contracts.
 */

import { Router, Request, Response } from 'express';
import { DeliveryService } from './deliveryService';
import { DEFAULT_RESTAURANT_ID } from '../../core/database';

export const deliveryRouter = Router();

// ==========================================
// 1. DRIVERS DIRECTORY & VERIFICATION
// ==========================================

// GET /api/delivery/drivers
deliveryRouter.get('/drivers', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const isVerified = req.query.is_verified !== undefined ? req.query.is_verified === 'true' : undefined;
    const status = req.query.status as any;
    const drivers = DeliveryService.listDrivers(restaurantId, { is_verified: isVerified, status });
    res.json({ success: true, drivers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/delivery/drivers/:id
deliveryRouter.get('/drivers/:id', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const driver = DeliveryService.getDriver(req.params.id, restaurantId);
    if (!driver) {
      return res.status(404).json({ error: 'Repartidor no encontrado.' });
    }
    res.json({ success: true, driver });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery/drivers
deliveryRouter.post('/drivers', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || 'Admin';
    const driver = DeliveryService.createDriver(req.body, actor);
    res.status(201).json({ success: true, driver });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/delivery/drivers/:id/verify
deliveryRouter.patch('/drivers/:id/verify', (req: Request, res: Response) => {
  try {
    const { is_verified, restaurant_id } = req.body;
    const actor = (req.headers['x-actor-name'] as string) || 'Admin';
    const restaurantId = (req.query.restaurant_id as string) || restaurant_id || DEFAULT_RESTAURANT_ID;
    const driver = DeliveryService.verifyDriver(req.params.id, Boolean(is_verified), actor, restaurantId);
    res.json({ success: true, driver });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/delivery/drivers/:id/gps
deliveryRouter.patch('/drivers/:id/gps', (req: Request, res: Response) => {
  try {
    const { latitude, longitude, restaurant_id } = req.body;
    const restaurantId = (req.query.restaurant_id as string) || restaurant_id || DEFAULT_RESTAURANT_ID;
    const driver = DeliveryService.updateDriverGps(req.params.id, { latitude, longitude }, restaurantId);
    res.json({ success: true, driver });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. DISPATCH & DELIVERIES
// ==========================================

// GET /api/delivery/eligible-drivers
deliveryRouter.get('/eligible-drivers', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const maxAge = req.query.max_gps_age_minutes ? Number(req.query.max_gps_age_minutes) : 30;
    const eligible = DeliveryService.findEligibleDrivers(restaurantId, maxAge);
    res.json({ success: true, drivers: eligible });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/delivery/dispatch
deliveryRouter.post('/dispatch', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || 'Dispatcher';
    const dispatch = DeliveryService.dispatchOrder({ ...req.body, actor });
    res.status(201).json({ success: true, dispatch });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/delivery/dispatches/:id/deliver
deliveryRouter.post('/dispatches/:id/deliver', (req: Request, res: Response) => {
  try {
    const actor = (req.headers['x-actor-name'] as string) || 'Driver';
    const restaurantId = (req.query.restaurant_id as string) || req.body.restaurant_id || DEFAULT_RESTAURANT_ID;
    const dispatch = DeliveryService.markDelivered(req.params.id, actor, restaurantId);
    res.json({ success: true, dispatch });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/delivery/dispatches
deliveryRouter.get('/dispatches', (req: Request, res: Response) => {
  try {
    const restaurantId = (req.query.restaurant_id as string) || DEFAULT_RESTAURANT_ID;
    const dispatches = DeliveryService.listDispatches(restaurantId, {
      status: req.query.status as any,
      driver_id: req.query.driver_id as string,
      order_id: req.query.order_id as string,
    });
    res.json({ success: true, dispatches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
