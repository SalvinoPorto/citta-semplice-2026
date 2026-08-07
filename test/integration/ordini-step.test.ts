import { describe, it, expect, beforeAll, beforeEach, afterAll, inject } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let client: Client;

/**
 * La migrazione gira su un database vuoto, quindi deduplica e rinumerazione
 * non toccano alcuna riga: per verificarle davvero bisogna costruire i dati
 * e poi rieseguire il file REALE, non una sua copia ridigitata qui.
 */
const PERCORSO_MIGRAZIONE = resolve(
  process.cwd(),
  'packages/db/prisma/migrations',
);

function sqlMigrazione(): string {
  const { readdirSync } = require('node:fs') as typeof import('node:fs');
  const cartella = readdirSync(PERCORSO_MIGRAZIONE)
    .filter((d) => d.endsWith('_step_unique_servizio_ordine'))
    .sort()
    .at(-1);
  if (!cartella) throw new Error('Migrazione step_unique_servizio_ordine non trovata');
  return readFileSync(resolve(PERCORSO_MIGRAZIONE, cartella, 'migration.sql'), 'utf-8');
}

beforeAll(async () => {
  client = new Client({ connectionString: inject('urlPostgres') });
  await client.connect();
});

afterAll(async () => {
  await client?.end();
});

/** Crea area, servizio, ufficio e due fasi. Restituisce gli id. */
async function creaServizioConDueFasi(suffisso: string) {
  const area = await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ($1, $2) RETURNING id`,
    [`Area ${suffisso}`, `area-${suffisso}`],
  );
  const servizio = await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ($1, $2, $3) RETURNING id`,
    [`Servizio ${suffisso}`, `servizio-${suffisso}`, area.rows[0].id],
  );
  const ufficio = await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ($1) RETURNING id`,
    [`Ufficio ${suffisso}`],
  );
  const servizioId = servizio.rows[0].id;
  const fasi: number[] = [];
  for (const ordine of [1, 2]) {
    const f = await client.query<{ id: number }>(
      `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [`Fase ${ordine} ${suffisso}`, ordine, servizioId, ufficio.rows[0].id],
    );
    fasi.push(f.rows[0].id);
  }
  return { servizioId, faseA: fasi[0], faseB: fasi[1] };
}

async function creaStep(servizioId: number, faseId: number, ordine: number, attivo = true) {
  const res = await client.query<{ id: number }>(
    `INSERT INTO steps (descrizione, ordine, attivo, servizio_id, fase_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [`Step ${ordine}`, ordine, attivo, servizioId, faseId],
  );
  return res.rows[0].id;
}

describe('deduplica e vincolo sugli ordini degli step', () => {
  // `beforeAll` applica l'intera storia delle migrazioni, inclusa questa,
  // tramite `prisma migrate deploy`: l'indice univoco esiste quindi già,
  // dal file REALE, prima che qualunque `it()` inizi (su una tabella vuota,
  // quindi senza errori). Per ricostruire lo stato "subito prima" della
  // migrazione — necessario per costruire dati in conflitto e poi vederli
  // sanare dalla riesecuzione del file — ogni test rimuove qui l'indice che
  // `beforeAll` ha già creato, esattamente come stato-istanza.test.ts
  // ricrea le colonne booleane già eliminate dalla propria migrazione.
  beforeEach(async () => {
    await client.query(`DROP INDEX IF EXISTS "steps_servizio_id_ordine_attivi_key"`);
  });

  it('rimuove i duplicati riproducendo il caso difficile', async () => {
    const { servizioId, faseA } = await creaServizioConDueFasi('duplicati');
    // Tre step allo stesso ordine, più un quarto già a 2: è il controesempio
    // per cui una deduplica che sposta i soli duplicati fallisce.
    await creaStep(servizioId, faseA, 1);
    await creaStep(servizioId, faseA, 1);
    await creaStep(servizioId, faseA, 1);
    await creaStep(servizioId, faseA, 2);

    await client.query(sqlMigrazione());

    const { rows } = await client.query<{ ordine: number; conta: string }>(
      `SELECT ordine, COUNT(*) AS conta FROM steps
       WHERE servizio_id = $1 AND attivo = true
       GROUP BY ordine HAVING COUNT(*) > 1`,
      [servizioId],
    );
    expect(rows).toEqual([]);
  });

  it('mantiene la numerazione GLOBALE sul servizio, non per fase', async () => {
    const { servizioId, faseA, faseB } = await creaServizioConDueFasi('globale');
    await creaStep(servizioId, faseA, 1);
    await creaStep(servizioId, faseA, 2);
    await creaStep(servizioId, faseB, 3);

    await client.query(sqlMigrazione());

    // Il punto che il tentativo precedente aveva sbagliato: rinumerando per
    // fase, faseB ripartirebbe da 1 e collidrebbe con faseA. Gli ordini devono
    // restare distinti fra TUTTE le fasi dello stesso servizio.
    const { rows } = await client.query<{ ordine: number; fase_id: number }>(
      `SELECT ordine, fase_id FROM steps
       WHERE servizio_id = $1 AND attivo = true ORDER BY ordine`,
      [servizioId],
    );
    const ordini = rows.map((r) => r.ordine);
    expect(new Set(ordini).size).toBe(ordini.length);
    expect(new Set(rows.map((r) => r.fase_id)).size).toBe(2);
  });

  it('rifiuta due step ATTIVI con la stessa coppia (servizio, ordine)', async () => {
    const { servizioId, faseA } = await creaServizioConDueFasi('vincolo');
    await creaStep(servizioId, faseA, 1);
    await client.query(sqlMigrazione());
    await expect(creaStep(servizioId, faseA, 1)).rejects.toMatchObject({ code: '23505' });
  });

  it('consente due step DISATTIVATI con la stessa coppia: l indice è parziale', async () => {
    const { servizioId, faseA } = await creaServizioConDueFasi('parziale');
    await client.query(sqlMigrazione());
    await creaStep(servizioId, faseA, 0, false);
    await expect(creaStep(servizioId, faseA, 0, false)).resolves.toBeTypeOf('number');
  });
});
