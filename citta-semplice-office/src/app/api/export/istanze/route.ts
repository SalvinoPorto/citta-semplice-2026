import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { auth } from '@/lib/auth';
import { getVisibilitaOperatore, istanzaVisibilityWhere } from '@/lib/auth/visibilita';
import {
  buildColonneDinamiche,
  valoriIstanza,
  valoriOverflow,
} from '@/lib/models/campi-esportabili';

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
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Visibilità operatore: ufficio + servizi assegnati
  const visibilita = await getVisibilitaOperatore(parseInt(session.user.id), session.user.ruoli);

  const searchParams = request.nextUrl.searchParams;
  const codiceFiscale = searchParams.get('codiceFiscale');
  const protocollo = searchParams.get('protocollo');
  const dataInizio = searchParams.get('dataInizio');
  const dataFine = searchParams.get('dataFine');
  const servizioId = searchParams.get('servizioId');
  const stato = searchParams.get('stato');

  // Build where clause
  const where: Record<string, unknown> = { inBozza: false, AND: [istanzaVisibilityWhere(visibilita)] };

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

  if (servizioId) {
    where.servizioId = parseInt(servizioId);
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
    const results = await prisma.istanza.findMany({
      where,
      include: {
        utente: {
          select: {
            nome: true,
            cognome: true,
            codiceFiscale: true,
            email: true,
            telefono: true,
          },
        },
        servizio: {
          select: { titolo: true },
        },
      },
      orderBy: { dataInvio: 'desc' },
      take: 10000, // Limit to 10000 records
    });

    // Colonne dei campi del modulo: unione dei `campiDaEsportare` dei servizi
    // effettivamente presenti nel risultato (servizi diversi = campi diversi).
    const serviziPresenti = await prisma.servizio.findMany({
      where: { id: { in: [...new Set(results.map((i) => i.servizioId))] } },
      select: { id: true, titolo: true, campiDaEsportare: true, attributi: true },
    });
    const colonne = buildColonneDinamiche(serviziPresenti);

    // Build CSV
    const headers = [
      'ID',
      'Codice Fiscale',
      'Cognome',
      'Nome',
      'Email',
      'Telefono',
      'Modulo',
      'Data Invio',
      'Protocollo',
      'Protocollo Finale',
      'Stato',
      ...colonne.headers,
      ...(colonne.campiOverflow.length > 0 ? ['Altri dati'] : []),
    ];

    const rows = results.map((istanza) => {
      const valori = valoriIstanza(istanza.dati);

      return [
        istanza.id,
        escapeCSV(istanza.utente.codiceFiscale),
        escapeCSV(istanza.utente.cognome),
        escapeCSV(istanza.utente.nome),
        escapeCSV(istanza.utente.email),
        escapeCSV(istanza.utente.telefono),
        escapeCSV(istanza.servizio.titolo),
        new Date(istanza.dataInvio).toLocaleDateString('it-IT'),
        escapeCSV(istanza.protoNumero),
        escapeCSV(istanza.protoFinaleNumero),
        istanza.respinta ? 'Respinta' : istanza.conclusa ? 'Conclusa' : 'In Lavorazione',
        ...colonne.campi.map((campo) => escapeCSV(valori.get(campo))),
        ...(colonne.campiOverflow.length > 0
          ? [escapeCSV(valoriOverflow(valori, colonne.campiOverflow))]
          : []),
      ];
    });

    const csv = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const filename = `istanze_export_${new Date().toISOString().split('T')[0]}.csv`;

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
