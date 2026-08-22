import { PrismaClient } from '@prisma/client';
import env from './env.js';

// Reuse a single client across hot reloads in development so we do not
// exhaust the PostgreSQL connection pool.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__hostelPrisma ??
  new PrismaClient({
    log: env.isProd ? ['error'] : ['warn', 'error'],
  });

if (!env.isProd) {
  globalForPrisma.__hostelPrisma = prisma;
}

export default prisma;
