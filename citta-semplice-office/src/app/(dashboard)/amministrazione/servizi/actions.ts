'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { servizioSchema, type ServizioFormData } from '@/lib/validations/servizio';

function buildStepData(step: ServizioFormData['steps'][number], idx: number) {
  return {
    descrizione: step.descrizione,
    ordine: idx + 1,
    attivo: step.attivo,
    pagamento: step.pagamento,
    allegati: step.allegati,
    allegatiOp: step.allegatiOp,
    allegatiRequired: step.allegatiRequired,
    allegatiOpRequired: step.allegatiOpRequired,
    protocollo: step.protocollo,
    tipoProtocollo: step.tipoProtocollo || null,
    unitaOrganizzativa: step.unitaOrganizzativa || null,
    numerazioneInterna: step.numerazioneInterna,
  };
}

async function createAllegatiRichiestiForStep(stepId: number, step: ServizioFormData['steps'][number]) {
  if (!step.allegatiRichiestiList || step.allegatiRichiestiList.length === 0) return;
  await prisma.allegatoRichiesto.createMany({
    data: step.allegatiRichiestiList.map((a) => ({
      stepId,
      nomeAllegatoRichiesto: a.nomeAllegatoRichiesto,
      obbligatorio: a.obbligatorio,
      interno: a.interno,
      soggetto: a.soggetto,
    })),
  });
}

async function upsertPagamentoForStep(stepId: number, step: ServizioFormData['steps'][number]) {
  if (!step.pagamento) return;

  await prisma.pagamento.upsert({
    where: { stepId },
    create: {
      stepId,
      codiceTributoId: step.pagamentoCodiceTributoId || null,
      importo: step.pagamentoImportoVariabile ? null : (step.pagamentoImporto ?? null),
      importoVariabile: step.pagamentoImportoVariabile,
      causale: step.pagamentoCausale || null,
      causaleVariabile: step.pagamentoCausaleVariabile,
      obbligatorio: step.pagamentoObbligatorio,
      tipologiaPagamento: step.pagamentoTipologia || null,
    },
    update: {
      codiceTributoId: step.pagamentoCodiceTributoId || null,
      importo: step.pagamentoImportoVariabile ? null : (step.pagamentoImporto ?? null),
      importoVariabile: step.pagamentoImportoVariabile,
      causale: step.pagamentoCausale || null,
      causaleVariabile: step.pagamentoCausaleVariabile,
      obbligatorio: step.pagamentoObbligatorio,
      tipologiaPagamento: step.pagamentoTipologia || null,
    },
  });
}

function buildServizioData(validated: ServizioFormData) {
  return {
    titolo: validated.titolo,
    sottoTitolo: validated.sottoTitolo || undefined,
    descrizione: validated.descrizione || undefined,
    comeFare: validated.comeFare || undefined,
    cosaServe: validated.cosaServe || undefined,
    altreInfo: validated.altreInfo || undefined,
    contatti: validated.contatti || undefined,
    slug: validated.slug || undefined,
    icona: validated.icona || undefined,
    ordine: validated.ordine,
    attivo: validated.attivo,
    areaId: validated.areaId,
    ufficioId: validated.ufficioId || undefined,
    dataInizio: validated.dataInizio ? new Date(validated.dataInizio) : undefined,
    dataFine: validated.dataFine ? new Date(validated.dataFine) : undefined,
    unicoInvio: validated.unicoInvio,
    unicoInvioPerUtente: validated.unicoInvioPerUtente,
    campiUnicoInvio: validated.campiUnicoInvio || undefined,
    numeroMaxIstanze: validated.numeroMaxIstanze || undefined,
    msgSopraSoglia: validated.msgSopraSoglia || undefined,
    msgExtraServizio: validated.msgExtraServizio || undefined,
    campiInEvidenza: validated.campiInEvidenza || undefined,
    campiDaEsportare: validated.campiDaEsportare || undefined,
    // prevedeDocumentoFinale: validated.prevedeDocumentoFinale,
    // templateDocumentoFinale: validated.templateDocumentoFinale || null,
    // nomeDocumentoFinale: validated.nomeDocumentoFinale || null,
    attributi: validated.attributi || undefined,
    postFormValidation: validated.postFormValidation,
    postFormValidationAPI: validated.postFormValidationAPI || undefined,
    postFormValidationFields: validated.postFormValidationFields || undefined,
  };
}

