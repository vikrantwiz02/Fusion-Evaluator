import * as divisionsService from '../services/divisions.service.js';
import { validateCreateDivision, validateUpdateDivision } from '../validators/division.validator.js';

export async function list(req, res) {
  const divisions = await divisionsService.listDivisions(req.params.id, req.actor);
  res.json(divisions);
}

export async function create(req, res) {
  validateCreateDivision(req.body);
  const division = await divisionsService.createDivision(req.params.id, req.body, req.actor);
  res.status(201).json(division);
}

export async function update(req, res) {
  validateUpdateDivision(req.body);
  const division = await divisionsService.renameDivision(
    req.params.id,
    req.params.divisionId,
    req.body,
    req.actor,
  );
  res.json(division);
}

export async function remove(req, res) {
  await divisionsService.deleteDivision(req.params.id, req.params.divisionId, req.actor);
  res.json({ success: true });
}
