import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { avviaPostgres, fermaPostgres, applicaSchema, type UrlDatabase } from './postgres';

let url: UrlDatabase;
let client: Client;

beforeAll(async () => {
  url = await avviaPostgres();
  await applicaSchema(url, resolve(process.cwd(), 'packages/db/prisma/schema.prisma'));
  client = new Client({ connectionString: url });
  await client.connect();
}, 180_000);

afterAll(async () => {
  await client?.end();
  await fermaPostgres();
});

/** Crea le righe di appoggio necessarie a inserire un'istanza. Restituisce gli id. */
async function creaDipendenze(suffisso: string) {
  const area = await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ($1, $2) RETURNING id`,
    [`Area ${suffisso}`, `area-${suffisso}`],
  );
  const servizio = await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ($1, $2, $3) RETURNING id`,
    [`Servizio ${suffisso}`, `servizio-${suffisso}`, area.rows[0].id],
  );
  const utente = await client.query<{ id: number }>(
    `INSERT INTO utenti (codice_fiscale, nome, cognome) VALUES ($1, $2, $3) RETURNING id`,
    [`CF${suffisso}`.padEnd(16, 'X'), 'Mario', 'Rossi'],
  );
  return { servizioId: servizio.rows[0].id, utenteId: utente.rows[0].id };
}

/** I booleani non esistono più: l'istanza si inserisce col solo `stato` (o il suo DEFAULT). */
async function inserisciIstanza(suffisso: string): Promise<number> {
  const { servizioId, utenteId } = await creaDipendenze(suffisso);
  const res = await client.query<{ id: number }>(
    `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id)
     VALUES ($1, now(), $2, $3) RETURNING id`,
    [`PROTO-${suffisso}`, utenteId, servizioId],
  );
  return res.rows[0].id;
}

describe('enum StatoIstanza', () => {
  it('esiste come tipo con i quattro valori attesi', async () => {
    const { rows } = await client.query<{ enumlabel: string }>(
      `SELECT enumlabel FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'StatoIstanza' ORDER BY e.enumsortorder`,
    );
    expect(rows.map((r) => r.enumlabel)).toEqual([
      'BOZZA',
      'IN_LAVORAZIONE',
      'CONCLUSA',
      'RESPINTA',
    ]);
  });

  it('la colonna stato ha IN_LAVORAZIONE come default', async () => {
    const id = await inserisciIstanza('default');
    const { rows } = await client.query<{ stato: string }>(
      `SELECT stato FROM istanze WHERE id = $1`,
      [id],
    );
    expect(rows[0].stato).toBe('IN_LAVORAZIONE');
  });

  it('rifiuta un valore di stato non previsto dall enum', async () => {
    const { servizioId, utenteId } = await creaDipendenze('invalido');
    await expect(
      client.query(
        `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, stato)
         VALUES ('PROTO-INV', now(), $1, $2, 'SOSPESA')`,
        [utenteId, servizioId],
      ),
    ).rejects.toMatchObject({ code: '22P02' }); // invalid_text_representation
  });

  it('le colonne booleane non esistono più', async () => {
    const { rows } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'istanze'`,
    );
    const colonne = rows.map((r) => r.column_name);
    expect(colonne).not.toContain('in_bozza');
    expect(colonne).not.toContain('conclusa');
    expect(colonne).not.toContain('respinta');
    expect(colonne).toContain('stato');
  });

  it('il riallineamento della migrazione di contrazione deriva "stato" da booleani divergenti', async () => {
    // La migrazione di contrazione (20260805110000_stato_istanza_contrazione)
    // riesegue il backfill PRIMA di eliminare i booleani, per riallineare le
    // righe nate nella finestra fra l'espansione (Task 1) e la conversione
    // del portale (Task 4): quella finestra poteva produrre bozze con
    // `in_bozza=true` ma `stato` ancora al DEFAULT `IN_LAVORAZIONE`.
    //
    // La migrazione gira su un database vuoto (questo harness applica tutta
    // la storia delle migrazioni in beforeAll), quindi non c'è nulla da
    // osservare a posteriori sull'effetto reale del backfill. Per non
    // verificare sé stesso invece della migrazione, questo test NON
    // ridigita l'espressione SQL: legge il file di migrazione reale da
    // disco e lo esegue per intero contro una riga costruita apposta per
    // simulare la divergenza. Se qualcuno rimuovesse o alterasse l'UPDATE di
    // riallineamento nel file, questo test lo scoprirebbe — una copia
    // manuale nel test non l'avrebbe fatto.
    const percorsoMigrazione = resolve(
      process.cwd(),
      'packages/db/prisma/migrations/20260805110000_stato_istanza_contrazione/migration.sql',
    );
    const sqlMigrazione = readFileSync(percorsoMigrazione, 'utf-8');

    // Il file esegue anche i DROP COLUMN: li ricreiamo qui per simulare lo
    // stato del database subito PRIMA di questa migrazione. Un solo
    // ALTER TABLE con tre ADD COLUMN è atomico — se una clausola fallisse
    // nessuna delle tre resterebbe applicata, quindi non c'è uno stato
    // parziale da ripulire in caso di errore qui.
    await client.query(`
      ALTER TABLE istanze
        ADD COLUMN in_bozza boolean NOT NULL DEFAULT false,
        ADD COLUMN conclusa boolean NOT NULL DEFAULT false,
        ADD COLUMN respinta boolean NOT NULL DEFAULT false
    `);

    try {
      const { servizioId, utenteId } = await creaDipendenze('divergente');
      const inserimento = await client.query<{ id: number }>(
        `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, stato, in_bozza)
         VALUES ('PROTO-DIVERGENTE', now(), $1, $2, 'IN_LAVORAZIONE', true) RETURNING id`,
        [utenteId, servizioId],
      );
      const id = inserimento.rows[0].id;

      // Esegue il file di migrazione REALE (non una copia): contiene sia
      // l'UPDATE di riallineamento sia i tre DROP COLUMN finali, quindi
      // eseguirlo qui rimette anche il database nello stato "colonne
      // sparite" atteso dal resto della suite — il `finally` sotto non deve
      // ripetere quei DROP nel percorso di successo.
      await client.query(sqlMigrazione);

      const { rows } = await client.query<{ stato: string }>(
        `SELECT stato FROM istanze WHERE id = $1`,
        [id],
      );
      expect(rows[0].stato).toBe('BOZZA');
    } finally {
      // Rete di sicurezza solo per il percorso di fallimento: se qualcosa è
      // andato storto prima che `sqlMigrazione` arrivasse ai suoi DROP
      // COLUMN, non lasciamo le colonne booleane fantasma per i test
      // successivi. Nel percorso di successo sono già sparite: IF EXISTS
      // rende l'operazione un no-op.
      await client.query(`
        ALTER TABLE istanze
          DROP COLUMN IF EXISTS in_bozza,
          DROP COLUMN IF EXISTS conclusa,
          DROP COLUMN IF EXISTS respinta
      `);
    }
  });
});
