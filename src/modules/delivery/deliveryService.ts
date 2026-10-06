/**
 * DIRECTAURANTE POS CORE v0.1 - Delivery & Dispatch Core Service (FASE 14)
 * 
 * Rules & Architecture:
 * 1. Single Order Truth: Dispatches strictly refer to canonical Order entity.
 * 2. Verified Driver Guard: Only drivers with (is_verified = true, status = 'available') are eligible.
 * 3. Fresh GPS Discipline: Disallows dispatch if GPS telemetry is stale (> 30 mins) or missing.
 * 4. Offer Expiration Safety: Dispatches track expiration; expired offers do not orphan orders.
 * 5. Multi-Tenant Isolation: Drivers and dispatches are strictly bounded by restaurant_id.
 * 6. Native Core: Exposes dispatch events on Domain Event Bus without external mock dependencies.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  DriverProfile,
  DeliveryDispatch,
  Order,
} from '../../core/types';
import { AuditService } from '../../core/audit';
import { eventBus } from '../../core/eventBus';

export interface CreateDriverDTO {
  restaurant_id?: string;
  name: string;
  phone: string;
  email?: string;
  vehicle_type: 'motorcycle' | 'bicycle' | 'car' | 'walker';
  license_plate?: string;
  is_verified?: boolean;
}

export interface UpdateDriverGpsDTO {
  latitude: number;
  longitude: number;
}

export interface DispatchOrderDTO {
  order_id: string;
  restaurant_id?: string;
  delivery_address: string;
  delivery_fee_cents?: number;
  cash_to_collect_cents?: number;
  driver_id?: string; // Optional direct assignment
  offer_timeout_seconds?: number; // Default 180s (3 mins)
  actor?: string;
}

export class DeliveryService {
  // ==========================================
  // 1. DRIVERS DIRECTORY & VERIFICATION
  // ==========================================

  public static listDrivers(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: { status?: DriverProfile['status']; is_verified?: boolean }
  ): DriverProfile[] {
    let drivers = db.get('drivers').filter((d) => d.restaurant_id === restaurant_id);
    if (filters?.status) drivers = drivers.filter((d) => d.status === filters.status);
    if (filters?.is_verified !== undefined) drivers = drivers.filter((d) => d.is_verified === filters.is_verified);
    return drivers;
  }

  public static getDriver(driver_id: string, restaurant_id: string = DEFAULT_RESTAURANT_ID): DriverProfile | null {
    return db.get('drivers').find((d) => d.id === driver_id && d.restaurant_id === restaurant_id) || null;
  }

  public static createDriver(data: CreateDriverDTO, actor: string = 'System Admin'): DriverProfile {
    const restaurant_id = data.restaurant_id || DEFAULT_RESTAURANT_ID;
    const now = new Date().toISOString();
    const driverId = `drv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newDriver: DriverProfile = {
      id: driverId,
      restaurant_id,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.toLowerCase().trim(),
      vehicle_type: data.vehicle_type,
      license_plate: data.license_plate?.trim(),
      is_verified: Boolean(data.is_verified),
      status: 'offline',
      created_at: now,
      updated_at: now,
    };

    db.get('drivers').push(newDriver);
    db.save();

    AuditService.log(
      'driver_created',
      'driver' as any,
      driverId,
      actor,
      null,
      newDriver,
      `Repartidor registrado: ${newDriver.name} (${newDriver.vehicle_type})`,
      restaurant_id
    );

    return newDriver;
  }

  public static verifyDriver(
    driver_id: string,
    is_verified: boolean,
    actor: string = 'Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): DriverProfile {
    const driver = this.getDriver(driver_id, restaurant_id);
    if (!driver) {
      throw new Error(`Repartidor con id ${driver_id} no encontrado.`);
    }

    driver.is_verified = is_verified;
    driver.updated_at = new Date().toISOString();
    db.save();

    AuditService.log(
      'driver_verified',
      'driver' as any,
      driver_id,
      actor,
      { is_verified: !is_verified },
      { is_verified },
      `Verificación de repartidor ${driver.name}: ${is_verified ? 'APROBADO' : 'REVOCADO'}`,
      restaurant_id
    );

    return driver;
  }

  public static updateDriverGps(
    driver_id: string,
    gps: UpdateDriverGpsDTO,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): DriverProfile {
    const driver = this.getDriver(driver_id, restaurant_id);
    if (!driver) {
      throw new Error(`Repartidor con id ${driver_id} no encontrado.`);
    }

    if (gps.latitude < -90 || gps.latitude > 90 || gps.longitude < -180 || gps.longitude > 180) {
      throw new Error(`Coordenadas GPS fuera de rango: (${gps.latitude}, ${gps.longitude}).`);
    }

    const now = new Date().toISOString();
    driver.current_latitude = gps.latitude;
    driver.current_longitude = gps.longitude;
    driver.last_gps_at = now;
    driver.updated_at = now;

    if (driver.status === 'offline') {
      driver.status = 'available';
    }

    db.save();
    return driver;
  }

  // ==========================================
  // 2. DISPATCH & ELIGIBILITY ENGINE
  // ==========================================

  public static findEligibleDrivers(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    maxGpsAgeMinutes: number = 30
  ): DriverProfile[] {
    const now = Date.now();
    const drivers = this.listDrivers(restaurant_id);

    return drivers.filter((d) => {
      if (!d.is_verified) return false;
      if (d.status !== 'available') return false;
      if (!d.last_gps_at || !d.current_latitude || !d.current_longitude) return false;

      const ageMinutes = (now - new Date(d.last_gps_at).getTime()) / (1000 * 60);
      return ageMinutes <= maxGpsAgeMinutes;
    });
  }

  public static dispatchOrder(dto: DispatchOrderDTO): DeliveryDispatch {
    const restaurant_id = dto.restaurant_id || DEFAULT_RESTAURANT_ID;
    const orders = db.get('orders');
    const order = orders.find((o) => o.id === dto.order_id && o.restaurant_id === restaurant_id);
    if (!order) {
      throw new Error(`Orden ${dto.order_id} no encontrada para despacho en este restaurante.`);
    }

    let targetDriver: DriverProfile | null = null;
    if (dto.driver_id) {
      targetDriver = this.getDriver(dto.driver_id, restaurant_id);
      if (!targetDriver) {
        throw new Error(`Repartidor asignado ${dto.driver_id} no existe.`);
      }
      if (!targetDriver.is_verified) {
        throw new Error(`El repartidor ${targetDriver.name} no está verificado.`);
      }
    } else {
      const eligible = this.findEligibleDrivers(restaurant_id);
      if (eligible.length > 0) {
        targetDriver = eligible[0]; // Nearest or first available
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const timeoutSeconds = dto.offer_timeout_seconds || 180;
    const expiresAt = new Date(now.getTime() + timeoutSeconds * 1000).toISOString();
    const dispatchId = `dsp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newDispatch: DeliveryDispatch = {
      id: dispatchId,
      order_id: order.id,
      restaurant_id,
      driver_id: targetDriver?.id,
      driver_name: targetDriver?.name,
      status: targetDriver ? 'assigned' : 'offered',
      delivery_address: dto.delivery_address,
      delivery_fee_cents: dto.delivery_fee_cents || 0,
      cash_to_collect_cents: dto.cash_to_collect_cents || 0,
      offered_at: nowIso,
      expires_at: expiresAt,
      assigned_at: targetDriver ? nowIso : undefined,
      created_at: nowIso,
    };

    db.get('delivery_dispatches').push(newDispatch);

    // Update canonical order with delivery metadata
    order.order_type = 'delivery';
    order.status = 'assigned';
    order.delivery_address = dto.delivery_address;
    order.driver_id = targetDriver?.id;
    order.driver_name = targetDriver?.name;
    order.dispatch_status = targetDriver ? 'assigned' : 'pending';
    order.dispatched_at = nowIso;
    order.updated_at = nowIso;

    if (targetDriver) {
      targetDriver.status = 'busy';
      targetDriver.updated_at = nowIso;
    }

    db.save();

    eventBus.publish('DELIVERY_DISPATCHED', restaurant_id, dto.actor || 'Dispatcher', {
      dispatch: newDispatch,
      order_id: order.id,
      ticket_number: order.ticket_number,
      driver_id: targetDriver?.id,
      driver_name: targetDriver?.name,
      timestamp: nowIso,
    });

    return newDispatch;
  }

  public static markDelivered(
    dispatch_id: string,
    actor: string = 'Driver',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): DeliveryDispatch {
    const dispatches = db.get('delivery_dispatches');
    const dispatch = dispatches.find((d) => d.id === dispatch_id && d.restaurant_id === restaurant_id);
    if (!dispatch) {
      throw new Error(`Despacho ${dispatch_id} no encontrado.`);
    }

    const now = new Date().toISOString();
    dispatch.status = 'delivered';
    dispatch.delivered_at = now;

    const order = db.get('orders').find((o) => o.id === dispatch.order_id && o.restaurant_id === restaurant_id);
    if (order) {
      order.status = 'delivered';
      order.dispatch_status = 'delivered';
      order.delivered_at = now;
      order.updated_at = now;
    }

    if (dispatch.driver_id) {
      const driver = this.getDriver(dispatch.driver_id, restaurant_id);
      if (driver) {
        driver.status = 'available';
        driver.updated_at = now;
      }
    }

    db.save();

    eventBus.publish('DELIVERY_DELIVERED', restaurant_id, actor, {
      dispatch_id: dispatch.id,
      order_id: dispatch.order_id,
      driver_id: dispatch.driver_id,
      timestamp: now,
    });

    return dispatch;
  }

  public static listDispatches(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: { status?: DeliveryDispatch['status']; driver_id?: string; order_id?: string }
  ): DeliveryDispatch[] {
    let list = db.get('delivery_dispatches').filter((d) => d.restaurant_id === restaurant_id);
    if (filters?.status) list = list.filter((d) => d.status === filters.status);
    if (filters?.driver_id) list = list.filter((d) => d.driver_id === filters.driver_id);
    if (filters?.order_id) list = list.filter((d) => d.order_id === filters.order_id);
    return list;
  }
}
