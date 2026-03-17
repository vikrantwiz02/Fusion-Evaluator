import { isWithinAccessWindow } from './time.js';

export function isLeadAssignedToModule(moduleDoc, leadEmail) {
  if (!moduleDoc || !leadEmail) return false;
  const assigned = Array.isArray(moduleDoc.assigned_leads) ? moduleDoc.assigned_leads : [];
  return assigned.some(email => String(email).trim().toLowerCase() === leadEmail);
}

export function canAccessModule(moduleDoc, actor) {
  if (!actor?.role || actor.role === 'admin') return true;
  if (actor.role !== 'lead') return false;
  if (!isLeadAssignedToModule(moduleDoc, actor.email)) return false;
  return isWithinAccessWindow(moduleDoc.access_start ?? null, moduleDoc.access_end ?? null);
}
