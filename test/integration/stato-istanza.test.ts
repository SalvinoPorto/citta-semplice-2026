import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
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

async function inserisciIstanza(
  suffisso: string,
  flag: { in_bozza?: boolean; conclusa?: boolean; respinta?: boolean },
): Promise<number> {
  const { servizioId, utenteId } = await creaDipendenze(suffisso);
  const res = await client.query<{ id: number }>(
    `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, in_bozza, conclusa, respinta)
     VALUES ($1, now(), $2, $3, $4, $5, $6) RETURNING id`,
    [
      `PROTO-${suffisso}`,
      utenteId,
      servizioId,
      flag.in_bozza ?? false,
      flag.conclusa ?? false,
      flag.respinta ?? false,
    ],
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

  it('l espressione di backfill deriva lo stato dai tre booleani', async () => {
    // La migrazione ha già girato su un database vuoto, quindi il backfill non
    // ha toccato alcuna riga: eseguirlo di nuovo su righe costruite ora è
    // l'unico modo di verificarne davvero la mappatura. L'espressione qui
    // sotto deve restare identica a quella della migrazione.
    const casi: Array<[string, { in_bozza?: boolean; conclusa?: boolean; respinta?: boolean }, string]> = [
      ['bozza', { in_bozza: true }, 'BOZZA'],
      ['conclusa', { conclusa: true }, 'CONCLUSA'],
      ['respinta', { respinta: true }, 'RESPINTA'],
      ['lavorazione', {}, 'IN_LAVORAZIONE'],
    ];

    const ids: Array<[number, string, string]> = [];
    for (const [suffisso, flag, atteso] of casi) {
      ids.push([await inserisciIstanza(suffisso, flag), suffisso, atteso]);
    }

    // Sporca deliberatamente `stato` su tutte le righe, così il DEFAULT non
    // può far passare il test per caso: se il backfill non funzionasse,
    // resterebbero tutte a 'RESPINTA' e tre casi su quattro fallirebbero.
    await client.query(`UPDATE istanze SET stato = 'RESPINTA'`);

    await client.query(`
      UPDATE istanze SET stato = CASE
        WHEN in_bozza THEN 'BOZZA'::"StatoIstanza"
        WHEN conclusa THEN 'CONCLUSA'::"StatoIstanza"
        WHEN respinta THEN 'RESPINTA'::"StatoIstanza"
        ELSE 'IN_LAVORAZIONE'::"StatoIstanza"
      END
    `);

    for (const [id, suffisso, atteso] of ids) {
      const { rows } = await client.query<{ stato: string }>(
        `SELECT stato FROM istanze WHERE id = $1`,
        [id],
      );
      expect(rows[0].stato, `caso ${suffisso}`).toBe(atteso);
    }
  });

  it('la colonna stato ha IN_LAVORAZIONE come default', async () => {
    const id = await inserisciIstanza('default', {});
    const { rows } = await client.query<{ stato: string }>(
      `SELECT stato FROM istanze WHERE id = $1`,
      [id],
    );
    expect(rows[0].stato).toBe('IN_LAVORAZIONE');
  });

  it('il vincolo di esclusività sui booleani è ancora attivo', async () => {
    const { servizioId, utenteId } = await creaDipendenze('esclusivo');
    await expect(
      client.query(
        `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, conclusa, respinta)
         VALUES ('PROTO-ESCL', now(), $1, $2, true, true)`,
        [utenteId, servizioId],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'istanze_stato_esclusivo_chk' });
  });
});
