import { ValidationError } from '../errors.js';

const MAX_NAME_LEN = 50;

export function validateCreateDivision(body) {
  if (!body.name?.trim()) {
    throw new ValidationError('name is required');
  }
  if (String(body.name).trim().length > MAX_NAME_LEN) {
    throw new ValidationError(`name must be ${MAX_NAME_LEN} characters or fewer`);
  }
}

export function validateUpdateDivision(body) {
  if (body.name !== undefined) {
    if (!body.name?.trim()) {
      throw new ValidationError('name cannot be empty');
    }
    if (String(body.name).trim().length > MAX_NAME_LEN) {
      throw new ValidationError(`name must be ${MAX_NAME_LEN} characters or fewer`);
    }
  }
}
