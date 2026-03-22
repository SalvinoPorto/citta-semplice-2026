import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { auth } from '@/lib/auth';
import { ServiziRequest } from '@/lib/models/requests';

const PAGE_SIZE = 10;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ServiziRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { area, page = 1, rows = PAGE_SIZE, order, filters = [], soloAttivi } = body;

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};

  if (area) {
    whereClause.areaId = area;
  }

  // Filtro attivi: attivo=true E (dataFine nulla O dataFine >= oggi)
  if (soloAttivi) {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    whereClause.attivo = true;
    whereClause.OR = [
      { dataFine: null },
      { dataFine: { gte: oggi } },
    ];
  }

  // Column filter: titolo
  const titoloFilter = filters.find((f) => f.key === 'titolo');
  if (titoloFilter?.value) {
    whereClause.titolo = { contains: String(titoloFilter.value), mode: 'insensitive' };
  }

  // Column filter: area (by titolo)
  const areaFilter = filters.find((f) => f.key === 'area');
  if (areaFilter?.value) {
    whereClause.area = {
      titolo: { contains: String(areaFilter.value), mode: 'insensitive' },
    };
  }

  // Build sort
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any = [{ area: { nome:'asc' } }, { ordine: 'asc' }];
  if (order?.field && order.direction !== 0) {
    const dir = order.direction === 1 ? 'asc' : 'desc';
    switch (order.field) {
      case 'titolo':
        orderBy = { titolo: dir };
        break;
      case 'area':
        orderBy = { area: { nome:dir } };
        break;
      default:
        orderBy = [{ area: { nome:'asc' } }, { ordine: 'asc' }];
    }
  }

  const safePageSize = Math.max(1, rows || PAGE_SIZE);
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * safePageSize;

  const [total, servizi] = await Promise.all([
    prisma.servizio.count({ where: whereClause }),
    prisma.servizio.findMany({
      where: whereClause,
      orderBy,
      skip,
      take: safePageSize,
      select: {
        id: true,
        titolo: true,
        descrizione: true,
        attivo: true,
        dataFine: true,
        area: {
          select: { nome: true },
        },
        _count: {
          select: { steps: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / safePageSize) || 1;

  return NextResponse.json({
    content: servizi,
    total,
    page: safePage,
    totalPages,
  });
}
