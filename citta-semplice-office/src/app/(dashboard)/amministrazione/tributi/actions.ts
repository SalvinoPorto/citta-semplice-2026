'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';

export interface TributoData {
  codice: string;
  descrizione: string;
  attivo: boolean;
}

export async function getTributo(id: number) {
  try {
    await requireAdmin();
    const tributo = await prisma.tributo.findUnique({ where: { id } });
    if (!tributo) return { success: false, message: 'Tributo non trovato', data: null };
    return { success: true, data: tributo };
  } catch {
    return { success: false, message: 'Errore durante il recupero del tributo', data: null };
  }
}

export async function saveTributo(data: TributoData, id?: number) {
  try {
    await requireAdmin();

    if (id) {
      await prisma.tributo.update({
        where: { id },
        data: {
          codice: data.codice.trim(),
          descrizione: data.descrizione.trim() || null,
          attivo: data.attivo,
        },
      });
    } else {
      await prisma.tributo.create({
        data: {
          codice: data.codice.trim(),
          descrizione: data.descrizione.trim() || null,
          attivo: data.attivo,
        },
      });
    }

    revalidatePath('/amministrazione/tributi');
    return { success: true, message: id ? 'Tributo aggiornato' : 'Tributo creato' };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { success: false, message: 'Codice tributo già esistente' };
    }
    return { success: false, message: 'Errore durante il salvataggio' };
  }
}

export async function deleteTributo(id: number) {
  try {
    await requireAdmin();
    await prisma.tributo.delete({ where: { id } });
    revalidatePath('/amministrazione/tributi');
    return { success: true, message: 'Tributo eliminato' };
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return { success: false, message: 'Impossibile eliminare: il tributo è usato in uno o più pagamenti' };
    }
    return { success: false, message: 'Errore durante l\'eliminazione' };
  }
}
