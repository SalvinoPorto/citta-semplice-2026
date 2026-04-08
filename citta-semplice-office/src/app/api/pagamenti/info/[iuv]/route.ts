import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { pmPayService } from '@/lib/external';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ iuv: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { iuv } = await params;
  const result = await pmPayService.getPaymentDetail(iuv);

  if (!result.success || !result.detail) {
    return NextResponse.json(
      { success: false, error: result.error || 'Info pagamento non disponibili' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, detail: result.detail });
}
