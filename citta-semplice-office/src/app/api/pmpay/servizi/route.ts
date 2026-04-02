import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { pmPayService } from '@/lib/external/pmpay';

/**
 * GET /api/pmpay/servizi
 * Returns the list of services (tributi) configured in PmPay for the current ente.
 * Called once at service form load to populate the payment step dropdown.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const servizi = await pmPayService.getServizi();
  return NextResponse.json(servizi);
}
