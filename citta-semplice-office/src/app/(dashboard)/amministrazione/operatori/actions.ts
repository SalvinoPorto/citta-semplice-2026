'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { hash } from 'bcryptjs';
import { operatoreSchema, operatoreCreateSchema, type OperatoreFormData, type OperatoreCreateFormData } from '@/lib/validations/operatore';

export async function createOperatore(data: OperatoreCreateFormData) {
  const validated = operatoreCreateSchema.parse(data);

  const existingOperatore = await prisma.operatore.findUnique({
    where: { userName: validated.userName },
  });

  if (existingOperatore) {
    return { error: 'Un operatore con questo nome utente esiste già' };
  }

  const hashedPassword = await hash(validated.password, 10);

  const operatore = await prisma.operatore.create({
    data: {
      email: validated.email,
      password: hashedPassword,
      userName: validated.userName,
      nome: validated.nome,
      cognome: validated.cognome,
      // codiceFiscale: validated.codiceFiscale || null,
      telefono: validated.telefono || null,
      attivo: validated.attivo,
      ruoli: {
        create: validated.ruoliIds.map((ruoloId) => ({
          ruoloId,
        })),
      },
      servizi: {
        create: validated.serviziIds.map((servizioId) => ({
          servizioId,
        })),
      },
    },
  });

  revalidatePath('/operatori');
  redirect('/operatori');
}

export async function updateOperatore(id: number, data: OperatoreFormData) {
  const validated = operatoreSchema.parse(data);

  const existingOperatore = await prisma.operatore.findUnique({
    where: { userName: validated.userName },
  });

  if (existingOperatore && existingOperatore.id !== id) {
    return { error: 'Un altro operatore con questo nome utente esiste già' };
  }

  // Prepare update data
  const updateData: Record<string, unknown> = {
    email: validated.email,
    userName: validated.userName,
    nome: validated.nome,
    cognome: validated.cognome,
    // codiceFiscale: validated.codiceFiscale || null,
    telefono: validated.telefono || null,
    attivo: validated.attivo,
  };

  // Update password only if provided
  if (validated.password) {
    updateData.password = await hash(validated.password, 10);
  }

  // Update operatore with relations
  await prisma.$transaction(async (tx) => {
    // Delete existing relations
    await tx.operatoreRuolo.deleteMany({ where: { operatoreId: id } });
    await tx.operatoreServizio.deleteMany({ where: { operatoreId: id } });

    // Update operatore
    await tx.operatore.update({
      where: { id },
      data: {
        ...updateData,
        ruoli: {
          create: validated.ruoliIds.map((ruoloId) => ({
            ruoloId,
          })),
        },
        servizi: {
          create: validated.serviziIds.map((servizioId) => ({
            servizioId,
          })),
        },
      },
    });
  });

  revalidatePath('/amministrazione/operatori');
  revalidatePath(`/amministrazione/operatori/${id}`);
  redirect('/amministrazione/operatori');
}

export async function deleteOperatore(id: number) {
  await prisma.operatore.delete({
    where: { id },
  });

  revalidatePath('/amministrazione/operatori');
  redirect('/amministrazione/operatori');
}

export async function toggleOperatoreStatus(id: number) {
  const operatore = await prisma.operatore.findUnique({
    where: { id },
    select: { attivo: true },
  });

  if (!operatore) {
    return { error: 'Operatore non trovato' };
  }

  await prisma.operatore.update({
    where: { id },
    data: { attivo: !operatore.attivo },
  });

  revalidatePath('/amministrazione/operatori');
  revalidatePath(`/amministrazione/operatori/${id}`);
}
