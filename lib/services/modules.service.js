import prisma from '../db.js';
import { serializeModule } from '../utils/serializeModule.js';
import { canAccessModule, canAccessTeamsModule, canAccessLeadModule } from '../utils/moduleAccess.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../errors.js';

const WITH_GROUPS = {
  groups: { orderBy: { created_at: 'asc' } },
  divisions: { orderBy: { created_at: 'asc' } },
};

const DEFAULT_SPEC_SECTION_ORDER = ['useCases', 'businessRules', 'workflows'];

function normalizeModuleData(body) {
  const payload = { ...body };
  if (Array.isArray(payload.assigned_leads)) {
    payload.assigned_leads = payload.assigned_leads
      .map(e => String(e).trim().toLowerCase())
      .filter(Boolean);
  }
  if (Array.isArray(payload.assigned_teams)) {
    payload.assigned_teams = payload.assigned_teams
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

function normalizeSizeMap(value, { min, max }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    out[String(key)] = Math.max(min, Math.min(max, n));
  }
  return out;
}

function normalizeExtraSections(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const key = String(entry.key || '').trim();
    const label = String(entry.label || '').trim();
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);

    out.push({
      key,
      label,
      rows: normalizeSpecRows(entry.rows),
      columns: Array.isArray(entry.columns)
        ? entry.columns.map(col => String(col || '').trim()).filter(Boolean)
        : [],
    });
  }

  return out;
}

function normalizeSectionOrder(value, extraSections) {
  const validKeys = [...DEFAULT_SPEC_SECTION_ORDER, ...(extraSections || []).map(section => section.key)];
  const seen = new Set();
  const out = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      const key = String(entry || '').trim();
      if (!key || seen.has(key) || !validKeys.includes(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }

  for (const key of validKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }

  return out;
}

function normalizeSectionColumns(value, extraSections) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const validKeys = [...DEFAULT_SPEC_SECTION_ORDER, ...(extraSections || []).map(section => section.key)];
  const out = {};

  for (const key of validKeys) {
    const raw = value[key];
    if (!Array.isArray(raw)) continue;
    const seen = new Set();
    const cols = [];

    for (const col of raw) {
      const normalized = String(col || '').trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      cols.push(normalized);
    }

    if (cols.length > 0) {
      out[key] = cols;
    }
  }

  return out;
}

function normalizeSpecLayout(layout) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    return { columnWidths: {}, rowHeights: {}, extraSections: [], sectionOrder: DEFAULT_SPEC_SECTION_ORDER, sectionColumns: {}, moduleSpecsZip: null };
  }

  const extraSections = normalizeExtraSections(layout.extraSections);
  const moduleSpecsZip = layout.moduleSpecsZip && typeof layout.moduleSpecsZip === 'object' && !Array.isArray(layout.moduleSpecsZip)
    ? {
      name: String(layout.moduleSpecsZip.name || '').trim(),
      type: String(layout.moduleSpecsZip.type || 'application/zip').trim() || 'application/zip',
      size: Number.isFinite(Number(layout.moduleSpecsZip.size)) ? Number(layout.moduleSpecsZip.size) : 0,
      uploadedAt: String(layout.moduleSpecsZip.uploadedAt || '').trim(),
      dataUrl: String(layout.moduleSpecsZip.dataUrl || '').trim(),
    }
    : null;

  return {
    columnWidths: normalizeSizeMap(layout.columnWidths, { min: 120, max: 520 }),
    rowHeights: normalizeSizeMap(layout.rowHeights, { min: 48, max: 260 }),
    extraSections,
    sectionOrder: normalizeSectionOrder(layout.sectionOrder, extraSections),
    sectionColumns: normalizeSectionColumns(layout.sectionColumns, extraSections),
    moduleSpecsZip,
  };
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

async function requireTeamsModule(id, actor) {
  const mod = await prisma.module.findUnique({ where: { id }, include: WITH_GROUPS });
  if (!mod) throw new NotFoundError('Module not found');
  if (actor?.role === 'admin') return mod;
  if (!canAccessTeamsModule(mod, actor)) throw new ForbiddenError();
  return mod;
}

