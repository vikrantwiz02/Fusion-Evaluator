import prisma from '../db.js';
import { serializeModule } from '../utils/serializeModule.js';
import { canAccessModule } from '../utils/moduleAccess.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../errors.js';

const WITH_GROUPS = {
  groups: { orderBy: { created_at: 'asc' } },
  divisions: { orderBy: { created_at: 'asc' } },
};

function normalizeModuleData(body) {
  const payload = { ...body };
  if (Array.isArray(payload.assigned_leads)) {
    payload.assigned_leads = payload.assigned_leads
      .map(e => String(e).trim().toLowerCase())
      .filter(Boolean);
  }
  return payload;
}

function normalizeSpecRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(row => row && typeof row === 'object' && !Array.isArray(row))
    .map(row => {
      const clean = {};
      for (const [key, value] of Object.entries(row)) {
        const k = String(key || '').trim();
        if (!k) continue;
        clean[k] = value == null ? '' : value;
      }
      return clean;
    });
}

function parseOptionalDateTime(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new ValidationError(`Invalid datetime value: "${value}". Expected ISO 8601 format.`);
  }
  return d;
}

async function requireModule(id, actor) {
  const mod = await prisma.module.findUnique({ where: { id }, include: WITH_GROUPS });
  if (!mod) throw new NotFoundError('Module not found');
  if (actor && !canAccessModule(mod, actor)) throw new ForbiddenError();
  return mod;
}

export async function listModules(actor) {
  const where = actor.role === 'lead'
    ? { assigned_leads: { has: actor.email } }
    : {};
  const modules = await prisma.module.findMany({
    where,
    include: WITH_GROUPS,
    orderBy: [{ created_at: 'asc' }],
  });
  return modules.map(serializeModule).filter(Boolean);
}

export async function createModule(body) {
  const {
    groups: _groups,
    divisions: _divisions,
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    ...data
  } = normalizeModuleData(body);

  const accessStart = parseOptionalDateTime(data.access_start);
  const accessEnd = parseOptionalDateTime(data.access_end);
  if (accessStart && accessEnd && accessStart >= accessEnd) {
    throw new ValidationError('access_start must be before access_end');
  }

  const mod = await prisma.module.create({
    data: {
      name: String(data.name).trim(),
      date: data.date ?? new Date().toISOString().split('T')[0],
      assigned_leads: data.assigned_leads ?? [],
      access_start: accessStart,
      access_end: accessEnd,
      has_backend: data.has_backend ?? true,
      has_frontend: data.has_frontend ?? true,
    },
    include: WITH_GROUPS,
  });
  return serializeModule(mod);
}

export async function getModule(id, actor) {
  const mod = await requireModule(id, actor);
  return serializeModule(mod);
}

export async function updateModule(id, body) {
  const {
    groups: _g,
    divisions: _d,
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    ...data
  } = normalizeModuleData(body);

  const update = {};
  if (data.name !== undefined) update.name = String(data.name).trim();
  if (data.date !== undefined) update.date = data.date;
  if (data.assigned_leads !== undefined) update.assigned_leads = data.assigned_leads;
  if ('access_start' in data) update.access_start = parseOptionalDateTime(data.access_start);
  if ('access_end' in data) update.access_end = parseOptionalDateTime(data.access_end);
  if (data.has_backend !== undefined) update.has_backend = Boolean(data.has_backend);
  if (data.has_frontend !== undefined) update.has_frontend = Boolean(data.has_frontend);
  if ('spec_use_cases' in data) update.spec_use_cases = normalizeSpecRows(data.spec_use_cases);
  if ('spec_workflows' in data) update.spec_workflows = normalizeSpecRows(data.spec_workflows);
  if ('spec_rules' in data) update.spec_rules = normalizeSpecRows(data.spec_rules);

  // Validate start < end when both are being set or already exist
  if (update.access_start && update.access_end && update.access_start >= update.access_end) {
    throw new ValidationError('access_start must be before access_end');
  }

  const mod = await prisma.module.update({
    where: { id },
    data: update,
    include: WITH_GROUPS,
  });
  return serializeModule(mod);
}

export async function deleteModule(id) {
  await prisma.module.delete({ where: { id } });
}

