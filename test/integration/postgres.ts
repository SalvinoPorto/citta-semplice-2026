import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type UrlDatabase = string;

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
 *   `packages/db/prisma.config.ts`, un livello sopra
 *   `packages/db/prisma/schema.prisma`): se esiste in quella posizione
 *   relativa a `percorsoSchema` lo usiamo, altrimenti si prosegue senza
 *   (caso in cui lo schema stesso definisce l'URL, o non serve).
 */
export async function applicaSchema(url: UrlDatabase, percorsoSchema: string): Promise<void> {
  const args = ['prisma', 'migrate', 'deploy', '--schema', percorsoSchema];

  const percorsoConfig = resolve(dirname(percorsoSchema), '..', 'prisma.config.ts');
  if (existsSync(percorsoConfig)) {
    args.push('--config', percorsoConfig);
  }

  try {
    execFileSync('npx', args, {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
  } catch (err) {
    // Con stdio: 'pipe', un fallimento arriva a Vitest come "Command failed"
    // senza lo stderr di Prisma (che spiega il vero motivo): resta solo su
    // `err.stderr`. Lo includiamo esplicitamente nel messaggio, altrimenti
    // ogni fallimento di `migrate deploy` è illeggibile per chi userà questo
    // helper nei piani 2-4.
    const stderr = err && typeof err === 'object' && 'stderr' in err ? String((err as { stderr: unknown }).stderr) : '';
    throw new Error(`prisma migrate deploy fallito:\n${stderr}`, { cause: err });
  }
}
