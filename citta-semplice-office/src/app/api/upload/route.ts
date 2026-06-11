import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db/prisma';
import { getStorage } from '@/lib/storage';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function generateHash(istanzaId: number, operatore: string, fileName: string): string {
  const data = `${istanzaId}-${operatore}-${fileName}-${Date.now()}`;
  return createHash('sha256').update(data).digest('hex');
}

function getDatePath(): string {
  const now = new Date();
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const workflowId = formData.get('workflowId') as string | null;
    const nomeFileRichiesto = formData.get('nomeFileRichiesto') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File mancante' }, { status: 400 });
    }

    if (!workflowId) {
      return NextResponse.json({ error: 'WorkflowId mancante' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File troppo grande. Massimo 20 MB.' }, { status: 413 });
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: parseInt(workflowId) },
      include: { istanza: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow non trovato' }, { status: 404 });
    }

    const hash = generateHash(
      workflow.istanzaId,
      session.user.cognome || 'operatore',
      file.name
    );
    // Store full relative path so download never needs to reconstruct it
    const relativePath = `${getDatePath()}/${hash}`;

    const bytes = await file.arrayBuffer();
    await getStorage().save(relativePath, Buffer.from(bytes));

    const allegato = await prisma.allegato.create({
      data: {
        nomeFile: file.name,
        nomeHash: relativePath,
        nomeFileRichiesto,
        mimeType: file.type,
        invUtente: false,
        visto: false,
        dataInserimento: new Date(),
        workflowId: parseInt(workflowId),
      },
    });

    return NextResponse.json({
      success: true,
      allegato: {
        id: allegato.id,
        nomeFile: allegato.nomeFile,
      },
    });
  } catch (error) {
    console.error('Errore upload:', error);
    return NextResponse.json(
      { error: 'Errore durante il caricamento' },
      { status: 500 }
    );
  }
}
