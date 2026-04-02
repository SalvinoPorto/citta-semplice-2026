'use server';

import { prisma } from '@/lib/db/prisma';
import type { Filter, Order } from '@/lib/models/table';
import type { Prisma } from '../../../generated/prisma/client';

const PAGE_SIZE = 10;

export type IstanzaRow = {
  id: number;
  servizioTitolo: string;
  dataInvio: string | null;
  protoNumero: string | null;
  protoData: string | null;
  conclusa: boolean;
  respinta: boolean;
  faseAttuale: string | null;
  stato: number; // -1 = in attesa, 0 = in lavorazione, 1 = conclusa
};

export type IstanzePageResult = {
  data: IstanzaRow[];
  total: number;
  pages: number;
};

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
        servizio: { select: { titolo: true } },
        workflows: {
          include: { step: { select: { descrizione: true } } },
          orderBy: { dataVariazione: 'desc' },
          take: 1,
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
      dataInvio: i.dataInvio?.toISOString() ?? null,
      protoNumero: i.protoNumero ?? null,
      protoData: i.protoData?.toISOString() ?? null,
      conclusa: i.conclusa,
      respinta: i.respinta,
      faseAttuale: i.workflows[0]?.step?.descrizione ?? null,
      stato: i.workflows[0]?.operatoreId === null ? -1 : (i.workflows[0]?.stato ?? 0),
    })),
    total,
    pages: Math.ceil(total / PAGE_SIZE),
  };
}

function buildWhere(utenteId: number, filters: Filter[]): Prisma.IstanzaWhereInput {
  const where: Prisma.IstanzaWhereInput = { utenteId, inBozza: false };
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
    case 'servizio': return { servizio: { titolo: dir } };
    case 'dataInvio': return { dataInvio: dir };
    case 'protoNumero': return { protoNumero: dir };
    default: return { dataInvio: 'desc' };
  }
}
