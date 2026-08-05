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

  it('crea l indice su stato usato dai filtri di visibilità', async () => {
    // Fino alla migrazione di contrazione (20260805110000) l'esclusività fra
    // "conclusa" e "respinta" era garantita dal vincolo CHECK
    // istanze_stato_esclusivo_chk: questo test verificava quel comportamento
    // inserendo una riga incoerente. Il vincolo e le colonne booleane non
    // esistono più (test/integration/stato-istanza.test.ts lo verifica
    // esplicitamente), e l'esclusività è oggi garantita dal tipo enum — una
    // proprietà già coperta lì dal test "rifiuta un valore di stato non
    // previsto dall enum". Ripetere lo stesso controllo qui sotto un nome
    // diverso sarebbe un duplicato mascherato da copertura, non copertura
    // vera. Al suo posto verifichiamo una proprietà di schema che nessun
    // altro test copre: l'indice su "stato" (creato dalla migrazione
    // 20260805100000_stato_istanza_enum), da cui dipendono le query di
    // whereStato/whereVisibileAgliOperatori usate da office e portal.
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'istanze' AND indexname = 'istanze_stato_idx'`,
      );
      expect(rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  });
});