export async function duplicateModule(id, actor) {
  const original = await requireModule(id, actor);
  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    groups,
    divisions,
    ...modData
  } = original;

  const copy = await prisma.$transaction(async (tx) => {
    const createdModule = await tx.module.create({
      data: {
        ...modData,
        name: `${modData.name} (Copy)`,
        // Reset timer on duplicate so the copy is not immediately restricted
        access_start: null,
        access_end: null,
      },
    });

    const divisionIdMap = new Map();
    for (const div of divisions || []) {
      const {
        id: oldDivisionId,
        module_id: _mid,
        pairs: _pairs,
        created_at: _ca,
        updated_at: _ua,
        ...divData
      } = div;

      const createdDivision = await tx.groupDivision.create({
        data: {
          ...divData,
          module_id: createdModule.id,
        },
      });
      divisionIdMap.set(oldDivisionId, createdDivision.id);
    }

    for (const group of groups || []) {
      const {
        id: _gid,
        module_id: _mid,
        created_at: _gca,
        division: _div,
        ...groupData
      } = group;

      await tx.group.create({
        data: {
          ...groupData,
          module_id: createdModule.id,
          division_id: group.division_id ? (divisionIdMap.get(group.division_id) || null) : null,
        },
      });
    }

    return tx.module.findUnique({ where: { id: createdModule.id }, include: WITH_GROUPS });
  });

  return serializeModule(copy);
}

/**
 * Bulk-update the access timer for multiple modules at once.
 * Only admins may call this route.
 *
 * @param {string[]} moduleIds
 * @param {string|null} accessStart  ISO 8601 or null to clear
 * @param {string|null} accessEnd    ISO 8601 or null to clear
 * @param {{ role: string }} actor
 */
export async function bulkUpdateTimer(moduleIds, accessStart, accessEnd, actor) {
  if (actor?.role !== 'admin') throw new ForbiddenError('Admin access required');

  const start = parseOptionalDateTime(accessStart);
  const end = parseOptionalDateTime(accessEnd);

  if (start && end && start >= end) {
    throw new ValidationError('access_start must be before access_end');
  }

  const result = await prisma.module.updateMany({
    where: { id: { in: moduleIds } },
    data: { access_start: start, access_end: end },
  });

  return { updated: result.count };
}

export async function mergeGroups(id, actor, { poorPairId, highPairId }) {
  const mod = await requireModule(id, actor);
  const poorGroup = mod.groups.find(g => g.pair_id === poorPairId);
  if (!poorGroup) throw new NotFoundError(`Group with pair_id "${poorPairId}" not found`);
  const highGroup = mod.groups.find(g => g.pair_id === highPairId);
  if (!highGroup) throw new NotFoundError(`Group with pair_id "${highPairId}" not found`);

  await prisma.$transaction([
    prisma.group.update({ where: { id: poorGroup.id }, data: { is_merged: true, partner_pair_id: highPairId } }),
    prisma.group.update({ where: { id: highGroup.id }, data: { is_merged: true, partner_pair_id: poorPairId } }),
  ]);
}

export async function getModuleSpecifications(id, actor) {
  const mod = await requireModule(id, actor);
  return {
    useCases: Array.isArray(mod.spec_use_cases) ? mod.spec_use_cases : [],
    workflows: Array.isArray(mod.spec_workflows) ? mod.spec_workflows : [],
    businessRules: Array.isArray(mod.spec_rules) ? mod.spec_rules : [],
  };
}

export async function updateModuleSpecifications(id, payload, actor) {
  const mod = await requireModule(id, actor);
  if (actor?.role !== 'admin') throw new ForbiddenError('Admin access required');

  const updated = await prisma.module.update({
    where: { id: mod.id },
    data: {
      spec_use_cases: normalizeSpecRows(payload.useCases),
      spec_workflows: normalizeSpecRows(payload.workflows),
      spec_rules: normalizeSpecRows(payload.businessRules),
    },
  });

  return {
    useCases: Array.isArray(updated.spec_use_cases) ? updated.spec_use_cases : [],
    workflows: Array.isArray(updated.spec_workflows) ? updated.spec_workflows : [],
    businessRules: Array.isArray(updated.spec_rules) ? updated.spec_rules : [],
  };
}
