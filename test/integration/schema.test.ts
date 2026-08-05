import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { resolve } from 'node:path';
import { avviaPostgres, fermaPostgres, applicaSchema, type UrlDatabase } from './postgres';

let url: UrlDatabase;

// Lo schema canonico e le sue migrazioni vivono in packages/db/prisma/
// (5 cartelle + migration_lock.toml), consumato da office e portal tramite
// il package @citta/db. applicaSchema usa `migrate deploy`, che richiede
// una storia di migrazioni da applicare.
const percorsoSchema = resolve(process.cwd(), 'packages/db/prisma/schema.prisma');

beforeAll(async () => {
  url = await avviaPostgres();
  applicaSchema(url, percorsoSchema);
}, 120_000);

afterAll(async () => {
  await fermaPostgres();
});

describe('schema Prisma', () => {
  it('si applica a un database vuoto e crea le tabelle del dominio', async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const tabelle = rows.map((r) => r.table_name);
      expect(tabelle).toContain('istanze');
      expect(tabelle).toContain('servizi');
      expect(tabelle).toContain('workflows');
      expect(tabelle).toContain('fasi');
      expect(tabelle).toContain('steps');
    } finally {
      await client.end();
    }
  });

  it('impedisce a una istanza di avere uno stato fuori dall enum StatoIstanza', async () => {
    // Test di comportamento, non di metadati. Fino alla migrazione di
    // contrazione (20260805110000_stato_istanza_contrazione) l'esclusività
    // fra "conclusa" e "respinta" era garantita dal vincolo CHECK
    // istanze_stato_esclusivo_chk sui tre booleani; quella migrazione lo
    // elimina insieme alle colonne (le colonne e il vincolo non esistono
    // più: vedi test/integration/stato-istanza.test.ts, che lo verifica
    // esplicitamente). Con l'enum l'esclusività è garantita dal tipo:
    // qui proviamo a scrivere davvero uno stato fuori enum e ci aspettiamo
    // che Postgres lo rifiuti a livello di tipo, non di CHECK.
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const area = await client.query<{ id: number }>(
        `INSERT INTO aree (nome) VALUES ('Area di test') RETURNING id`,
      );
      const servizio = await client.query<{ id: number }>(
        `INSERT INTO servizi (titolo, area_id) VALUES ('Servizio di test', $1) RETURNING id`,
        [area.rows[0].id],
      );
      const utente = await client.query<{ id: number }>(
        `INSERT INTO utenti (codice_fiscale, nome, cognome) VALUES ('TSTTST00A00A000A', 'Test', 'Test') RETURNING id`,
      );

      const inserimentoIncoerente = client.query(
        `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, stato)
         VALUES ('TEST-0001', now(), $1, $2, 'SOSPESA')`,
        [utente.rows[0].id, servizio.rows[0].id],
      );

      await expect(inserimentoIncoerente).rejects.toMatchObject({
        code: '22P02', // invalid_text_representation
      });
    } finally {
      await client.end();
    }
  });
});
