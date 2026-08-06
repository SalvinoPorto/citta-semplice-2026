import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Tipi e namespace generati (Prisma, Istanza, Servizio, ...): i consumatori
// importano tutto da '@citta/db', mai dal percorso di generazione.
export * from '../generated/prisma/client';

export * from './stato-istanza';
export * from './navigazione-iter';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function creaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? creaClient();

// In sviluppo il hot reload di Next ricrea i moduli a ogni modifica: senza
// questa cache si aprirebbe un pool di connessioni nuovo a ogni ricompilazione.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
