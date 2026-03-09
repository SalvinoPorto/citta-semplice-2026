'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';

export interface RuoloData {
  nome: string;
  descrizione: string;
  permessi: string[];
}

export async function getRuolo(id: number) {
  try {
    await requireAdmin();
    const ruolo = await prisma.ruolo.findUnique({ where: { id } });
    if (!ruolo) return { success: false, message: 'Ruolo non trovato', data: null };
    return { success: true, data: ruolo };
  } catch {
    return { success: false, message: 'Errore durante il recupero del ruolo', data: null };
  }
}

export async function saveRuolo(data: RuoloData, id?: number) {
  try {
    await requireAdmin();

    if (id) {
      await prisma.ruolo.update({
        where: { id },
        data: {
          nome: data.nome.trim(),
          descrizione: data.descrizione.trim() || null,
          permessi: data.permessi,
        },
      });
    } else {
      await prisma.ruolo.create({
        data: {
          nome: data.nome.trim(),
          descrizione: data.descrizione.trim() || null,
          permessi: data.permessi,
        },
      });
    }

    revalidatePath('/amministrazione/ruoli');
    return { success: true, message: id ? 'Ruolo aggiornato' : 'Ruolo creato' };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { success: false, message: 'Nome ruolo già esistente' };
    }
    return { success: false, message: 'Errore durante il salvataggio' };
  }
}

export async function deleteRuolo(id: number) {
  try {
    await requireAdmin();
    const ruolo = await prisma.ruolo.findUnique({
      where: { id },
      include: { _count: { select: { operatori: true } } },
    });
    if (ruolo && ruolo._count.operatori > 0) {
      return { success: false, message: 'Impossibile eliminare: il ruolo è assegnato a uno o più operatori' };
    }
    await prisma.ruolo.delete({ where: { id } });
    revalidatePath('/amministrazione/ruoli');
    return { success: true, message: 'Ruolo eliminato' };
  } catch {
    return { success: false, message: 'Errore durante l\'eliminazione' };
  }
}
