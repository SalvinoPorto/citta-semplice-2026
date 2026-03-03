'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { moduloSchema, type ModuloFormData } from '@/lib/validations/modulo';

export async function createModulo(data: ModuloFormData) {
  const validated = moduloSchema.parse(data);

  const existingModulo = await prisma.modulo.findUnique({
    where: { slug: validated.slug },
  });

  if (existingModulo) {
    return { error: 'Uno slug con questo nome esiste già' };
  }

  const modulo = await prisma.modulo.create({
    data: {
      name: validated.name,
      slug: validated.slug,
      description: validated.description || null,
      tipo: validated.tipo,
      nomeFile: validated.nomeFile || null,
      attributes: validated.attributes || null,
      corpo: validated.corpo || null,
      attivo: validated.attivo,
    },
  });

  revalidatePath('/moduli');
  redirect('/moduli');
}

export async function updateModulo(id: number, data: ModuloFormData) {
  const validated = moduloSchema.parse(data);

  const existingModulo = await prisma.modulo.findUnique({
    where: { slug: validated.slug },
  });

  if (existingModulo && existingModulo.id !== id) {
    return { error: 'Uno slug con questo nome esiste già' };
  }

  await prisma.modulo.update({
    where: { id },
    data: {
      name: validated.name,
      slug: validated.slug,
      description: validated.description || null,
      tipo: validated.tipo,
      nomeFile: validated.nomeFile || null,
      attributes: validated.attributes || null,
      corpo: validated.corpo || null,
      attivo: validated.attivo,
    },
  });

  revalidatePath('/moduli');
  revalidatePath(`/moduli/${id}`);
  redirect('/moduli');
}

export async function deleteModulo(id: number) {
  const serviziCount = await prisma.servizio.count({
    where: { moduloId: id },
  });

  if (serviziCount > 0) {
    return { error: `Impossibile eliminare: il modulo è usato da ${serviziCount} servizi` };
  }

  await prisma.modulo.delete({
    where: { id },
  });

  revalidatePath('/moduli');
  redirect('/moduli');
}

export async function cloneModulo(id: number) {
  const original = await prisma.modulo.findUnique({
    where: { id },
  });

  if (!original) {
    return { error: 'Modulo non trovato' };
  }

  let newSlug = `${original.slug}-copia`;
  let counter = 1;
  while (await prisma.modulo.findUnique({ where: { slug: newSlug } })) {
    newSlug = `${original.slug}-copia-${counter}`;
    counter++;
  }

  const cloned = await prisma.modulo.create({
    data: {
      name: `${original.name} (Copia)`,
      slug: newSlug,
      description: original.description,
      tipo: original.tipo,
      nomeFile: original.nomeFile,
      attributes: original.attributes,
      corpo: original.corpo,
      attivo: false,
    },
  });

  revalidatePath('/moduli');
  redirect(`/moduli/${cloned.id}`);
}
