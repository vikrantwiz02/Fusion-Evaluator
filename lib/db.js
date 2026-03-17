import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
// DATABASE_URL is loaded by lib/config.js which is imported before db.js in the module graph

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const prisma = globalThis._prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma;

export default prisma;
