import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { Client, Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@citta/db';
import { whereTab } from '../../citta-semplice-office/src/lib/istanze/filtri-tab';

let client: Client;
let prisma: PrismaClient;
let pool: Pool;
let scenario: Awaited<ReturnType<typeof costruisciDataset>>;

beforeAll(async () => {
  const url = inject('urlPostgres');
  client = new Client({ connectionString: url });
  await client.connect();
  // Le righe di appoggio si inseriscono in SQL grezzo (più diretto per
  // costruire configurazioni precise); le ASSERZIONI passano da Prisma e da
  // `whereTab`, che è il codice sotto test.
  pool = new Pool({ connectionString: url });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  scenario = await costruisciDataset();
});

afterAll(async () => {
  await client?.end();
  await prisma?.$disconnect();
  await pool?.end();
});

/**
 * Sette istanze, una per configurazione rilevante. I nomi delle chiavi sono
 * la specifica del caso: se un tab cambia comportamento, il test dice quale
 * caso si è rotto invece di "un id in meno".
 */
async function costruisciDataset() {
  const ufficioA = (await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ('Ufficio Tab A') RETURNING id`)).rows[0].id;
  const ufficioB = (await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ('Ufficio Tab B') RETURNING id`)).rows[0].id;
  const area = (await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ('Area Tab', 'area-tab') RETURNING id`)).rows[0].id;
  const servizio = (await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ('Servizio Tab', 'servizio-tab', $1) RETURNING id`,
    [area])).rows[0].id;
  const faseUno = (await client.query<{ id: number }>(
    `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ('Prima', 1, $1, $2) RETURNING id`,
    [servizio, ufficioA])).rows[0].id;
  const faseDue = (await client.query<{ id: number }>(
    `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ('Seconda', 2, $1, $2) RETURNING id`,
    [servizio, ufficioB])).rows[0].id;
  const utente = (await client.query<{ id: number }>(
    `INSERT INTO utenti (codice_fiscale, nome, cognome) VALUES ('CFTABXXXXXXXXXX', 'Mario', 'Rossi') RETURNING id`)).rows[0].id;
  // `updated_at` è NOT NULL senza DEFAULT: `@updatedAt` di Prisma lo valorizza
  // dal client, non dal database.
  const io = (await client.query<{ id: number }>(
    `INSERT INTO operatori (email, password, nome, cognome, user_name, updated_at)
     VALUES ('io@tab.it', 'x', 'Anna', 'Bianchi', 'io-tab', now()) RETURNING id`)).rows[0].id;
  const altro = (await client.query<{ id: number }>(
    `INSERT INTO operatori (email, password, nome, cognome, user_name, updated_at)
     VALUES ('altro@tab.it', 'x', 'Luca', 'Verdi', 'altro-tab', now()) RETURNING id`)).rows[0].id;

  async function istanza(proto: string, stato: string, faseId: number | null, assegnatario: number | null) {
    const res = await client.query<{ id: number }>(
      `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, stato, fase_corrente_id, assegnatario_id)
       VALUES ($1, now(), $2, $3, $4::"StatoIstanza", $5, $6) RETURNING id`,
      [proto, utente, servizio, stato, faseId, assegnatario]);
    return res.rows[0].id;
  }

  return {
    io, altro, faseUno, faseDue,
    nonAssegnata:  await istanza('TAB-1', 'IN_LAVORAZIONE', faseUno, null),
    mia:           await istanza('TAB-2', 'IN_LAVORAZIONE', faseUno, io),
    diAltri:       await istanza('TAB-3', 'IN_LAVORAZIONE', faseUno, altro),
    conclusa:      await istanza('TAB-4', 'CONCLUSA',       faseDue, io),
    respinta:      await istanza('TAB-5', 'RESPINTA',       faseUno, io),
    bozza:         await istanza('TAB-6', 'BOZZA',          null,    null),
    daAvanzare:    await istanza('TAB-7', 'IN_LAVORAZIONE', faseUno, io),
  };
}

/**
 * Passa dal CODICE SOTTO TEST: `whereTab` costruisce il filtro, Prisma lo
 * esegue. Ricalcare qui le condizioni in SQL avrebbe lasciato il test verde
 * anche rompendo `whereTab` — il difetto che il piano 2a ha pagato due volte.
 */
async function idsDelTab(tab: 'nuove' | 'mie' | 'altri', operatoreId: number): Promise<number[]> {
  const istanze = await prisma.istanza.findMany({
    where: { ...whereTab(tab, operatoreId), protoNumero: { startsWith: 'TAB-' } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return istanze.map((i) => i.id);
}

describe('tab della lista istanze', () => {
  it('"Nuove" contiene solo le istanze in lavorazione non assegnate', async () => {
    expect(await idsDelTab('nuove', scenario.io)).toEqual([scenario.nonAssegnata]);
  });

  it('"Mie" contiene solo le istanze in lavorazione assegnate a me', async () => {
    expect(await idsDelTab('mie', scenario.io)).toEqual([scenario.mia, scenario.daAvanzare]);
  });

  it('"Di altri" esclude sia le mie sia quelle non assegnate', async () => {
    expect(await idsDelTab('altri', scenario.io)).toEqual([scenario.diAltri]);
  });

  it('i tre tab sono una partizione: la loro somma è il totale delle istanze in lavorazione', async () => {
    // È il difetto che la subquery correlata era stata introdotta a
    // correggere: prima nuove + mie + altri superava il totale.
    const [nuove, mie, altri] = await Promise.all([
      idsDelTab('nuove', scenario.io), idsDelTab('mie', scenario.io), idsDelTab('altri', scenario.io),
    ]);
    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM istanze WHERE stato = 'IN_LAVORAZIONE' AND proto_numero LIKE 'TAB-%'`);
    expect(nuove.length + mie.length + altri.length).toBe(Number(rows[0].count));
    expect(new Set([...nuove, ...mie, ...altri]).size).toBe(nuove.length + mie.length + altri.length);
  });

  it('un avanzamento a una fase di un altro ufficio riporta l istanza fra le "Nuove"', async () => {
    // È il difetto A1: prima l'istanza arrivava all'ufficio successivo già
    // presa in carico da chi non ci avrebbe lavorato.
    await client.query(`UPDATE istanze SET fase_corrente_id = $1 WHERE id = $2`,
      [scenario.faseDue, scenario.daAvanzare]);

    expect(await idsDelTab('nuove', scenario.io)).toContain(scenario.daAvanzare);
    expect(await idsDelTab('mie', scenario.io)).not.toContain(scenario.daAvanzare);
  });

  it('le bozze non compaiono in nessun tab', async () => {
    const [nuove, mie, altri] = await Promise.all([
      idsDelTab('nuove', scenario.io), idsDelTab('mie', scenario.io), idsDelTab('altri', scenario.io),
    ]);
    expect([...nuove, ...mie, ...altri]).not.toContain(scenario.bozza);
  });
});
