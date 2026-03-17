import * as modulesService from '../services/modules.service.js';
import { validateCreateModule, validateUpdateModule } from '../validators/module.validator.js';
import { validateMerge } from '../validators/group.validator.js';

export async function list(req, res) {
  const modules = await modulesService.listModules(req.actor);
  res.json(modules);
}

export async function create(req, res) {
  validateCreateModule(req.body);
  const mod = await modulesService.createModule(req.body);
  res.status(201).json(mod);
}

export async function getOne(req, res) {
  const mod = await modulesService.getModule(req.params.id, req.actor);
  res.json(mod);
}

export async function update(req, res) {
  validateUpdateModule(req.body);
  const mod = await modulesService.updateModule(req.params.id, req.body);
  res.json(mod);
}

export async function remove(req, res) {
  await modulesService.deleteModule(req.params.id);
  res.json({ success: true });
}

export async function duplicate(req, res) {
  const mod = await modulesService.duplicateModule(req.params.id, req.actor);
  res.status(201).json(mod);
}

export async function merge(req, res) {
  validateMerge(req.body);
  await modulesService.mergeGroups(req.params.id, req.actor, req.body);
  res.json({ success: true });
}
