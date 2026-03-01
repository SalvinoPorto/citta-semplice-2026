'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { ufficioSchema, type UfficioFormData } from '@/lib/validations/ufficio';

export async function createUfficio(data: UfficioFormData) {
  const validated = ufficioSchema.parse(data);

  await prisma.ufficio.create({
    data: {
      nome: validated.nome,
      descrizione: validated.descrizione || null,
      email: validated.email || null,
      telefono: validated.telefono || null,
      indirizzo: validated.indirizzo || null,
      attivo: validated.attivo,
    },
  });

  revalidatePath('/uffici');
  redirect('/uffici');
}

export async function updateUfficio(id: number, data: UfficioFormData) {
  const validated = ufficioSchema.parse(data);

  await prisma.ufficio.update({
    where: { id },
    data: {
      nome: validated.nome,
      descrizione: validated.descrizione || null,
      email: validated.email || null,
      telefono: validated.telefono || null,
      indirizzo: validated.indirizzo || null,
      attivo: validated.attivo,
    },
  });

  revalidatePath('/uffici');
  revalidatePath(`/uffici/${id}`);
  redirect('/uffici');
}

export async function deleteUfficio(id: number) {
  // Check for dependent moduli
  const moduliCount = await prisma.modulo.count({
    where: { ufficioId: id },
  });

  if (moduliCount > 0) {
    return { error: `Impossibile eliminare: l'ufficio ha ${moduliCount} moduli associati` };
  }

  await prisma.ufficio.delete({
    where: { id },
  });

  revalidatePath('/uffici');
  redirect('/uffici');
}