function buildRicevutaArt18Data(r: NonNullable<ServizioFormData['ricevutaArt18']>) {
  return {
    richiestaArt18: r.richiestaArt18,
    unitaOrganizzativaCompetente: r.unitaOrganizzativaCompetente || null,
    ufficioCompetente: r.ufficioCompetente || null,
    responsabileProcedimento: r.responsabileProcedimento || null,
    durataMassimaProcedimento: r.durataMassimaProcedimento ?? null,
    responsabileProvvedimentoFinale: r.responsabileProvvedimentoFinale || null,
    personaPotereSostitutivo: r.personaPotereSostitutivo || null,
    urlServizioWeb: r.urlServizioWeb || null,
    ufficioRicevimento: r.ufficioRicevimento || null,
  };
}

export async function createServizio(data: ServizioFormData) {
  const validated = servizioSchema.parse(data);

  const servizio = await prisma.servizio.create({
    data: {
      ...buildServizioData(validated),
      steps: {
        create: validated.steps.map((step, idx) => buildStepData(step, idx)),
      },
      ...(validated.ricevutaArt18 && {
        ricevuta: { create: buildRicevutaArt18Data(validated.ricevutaArt18) },
      }),
    },
    include: { steps: true },
  });

  for (let i = 0; i < validated.steps.length; i++) {
    const step = validated.steps[i];
    const createdStep = servizio.steps.find((s) => s.ordine === i + 1);
    if (createdStep) {
      if (step.pagamento) await upsertPagamentoForStep(createdStep.id, step);
      await createAllegatiRichiestiForStep(createdStep.id, step);
    }
  }

  revalidatePath('/servizi');
  return { success: true, message: 'Servizio creato con successo' };
}

export async function updateServizio(id: number, data: ServizioFormData) {
  const validated = servizioSchema.parse(data);

  const steps = await prisma.$transaction(async (tx) => {
    await tx.step.deleteMany({ where: { servizioId: id } });

    await tx.servizio.update({
      where: { id },
      data: {
        ...buildServizioData(validated),
        steps: {
          create: validated.steps.map((step, idx) => buildStepData(step, idx)),
        },
        ...(validated.ricevutaArt18 && {
          ricevuta: {
            upsert: {
              create: buildRicevutaArt18Data(validated.ricevutaArt18),
              update: buildRicevutaArt18Data(validated.ricevutaArt18),
            },
          },
        }),
      },
    });

    return tx.step.findMany({
      where: { servizioId: id },
      orderBy: { ordine: 'asc' },
    });
  });

  for (let i = 0; i < validated.steps.length; i++) {
    const step = validated.steps[i];
    const createdStep = steps.find((s) => s.ordine === i + 1);
    if (createdStep) {
      if (step.pagamento) await upsertPagamentoForStep(createdStep.id, step);
      await createAllegatiRichiestiForStep(createdStep.id, step);
    }
  }

  revalidatePath('/servizi');
  revalidatePath(`/servizi/${id}`);
  return { success: true, message: 'Servizio aggiornato con successo' };
}

export async function deleteServizio(id: number) {
  const istanzeCount = await prisma.istanza.count({
    where: { servizioId: id },
  });

  if (istanzeCount > 0) {
    return { success: false, message: `Impossibile eliminare: il servizio ha ${istanzeCount} istanze associate` };
  }

  await prisma.servizio.delete({ where: { id } });

  revalidatePath('/servizi');
  return { success: true, message: 'Servizio eliminato con successo' };
}

