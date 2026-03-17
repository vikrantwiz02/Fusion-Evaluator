import prisma from '../db.js';
import { serializeModule } from '../utils/serializeModule.js';
import { canAccessModule } from '../utils/moduleAccess.js';
import { NotFoundError, ForbiddenError } from '../errors.js';

const WITH_GROUPS = { groups: { orderBy: { created_at: 'asc' } } };

function normalizeModuleData(body) {
  const payload = { ...body };
  if (Array.isArray(payload.assigned_leads)) {
    payload.assigned_leads = payload.assigned_leads
      .map(e => String(e).trim().toLowerCase())
      .filter(Boolean);
  }
  return payload;
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
    orderBy: [{ week_num: 'asc' }, { created_at: 'asc' }],
  });
  return modules.map(serializeModule).filter(Boolean);
}

export async function createModule(body) {
  const { groups: _groups, id: _id, created_at: _ca, updated_at: _ua, ...data } = normalizeModuleData(body);
  const mod = await prisma.module.create({
    data: {
      name: String(data.name).trim(),
      assignment_name: data.assignment_name ?? '',
      week_num: Number(data.week_num),
      date: data.date ?? new Date().toISOString().split('T')[0],
      assigned_leads: data.assigned_leads ?? [],
      login_start: data.login_start ?? '00:00',
      login_end: data.login_end ?? '23:59',
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
  const { groups: _g, id: _id, created_at: _ca, updated_at: _ua, ...data } = normalizeModuleData(body);
  const update = {};
  if (data.name !== undefined) update.name = String(data.name).trim();
  if (data.assignment_name !== undefined) update.assignment_name = data.assignment_name;
  if (data.week_num !== undefined) update.week_num = Number(data.week_num);
  if (data.date !== undefined) update.date = data.date;
  if (data.assigned_leads !== undefined) update.assigned_leads = data.assigned_leads;
  if (data.login_start !== undefined) update.login_start = data.login_start;
  if (data.login_end !== undefined) update.login_end = data.login_end;
  if (data.has_backend !== undefined) update.has_backend = Boolean(data.has_backend);
  if (data.has_frontend !== undefined) update.has_frontend = Boolean(data.has_frontend);

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
  const { id: _id, created_at: _ca, updated_at: _ua, groups, ...modData } = original;
  const copy = await prisma.module.create({
    data: {
      ...modData,
      name: `${modData.name} (Copy)`,
      groups: {
        create: groups.map(({ id: _gid, module_id: _mid, created_at: _gca, ...g }) => g),
      },
    },
    include: WITH_GROUPS,
  });
  return serializeModule(copy);
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
