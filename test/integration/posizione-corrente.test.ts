import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let client: Client;

beforeAll(async () => {
  client = new Client({ connectionString: inject('urlPostgres') });
  await client.connect();
});

afterAll(async () => {
  await client?.end();
});

/** Crea area, servizio, due fasi con un ufficio ciascuna, un utente e un operatore. */
async function creaScenario(suffisso: string) {
  const ufficioA = await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ($1) RETURNING id`, [`Ufficio A ${suffisso}`]);
  const ufficioB = await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ($1) RETURNING id`, [`Ufficio B ${suffisso}`]);
  const area = await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ($1, $2) RETURNING id`, [`Area ${suffisso}`, `area-${suffisso}`]);
  const servizio = await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ($1, $2, $3) RETURNING id`,
    [`Servizio ${suffisso}`, `servizio-${suffisso}`, area.rows[0].id]);
  const faseUno = await client.query<{ id: number }>(
    `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ('Prima', 1, $1, $2) RETURNING id`,
    [servizio.rows[0].id, ufficioA.rows[0].id]);
  const faseDue = await client.query<{ id: number }>(
    `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ('Seconda', 2, $1, $2) RETURNING id`,
    [servizio.rows[0].id, ufficioB.rows[0].id]);
  const utente = await client.query<{ id: number }>(
    `INSERT INTO utenti (codice_fiscale, nome, cognome) VALUES ($1, 'Mario', 'Rossi') RETURNING id`,
    [`CF${suffisso}`.padEnd(16, 'X')]);
  // `operatori` richiede email, password, nome, cognome e user_name (NON
  // `username`): vedi packages/db/prisma/schema.prisma:49-56. `updated_at` è
  // NOT NULL senza DEFAULT: `@updatedAt` di Prisma è valorizzato dal CLIENT,
  // non dal database, quindi un INSERT in SQL grezzo deve passarlo a mano.
  const operatore = await client.query<{ id: number }>(
    `INSERT INTO operatori (email, password, nome, cognome, user_name, updated_at)
     VALUES ($1, 'x', 'Anna', 'Bianchi', $2, now()) RETURNING id`,
    [`op-${suffisso}@test.it`, `op-${suffisso}`]);
  return {
    servizioId: servizio.rows[0].id,
    faseUnoId: faseUno.rows[0].id,
    faseDueId: faseDue.rows[0].id,
    utenteId: utente.rows[0].id,
    operatoreId: operatore.rows[0].id,
  };
}

async function creaIstanza(s: { servizioId: number; utenteId: number; faseUnoId: number }, suffisso: string) {
  const res = await client.query<{ id: number }>(
    `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, fase_corrente_id)
     VALUES ($1, now(), $2, $3, $4) RETURNING id`,
    [`PROTO-${suffisso}`, s.utenteId, s.servizioId, s.faseUnoId]);
  return res.rows[0].id;
}

