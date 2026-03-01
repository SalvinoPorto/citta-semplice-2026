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
  const codiceFiscale = searchParams.get('codiceFiscale');
  const cognome = searchParams.get('cognome');
  const email = searchParams.get('email');

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
    const results = await prisma.utente.findMany({
      where,
      include: {
        _count: {
          select: { istanze: true },
        },
      },
      orderBy: { cognome: 'asc' },
      take: 10000,
    });

    // Build CSV
    const headers = [
      'ID',
      'Codice Fiscale',
      'Cognome',
      'Nome',
      'Email',
      'Telefono',
      'Data Nascita',
      'Luogo Nascita',
      'Indirizzo',
      'CAP',
      'Citta',
      'Provincia',
      'PEC',
      'Numero Istanze',
    ];

    const rows = results.map((utente) => [
      utente.id,
      escapeCSV(utente.codiceFiscale),
      escapeCSV(utente.cognome),
      escapeCSV(utente.nome),
      escapeCSV(utente.email),
      escapeCSV(utente.telefono),
      utente.dataNascita
        ? new Date(utente.dataNascita).toLocaleDateString('it-IT')
        : '',
      escapeCSV(utente.luogoNascita),
      escapeCSV(utente.indirizzo),
      escapeCSV(utente.cap),
      escapeCSV(utente.citta),
      escapeCSV(utente.provincia),
      escapeCSV(utente.pec),
      utente._count.istanze,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const filename = `utenti_export_${new Date().toISOString().split('T')[0]}.csv`;

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
