import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const iuv = searchParams.get('iuv');
  const codiceFiscale = searchParams.get('codiceFiscale');
  const dataInizio = searchParams.get('dataInizio');
  const dataFine = searchParams.get('dataFine');
  const stato = searchParams.get('stato');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  // Build where clause
  const where: Record<string, unknown> = {};

  if (iuv) {
    where.iuv = {
      contains: iuv,
    };
  }

  if (codiceFiscale) {
    where.cfUtente = {
      contains: codiceFiscale.toUpperCase(),
    };
  }

  if (dataInizio || dataFine) {
    where.dataOperazione = {};
    if (dataInizio) {
      (where.dataOperazione as Record<string, Date>).gte = new Date(dataInizio);
    }
    if (dataFine) {
      const endDate = new Date(dataFine);
      endDate.setHours(23, 59, 59, 999);
      (where.dataOperazione as Record<string, Date>).lte = endDate;
    }
  }

  if (stato) {
    where.stato = stato;
  }

  try {
    const [total, results] = await Promise.all([
      prisma.pagamentoAtteso.count({ where }),
      prisma.pagamentoAtteso.findMany({
        where,
        include: {
          workflow: {
            include: {
              istanza: {
                include: {
                  utente: {
                    select: { nome: true, cognome: true, codiceFiscale: true },
                  },
                  servizio: {
                    select: { titolo: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { dataOperazione: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const formattedResults = results.map((pagamento) => {
      const utente = pagamento.workflow?.istanza?.utente;
      const servizio = pagamento.workflow?.istanza?.servizio;

      return {
        id: pagamento.id,
        iuv: pagamento.iuv || '-',
        importo: pagamento.importoTotale,
        importoFormatted: `€${pagamento.importoTotale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        stato: pagamento.stato || 'N/D',
        dataOperazione: pagamento.dataOperazione
          ? new Date(pagamento.dataOperazione).toLocaleDateString('it-IT')
          : '-',
        utente: utente ? `${utente.cognome} ${utente.nome}` : pagamento.pagante || '-',
        codiceFiscale: utente?.codiceFiscale || pagamento.paganteCodiceFiscale || '-',
        modulo: servizio?.titolo || '-',
        istanzaId: pagamento.workflow?.istanza?.id,
        data: pagamento.dataOperazione
          ? pagamento.dataOperazione.toLocaleDateString('it-IT')
          : '-',
      };
    });

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
