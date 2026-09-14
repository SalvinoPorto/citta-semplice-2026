import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Tipi e namespace generati (Prisma, Istanza, Servizio, ...): i consumatori
// importano tutto da '@citta/db', mai dal percorso di generazione.
export * from '../generated/prisma/client';

export * from './stato-istanza';
export * from './navigazione-iter';
export * from './stato-attivita';
export * from './quota-istanze';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function creaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Connessioni per processo. Va moltiplicato per il numero di replica in
    // esecuzione e deve restare sotto il `max_connections` di Postgres: con 20
    // replica e il default di 10 si arriva a 200 contro le 100 di un Postgres
    // non riconfigurato, che smette di accettare connessioni. Il default resta
    // 10 (quello di `pg`) per non cambiare il comportamento attuale.
    // Con molte replica la risposta giusta è PgBouncer in transaction mode:
    // l'adapter non passa `statementNameGenerator`, quindi non usa prepared
    // statement con nome ed è compatibile senza altre modifiche.
    max: Number(process.env.DATABASE_POOL_MAX ?? '10'),
    // 0 è il default di `pg`: attesa illimitata di una connessione libera.
    // Sotto picco significa richieste appese a tempo indefinito, ognuna delle
    // quali tiene occupato un worker Node. In produzione conviene un valore
    // finito, così la richiesta fallisce presto e libera il worker.
    connectionTimeoutMillis: Number(process.env.DATABASE_POOL_TIMEOUT_MS ?? '0'),
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? creaClient();

// In sviluppo il hot reload di Next ricrea i moduli a ogni modifica: senza
// questa cache si aprirebbe un pool di connessioni nuovo a ogni ricompilazione.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
