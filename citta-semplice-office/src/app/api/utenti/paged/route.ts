import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { auth } from '@/lib/auth';
import type { BaseRequest } from '@/lib/models/requests';

const PAGE_SIZE = 10;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: BaseRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { page = 1, rows = PAGE_SIZE, order, filters = [] } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};

  const cognomeFilter = filters.find((f) => f.key === 'cognome');
  if (cognomeFilter?.value) {
    whereClause.cognome = { contains: String(cognomeFilter.value), mode: 'insensitive' };
  }

  const nomeFilter = filters.find((f) => f.key === 'nome');
  if (nomeFilter?.value) {
    whereClause.nome = { contains: String(nomeFilter.value), mode: 'insensitive' };
  }

  const cfFilter = filters.find((f) => f.key === 'codiceFiscale');
  if (cfFilter?.value) {
    whereClause.codiceFiscale = { contains: String(cfFilter.value), mode: 'insensitive' };
  }

  const emailFilter = filters.find((f) => f.key === 'email');
  if (emailFilter?.value) {
    whereClause.email = { contains: String(emailFilter.value), mode: 'insensitive' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any = [{ cognome: 'asc' }, { nome: 'asc' }];
  if (order?.field && order.direction !== 0) {
    const dir = order.direction === 1 ? 'asc' : 'desc';
    switch (order.field) {
      case 'cognome':   orderBy = [{ cognome: dir }, { nome: dir }]; break;
      case 'nome':      orderBy = { nome: dir }; break;
      case 'cf':        orderBy = { codiceFiscale: dir }; break;
      case 'email':     orderBy = { email: dir }; break;
      case 'istanze':   orderBy = { istanze: { _count: dir } }; break;
      default:          orderBy = [{ cognome: 'asc' }, { nome: 'asc' }];
    }
  }

  const safePageSize = Math.max(1, rows || PAGE_SIZE);
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * safePageSize;

  const [total, utenti] = await Promise.all([
    prisma.utente.count({ where: whereClause }),
    prisma.utente.findMany({
      where: whereClause,
      orderBy,
      skip,
      take: safePageSize,
      select: {
        id: true,
        cognome: true,
        nome: true,
        codiceFiscale: true,
        email: true,
        telefono: true,
        citta: true,
        provincia: true,
        _count: { select: { istanze: true } },
      },
    }),
  ]);

  return NextResponse.json({
    content: utenti,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safePageSize) || 1,
  });
}
