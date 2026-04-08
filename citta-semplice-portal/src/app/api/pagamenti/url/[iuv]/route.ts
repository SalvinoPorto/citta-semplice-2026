import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { pmPayService } from '@/lib/external/pmpay';

/**
 * GET /api/pagamenti/url/[iuv]
 * Restituisce l'URL per il pagamento online di un IUV in stato DAD.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ iuv: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { iuv } = await params;
  const utente = await prisma.utente.findUnique({ where: { id: Number(session.user.id) } });
  if (!utente) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  const pagamento = await prisma.pagamentoAtteso.findFirst({
    where: {
      iuv,
      stato: 'DAD',
      workflow: { istanza: { utenteId: utente.id } },
    },
    include: { workflow: { select: { istanzaId: true } } },
  });

  if (!pagamento) {
    return NextResponse.json({ error: 'Pagamento non trovato' }, { status: 404 });
  }

  const result = await pmPayService.getUrlPagamento(iuv, String(pagamento.workflow.istanzaId));
  if (!result.success || !result.location) {
    return NextResponse.json({ error: result.error ?? 'URL non disponibile' }, { status: 502 });
  }

  return NextResponse.json({ location: result.location });
}
