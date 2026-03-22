import { isWithinAccessWindow } from './time.js';
import jwt from 'jsonwebtoken';
import config from '../config.js';

export function getRequestActor(req) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      return {
        role: payload?.role || 'lead',
        email: String(payload?.email || '').trim().toLowerCase(),
      };
    } catch {
      // Fall through to legacy header support.
    }
  }

  return {
    role: String(req?.headers?.['x-user-role'] || 'lead').trim().toLowerCase(),
    email: String(req?.headers?.['x-user-email'] || '').trim().toLowerCase(),
  };
}

export function isLeadAssignedToModule(moduleDoc, leadEmail) {
  if (!moduleDoc || !leadEmail) return false;
  const assigned = Array.isArray(moduleDoc.assigned_leads) ? moduleDoc.assigned_leads : [];
  return assigned.some(email => String(email).trim().toLowerCase() === leadEmail);
}

export function isTeamAssignedToModule(moduleDoc, teamEmail) {
  if (!moduleDoc || !teamEmail) return false;
  const assigned = Array.isArray(moduleDoc.assigned_teams) ? moduleDoc.assigned_teams : [];
  return assigned.some(email => String(email).trim().toLowerCase() === teamEmail);
}

export function canAccessLeadModule(moduleDoc, actor) {
  if (!actor?.email) return false;
  if (!isLeadAssignedToModule(moduleDoc, actor.email)) return false;
  return isWithinAccessWindow(moduleDoc.access_start ?? null, moduleDoc.access_end ?? null);
}

export function canAccessTeamsModule(moduleDoc, actor) {
  if (!actor?.email) return false;
  if (!isTeamAssignedToModule(moduleDoc, actor.email)) return false;
  return isWithinAccessWindow(moduleDoc.team_access_start ?? null, moduleDoc.team_access_end ?? null);
}

export function canAccessModule(moduleDoc, actor) {
  if (!actor?.role || actor.role === 'admin') return true;
  return canAccessLeadModule(moduleDoc, actor);
}
