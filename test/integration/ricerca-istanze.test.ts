import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { Client } from 'pg';

/**
 * `istanze.ricerca` e i suoi due trigger (20260813100000_ricerca_istanze).
 *
 * Sono esattamente il genere di oggetto che questi test esistono per coprire:
 * vivono solo come SQL grezzo in una migrazione, il DSL di Prisma non li vede,
 * e una colonna denormalizzata che smette di aggiornarsi non rompe niente in
 * modo rumoroso — semplicemente certe istanze spariscono dalla ricerca.
 */

let client: Client;

beforeAll(async () => {
  client = new Client({ connectionString: inject('urlPostgres') });
  await client.connect();
});

afterAll(async () => {
  await client?.end();
});

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

async function inserisciIstanza(suffisso: string, dati: string | null) {
  const { servizioId, utenteId } = await creaDipendenze(suffisso);
  const res = await client.query<{ id: number; ricerca: string }>(
    `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, dati)
     VALUES ($1, now(), $2, $3, $4) RETURNING id, ricerca`,
    [`PROTO-${suffisso}`, utenteId, servizioId, dati],
  );
  return { ...res.rows[0], utenteId };
}

const DATI = JSON.stringify([
  { name: 'iban', label: 'IBAN del beneficiario', value: 'IT60X054281' },
  { name: 'importo', label: 'Importo', value: 42 },
]);

describe('istanze.ricerca', () => {
  it('viene popolata all INSERT con anagrafica utente e valori del modulo', async () => {
    const { ricerca } = await inserisciIstanza('ins', DATI);

    expect(ricerca).toContain('cfins');       // codice fiscale
    expect(ricerca).toContain('mario');       // nome
    expect(ricerca).toContain('rossi');       // cognome
    expect(ricerca).toContain('it60x054281'); // valore del modulo, in minuscolo
    expect(ricerca).toContain('42');          // i valori non stringa non si perdono
  });

  it('NON indicizza chiavi e label del modulo', async () => {
    // Sono identiche su tutte le istanze dello stesso servizio: gonfierebbero
    // l'indice e cercando "IBAN" tornerebbe l'intero servizio.
    const { ricerca } = await inserisciIstanza('label', DATI);

    expect(ricerca).not.toContain('iban');
    expect(ricerca).not.toContain('beneficiario');
  });

  it('si ricalcola quando cambia `dati`', async () => {
    const { id } = await inserisciIstanza('upd', DATI);

    const res = await client.query<{ ricerca: string }>(
      `UPDATE istanze SET dati = $1 WHERE id = $2 RETURNING ricerca`,
      [JSON.stringify([{ name: 'iban', label: 'IBAN', value: 'VALORENUOVO' }]), id],
    );

    expect(res.rows[0].ricerca).toContain('valorenuovo');
    expect(res.rows[0].ricerca).not.toContain('it60x054281');
    expect(res.rows[0].ricerca).toContain('rossi'); // l'anagrafica resta
  });

  it('si propaga alle istanze quando il cittadino cambia cognome', async () => {
    const { id, utenteId } = await inserisciIstanza('rinomina', DATI);

    await client.query(`UPDATE utenti SET cognome = 'Bianchi' WHERE id = $1`, [utenteId]);

    const res = await client.query<{ ricerca: string }>(
      `SELECT ricerca FROM istanze WHERE id = $1`,
      [id],
    );
    expect(res.rows[0].ricerca).toContain('bianchi');
    expect(res.rows[0].ricerca).not.toContain('rossi');
  });

  it('non azzera l assegnatario quando si propaga dal cittadino', async () => {
    // `assegnatario_al_cambio_fase` scatta su ogni UPDATE di istanze: deve
    // reagire solo a fase_corrente_id, non all UPDATE fatto dal trigger 2.
    const { id, utenteId } = await inserisciIstanza('assegn', DATI);
    const op = await client.query<{ id: number }>(
      // `updated_at` è @updatedAt lato Prisma, quindi NOT NULL senza default:
      // in SQL grezzo va valorizzato a mano.
      `INSERT INTO operatori (email, password, nome, cognome, user_name, updated_at)
       VALUES ('a@b.c', 'x', 'Op', 'Uno', $1, now()) RETURNING id`,
      [`op-assegn-${Date.now()}`],
    );
    await client.query(`UPDATE istanze SET assegnatario_id = $1 WHERE id = $2`, [op.rows[0].id, id]);

    await client.query(`UPDATE utenti SET nome = 'Giuseppe' WHERE id = $1`, [utenteId]);

    const res = await client.query<{ assegnatario_id: number | null }>(
      `SELECT assegnatario_id FROM istanze WHERE id = $1`,
      [id],
    );
    expect(res.rows[0].assegnatario_id).toBe(op.rows[0].id);
  });

  it('non fa fallire la scrittura se `dati` non e JSON valido', async () => {
    // Il codice applicativo tratta `dati` come potenzialmente malformato
    // (try/catch ovunque): un trigger piu severo trasformerebbe un dato sporco
    // in un invio di istanza fallito.
    const { ricerca } = await inserisciIstanza('rotto', 'questo{{{ non e json');

    expect(ricerca).toContain('questo{{{ non e json');
    expect(ricerca).toContain('rossi');
  });

  it('gestisce `dati` a NULL senza perdere l anagrafica', async () => {
    const { ricerca } = await inserisciIstanza('nullo', null);

    expect(ricerca).toContain('rossi');
  });

  it('ha l indice GIN trigram che rende servibile la ricerca', async () => {
    const res = await client.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'istanze' AND indexname = 'istanze_ricerca_trgm'`,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].indexdef).toContain('gin_trgm_ops');
  });
});
