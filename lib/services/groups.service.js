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

async function validateDivisionBelongsToModule(divisionId, moduleId) {
  if (!divisionId) return;
  const division = await prisma.groupDivision.findFirst({
    where: { id: divisionId, module_id: moduleId },
  });
  if (!division) throw new NotFoundError('Division not found in this module');
}

export async function addGroup(moduleId, body, actor) {
  await requireModuleAccess(moduleId, actor);
  await validateDivisionBelongsToModule(body.division_id, moduleId);

  return prisma.group.create({
    data: {
      module_id: moduleId,
      pair_id: String(body.pair_id).trim(),
      roll_numbers: Array.isArray(body.roll_numbers) ? body.roll_numbers : [],
      domain_leads: Array.isArray(body.domain_leads) ? body.domain_leads : [],
      category: body.category ?? 'CONV',
      is_merged: false,
      partner_pair_id: null,
      evaluation: {},
      division_id: body.division_id ?? null,
    },
  });
}

export async function updateGroup(moduleId, groupId, body, actor) {
  const mod = await requireModuleAccess(moduleId, actor);
  const group = mod.groups.find(g => g.id === groupId);
  if (!group) throw new NotFoundError('Group not found');

  if (body.division_id !== undefined) {
    await validateDivisionBelongsToModule(body.division_id, moduleId);
  }

  // Strip immutable / protected fields — evaluation has its own dedicated endpoint
  const {
    id: _id,
    module_id: _mid,
    created_at: _ca,
    evaluation: _ev,
    division: _divRelation,
    ...allowed
  } = body;

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

  const {
    id: _id,
    module_id: _mid,
    created_at: _ca,
    division: _divRelation,
    ...copyData
  } = source;

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
