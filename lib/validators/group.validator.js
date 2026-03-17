import { ValidationError } from '../errors.js';

const VALID_CATEGORIES = ['CONV', 'AI'];

export function validateCreateGroup(body) {
  if (!body.pair_id?.trim()) {
    throw new ValidationError('pair_id is required');
  }
  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
    throw new ValidationError(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }
}

export function validateUpdateGroup(body) {
  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
    throw new ValidationError(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }
}

export function validateMerge(body) {
  if (!body.poorPairId || typeof body.poorPairId !== 'string') {
    throw new ValidationError('poorPairId is required');
  }
  if (!body.highPairId || typeof body.highPairId !== 'string') {
    throw new ValidationError('highPairId is required');
  }
  if (body.poorPairId === body.highPairId) {
    throw new ValidationError('poorPairId and highPairId must be different');
  }
}
