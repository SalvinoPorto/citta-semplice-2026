'use server';

import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/allegati';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function normalizzaNomeFile(nomeOriginale: string): string {
  const senzaExt = nomeOriginale.replace(/\.pdf$/i, '');
  const normalizzato = senzaExt
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (normalizzato || 'allegato') + '.pdf';
}

function validaFile(file: File): string | null {
  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return `"${file.name}" non è un file PDF. Sono ammessi solo file PDF.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" supera la dimensione massima consentita di 10 MB.`;
  }
  return null;
}

export async function rispondiComunicazione(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Non autenticato' };
  }

  const comunicazioneId = Number(formData.get('comunicazioneId'));
  const testo = formData.get('testo')?.toString().trim() ?? '';
  const files = formData.getAll('allegati').filter(
    (f): f is File => f instanceof File && f.size > 0,
  );

  if (!comunicazioneId || isNaN(comunicazioneId)) {
    return { error: 'Comunicazione non valida' };
  }

  // Verifica che la comunicazione appartenga all'utente
  const utente = await prisma.utente.findUnique({
    where: { id: Number(session.user.id) },
  });
  if (!utente) return { error: 'Utente non trovato' };

  const comunicazione = await prisma.comunicazione.findUnique({
    where: { id: comunicazioneId },
    include: {
      istanza: true,
      risposta: true,
    },
  });

  if (!comunicazione) return { error: 'Comunicazione non trovata' };
  if (comunicazione.istanza.utenteId !== utente.id) {
    return { error: 'Accesso negato' };
  }
  if (!comunicazione.richiedeRisposta) {
    return { error: 'Questa comunicazione non richiede risposta' };
  }
  if (comunicazione.risposta) {
    return { error: 'Hai già risposto a questa comunicazione' };
  }

  // Verifica allegati obbligatori dichiarati nella comunicazione
  if (comunicazione.allegatiRichiesti) {
    try {
      const richiesti = JSON.parse(comunicazione.allegatiRichiesti) as Array<{
        nome: string;
        obbligatorio: boolean;
      }>;
      const nomiCaricati = files.map((f) => normalizzaNomeFile(f.name).toLowerCase());
      for (const r of richiesti) {
        if (r.obbligatorio && !nomiCaricati.length) {
          return { error: `L'allegato "${r.nome}" è obbligatorio.` };
        }
      }
    } catch {
      // allegatiRichiesti non è JSON valido, ignora
    }
  }

  // Valida i file
  for (const file of files) {
    const errore = validaFile(file);
    if (errore) return { error: errore };
  }

  // Deve esserci almeno testo o un allegato
  if (!testo && files.length === 0) {
    return { error: 'Inserisci un testo di risposta o carica almeno un allegato.' };
  }

  try {
    const risposta = await prisma.rispostaComunicazione.create({
      data: {
        testo: testo || null,
        comunicazioneId,
      },
    });

    if (files.length > 0) {
      const now = new Date();
      const anno = String(now.getFullYear());
      const mese = String(now.getMonth() + 1).padStart(2, '0');
      const giorno = String(now.getDate()).padStart(2, '0');
      const relDir = join(anno, mese, giorno);
      const absDir = join(UPLOAD_DIR, relDir);
      await mkdir(absDir, { recursive: true });

      for (const file of files) {
        const uuid = randomUUID();
        const nomeHash = join(relDir, uuid);
        const bytes = await file.arrayBuffer();
        await writeFile(join(absDir, uuid), Buffer.from(bytes));

        await prisma.allegatoRisposta.create({
          data: {
            nomeFile: normalizzaNomeFile(file.name),
            nomeHash,
            mimeType: 'application/pdf',
            rispostaId: risposta.id,
          },
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Errore salvataggio risposta:', error);
    return { error: 'Errore durante il salvataggio della risposta. Riprova.' };
  }
}
