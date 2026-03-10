'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import { areaSchema, type AreaFormData } from '@/lib/validations/area';

export async function createArea(data: AreaFormData) {
  const validated = areaSchema.parse(data);

  await prisma.area.create({
    data: {
      titolo: validated.titolo,
      descrizione: validated.descrizione || null,
      icona: validated.icona || null,
      ordine: validated.ordine,
      attiva: validated.attiva,
    },
  });

  revalidatePath('/aree');
  return { success: true, message: 'Area creata con successo' };
}

export async function updateArea(id: number, data: AreaFormData) {
  const validated = areaSchema.parse(data);

  await prisma.area.update({
    where: { id },
    data: {
      titolo: validated.titolo,
      descrizione: validated.descrizione || null,
      icona: validated.icona || null,
      ordine: validated.ordine,
      attiva: validated.attiva,
    },
  });

  revalidatePath('/aree');
  revalidatePath(`/aree/${id}`);
  return { success: true, message: 'Area aggiornata con successo' };
}

export async function deleteArea(id: number) {
  const serviziCount = await prisma.servizio.count({
    where: { areaId: id },
  });

  if (serviziCount > 0) {
    return { success: false, message: `Impossibile eliminare: l'area ha ${serviziCount} servizi associati` };
  }

  await prisma.area.delete({ where: { id } });

  revalidatePath('/aree');
  return { success: true, message: 'Area eliminata con successo' };
}
