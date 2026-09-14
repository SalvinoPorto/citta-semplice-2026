import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness: dice soltanto che il processo Node risponde ancora.
 *
 * NON interroga il database di proposito. Una liveness che dipende dal DB fa
 * riavviare ogni replica insieme al primo sfarfallio della connessione — il
 * riavvio non aggiusta il database e il servizio resta giù più a lungo.
 * La verifica del database vive in /api/ready.
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
