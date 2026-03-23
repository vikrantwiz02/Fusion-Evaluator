import * as modulesService from '../services/modules.service.js';
import {
  validateCreateModule,
  validateUpdateModule,
  validateBulkTimer,
  validateModuleSpecifications,
} from '../validators/module.validator.js';
import { validateMerge } from '../validators/group.validator.js';

export async function list(req, res) {
  const scope = String(req.query?.scope || 'lead').trim().toLowerCase();
  const modules = await modulesService.listModules(req.actor, scope);
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

export async function bulkTimer(req, res) {
  validateBulkTimer(req.body);
  const result = await modulesService.bulkUpdateTimer(
    req.body.moduleIds,
    req.body.access_start ?? null,
    req.body.access_end ?? null,
    req.body.applyForLeads !== false,
    req.body.applyForTeams !== false,
    req.actor,
  );
  res.json({ success: true, ...result });
}

export async function getSpecifications(req, res) {
  const specs = await modulesService.getModuleSpecifications(req.params.id, req.actor);
  res.json(specs);
}

export async function updateSpecifications(req, res) {
  validateModuleSpecifications(req.body);
  const specs = await modulesService.updateModuleSpecifications(req.params.id, req.body, req.actor);
  res.json({ success: true, ...specs });
}

export async function updateSpecificationsZip(req, res) {
  const specs = await modulesService.updateModuleSpecificationsZip(req.params.id, req.body, req.actor);
  res.json({ success: true, ...specs });
}

export async function getTeamsSpecifications(req, res) {
  const specs = await modulesService.getTeamsModuleSpecifications(req.params.id, req.actor);
  res.json(specs);
}

export async function updateTeamsSpecifications(req, res) {
  validateModuleSpecifications(req.body);
  const specs = await modulesService.updateTeamsModuleSpecifications(req.params.id, req.body, req.actor);
  res.json({ success: true, ...specs });
}

export async function updateTeamsSpecificationsZip(req, res) {
  const specs = await modulesService.updateTeamsModuleSpecificationsZip(req.params.id, req.body, req.actor);
  res.json({ success: true, ...specs });
}
