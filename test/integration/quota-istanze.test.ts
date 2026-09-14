import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { PrismaClient } from '../../packages/db/generated/prisma/client';
import { cePostoInQuota } from '../../packages/db/src/quota-istanze';

/**
 * La race che questo file inchioda: `sogliaIstanzeRaggiunta` contava le istanze
 * FUORI da qualsiasi transazione e senza lock, e l'inserimento avveniva molto
 * più tardi (in mezzo c'è la protocollazione). Con invii simultanei tutti
 * leggono lo stesso conteggio e passano tutti.
 *
 * Il primo test dimostra che l'harness la race la rileva DAVVERO; il secondo
 * che `cePostoInQuota` la chiude. Senza il primo, un verde nel secondo non
 * proverebbe nulla: potrebbe essere concorrenza che non si è manifestata.
 */

const CONCORRENTI = 12;
const QUOTA = 3;

let pool: Pool;
let prisma: PrismaClient;

beforeAll(async () => {
  const url = inject('urlPostgres');
  // `max` deve superare i client concorrenti: ogni transazione interattiva
  // occupa una connessione per tutta la sua durata, e con un pool più piccolo
  // i "concorrenti" si metterebbero in fila per avere una connessione — il
  // test passerebbe per il motivo sbagliato.
  pool = new Pool({ connectionString: url, max: CONCORRENTI + 3 });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
});

afterAll(async () => {
  await prisma?.$disconnect();
  await pool?.end();
});

/** Area, servizio con quota e un utente. Valori sintetici, isolati dal suffisso. */
async function creaScenario(suffisso: string, quota: number) {
  const area = await prisma.area.create({
    data: { nome: `Area ${suffisso}`, slug: `area-${suffisso}` },
  });
  const servizio = await prisma.servizio.create({
    data: {
      titolo: `Servizio ${suffisso}`,
      slug: `servizio-${suffisso}`,
      areaId: area.id,
      numeroMaxIstanze: quota,
    },
  });
  const utente = await prisma.utente.create({
    data: {
      codiceFiscale: `CF${suffisso}`.padEnd(16, 'X').slice(0, 16),
      nome: 'Mario',
      cognome: 'Rossi',
    },
  });
  return { servizioId: servizio.id, utenteId: utente.id };
}

function creaIstanza(
  istanze: PrismaClient['istanza'],
  servizioId: number,
  utenteId: number,
  n: number,
) {
  return istanze.create({
    data: {
      protoNumero: `PROTO-${servizioId}-${n}`,
      dataInvio: new Date(),
      stato: 'IN_LAVORAZIONE',
      servizioId,
      utenteId,
    },
  });
}

function istanzeInQuota(servizioId: number): Promise<number> {
  return prisma.istanza.count({
    where: { servizioId, stato: { in: ['IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA'] } },
  });
}

describe('quota istanze sotto invii simultanei', () => {
  it('la logica ingenua (conta fuori transazione, poi inserisci) sfonda la quota', async () => {
    const { servizioId, utenteId } = await creaScenario('ingenua', QUOTA);

    // Riproduce il codice com'era: conteggio senza lock, poi inserimento.
    // La pausa rende esplicita la finestra fra le due operazioni invece di
    // sperare in una coincidenza di scheduling. In produzione quella finestra
    // è enormemente più ampia, perché in mezzo c'è la chiamata a Urbi.
    const invio = async (n: number) => {
      const occupati = await istanzeInQuota(servizioId);
      if (occupati >= QUOTA) return 'rifiutata';
      await new Promise((r) => setTimeout(r, 25));
      await creaIstanza(prisma.istanza, servizioId, utenteId, n);
      return 'accettata';
    };

    const esiti = await Promise.all(Array.from({ length: CONCORRENTI }, (_, n) => invio(n)));

    expect(esiti.filter((e) => e === 'accettata').length).toBeGreaterThan(QUOTA);
    expect(await istanzeInQuota(servizioId)).toBeGreaterThan(QUOTA);
  });

  it('cePostoInQuota rispetta la quota esatta con 12 invii simultanei', async () => {
    const { servizioId, utenteId } = await creaScenario('conlock', QUOTA);

    const invio = (n: number) =>
      prisma.$transaction(async (tx) => {
        if (!(await cePostoInQuota(tx, servizioId, QUOTA))) return 'rifiutata';
        // La stessa pausa del test precedente: qui non cambia l'esito perché il
        // lock tiene la finestra chiusa. È la differenza che si vuole
        // dimostrare, quindi le due prove devono restare confrontabili.
        await new Promise((r) => setTimeout(r, 25));
        await creaIstanza(tx.istanza, servizioId, utenteId, n);
        return 'accettata';
      });

    const esiti = await Promise.all(Array.from({ length: CONCORRENTI }, (_, n) => invio(n)));

    expect(esiti.filter((e) => e === 'accettata').length).toBe(QUOTA);
    expect(await istanzeInQuota(servizioId)).toBe(QUOTA);
  });

  it('senza quota configurata non blocca nulla', async () => {
    const { servizioId, utenteId } = await creaScenario('senzaquota', 0);

    const esiti = await Promise.all(
      Array.from({ length: 5 }, (_, n) =>
        prisma.$transaction(async (tx) => {
          if (!(await cePostoInQuota(tx, servizioId, 0))) return 'rifiutata';
          await creaIstanza(tx.istanza, servizioId, utenteId, n);
          return 'accettata';
        }),
      ),
    );

    expect(esiti.every((e) => e === 'accettata')).toBe(true);
    expect(await istanzeInQuota(servizioId)).toBe(5);
  });
});
