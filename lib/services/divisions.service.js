import prisma from '../db.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../errors.js';

function requireAdmin(actor) {
  if (actor?.role !== 'admin') throw new ForbiddenError('Admin access required');
}

export async function listDivisions(moduleId, actor) {
  requireAdmin(actor);
  return prisma.groupDivision.findMany({
    where: { module_id: moduleId },
    orderBy: { created_at: 'asc' },
  });
}

export async function createDivision(moduleId, body, actor) {
  requireAdmin(actor);
  const name = String(body.name ?? '').trim();
  if (!name) throw new ValidationError('name is required');

  const existing = await prisma.groupDivision.findUnique({
    where: { module_id_name: { module_id: moduleId, name } },
  });
  if (existing) throw new ValidationError(`Division "${name}" already exists in this module`);

  return prisma.groupDivision.create({
    data: { module_id: moduleId, name },
  });
}

export async function renameDivision(moduleId, divisionId, body, actor) {
  requireAdmin(actor);

  const division = await prisma.groupDivision.findFirst({
    where: { id: divisionId, module_id: moduleId },
  });
  if (!division) throw new NotFoundError('Division not found');

  const name = String(body.name ?? '').trim();
  if (!name) throw new ValidationError('name is required');

  if (name !== division.name) {
    const conflict = await prisma.groupDivision.findUnique({
      where: { module_id_name: { module_id: moduleId, name } },
    });
    if (conflict) throw new ValidationError(`Division "${name}" already exists in this module`);
  }

  return prisma.groupDivision.update({
    where: { id: divisionId },
    data: { name },
  });
}

export async function deleteDivision(moduleId, divisionId, actor) {
  requireAdmin(actor);

  const division = await prisma.groupDivision.findFirst({
    where: { id: divisionId, module_id: moduleId },
  });
  if (!division) throw new NotFoundError('Division not found');

  // Unlink pairs before deleting so we don't orphan them (SetNull in schema handles this,
  // but explicit updateMany ensures the transaction is atomic)
  await prisma.$transaction([
    prisma.group.updateMany({
      where: { division_id: divisionId },
      data: { division_id: null },
    }),
    prisma.groupDivision.delete({ where: { id: divisionId } }),
  ]);
}
