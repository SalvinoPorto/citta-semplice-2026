'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { moduloSchema, type ModuloFormData } from '@/lib/validations/modulo';

export async function createModulo(data: ModuloFormData) {
  const validated = moduloSchema.parse(data);

  // Check slug uniqueness
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
      dataInizio: new Date(validated.dataInizio),
      dataFine: new Date(validated.dataFine),
      attivo: validated.attivo,
      campiInEvidenza: validated.campiInEvidenza || null,
      campiDaEsportare: validated.campiDaEsportare || null,
      unicoInvio: validated.unicoInvio,
      unicoInvioPerUtente: validated.unicoInvioPerUtente,
      campiUnicoInvio: validated.campiUnicoInvio || null,
      numeroMaxIstanze: validated.numeroMaxIstanze || null,
      avvisoSoglia: validated.avvisoSoglia || null,
      msgExtraModulo: validated.msgExtraModulo || null,
      prevedeDocumentoFinale: validated.prevedeDocumentoFinale,
      templateDocumentoFinale: validated.templateDocumentoFinale || null,
      nomeDocumentoFinale: validated.nomeDocumentoFinale || null,
      servizioId: validated.servizioId,
      ufficioId: validated.ufficioId || null,
      steps: {
        create: validated.steps.map((step) => ({
          descrizione: step.descrizione,
          ordine: step.ordine,
          attivo: step.attivo,
          pagamento: step.pagamento,
          allegati: step.allegati,
          allegatiOp: step.allegatiOp,
          allegatiRequired: step.allegatiRequired,
          allegatiOpRequired: step.allegatiOpRequired,
          protocollo: step.protocollo,
          unitaOrganizzativa: step.unitaOrganizzativa || null,
        })),
      },
    },
  });

  revalidatePath('/moduli');
  redirect('/moduli');
}

export async function updateModulo(id: number, data: ModuloFormData) {
  const validated = moduloSchema.parse(data);

  // Check slug uniqueness
  const existingModulo = await prisma.modulo.findUnique({
    where: { slug: validated.slug },
  });

  if (existingModulo && existingModulo.id !== id) {
    return { error: 'Uno slug con questo nome esiste già' };
  }

  await prisma.$transaction(async (tx) => {
    // Delete existing steps
    await tx.step.deleteMany({ where: { moduloId: id } });

    // Update modulo with new steps
    await tx.modulo.update({
      where: { id },
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description || null,
        tipo: validated.tipo,
        nomeFile: validated.nomeFile || null,
        attributes: validated.attributes || null,
        corpo: validated.corpo || null,
        dataInizio: new Date(validated.dataInizio),
        dataFine: new Date(validated.dataFine),
        attivo: validated.attivo,
        campiInEvidenza: validated.campiInEvidenza || null,
        campiDaEsportare: validated.campiDaEsportare || null,
        unicoInvio: validated.unicoInvio,
        unicoInvioPerUtente: validated.unicoInvioPerUtente,
        campiUnicoInvio: validated.campiUnicoInvio || null,
        numeroMaxIstanze: validated.numeroMaxIstanze || null,
        avvisoSoglia: validated.avvisoSoglia || null,
        msgExtraModulo: validated.msgExtraModulo || null,
        prevedeDocumentoFinale: validated.prevedeDocumentoFinale,
        templateDocumentoFinale: validated.templateDocumentoFinale || null,
        nomeDocumentoFinale: validated.nomeDocumentoFinale || null,
        servizioId: validated.servizioId,
        ufficioId: validated.ufficioId || null,
        steps: {
          create: validated.steps.map((step) => ({
            descrizione: step.descrizione,
            ordine: step.ordine,
            attivo: step.attivo,
            pagamento: step.pagamento,
            allegati: step.allegati,
            allegatiOp: step.allegatiOp,
            allegatiRequired: step.allegatiRequired,
            allegatiOpRequired: step.allegatiOpRequired,
            protocollo: step.protocollo,
            unitaOrganizzativa: step.unitaOrganizzativa || null,
          })),
        },
      },
    });
  });

  revalidatePath('/moduli');
  revalidatePath(`/moduli/${id}`);
  redirect('/moduli');
}

export async function deleteModulo(id: number) {
  // Check for dependent istanze
  const istanzeCount = await prisma.istanza.count({
    where: { moduloId: id },
  });

  if (istanzeCount > 0) {
    return { error: `Impossibile eliminare: il modulo ha ${istanzeCount} istanze associate` };
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
    include: { steps: true },
  });

  if (!original) {
    return { error: 'Modulo non trovato' };
  }

  // Generate unique slug
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
      dataInizio: original.dataInizio,
      dataFine: original.dataFine,
      attivo: false, // Cloned modulo starts as inactive
      campiInEvidenza: original.campiInEvidenza,
      campiDaEsportare: original.campiDaEsportare,
      unicoInvio: original.unicoInvio,
      unicoInvioPerUtente: original.unicoInvioPerUtente,
      campiUnicoInvio: original.campiUnicoInvio,
      numeroMaxIstanze: original.numeroMaxIstanze,
      avvisoSoglia: original.avvisoSoglia,
      msgExtraModulo: original.msgExtraModulo,
      prevedeDocumentoFinale: original.prevedeDocumentoFinale,
      templateDocumentoFinale: original.templateDocumentoFinale,
      nomeDocumentoFinale: original.nomeDocumentoFinale,
      servizioId: original.servizioId,
      ufficioId: original.ufficioId,
      steps: {
        create: original.steps.map((step) => ({
          descrizione: step.descrizione,
          ordine: step.ordine,
          attivo: step.attivo,
          pagamento: step.pagamento,
          allegati: step.allegati,
          allegatiOp: step.allegatiOp,
          allegatiRequired: step.allegatiRequired,
          allegatiOpRequired: step.allegatiOpRequired,
          protocollo: step.protocollo,
          unitaOrganizzativa: step.unitaOrganizzativa,
        })),
      },
    },
  });

  revalidatePath('/moduli');
  redirect(`/moduli/${cloned.id}`);
}
