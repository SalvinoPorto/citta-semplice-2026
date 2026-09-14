import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * Readiness: la replica è pronta a ricevere traffico solo se il database
 * risponde. A differenza della liveness, un fallimento qui la sfila dal
 * bilanciatore senza riavviarla, e la rimette in servizio da sola appena il
 * database torna disponibile.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      services: {
        database: 'ok',
      },
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    return NextResponse.json(
      {
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      },
      { status: 503 },
    );
  }
}