export async function listModules(actor, scope = 'lead') {
  let where = {};
  if (actor?.role !== 'admin') {
    if (scope === 'teams') {
      where = { assigned_teams: { has: actor.email } };
    } else if (scope === 'both') {
      where = {
        OR: [
          { assigned_leads: { has: actor.email } },
          { assigned_teams: { has: actor.email } },
        ],
      };
    } else {
      where = { assigned_leads: { has: actor.email } };
    }
  }
  const modules = await prisma.module.findMany({
    where,
    include: WITH_GROUPS,
    orderBy: [{ created_at: 'asc' }],
  });

  // Filter out modules whose access window is closed for the actor so that
  // expired lead/team assignments do not block users with another active window.
  const canSee = (mod) => {
    if (actor?.role === 'admin') return true;
    if (scope === 'teams') return canAccessTeamsModule(mod, actor);
    if (scope === 'both') return canAccessLeadModule(mod, actor) || canAccessTeamsModule(mod, actor);
    return canAccessLeadModule(mod, actor);
  };

  return modules.filter(canSee).map(serializeModule).filter(Boolean);
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
  const teamAccessStart = parseOptionalDateTime(data.team_access_start);
  const teamAccessEnd = parseOptionalDateTime(data.team_access_end);
  if (accessStart && accessEnd && accessStart >= accessEnd) {
    throw new ValidationError('access_start must be before access_end');
  }
  if (teamAccessStart && teamAccessEnd && teamAccessStart >= teamAccessEnd) {
    throw new ValidationError('team_access_start must be before team_access_end');
  }

  const mod = await prisma.module.create({
    data: {
      name: String(data.name).trim(),
      date: data.date ?? new Date().toISOString().split('T')[0],
      assigned_leads: data.assigned_leads ?? [],
      assigned_teams: data.assigned_teams ?? [],
      access_start: accessStart,
      access_end: accessEnd,
      team_access_start: teamAccessStart,
      team_access_end: teamAccessEnd,
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
  if (data.assigned_teams !== undefined) update.assigned_teams = data.assigned_teams;
  if ('access_start' in data) update.access_start = parseOptionalDateTime(data.access_start);
  if ('access_end' in data) update.access_end = parseOptionalDateTime(data.access_end);
  if ('team_access_start' in data) update.team_access_start = parseOptionalDateTime(data.team_access_start);
  if ('team_access_end' in data) update.team_access_end = parseOptionalDateTime(data.team_access_end);
  if (data.has_backend !== undefined) update.has_backend = Boolean(data.has_backend);
  if (data.has_frontend !== undefined) update.has_frontend = Boolean(data.has_frontend);
  if ('spec_use_cases' in data) update.spec_use_cases = normalizeSpecRows(data.spec_use_cases);
  if ('spec_workflows' in data) update.spec_workflows = normalizeSpecRows(data.spec_workflows);
  if ('spec_rules' in data) update.spec_rules = normalizeSpecRows(data.spec_rules);
  if ('spec_layout' in data) update.spec_layout = normalizeSpecLayout(data.spec_layout);
  if ('team_spec_use_cases' in data) update.team_spec_use_cases = normalizeSpecRows(data.team_spec_use_cases);
  if ('team_spec_workflows' in data) update.team_spec_workflows = normalizeSpecRows(data.team_spec_workflows);
  if ('team_spec_rules' in data) update.team_spec_rules = normalizeSpecRows(data.team_spec_rules);
  if ('team_spec_layout' in data) update.team_spec_layout = normalizeSpecLayout(data.team_spec_layout);

  // Validate start < end when both are being set or already exist
  if (update.access_start && update.access_end && update.access_start >= update.access_end) {
    throw new ValidationError('access_start must be before access_end');
  }
  if (update.team_access_start && update.team_access_end && update.team_access_start >= update.team_access_end) {
    throw new ValidationError('team_access_start must be before team_access_end');
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
export async function bulkUpdateTimer(moduleIds, accessStart, accessEnd, applyForLeads, applyForTeams, actor) {
  if (actor?.role !== 'admin') throw new ForbiddenError('Admin access required');

  if (!applyForLeads && !applyForTeams) {
    throw new ValidationError('Select at least one timer target: Leads or Teams');
  }

  const start = parseOptionalDateTime(accessStart);
  const end = parseOptionalDateTime(accessEnd);

  if (start && end && start >= end) {
    throw new ValidationError('access_start must be before access_end');
  }

  const updateData = {};
  if (applyForLeads) {
    updateData.access_start = start;
    updateData.access_end = end;
  }
  if (applyForTeams) {
    updateData.team_access_start = start;
    updateData.team_access_end = end;
  }

  const result = await prisma.module.updateMany({
    where: { id: { in: moduleIds } },
    data: updateData,
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
  const layout = mod.spec_layout && typeof mod.spec_layout === 'object' && !Array.isArray(mod.spec_layout)
    ? normalizeSpecLayout(mod.spec_layout)
    : normalizeSpecLayout(null);

  return {
    useCases: Array.isArray(mod.spec_use_cases) ? mod.spec_use_cases : [],
    workflows: Array.isArray(mod.spec_workflows) ? mod.spec_workflows : [],
    businessRules: Array.isArray(mod.spec_rules) ? mod.spec_rules : [],
    layout,
  };
}

export async function updateModuleSpecifications(id, payload, actor) {
  const mod = await requireModule(id, actor);

  const nextLayout = normalizeSpecLayout(payload.layout);

  const updated = await prisma.module.update({
    where: { id: mod.id },
    data: {
      spec_use_cases: normalizeSpecRows(payload.useCases),
      spec_workflows: normalizeSpecRows(payload.workflows),
      spec_rules: normalizeSpecRows(payload.businessRules),
      spec_layout: nextLayout,
    },
  });

  const savedLayout = updated.spec_layout && typeof updated.spec_layout === 'object' && !Array.isArray(updated.spec_layout)
    ? normalizeSpecLayout(updated.spec_layout)
    : normalizeSpecLayout(null);

  return {
    useCases: Array.isArray(updated.spec_use_cases) ? updated.spec_use_cases : [],
    workflows: Array.isArray(updated.spec_workflows) ? updated.spec_workflows : [],
    businessRules: Array.isArray(updated.spec_rules) ? updated.spec_rules : [],
    layout: savedLayout,
  };
}

export async function getTeamsModuleSpecifications(id, actor) {
  const mod = await requireTeamsModule(id, actor);
  const layout = mod.team_spec_layout && typeof mod.team_spec_layout === 'object' && !Array.isArray(mod.team_spec_layout)
    ? normalizeSpecLayout(mod.team_spec_layout)
    : normalizeSpecLayout(null);

  return {
    useCases: Array.isArray(mod.team_spec_use_cases) ? mod.team_spec_use_cases : [],
    workflows: Array.isArray(mod.team_spec_workflows) ? mod.team_spec_workflows : [],
    businessRules: Array.isArray(mod.team_spec_rules) ? mod.team_spec_rules : [],
    layout,
  };
}

export async function updateTeamsModuleSpecifications(id, payload, actor) {
  const mod = await requireTeamsModule(id, actor);

  const nextLayout = normalizeSpecLayout(payload.layout);

  const updated = await prisma.module.update({
    where: { id: mod.id },
    data: {
      team_spec_use_cases: normalizeSpecRows(payload.useCases),
      team_spec_workflows: normalizeSpecRows(payload.workflows),
      team_spec_rules: normalizeSpecRows(payload.businessRules),
      team_spec_layout: nextLayout,
    },
  });

  const savedLayout = updated.team_spec_layout && typeof updated.team_spec_layout === 'object' && !Array.isArray(updated.team_spec_layout)
    ? normalizeSpecLayout(updated.team_spec_layout)
    : normalizeSpecLayout(null);

  return {
    useCases: Array.isArray(updated.team_spec_use_cases) ? updated.team_spec_use_cases : [],
    workflows: Array.isArray(updated.team_spec_workflows) ? updated.team_spec_workflows : [],
    businessRules: Array.isArray(updated.team_spec_rules) ? updated.team_spec_rules : [],
    layout: savedLayout,
  };
}
