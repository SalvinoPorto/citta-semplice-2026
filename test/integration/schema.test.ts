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

  it('impedisce a una istanza di essere insieme conclusa e respinta', async () => {
    // Test di comportamento, non di metadati: il vincolo CHECK
    // istanze_stato_esclusivo_chk viene creato dalla migrazione 0_init
    // (packages/db/prisma/migrations/0_init/migration.sql:611-612),
    // applicata da `migrate deploy` in beforeAll. Qui non rileggiamo il nome
    // del vincolo da pg_constraint: proviamo davvero a violarlo, cosi il test
    // fallisce se il vincolo sparisce o cambia semantica — non solo se cambia
    // nome. Il piano 2 sostituira questo vincolo con StatoIstanza.
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
        `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, conclusa, respinta)
         VALUES ('TEST-0001', now(), $1, $2, true, true)`,
        [utente.rows[0].id, servizio.rows[0].id],
      );

      await expect(inserimentoIncoerente).rejects.toMatchObject({
        code: '23514', // check_violation
        constraint: 'istanze_stato_esclusivo_chk',
      });
    } finally {
      await client.end();
    }
  });
});
