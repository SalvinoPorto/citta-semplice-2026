import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const codiceFiscale = searchParams.get('codiceFiscale');
  const cognome = searchParams.get('cognome');
  const email = searchParams.get('email');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  // Build where clause
  const where: Record<string, unknown> = {};

  if (codiceFiscale) {
    where.codiceFiscale = {
      contains: codiceFiscale.toUpperCase(),
    };
  }

  if (cognome) {
    where.cognome = {
      contains: cognome,
      mode: 'insensitive',
    };
  }

  if (email) {
    where.email = {
      contains: email,
      mode: 'insensitive',
    };
  }

  try {
    const [total, results] = await Promise.all([
      prisma.utente.count({ where }),
      prisma.utente.findMany({
        where,
        include: {
          _count: {
            select: { istanze: true },
          },
        },
        orderBy: { cognome: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const formattedResults = results.map((utente) => ({
      id: utente.id,
      codiceFiscale: utente.codiceFiscale,
      cognome: utente.cognome,
      nome: utente.nome,
      email: utente.email || '-',
      telefono: utente.telefono || '-',
      istanze: utente._count.istanze,
      utente: `${utente.cognome} ${utente.nome}`,
      servizio: '-',
      data: utente.createdAt ? new Date(utente.createdAt).toLocaleDateString('it-IT') : '-',
      stato: `${utente._count.istanze} istanze`,
    }));

    return NextResponse.json({
      results: formattedResults,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Errore nella ricerca' }, { status: 500 });
  }
}
