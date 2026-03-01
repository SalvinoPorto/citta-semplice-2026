'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { enteSchema, type EnteFormData } from '@/lib/validations/ente';

export async function createEnte(data: EnteFormData) {
  const validated = enteSchema.parse(data);

  await prisma.ente.create({
    data: {
      ente: validated.ente,
      descrizione: validated.descrizione || null,
      codiceFiscale: validated.codiceFiscale || null,
      indirizzo: validated.indirizzo || null,
      telefono: validated.telefono || null,
      email: validated.email || null,
      pec: validated.pec || null,
      logo: validated.logo || null,
      attivo: validated.attivo,
    },
  });

  revalidatePath('/enti');
  redirect('/enti');
}

export async function updateEnte(id: number, data: EnteFormData) {
  const validated = enteSchema.parse(data);

  await prisma.ente.update({
    where: { id },
    data: {
      ente: validated.ente,
      descrizione: validated.descrizione || null,
      codiceFiscale: validated.codiceFiscale || null,
      indirizzo: validated.indirizzo || null,
      telefono: validated.telefono || null,
      email: validated.email || null,
      pec: validated.pec || null,
      logo: validated.logo || null,
      attivo: validated.attivo,
    },
  });

  revalidatePath('/enti');
  revalidatePath(`/enti/${id}`);
  redirect('/enti');
}

export async function deleteEnte(id: number) {
  // Check for dependent aree
  const areeCount = await prisma.area.count({
    where: { enteId: id },
  });

  if (areeCount > 0) {
    return { error: `Impossibile eliminare: l'ente ha ${areeCount} aree associate` };
  }

  await prisma.ente.delete({
    where: { id },
  });

  revalidatePath('/enti');
  redirect('/enti');
}
