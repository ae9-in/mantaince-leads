import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

// Write client -> RDS Proxy -> Primary
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

// Read-only client -> RDS Proxy -> Read Replica (for exports, stats, search)
// Falls back to DATABASE_URL if replica URL is not defined
export const prismaRO =
  globalForPrisma.prismaReadOnly ||
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL } },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaReadOnly = prismaRO;
}
