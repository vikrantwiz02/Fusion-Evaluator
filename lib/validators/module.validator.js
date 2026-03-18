import { ValidationError } from '../errors.js';

function validateOptionalDateTime(value, fieldName) {
  if (value === null || value === undefined || value === '') return;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid ISO 8601 datetime`);
  }
}

export function validateCreateModule(body) {
  if (!body.name?.trim()) {
    throw new ValidationError('name is required');
  }
  validateOptionalDateTime(body.access_start, 'access_start');
  validateOptionalDateTime(body.access_end, 'access_end');
  if (body.access_start && body.access_end) {
    if (new Date(body.access_start) >= new Date(body.access_end)) {
      throw new ValidationError('access_start must be before access_end');
    }
  }
}

export function validateUpdateModule(body) {
  if (body.name !== undefined && !body.name?.trim()) {
    throw new ValidationError('name cannot be empty');
  }
  if (body.access_start !== undefined) validateOptionalDateTime(body.access_start, 'access_start');
  if (body.access_end !== undefined) validateOptionalDateTime(body.access_end, 'access_end');
}

export function validateBulkTimer(body) {
  if (!Array.isArray(body.moduleIds) || body.moduleIds.length === 0) {
    throw new ValidationError('moduleIds must be a non-empty array');
  }
  if (body.moduleIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new ValidationError('Each moduleId must be a non-empty string');
  }
  if (body.access_start !== undefined) validateOptionalDateTime(body.access_start, 'access_start');
  if (body.access_end !== undefined) validateOptionalDateTime(body.access_end, 'access_end');
  if (body.access_start && body.access_end) {
    if (new Date(body.access_start) >= new Date(body.access_end)) {
      throw new ValidationError('access_start must be before access_end');
    }
  }
}

function validateRowsArray(rows, fieldName) {
  if (!Array.isArray(rows)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }
  if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new ValidationError(`${fieldName} must contain only row objects`);
  }
}

export function validateModuleSpecifications(body) {
  validateRowsArray(body.useCases ?? [], 'useCases');
  validateRowsArray(body.workflows ?? [], 'workflows');
  validateRowsArray(body.businessRules ?? [], 'businessRules');
}
