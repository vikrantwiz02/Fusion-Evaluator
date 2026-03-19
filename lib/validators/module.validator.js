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

  if (body.layout !== undefined) {
    if (!body.layout || typeof body.layout !== 'object' || Array.isArray(body.layout)) {
      throw new ValidationError('layout must be an object');
    }

    if (body.layout.extraSections !== undefined) {
      if (!Array.isArray(body.layout.extraSections)) {
        throw new ValidationError('layout.extraSections must be an array');
      }

      for (const section of body.layout.extraSections) {
        if (!section || typeof section !== 'object' || Array.isArray(section)) {
          throw new ValidationError('Each layout.extraSections item must be an object');
        }
        if (!String(section.key || '').trim() || !String(section.label || '').trim()) {
          throw new ValidationError('Each layout.extraSections item must have key and label');
        }
        validateRowsArray(section.rows ?? [], `layout.extraSections(${section.key}).rows`);
      }
    }

    if (body.layout.sectionOrder !== undefined) {
      if (!Array.isArray(body.layout.sectionOrder)) {
        throw new ValidationError('layout.sectionOrder must be an array');
      }
      if (body.layout.sectionOrder.some(item => !String(item || '').trim())) {
        throw new ValidationError('layout.sectionOrder must contain only non-empty strings');
      }
    }

    if (body.layout.sectionColumns !== undefined) {
      if (!body.layout.sectionColumns || typeof body.layout.sectionColumns !== 'object' || Array.isArray(body.layout.sectionColumns)) {
        throw new ValidationError('layout.sectionColumns must be an object');
      }
      for (const [sectionKey, columns] of Object.entries(body.layout.sectionColumns)) {
        if (!Array.isArray(columns)) {
          throw new ValidationError(`layout.sectionColumns.${sectionKey} must be an array`);
        }
        if (columns.some(col => !String(col || '').trim())) {
          throw new ValidationError(`layout.sectionColumns.${sectionKey} must contain only non-empty strings`);
        }
      }
    }
  }
}
