import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db/prisma';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

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

    // Get allegato from database
    const allegato = await prisma.allegato.findUnique({
      where: { id },
      include: {
        workflow: true,
      },
    });

    if (!allegato) {
      return NextResponse.json({ error: 'Allegato non trovato' }, { status: 404 });
    }

    // Mark as viewed
    await prisma.allegato.update({
      where: { id },
      data: { visto: true },
    });

    // Determine file path
    const dataInserimento = allegato.dataInserimento || allegato.workflow.dataVariazione;
    const datePath = formatDate(new Date(dataInserimento));
    const filePath = join(UPLOAD_DIR, datePath, allegato.nomeHash);

    // Read file
    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(filePath);
    } catch {
      return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
    }

    // Return file with appropriate headers
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
