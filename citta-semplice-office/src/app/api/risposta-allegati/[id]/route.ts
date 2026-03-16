import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db/prisma';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

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

    const allegato = await prisma.allegatoRisposta.findUnique({
      where: { id },
    });

    if (!allegato) {
      return NextResponse.json({ error: 'Allegato non trovato' }, { status: 404 });
    }

    const filePath = join(UPLOAD_DIR, allegato.nomeHash);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(filePath);
    } catch {
      return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', allegato.mimeType || 'application/pdf');
    headers.set(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(allegato.nomeFile)}"`
    );
    headers.set('Content-Length', String(fileBuffer.length));

    return new NextResponse(new Uint8Array(fileBuffer), { status: 200, headers });
  } catch (error) {
    console.error('Errore download risposta allegato:', error);
    return NextResponse.json({ error: 'Errore durante il download' }, { status: 500 });
  }
}