export async function cloneServizio(id: number) {
  const original = await prisma.servizio.findUnique({
    where: { id },
    include: {
      steps: {
        include: { pagamentoConfig: true, allegatiRichiestiList: true },
        orderBy: { ordine: 'asc' },
      },
    },
  });

  if (!original) {
    return { error: 'Servizio non trovato' };
  }

  // Deactivate original
  await prisma.servizio.update({
    where: { id },
    data: { attivo: false },
  });

  // Generate new slug
  let newSlug = original.slug ? `${original.slug}-copia` : undefined;
  if (newSlug) {
    let counter = 1;
    while (await prisma.servizio.findFirst({ where: { slug: newSlug } })) {
      newSlug = `${original.slug}-copia-${counter}`;
      counter++;
    }
  }

  const cloned = await prisma.servizio.create({
    data: {
      titolo: `${original.titolo} (Copia)`,
      sottoTitolo: original.sottoTitolo,
      descrizione: original.descrizione,
      comeFare: original.comeFare,
      cosaServe: original.cosaServe,
      altreInfo: original.altreInfo,
      contatti: original.contatti,
      slug: newSlug,
      icona: original.icona,
      ordine: original.ordine,
      attivo: false,
      areaId: original.areaId,
      ufficioId: original.ufficioId,
      dataInizio: original.dataInizio,
      dataFine: original.dataFine,
      unicoInvio: original.unicoInvio,
      unicoInvioPerUtente: original.unicoInvioPerUtente,
      campiUnicoInvio: original.campiUnicoInvio,
      numeroMaxIstanze: original.numeroMaxIstanze,
      msgSopraSoglia: original.msgSopraSoglia,
      msgExtraServizio: original.msgExtraServizio,
      campiInEvidenza: original.campiInEvidenza,
      campiDaEsportare: original.campiDaEsportare,
      // prevedeDocumentoFinale: original.prevedeDocumentoFinale,
      // templateDocumentoFinale: original.templateDocumentoFinale,
      // nomeDocumentoFinale: original.nomeDocumentoFinale,
      //moduloTipo: original.moduloTipo,
      attributi: original.attributi,
      postFormValidation: original.postFormValidation,
      postFormValidationAPI: original.postFormValidationAPI,
      postFormValidationFields: original.postFormValidationFields,
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
          tipoProtocollo: step.tipoProtocollo,
          unitaOrganizzativa: step.unitaOrganizzativa,
          numerazioneInterna: step.numerazioneInterna,
        })),
      },
    },
    include: { steps: true },
  });

  // Clone payment configs and allegati richiesti
  for (const originalStep of original.steps) {
    const clonedStep = cloned.steps.find((s) => s.ordine === originalStep.ordine);
    if (!clonedStep) continue;

    if (originalStep.pagamentoConfig) {
      await prisma.pagamento.create({
        data: {
          stepId: clonedStep.id,
          codiceTributoId: originalStep.pagamentoConfig.codiceTributoId,
          importo: originalStep.pagamentoConfig.importo,
          importoVariabile: originalStep.pagamentoConfig.importoVariabile,
          causale: originalStep.pagamentoConfig.causale,
          causaleVariabile: originalStep.pagamentoConfig.causaleVariabile,
          obbligatorio: originalStep.pagamentoConfig.obbligatorio,
          tipologiaPagamento: originalStep.pagamentoConfig.tipologiaPagamento,
        },
      });
    }

    if (originalStep.allegatiRichiestiList.length > 0) {
      await prisma.allegatoRichiesto.createMany({
        data: originalStep.allegatiRichiestiList.map((a) => ({
          stepId: clonedStep.id,
          nomeAllegatoRichiesto: a.nomeAllegatoRichiesto,
          obbligatorio: a.obbligatorio,
          interno: a.interno,
          soggetto: a.soggetto,
        })),
      });
    }
  }

  revalidatePath('/servizi');
  redirect(`/servizi/${cloned.id}`);
}
