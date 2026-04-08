import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { pmPayService } from '@/lib/external/pmpay';

/**
 * GET /api/pagamenti/bollettino/[iuv]
 * Scarica il bollettino PDF per un pagamento in stato DAD appartenente all'utente.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ iuv: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Non autorizzato', { status: 401 });
  }

  const { iuv } = await params;
  const utente = await prisma.utente.findUnique({ where: { id: Number(session.user.id) } });
  if (!utente) return new NextResponse('Non autorizzato', { status: 401 });

  // Verifica che il pagamento atteso appartenga a un'istanza di questo utente
  const pagamento = await prisma.pagamentoAtteso.findFirst({
    where: {
      iuv,
      workflow: { istanza: { utenteId: utente.id } },
    },
  });

  if (!pagamento) {
    return new NextResponse('Pagamento non trovato', { status: 404 });
  }

  const result = await pmPayService.getBollettino(iuv);
  if (!result.success || !result.pdfBuffer) {
    return new NextResponse(result.error ?? 'Bollettino non disponibile', { status: 502 });
  }

  return new NextResponse(new Uint8Array(result.pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="bollettino_${iuv}.pdf"`,
    },
  });
}
