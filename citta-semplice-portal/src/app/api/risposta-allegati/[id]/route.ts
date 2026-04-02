import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/allegati';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Non autorizzato', { status: 401 });
  }

  const { id } = await params;
  const allegatoId = Number(id);
  if (isNaN(allegatoId)) {
    return new NextResponse('ID non valido', { status: 400 });
  }

  const allegato = await prisma.allegatoRisposta.findUnique({
    where: { id: allegatoId },
    include: {
      risposta: {
        include: {
          comunicazione: {
            include: { istanza: true },
          },
        },
      },
    },
  });

  if (!allegato) {
    return new NextResponse('File non trovato', { status: 404 });
  }

  // Verifica che l'istanza appartenga all'utente corrente
  const utente = await prisma.utente.findUnique({
    where: { id: Number(session.user.id) },
  });
  const istanza = allegato.risposta.comunicazione.istanza;
  if (!utente || istanza.utenteId !== utente.id) {
    return new NextResponse('Accesso negato', { status: 403 });
  }

  const filePath = join(UPLOAD_DIR, allegato.nomeHash);

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': allegato.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(allegato.nomeFile)}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch {
    return new NextResponse('File non disponibile', { status: 404 });
  }
}
