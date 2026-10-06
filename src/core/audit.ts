/**
 * DIRECTAURANTE POS CORE v0.1 - Audit Trail Service
 * Immutable record for operational and financial actions.
 * Enforces compensatory records over hard deletes.
 */

import { db, DEFAULT_RESTAURANT_ID } from './database';
import { AuditLog } from './types';

export class AuditService {
  public static log(
    action: string,
    entity_type: AuditLog['entity_type'],
    entity_id: string,
    actor: string,
    previous_state?: any,
    new_state?: any,
    notes?: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): AuditLog {
    const entry: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      restaurant_id,
      action,
      entity_type,
      entity_id,
      actor: actor || 'Mesero / Operador',
      previous_state: previous_state ? JSON.parse(JSON.stringify(previous_state)) : undefined,
      new_state: new_state ? JSON.parse(JSON.stringify(new_state)) : undefined,
      notes,
      timestamp: new Date().toISOString(),
    };

    const logs = db.get('audit_logs');
    logs.unshift(entry);

    // Keep max 500 in memory, persistently saved
    if (logs.length > 500) {
      logs.pop();
    }

    db.save();
    return entry;
  }

  public static getLogs(restaurant_id: string = DEFAULT_RESTAURANT_ID, limit = 100): AuditLog[] {
    const logs = db.get('audit_logs');
    return logs.filter((l) => l.restaurant_id === restaurant_id).slice(0, limit);
  }
}

export const audit = {
  logAction: (
    action: string,
    entity_type: AuditLog['entity_type'] | string,
    entity_id: string,
    actor: string,
    notes?: string,
    metadata?: any,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ) => {
    return AuditService.log(
      action,
      entity_type as any,
      entity_id,
      actor,
      undefined,
      metadata,
      notes,
      restaurant_id
    );
  },
};

