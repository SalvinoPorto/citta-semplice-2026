'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
      enteId: validated.enteId,
    },
  });

  revalidatePath('/aree');
  redirect('/aree');
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
      enteId: validated.enteId,
    },
  });

  revalidatePath('/aree');
  revalidatePath(`/aree/${id}`);
  redirect('/aree');
}

export async function deleteArea(id: number) {
  // Check for dependent servizi
  const serviziCount = await prisma.servizio.count({
    where: { areaId: id },
  });

  if (serviziCount > 0) {
    return { error: `Impossibile eliminare: l'area ha ${serviziCount} servizi associati` };
  }

  await prisma.area.delete({
    where: { id },
  });

  revalidatePath('/aree');
  redirect('/aree');
}
