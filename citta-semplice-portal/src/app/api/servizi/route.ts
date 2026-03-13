import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search') ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 200);

  const where = {
    attivo: true,
    area: { attiva: true, privata: false },
    ...(search.trim()
      ? {
          OR: [
            { titolo: { contains: search, mode: 'insensitive' as const } },
            { descrizione: { contains: search, mode: 'insensitive' as const } },
            { sottoTitolo: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [servizi, total] = await Promise.all([
    prisma.servizio.findMany({
      where,
      select: {
        id: true,
        titolo: true,
        slug: true,
        area: { select: { titolo: true, slug: true, id: true } },
      },
      orderBy: { titolo: 'asc' },
      take: limit,
    }),
    prisma.servizio.count({ where }),
  ]);

  return NextResponse.json({ servizi, total });
}
