import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pmPayService } from '@/lib/external';

/**
 * GET /api/pagamenti/bollettino/[iuv]
 * Serves the bollettino PDF saved on disk after payment creation.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ iuv: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { iuv } = await params;
  // const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/allegati';
  const fileName = `bollettino_${iuv}.pdf`;

  try {
    const res = await pmPayService.getBollettino(iuv);
    // const buffer1 = await readFile(join(UPLOAD_DIR, fileName));
    return new NextResponse(new Uint8Array(res.pdfBuffer || []), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Bollettino non trovato' }, { status: 404 });
  }
}
