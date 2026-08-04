import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type UrlDatabase = string;

let container: StartedPostgreSqlContainer | undefined;

/**
 * Avvia un Postgres effimero e restituisce la sua connection string.
 * Il container e condiviso da tutti i test di integrazione: `fileParallelism`
 * e disattivato in vitest.config.ts perche i test non si calpestino.
 */
export async function avviaPostgres(): Promise<UrlDatabase> {
  if (!container) {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('citta_semplice_test')
      .withUsername('test')
      .withPassword('test')
      .start();
  }
  return container.getConnectionUri();
}

export async function fermaPostgres(): Promise<void> {
  await container?.stop();
  container = undefined;
}

/**
 * Applica lo schema al database indicato eseguendo `prisma migrate deploy`,
 * NON `prisma db push`.
 *
 * Il motivo e il DSL di Prisma: non esprime CHECK constraint, trigger ne
 * indici GIN. `db push` costruisce il database leggendo solo il modello
 * dichiarativo, quindi qualunque oggetto esista soltanto come SQL grezzo in
 * una migrazione (vincoli CHECK oggi, trigger e indici GIN nei prossimi
 * piani) semplicemente non verrebbe creato: i test passerebbero contro un
 * database piu "povero" di quello di produzione, mascherando differenze di
 * comportamento reali. `migrate deploy` applica invece la storia delle
 * migrazioni cosi come e stata scritta, quindi il database di test
 * corrisponde a quello di produzione, oggetti in SQL grezzo inclusi.
 *
 * Dettagli di invocazione (Prisma 7.7.0, verificati con
 * `npx prisma migrate deploy --help` e con esecuzioni manuali contro
 * container usa-e-getta):
 * - `migrate deploy` non ha un flag `--url`: l'URL puo arrivare solo da
 *   `DATABASE_URL` letto dentro un file di configurazione Prisma
 *   (`prisma.config.ts`), non da env puro senza config;
 * - il file di configurazione NON viene individuato automaticamente in base
 *   alla posizione di `--schema` quando il processo gira da una working
 *   directory diversa (qui la radice del repo): va indicato esplicitamente
 *   con `--config`. Per convenzione in questo repo un `prisma.config.ts` sta
 *   nella cartella progetto, un livello sopra `prisma/schema.prisma` (vedi
 *   `citta-semplice-office/prisma.config.ts` e
 *   `citta-semplice-portal/prisma.config.ts`): se esiste in quella
 *   posizione relativa a `percorsoSchema` lo usiamo, altrimenti si prosegue
 *   senza (caso in cui lo schema stesso definisce l'URL, o non serve).
 *
 * Nota per il Task 4: quando schema e migrazioni si sposteranno in
 * `packages/db/prisma/`, questa convenzione (`prisma.config.ts` un livello
 * sopra `prisma/schema.prisma`) deve continuare a valere, oppure va
 * aggiornata qui.
 */
export async function applicaSchema(url: UrlDatabase, percorsoSchema: string): Promise<void> {
  const args = ['prisma', 'migrate', 'deploy', '--schema', percorsoSchema];

  const percorsoConfig = resolve(dirname(percorsoSchema), '..', 'prisma.config.ts');
  if (existsSync(percorsoConfig)) {
    args.push('--config', percorsoConfig);
  }

  execFileSync('npx', args, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
}