async function creaStep(faseId: number, servizioId: number, ordine: number) {
  const res = await client.query<{ id: number }>(
    `INSERT INTO steps (descrizione, ordine, fase_id, servizio_id, attivo)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [`Step ${ordine}`, ordine, faseId, servizioId]);
  return res.rows[0].id;
}

describe('attivita_corrente_id', () => {
  it('viene impostata dal trigger a ogni inserimento di attività, senza che nessuno la scriva', async () => {
    const s = await creaScenario('corrente');
    const istanzaId = await creaIstanza(s, 'corrente');
    const stepId = await creaStep(s.faseUnoId, s.servizioId, 1);

    const prima = await client.query<{ id: number }>(
      `INSERT INTO istanza_attivita (istanza_id, step_id, data_variazione) VALUES ($1, $2, now()) RETURNING id`,
      [istanzaId, stepId]);
    const dopo = await client.query<{ id: number }>(
      `INSERT INTO istanza_attivita (istanza_id, step_id, data_variazione) VALUES ($1, $2, now()) RETURNING id`,
      [istanzaId, stepId]);

    const { rows } = await client.query<{ attivita_corrente_id: number }>(
      `SELECT attivita_corrente_id FROM istanze WHERE id = $1`, [istanzaId]);
    expect(rows[0].attivita_corrente_id).toBe(dopo.rows[0].id);
    expect(rows[0].attivita_corrente_id).not.toBe(prima.rows[0].id);
  });

  it('è unica: la stessa attività non può essere corrente per due istanze', async () => {
    const s = await creaScenario('unica');
    const istanzaUno = await creaIstanza(s, 'unica-1');
    const istanzaDue = await creaIstanza(s, 'unica-2');
    const stepId = await creaStep(s.faseUnoId, s.servizioId, 1);
    const attivita = await client.query<{ id: number }>(
      `INSERT INTO istanza_attivita (istanza_id, step_id, data_variazione) VALUES ($1, $2, now()) RETURNING id`,
      [istanzaUno, stepId]);

    await expect(
      client.query(`UPDATE istanze SET attivita_corrente_id = $1 WHERE id = $2`,
        [attivita.rows[0].id, istanzaDue]),
    ).rejects.toMatchObject({ code: '23505' }); // unique_violation
  });
});

describe('assegnatario_id', () => {
  it('resta invariato quando cambia qualcosa che non è la fase corrente', async () => {
    const s = await creaScenario('invariato');
    const istanzaId = await creaIstanza(s, 'invariato');
    await client.query(`UPDATE istanze SET assegnatario_id = $1 WHERE id = $2`, [s.operatoreId, istanzaId]);

    await client.query(`UPDATE istanze SET proto_numero = 'ALTRO' WHERE id = $1`, [istanzaId]);

    const { rows } = await client.query<{ assegnatario_id: number | null }>(
      `SELECT assegnatario_id FROM istanze WHERE id = $1`, [istanzaId]);
    expect(rows[0].assegnatario_id).toBe(s.operatoreId);
  });

  it('viene azzerato dal trigger quando cambia la fase corrente', async () => {
    const s = await creaScenario('cambio-fase');
    const istanzaId = await creaIstanza(s, 'cambio-fase');
    await client.query(`UPDATE istanze SET assegnatario_id = $1 WHERE id = $2`, [s.operatoreId, istanzaId]);

    await client.query(`UPDATE istanze SET fase_corrente_id = $1 WHERE id = $2`, [s.faseDueId, istanzaId]);

    const { rows } = await client.query<{ assegnatario_id: number | null }>(
      `SELECT assegnatario_id FROM istanze WHERE id = $1`, [istanzaId]);
    expect(rows[0].assegnatario_id).toBeNull();
  });

  it('NON viene azzerato quando la fase corrente passa da NULL a una fase', async () => {
    // `takeCharge` valorizza la fase corrente delle istanze migrate che ce
    // l'hanno a NULL, nello stesso statement in cui assegna l'operatore:
    // senza la guardia OLD.fase_corrente_id IS NOT NULL quella prima
    // assegnazione verrebbe azzerata nell'atto stesso di crearla.
    const s = await creaScenario('da-null');
    const res = await client.query<{ id: number }>(
      `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id)
       VALUES ('PROTO-DA-NULL', now(), $1, $2) RETURNING id`, [s.utenteId, s.servizioId]);
    const istanzaId = res.rows[0].id;

    await client.query(
      `UPDATE istanze SET assegnatario_id = $1, fase_corrente_id = $2 WHERE id = $3`,
      [s.operatoreId, s.faseUnoId, istanzaId]);

    const { rows } = await client.query<{ assegnatario_id: number | null }>(
      `SELECT assegnatario_id FROM istanze WHERE id = $1`, [istanzaId]);
    expect(rows[0].assegnatario_id).toBe(s.operatoreId);
  });
});

describe('riallineamento della migrazione di contrazione', () => {
  it('valorizza completata_at per le righe nate fra espansione e conversione', async () => {
    // La contrazione riesegue il backfill PRIMA dei DROP, per le righe nate
    // nella finestra fra le due migrazioni. Il database di test ha già
    // applicato tutta la storia, quindi non c'è nulla da osservare a
    // posteriori: si ricostruisce lo stato PRECEDENTE alla contrazione e si
    // esegue il FILE REALE. Ridigitare qui l'UPDATE renderebbe il test
    // verde anche se qualcuno lo rimuovesse dalla migrazione.
    const percorso = resolve(
      process.cwd(),
      'packages/db/prisma/migrations/20260807110000_posizione_corrente_contrazione/migration.sql',
    );
    const sqlMigrazione = readFileSync(percorso, 'utf-8');

    const s = await creaScenario('riallineamento');
    const istanzaId = await creaIstanza(s, 'riallineamento');
    const stepId = await creaStep(s.faseUnoId, s.servizioId, 1);

    // La ricostruzione include anche il NOME della tabella: quando la
    // contrazione girò, `istanza_attivita` si chiamava ancora `workflows` — la
    // rinomina è la migrazione successiva. Il file va eseguito com'è:
    // riscriverlo per farlo funzionare sullo schema di oggi vorrebbe dire
    // testare una migrazione diversa da quella che gira in produzione.
    // Un solo ALTER TABLE con due ADD COLUMN è atomico: non resta uno stato
    // parziale se una clausola fallisce.
    await client.query(`ALTER TABLE istanza_attivita RENAME TO workflows`);
    await client.query(`
      ALTER TABLE workflows
        ADD COLUMN stato integer NOT NULL DEFAULT 0,
        ADD COLUMN operatore_id integer
    `);
    await client.query(`CREATE INDEX istanze_stato_idx ON istanze(stato)`);

    try {
      const attivita = await client.query<{ id: number }>(
        `INSERT INTO workflows (istanza_id, step_id, data_variazione, stato, operatore_id)
         VALUES ($1, $2, now(), 1, $3) RETURNING id`,
        [istanzaId, stepId, s.operatoreId],
      );

      await client.query(sqlMigrazione);

      const { rows } = await client.query<{ completata_at: Date | null; completata_da_id: number | null }>(
        `SELECT completata_at, completata_da_id FROM workflows WHERE id = $1`,
        [attivita.rows[0].id],
      );
      expect(rows[0].completata_at).not.toBeNull();
      expect(rows[0].completata_da_id).toBe(s.operatoreId);
    } finally {
      // Le colonne le ha già eliminate il file di migrazione nel percorso di
      // successo; `IF EXISTS` copre quello di fallimento. Il nome della
      // tabella va invece sempre ripristinato, o i test successivi (e gli
      // altri file della suite, che condividono questo database) troverebbero
      // uno schema diverso da quello delle migrazioni.
      await client.query(`
        ALTER TABLE workflows
          DROP COLUMN IF EXISTS stato,
          DROP COLUMN IF EXISTS operatore_id
      `);
      await client.query(`DROP INDEX IF EXISTS istanze_stato_idx`);
      await client.query(`ALTER TABLE workflows RENAME TO istanza_attivita`);
    }
  });
});
