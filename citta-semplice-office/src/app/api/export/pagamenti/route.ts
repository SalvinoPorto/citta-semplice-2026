import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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
    const results = await prisma.pagamentoAtteso.findMany({
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
      take: 10000,
    });

    // Build CSV
    const headers = [
      'ID',
      'IUV',
      'Importo',
      'Stato',
      'Data Operazione',
      'Data Ricevuta',
      'Codice Fiscale',
      'Cognome',
      'Nome',
      'Causale',
      'Modulo',
      'ID Istanza',
    ];

    const rows = results.map((pagamento) => {
      const utente = pagamento.workflow?.istanza?.utente;
      const servizio = pagamento.workflow?.istanza?.servizio;

      return [
        pagamento.id,
        escapeCSV(pagamento.iuv),
        pagamento.importoTotale.toFixed(2),
        escapeCSV(pagamento.stato),
        pagamento.dataOperazione
          ? pagamento.dataOperazione.toLocaleDateString('it-IT')
          : '',
        pagamento.dataEmissione
          ? pagamento.dataEmissione.toLocaleDateString('it-IT')
          : '',
        escapeCSV(utente?.codiceFiscale || pagamento.paganteCodiceFiscale),
        escapeCSV(utente?.cognome || pagamento.pagante),
        escapeCSV(utente?.nome || ''),
        escapeCSV(pagamento.causale),
        escapeCSV(servizio?.titolo),
        pagamento.workflow?.istanza?.id || '',
      ];
    });

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const filename = `pagamenti_export_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Errore nell\'export' }, { status: 500 });
  }
}
