'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { servizioSchema, type ServizioFormData } from '@/lib/validations/servizio';

export async function createServizio(data: ServizioFormData) {
  const validated = servizioSchema.parse(data);

  await prisma.servizio.create({
    data: {
      titolo: validated.titolo,
      descrizione: validated.descrizione || null,
      icona: validated.icona || null,
      ordine: validated.ordine,
      attivo: validated.attivo,
      areaId: validated.areaId,
    },
  });

  revalidatePath('/servizi');
  redirect('/servizi');
}

export async function updateServizio(id: number, data: ServizioFormData) {
  const validated = servizioSchema.parse(data);

  await prisma.servizio.update({
    where: { id },
    data: {
      titolo: validated.titolo,
      descrizione: validated.descrizione || null,
      icona: validated.icona || null,
      ordine: validated.ordine,
      attivo: validated.attivo,
      areaId: validated.areaId,
    },
  });

  revalidatePath('/servizi');
  revalidatePath(`/servizi/${id}`);
  redirect('/servizi');
}

export async function deleteServizio(id: number) {
  // Check for dependent moduli
  const moduliCount = await prisma.modulo.count({
    where: { servizioId: id },
  });

  if (moduliCount > 0) {
    return { error: `Impossibile eliminare: il servizio ha ${moduliCount} moduli associati` };
  }

  await prisma.servizio.delete({
    where: { id },
  });

  revalidatePath('/servizi');
  redirect('/servizi');
}
