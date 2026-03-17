import { ValidationError } from '../errors.js';

export function validateCreateModule(body) {
  if (!body.name?.trim()) {
    throw new ValidationError('name is required');
  }
  const weekNum = Number(body.week_num);
  if (!Number.isFinite(weekNum) || !Number.isInteger(weekNum)) {
    throw new ValidationError('week_num must be an integer');
  }
}

export function validateUpdateModule(body) {
  if (body.week_num !== undefined) {
    const weekNum = Number(body.week_num);
    if (!Number.isFinite(weekNum) || !Number.isInteger(weekNum)) {
      throw new ValidationError('week_num must be an integer');
    }
  }
  if (body.name !== undefined && !body.name?.trim()) {
    throw new ValidationError('name cannot be empty');
  }
}
