'use server';

import { prisma } from '@/lib/db/prisma';
import type { Filter, Order } from '@/lib/models/table';
import { whereStato, type Prisma, type StatoIstanzaValore } from '@citta/db';
import { statoAttivita, type StatoAttivita } from '@citta/db/stato-attivita';

const PAGE_SIZE = 10;

export type IstanzaRow = {
  id: number;
  servizioTitolo: string;
  servizioSottoTitolo: string | null;
  dataInvio: string | null;
  protoNumero: string | null;
  protoData: string | null;
  /** `true` finché il numero è quello interno, non ancora quello dell'ente. */
  protocolloProvvisorio: boolean;
  statoIstanza: StatoIstanzaValore;
  faseAttuale: string | null;
  stato: StatoAttivita;
  comunicazioniNuove: number;   // comunicazioni dell'ufficio mai aperte
  azioneRichiesta: boolean;     // comunicazione che attende risposta/documenti
};

export type IstanzePageResult = {
  data: IstanzaRow[];
  total: number;
  pages: number;
};

function haAllegatiRichiesti(json: string | null): boolean {
  if (!json) return false;
  try {
    return (JSON.parse(json) as unknown[]).length > 0;
  } catch {
    return false;
  }
}

export async function getIstanzePage(
  utenteId: number,
  page: number,
  order: Order,
  filters: Filter[]
): Promise<IstanzePageResult> {
  const where = buildWhere(utenteId, filters);
  const orderBy = buildOrderBy(order);

  const [total, items] = await Promise.all([
    prisma.istanza.count({ where }),
    prisma.istanza.findMany({
      where,
      include: {
        servizio: { select: { titolo: true, sottoTitolo: true } },
        attivitaCorrente: { include: { step: { select: { descrizione: true } } } },
        comunicazioni: {
          select: {
            lettaDaCittadino: true,
            richiedeRisposta: true,
            allegatiRichiesti: true,
            risposta: { select: { id: true } },
          },
        },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    data: items.map((i) => ({
      id: i.id,
      servizioTitolo: i.servizio.titolo,
      servizioSottoTitolo: i.servizio.sottoTitolo,
      dataInvio: i.dataInvio?.toISOString() ?? null,
      protoNumero: i.protoNumero ?? null,
      protoData: i.protoData?.toISOString() ?? null,
      protocolloProvvisorio: i.protocolloProvvisorio,
      statoIstanza: i.stato,
      faseAttuale: i.attivitaCorrente?.step?.descrizione ?? null,
      stato: i.attivitaCorrente
        ? statoAttivita(i.attivitaCorrente, i)
        : ('IN_ATTESA' satisfies StatoAttivita),
      comunicazioniNuove: i.comunicazioni.filter((c) => !c.lettaDaCittadino).length,
      azioneRichiesta: i.comunicazioni.some(
        (c) => !c.risposta && (c.richiedeRisposta || haAllegatiRichiesti(c.allegatiRichiesti)),
      ),
    })),
    total,
    pages: Math.ceil(total / PAGE_SIZE),
  };
}

function buildWhere(utenteId: number, filters: Filter[]): Prisma.IstanzaWhereInput {
  const where: Prisma.IstanzaWhereInput = { utenteId, ...whereStato(['IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA']) };
  for (const f of filters) {
    if (!f.value) continue;
    switch (f.key) {
      case 'id': {
        const n = parseInt(f.value, 10);
        if (!isNaN(n)) where.id = n;
        break;
      }
      case 'servizio':
        where.servizio = { titolo: { contains: f.value, mode: 'insensitive' } };
        break;
      case 'protoNumero':
        where.protoNumero = { contains: f.value, mode: 'insensitive' };
        break;
    }
  }
  return where;
}

function buildOrderBy(order: Order): Prisma.IstanzaOrderByWithRelationInput {
  if (!order.field || order.direction === 0) return { dataInvio: 'desc' };
  const dir = order.direction === 1 ? 'asc' : ('desc' as const);
  switch (order.field) {
    case 'id':       return { id: dir };
    case 'servizio': return { servizio: { titolo: dir, sottoTitolo: dir } };
    case 'dataInvio': return { dataInvio: dir };
    case 'protoNumero': return { protoNumero: dir };
    default: return { dataInvio: 'desc' };
  }
}
