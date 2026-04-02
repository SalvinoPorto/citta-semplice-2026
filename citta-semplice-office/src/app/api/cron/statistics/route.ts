import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

/**
 * Cron job to generate daily statistics
 * Should be called once a day (e.g., at midnight)
 *
 * Requires CRON_SECRET header for authentication
 */
export async function GET(request: NextRequest) {
  if (process.env.ENABLE_CRON_JOBS !== 'true') {
    return NextResponse.json({ error: 'Cron jobs disabilitati' }, { status: 503 });
  }

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON] Starting statistics generation...');
    const startTime = Date.now();

    // Get yesterday's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Count istanze for yesterday
    const [istanzeInviate, istanzeConcluse, istanzeRespinte] = await Promise.all([
      prisma.istanza.count({
        where: {
          dataInvio: {
            gte: yesterday,
            lt: today,
          },
        },
      }),
      prisma.istanza.count({
        where: {
          conclusa: true,
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
      }),
      prisma.istanza.count({
        where: {
          respinta: true,
          createdAt: {
            gte: yesterday,
            lt: today,
          },
        },
      }),
    ]);

    // Upsert daily statistics
    await prisma.statisticheGiornaliere.upsert({
      where: { data: yesterday },
      create: {
        data: yesterday,
        istanzeInviate,
        istanzeConcluse,
        istanzeRespinte,
      },
      update: {
        istanzeInviate,
        istanzeConcluse,
        istanzeRespinte,
      },
    });

    // Count payments for yesterday
    const pagamenti = await prisma.pagamentoAtteso.aggregate({
      where: {
        stato: 'CON',
        dataRicevuta: {
          gte: yesterday,
          lt: today,
        },
      },
      _count: true,
      _sum: {
        importoTotale: true,
      },
    });

    // Upsert payment statistics
    await prisma.statistichePagamenti.upsert({
      where: { data: yesterday },
      create: {
        data: yesterday,
        numeroTransazioni: pagamenti._count,
        importoTotale: pagamenti._sum.importoTotale || 0,
      },
      update: {
        numeroTransazioni: pagamenti._count,
        importoTotale: pagamenti._sum.importoTotale || 0,
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[CRON] Statistics generated in ${duration}ms`);

    return NextResponse.json({
      success: true,
      date: yesterday.toISOString().split('T')[0],
      statistics: {
        istanzeInviate,
        istanzeConcluse,
        istanzeRespinte,
        pagamenti: {
          count: pagamenti._count,
          total: pagamenti._sum.importoTotale || 0,
        },
      },
      duration,
    });
  } catch (error) {
    console.error('[CRON] Statistics generation error:', error);
    return NextResponse.json(
      { error: 'Errore durante la generazione delle statistiche' },
      { status: 500 }
    );
  }
}
