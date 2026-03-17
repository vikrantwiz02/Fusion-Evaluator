import dotenv from 'dotenv';
// Load .env.local at module initialization — this runs before any dependent module's body
dotenv.config({ path: '.env.local' });

const REQUIRED_ENV = ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'JWT_SECRET'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const config = {
  port: Number(process.env.PORT) || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  appTimezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
};

export default config;
