import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { whereVisibileAgliOperatori } from '@citta/db';
import { auth } from '@/lib/auth';
import { getVisibilitaOperatore, istanzaVisibilityWhere } from '@/lib/auth/visibilita';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const visibilita = await getVisibilitaOperatore(parseInt(session.user.id), session.user.ruoli);

  const searchParams = request.nextUrl.searchParams;
  const iuv = searchParams.get('iuv');
  const codiceFiscale = searchParams.get('codiceFiscale');
  const dataInizio = searchParams.get('dataInizio');
  const dataFine = searchParams.get('dataFine');
  const stato = searchParams.get('stato');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  // Build where clause — limitato alle istanze visibili all'operatore
  const where: Record<string, unknown> = {
    attivita: { istanza: { ...whereVisibileAgliOperatori(), AND: [istanzaVisibilityWhere(visibilita)] } },
  };

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
          attivita: {
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
      const utente = pagamento.attivita?.istanza?.utente;
      const servizio = pagamento.attivita?.istanza?.servizio;

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
        istanzaId: pagamento.attivita?.istanza?.id,
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
