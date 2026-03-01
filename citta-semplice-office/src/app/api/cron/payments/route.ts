import { NextRequest, NextResponse } from 'next/server';
import { pmPayService } from '@/lib/external/pmpay';

/**
 * Cron job to sync payment statuses with PMPay
 * Should be called every 5 minutes
 *
 * Requires CRON_SECRET header for authentication
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON] Starting payment sync...');
    const startTime = Date.now();

    const result = await pmPayService.syncPendingPayments();

    const duration = Date.now() - startTime;
    console.log(
      `[CRON] Payment sync completed in ${duration}ms. Synced: ${result.synced}, Errors: ${result.errors}`
    );

    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
      duration,
    });
  } catch (error) {
    console.error('[CRON] Payment sync error:', error);
    return NextResponse.json(
      { error: 'Errore durante la sincronizzazione' },
      { status: 500 }
    );
  }
}
