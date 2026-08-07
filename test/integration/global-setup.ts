import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';
import { applicaSchema } from './postgres';

/**
 * Un solo container Postgres per l'INTERA suite di integrazione.
 *
 * Con il pool `forks` di Vitest 3 ogni file di test ottiene un registry di
 * moduli nuovo: una variabile a livello di modulo non sopravvive fra file, e
 * infatti prima di questo setup ogni file avviava il proprio container (~10 s
 * l'uno). `globalSetup` gira invece una volta sola nel processo principale, e
 * `provide` è il canale con cui passa un valore ai file di test, che lo
 * leggono con `inject`.
 *
 * Lo schema si applica QUI, una volta: i file di test trovano il database già
 * migrato. `fileParallelism: false` (in vitest.config.ts) resta necessario —
 * ora non per evitare container concorrenti ma perché i file condividono lo
 * stesso database e non devono scriverci in parallelo.
 */
export default async function setup(project: TestProject) {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('citta_semplice_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const url = container.getConnectionUri();
  await applicaSchema(url, resolve(process.cwd(), 'packages/db/prisma/schema.prisma'));

  project.provide('urlPostgres', url);

  return async () => {
    await container.stop();
  };
}

declare module 'vitest' {
  interface ProvidedContext {
    urlPostgres: string;
  }
}
