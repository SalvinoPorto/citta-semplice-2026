import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ROLES } from '@/lib/auth/roles';
import prisma from '@/lib/db/prisma';
import { getStorage } from '@/lib/storage';

function formatDate(date: Date): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
    }

    const allegato = await prisma.allegato.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            istanza: {
              select: {
                servizio: {
                  select: {
                    ufficioId: true,
                    fasi: { select: { ufficioId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!allegato) {
      return NextResponse.json({ error: 'Allegato non trovato' }, { status: 404 });
    }

    // IDOR check: verify the operator's office has access to this istanza
    const isAdmin = (session.user.ruoli ?? []).includes(ROLES.ADMIN);
    if (!isAdmin) {
      const operatoreId = parseInt(session.user.id);
      const operatore = await prisma.operatore.findUnique({
        where: { id: operatoreId },
        select: { ufficioId: true },
      });
      if (operatore?.ufficioId) {
        const { istanza } = allegato.workflow;
        const ufficiServizio = [
          istanza.servizio.ufficioId,
          ...istanza.servizio.fasi.map((f) => f.ufficioId),
        ].filter((uid): uid is number => uid !== null);
        if (ufficiServizio.length > 0 && !ufficiServizio.includes(operatore.ufficioId)) {
          return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
        }
      }
    }

    await prisma.allegato.update({
      where: { id },
      data: { visto: true },
    });

    const storage = getStorage();
    let fileBuffer: Buffer;
    try {
      // New records: nomeHash is the full relative path (YYYY/MM/DD/hash)
      fileBuffer = await storage.read(allegato.nomeHash);
    } catch {
      // Legacy records (pre-P3): nomeHash is just the hash — reconstruct date path
      if (!allegato.dataInserimento) {
        return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
      }
      try {
        fileBuffer = await storage.read(`${formatDate(allegato.dataInserimento)}/${allegato.nomeHash}`);
      } catch {
        return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
      }
    }

    const headers = new Headers();
    headers.set('Content-Type', allegato.mimeType || 'application/octet-stream');
    headers.set(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(allegato.nomeFile)}"`
    );
    headers.set('Content-Length', String(fileBuffer.length));

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Errore download:', error);
    return NextResponse.json(
      { error: 'Errore durante il download' },
      { status: 500 }
    );
  }
}
