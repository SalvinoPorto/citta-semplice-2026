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
  const protocollo = searchParams.get('protocollo');
  const dataInizio = searchParams.get('dataInizio');
  const dataFine = searchParams.get('dataFine');
  const moduloId = searchParams.get('moduloId');
  const stato = searchParams.get('stato');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  // Build where clause
  const where: Record<string, unknown> = {};

  if (codiceFiscale) {
    where.utente = {
      codiceFiscale: {
        contains: codiceFiscale.toUpperCase(),
      },
    };
  }

  if (protocollo) {
    where.protoNumero = {
      contains: protocollo,
    };
  }

  if (dataInizio || dataFine) {
    where.dataInvio = {};
    if (dataInizio) {
      (where.dataInvio as Record<string, Date>).gte = new Date(dataInizio);
    }
    if (dataFine) {
      const endDate = new Date(dataFine);
      endDate.setHours(23, 59, 59, 999);
      (where.dataInvio as Record<string, Date>).lte = endDate;
    }
  }

  if (moduloId) {
    where.moduloId = parseInt(moduloId);
  }

  if (stato) {
    if (stato === 'aperta') {
      where.conclusa = false;
      where.respinta = false;
    } else if (stato === 'conclusa') {
      where.conclusa = true;
    } else if (stato === 'respinta') {
      where.respinta = true;
    }
  }

  try {
    const [total, results] = await Promise.all([
      prisma.istanza.count({ where }),
      prisma.istanza.findMany({
        where,
        include: {
          utente: {
            select: { nome: true, cognome: true, codiceFiscale: true },
          },
          modulo: {
            select: { name: true },
          },
        },
        orderBy: { dataInvio: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const formattedResults = results.map((istanza) => ({
      id: istanza.id,
      utente: `${istanza.utente.cognome} ${istanza.utente.nome}`,
      codiceFiscale: istanza.utente.codiceFiscale,
      modulo: istanza.modulo.name,
      moduloId: istanza.moduloId,
      data: new Date(istanza.dataInvio).toLocaleDateString('it-IT'),
      dataInvio: istanza.dataInvio,
      protocollo: istanza.protoNumero || '-',
      stato: istanza.respinta ? 'Respinta' : istanza.conclusa ? 'Conclusa' : 'In Lavorazione',
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
