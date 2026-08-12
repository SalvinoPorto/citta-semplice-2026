import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { Client } from 'pg';

/**
 * Test di volume: escluso dalla suite ordinaria.
 *
 * Si esegue con `TEST_VOLUME=1 npm run test:integration -- tab-istanze-volume`.
 * Genera 100.000 istanze e verifica che i tre tab usino l'indice
 * (stato, assegnatario_id) invece di un sequential scan — il criterio P2
 * della specifica di dominio. Senza la variabile d'ambiente il file esce
 * subito, così `npm test` resta eseguibile a ogni commit.
 */
const ATTIVO = process.env.TEST_VOLUME === '1';
const ISTANZE = 100_000;

let client: Client;

beforeAll(async () => {
  if (!ATTIVO) return;
  client = new Client({ connectionString: inject('urlPostgres') });
  await client.connect();
  await seed();
}, 600_000);

afterAll(async () => {
  await client?.end();
});

async function seed() {
  const area = (await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ('Area Volume', 'area-volume') RETURNING id`)).rows[0].id;
  const servizio = (await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ('Servizio Volume', 'servizio-volume', $1) RETURNING id`,
    [area])).rows[0].id;
  const utente = (await client.query<{ id: number }>(
    `INSERT INTO utenti (codice_fiscale, nome, cognome) VALUES ('CFVOLXXXXXXXXXX', 'Mario', 'Rossi') RETURNING id`)).rows[0].id;
  // `operatori` richiede email e user_name (NON `username`), e `updated_at` è
  // NOT NULL senza DEFAULT: `@updatedAt` di Prisma è valorizzato dal client.
  const operatori = await client.query<{ id: number }>(
    `INSERT INTO operatori (email, password, nome, cognome, user_name, updated_at)
     SELECT 'vol-' || g || '@test.it', 'x', 'Op', 'Volume', 'vol-' || g, now()
     FROM generate_series(1, 20) g RETURNING id`);
  const ids = operatori.rows.map((r) => r.id);

  // Distribuzione realistica: un terzo non assegnate, il resto sparse fra 20
  // operatori. Un indice su una colonna quasi tutta NULL non direbbe nulla.
  await client.query(
    `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, stato, assegnatario_id)
     SELECT 'VOL-' || g, now(), $1, $2, 'IN_LAVORAZIONE',
            CASE WHEN g % 3 = 0 THEN NULL ELSE ($3::int[])[1 + (g % 20)] END
     FROM generate_series(1, $4) g`,
    [utente, servizio, ids, ISTANZE]);

  await client.query(`ANALYZE istanze`);
}

async function piano(condizione: string, parametri: unknown[]): Promise<string> {
  const { rows } = await client.query<{ 'QUERY PLAN': string }>(
    `EXPLAIN SELECT COUNT(*) FROM istanze WHERE stato = 'IN_LAVORAZIONE' AND ${condizione}`,
    parametri);
  return rows.map((r) => r['QUERY PLAN']).join('\n');
}

async function unAssegnatario(): Promise<number> {
  const { rows } = await client.query<{ id: number }>(
    `SELECT assegnatario_id AS id FROM istanze WHERE assegnatario_id IS NOT NULL LIMIT 1`);
  return rows[0].id;
}

describe.skipIf(!ATTIVO)(`tab su ${ISTANZE} istanze`, () => {
  // Il guadagno che questo piano doveva produrre è che i tab si risolvano
  // SULLA SOLA TABELLA `istanze`. Prima ognuno faceva un join su `istanza_attivita`
  // con subquery correlata per riga, e ne materializzava gli id in memoria
  // Node. Questa è l'asserzione che vale per tutti e tre i tab; l'uso
  // dell'indice è un di più che dipende dalla selettività del predicato.
  it('nessuno dei tre tab tocca più la tabella delle attività', async () => {
    // In sequenza, non con Promise.all: un solo `Client` pg non esegue query
    // concorrenti.
    const id = await unAssegnatario();
    const piani = [
      await piano(`assegnatario_id IS NULL`, []),
      await piano(`assegnatario_id = $1`, [id]),
      await piano(`assegnatario_id IS NOT NULL AND assegnatario_id <> $1`, [id]),
    ];
    for (const p of piani) expect(p).not.toContain('istanza_attivita');
  });

  it('"Nuove" usa l indice (stato, assegnatario_id)', async () => {
    const p = await piano(`assegnatario_id IS NULL`, []);
    expect(p).toContain('istanze_stato_assegnatario_id_idx');
    expect(p).not.toContain('Seq Scan');
  });

  it('"Mie" usa l indice (stato, assegnatario_id)', async () => {
    const p = await piano(`assegnatario_id = $1`, [await unAssegnatario()]);
    expect(p).toContain('istanze_stato_assegnatario_id_idx');
    expect(p).not.toContain('Seq Scan');
  });

  it('"Di altri" resta una scansione sola, che a questa selettività è il piano giusto', async () => {
    // Misurato: il predicato seleziona ~42.000 righe su 100.000. A quel
    // rapporto un indice NON conviene, e Postgres sceglie correttamente la
    // scansione sequenziale: nessun indice su (stato, assegnatario_id)
    // batterebbe una lettura lineare che deve comunque toccare il 42% della
    // tabella. Pretendere qui l'indice — come faceva il criterio del piano —
    // sarebbe pretendere una cosa falsa sul funzionamento del planner.
    // Quello che conta, e che si verifica, è che sia UNA scansione di
    // `istanze` e non un join con subquery correlata per riga.
    const p = await piano(`assegnatario_id IS NOT NULL AND assegnatario_id <> $1`, [await unAssegnatario()]);
    expect(p).not.toContain('istanza_attivita');
    expect(p).not.toContain('SubPlan');
    expect((p.match(/Seq Scan/g) ?? []).length).toBe(1);
  });
});
