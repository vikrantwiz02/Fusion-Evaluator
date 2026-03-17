// lib/config.js loads .env.local and validates required env vars at startup
import config from './lib/config.js';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import corsMiddleware from './lib/middleware/cors.js';
import routes from './lib/routes/index.js';
import { errorHandler } from './lib/middleware/errorHandler.js';
import { notFound } from './lib/middleware/notFound.js';
import prisma from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Security headers (helmet sets X-Content-Type-Options, HSTS, etc.)
// Preserve COOP header required for Google OAuth popup
app.use(helmet({ crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/lab-manager', routes);

// Return 404 for any unmatched /api/* path (prevents SPA fallback on bad API calls)
app.use('/api', notFound);

// Serve built frontend (production)
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

// Global error handler (must be last)
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port} [${config.nodeEnv}]`);
});

// Graceful shutdown on SIGTERM / SIGINT (e.g. Docker stop, Ctrl+C)
async function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
