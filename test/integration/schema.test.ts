import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { Client } from 'pg';

let client: Client;

beforeAll(async () => {
  client = new Client({ connectionString: inject('urlPostgres') });
  await client.connect();
});

afterAll(async () => {
  await client?.end();
});

describe('schema Prisma', () => {
  it('si applica a un database vuoto e crea le tabelle del dominio', async () => {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tabelle = rows.map((r) => r.table_name);
    expect(tabelle).toContain('istanze');
    expect(tabelle).toContain('servizi');
    expect(tabelle).toContain('istanza_attivita');
    expect(tabelle).toContain('fasi');
    expect(tabelle).toContain('steps');
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
    // altro test copre: che le query di whereStato/whereVisibileAgliOperatori
    // usate da office e portal abbiano un indice con "stato" come PRIMA
    // colonna.
    //
    // Non è più `istanze_stato_idx`: la migrazione di contrazione
    // (20260807110000) l'ha eliminato perché era il prefisso di
    // `istanze_stato_assegnatario_id_idx`, mantenuto a ogni scrittura senza
    // che nulla lo usasse. La garanzia che conta — "stato" indicizzato in
    // testa — la dà ora l'indice composito, e questo test la verifica
    // leggendo la colonna di testa invece del nome, così sopravvive alla
    // prossima ricomposizione degli indici.
    const { rows } = await client.query<{ indexname: string }>(
      `SELECT i.relname AS indexname
       FROM pg_index x
       JOIN pg_class i ON i.oid = x.indexrelid
       JOIN pg_class t ON t.oid = x.indrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.indkey[0]
       WHERE t.relname = 'istanze' AND a.attname = 'stato'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
