'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';

export interface UtenteContattiData {
  email: string | null;
  telefono: string | null;
  pec: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
}

export async function updateUtenteContatti(id: number, data: UtenteContattiData) {
  await requireAdmin();

  const utente = await prisma.utente.findUnique({ where: { id } });
  if (!utente) {
    return { error: 'Utente non trovato' };
  }

  await prisma.utente.update({
    where: { id },
    data: {
      email: data.email || null,
      telefono: data.telefono || null,
      pec: data.pec || null,
      indirizzo: data.indirizzo || null,
      cap: data.cap || null,
      citta: data.citta || null,
      provincia: data.provincia || null,
    },
  });

  revalidatePath('/utenti');
  revalidatePath(`/utenti/${id}`);

  return { success: true };
}
