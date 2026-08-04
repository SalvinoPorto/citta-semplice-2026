import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';

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
 * Applica lo schema Prisma al database indicato con `prisma db push`.
 * Si usa `db push` e non `migrate deploy` perche i test partono sempre da un
 * database vuoto: interessa lo stato finale dello schema, non la storia.
 *
 * Note su Prisma 7.7.0 (verificate con `npx prisma db push --help` e con
 * un'esecuzione manuale contro un container usa-e-getta):
 * - il flag `--skip-generate` non esiste piu, ma non serve: in questa
 *   versione `db push` non rigenera il client da solo (nessuna cartella
 *   `generated/prisma` compare in radice dopo l'esecuzione);
 * - lo schema canonico (`prisma/schema.prisma:13-15`) non ha un
 *   `url = env("DATABASE_URL")` nel blocco datasource ne un
 *   `prisma.config.ts` accanto (quelli esistono solo per office/portal),
 *   quindi il solo env `DATABASE_URL` non basta piu: serve passare `--url`
 *   esplicitamente. Nessuna delle due note tocca la firma della funzione.
 */
export async function applicaSchema(url: UrlDatabase, percorsoSchema: string): Promise<void> {
  execFileSync(
    'npx',
    ['prisma', 'db', 'push', '--schema', percorsoSchema, '--url', url, '--accept-data-loss'],
    { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', shell: process.platform === 'win32' },
  );
}
