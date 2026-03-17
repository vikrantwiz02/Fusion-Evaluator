import config from '../config.js';
import { AppError } from '../errors.js';

const PRISMA_NOT_FOUND = 'P2025';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Known operational error
  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Prisma record-not-found
  if (err.code === PRISMA_NOT_FOUND) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  // Unknown error: log full details, hide from client in production
  console.error('[errorHandler]', err);

  const message = config.nodeEnv === 'production'
    ? 'Internal server error'
    : err.message;

  return res.status(500).json({ error: message });
}
