/**
 * PmPay — re-export dal package condiviso @citta/integrations.
 * Il client HTTP vive nel package (unica fonte). Qui resta solo la
 * sincronizzazione cron, che dipende dal Prisma app-locale.
 */
export * from '@citta/integrations/pmpay';

import { pmPayService } from '@citta/integrations/pmpay';
import prisma from '@/lib/db/prisma';

/**
 * Chiamata dal cron per sincronizzare gli stati dei pagamenti con PmPay.
 * Interroga PmPay per i pagamenti pendenti e aggiorna il DB.
 */
export async function syncPendingPayments(): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  try {
    const pendingPayments = await prisma.pagamentoAtteso.findMany({
      where: {
        iuv: { not: null },
        stato: { notIn: ['CON', 'NCO'] },
      },
    });

    const BATCH = 5;
    for (let i = 0; i < pendingPayments.length; i += BATCH) {
      await Promise.all(
        pendingPayments.slice(i, i + BATCH).map(async (payment) => {
          if (!payment.iuv) return;
          try {
            const result = await pmPayService.getPaymentDetail(payment.iuv);
            if (!result.success || !result.detail) { errors++; return; }
            if (result.detail.statoPagamento !== payment.stato) {
              await prisma.pagamentoAtteso.update({
                where: { id: payment.id },
                data: {
                  stato: result.detail.statoPagamento,
                  ...(result.detail.dataOperazione
                    ? { dataOperazione: new Date(result.detail.dataOperazione) }
                    : {}),
                },
              });
              synced++;
            }
          } catch {
            errors++;
          }
        })
      );
    }
  } catch (err) {
    console.error('[PmPay] syncPendingPayments error:', err);
  }

  return { synced, errors };
}
