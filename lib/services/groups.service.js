import prisma from '../db.js';
import { canAccessModule } from '../utils/moduleAccess.js';
import { NotFoundError, ForbiddenError } from '../errors.js';

const WITH_GROUPS = { groups: { orderBy: { created_at: 'asc' } } };

async function requireModuleAccess(moduleId, actor) {
  const mod = await prisma.module.findUnique({ where: { id: moduleId }, include: WITH_GROUPS });
  if (!mod) throw new NotFoundError('Module not found');
  if (!canAccessModule(mod, actor)) throw new ForbiddenError();
  return mod;
}

export async function addGroup(moduleId, body, actor) {
  await requireModuleAccess(moduleId, actor);
  return prisma.group.create({
    data: {
      module_id: moduleId,
      pair_id: String(body.pair_id).trim(),
      roll_numbers: Array.isArray(body.roll_numbers) ? body.roll_numbers : [],
      category: body.category ?? 'CONV',
      is_merged: Boolean(body.is_merged),
      partner_pair_id: body.partner_pair_id ?? null,
      evaluation: body.evaluation ?? {},
    },
  });
}

export async function updateGroup(moduleId, groupId, body, actor) {
  const mod = await requireModuleAccess(moduleId, actor);
  const group = mod.groups.find(g => g.id === groupId);
  if (!group) throw new NotFoundError('Group not found');

  const { id: _id, module_id: _mid, created_at: _ca, evaluation: _ev, ...allowed } = body;
  await prisma.group.update({ where: { id: groupId }, data: allowed });
}

export async function deleteGroup(moduleId, groupId, actor) {
  const mod = await requireModuleAccess(moduleId, actor);
  const group = mod.groups.find(g => g.id === groupId);
  if (!group) throw new NotFoundError('Group not found');
  await prisma.group.delete({ where: { id: groupId } });
}

export async function duplicateGroup(moduleId, groupId, actor) {
  const mod = await requireModuleAccess(moduleId, actor);
  const source = mod.groups.find(g => g.id === groupId);
  if (!source) throw new NotFoundError('Group not found');

  const { id: _id, module_id: _mid, created_at: _ca, ...copyData } = source;
  return prisma.group.create({
    data: {
      ...copyData,
      module_id: moduleId,
      pair_id: `${copyData.pair_id} (Copy)`,
    },
  });
}

export async function updateEvaluation(moduleId, groupId, evalData, actor) {
  const mod = await requireModuleAccess(moduleId, actor);
  const group = mod.groups.find(g => g.id === groupId);
  if (!group) throw new NotFoundError('Group not found');

  const currentEval = (typeof group.evaluation === 'object' && group.evaluation !== null)
    ? group.evaluation
    : {};
  const merged = { ...currentEval, ...evalData };

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { evaluation: merged },
  });
  return updated.evaluation;
}
