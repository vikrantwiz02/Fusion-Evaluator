import * as groupsService from '../services/groups.service.js';
import { validateCreateGroup, validateUpdateGroup } from '../validators/group.validator.js';

export async function add(req, res) {
  validateCreateGroup(req.body);
  const group = await groupsService.addGroup(req.params.id, req.body, req.actor);
  res.status(201).json(group);
}

export async function update(req, res) {
  validateUpdateGroup(req.body);
  await groupsService.updateGroup(req.params.id, req.params.groupId, req.body, req.actor);
  res.json({ success: true });
}

export async function remove(req, res) {
  await groupsService.deleteGroup(req.params.id, req.params.groupId, req.actor);
  res.json({ success: true });
}

export async function duplicate(req, res) {
  const group = await groupsService.duplicateGroup(req.params.id, req.params.groupId, req.actor);
  res.status(201).json(group);
}

export async function updateEvaluation(req, res) {
  const evaluation = await groupsService.updateEvaluation(
    req.params.id,
    req.params.groupId,
    req.body,
    req.actor,
  );
  res.json({ success: true, evaluation });
}
