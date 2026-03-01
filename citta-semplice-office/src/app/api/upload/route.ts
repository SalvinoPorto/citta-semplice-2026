import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db/prisma';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

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

    // Verify workflow exists and get istanza
    const workflow = await prisma.workflow.findUnique({
      where: { id: parseInt(workflowId) },
      include: { istanza: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow non trovato' }, { status: 404 });
    }

    // Create directory structure
    const datePath = getDatePath();
    const fullPath = join(UPLOAD_DIR, datePath);
    await mkdir(fullPath, { recursive: true });

    // Generate hash name
    const nomeHash = generateHash(
      workflow.istanzaId,
      session.user.cognome || 'operatore',
      file.name
    );

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(fullPath, nomeHash);
    await writeFile(filePath, buffer);

    // Save to database
    const allegato = await prisma.allegato.create({
      data: {
        nomeFile: file.name,
        nomeHash,
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
