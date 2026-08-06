'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { Prisma } from '@citta/db';
import { servizioSchema, type ServizioFormData } from '@/lib/validations/servizio';
import { pianoRinumerazione } from './ordini';

// Client Prisma "generico": in createServizio è il client top-level, in
// updateServizio è il client transazionale (tx). Le funzioni ausiliarie
// condivise fra le due lo ricevono come parametro invece di chiudere sempre
// su `prisma`, così updateServizio può eseguirle dentro la propria transazione.
type PrismaClientOrTx = Prisma.TransactionClient;

function buildStepData(step: ServizioFormData['steps'][number], faseId?: number) {
  return {
    descrizione: step.descrizione,
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
    ...(faseId !== undefined && { faseId }),
  };
}

async function upsertFasi(
  tx: PrismaClientOrTx,
  servizioId: number,
  fasiFormData: ServizioFormData['fasi'],
): Promise<Array<{ ordine: number; id: number }>> {
  const faseSalvate: Array<{ ordine: number; id: number }> = [];

  for (let i = 0; i < fasiFormData.length; i++) {
    const faseData = fasiFormData[i];
    if (faseData.id) {
      const fase = await tx.fase.update({
        where: { id: faseData.id },
        data: {
          nome: faseData.nome,
          ordine: i + 1,
          ufficioId: faseData.ufficioId!, // A7: garantito non-null dalla validazione (Fase.ufficioId NOT NULL)
        },
      });
      faseSalvate.push({ ordine: i + 1, id: fase.id });
    } else {
      const fase = await tx.fase.create({
        data: {
          nome: faseData.nome,
          ordine: i + 1,
          servizioId,
          ufficioId: faseData.ufficioId!, // A7: garantito non-null dalla validazione (Fase.ufficioId NOT NULL)
        },
      });
      faseSalvate.push({ ordine: i + 1, id: fase.id });
    }
  }

  // Elimina fasi non più nel form (usa gli id effettivi salvati, incluse le nuove)
  await tx.fase.deleteMany({
    where: {
      servizioId,
      id: { notIn: faseSalvate.length > 0 ? faseSalvate.map((f) => f.id) : [-1] },
    },
  });

  return faseSalvate;
}

function getFaseId(faseSalvate: Array<{ ordine: number; id: number }>, faseOrdine: number): number | undefined {
  return faseSalvate.find((f) => f.ordine === faseOrdine)?.id ?? faseSalvate[0]?.id;
}

async function createAllegatiRichiestiForStep(
  tx: PrismaClientOrTx,
  stepId: number,
  step: ServizioFormData['steps'][number],
) {
  if (!step.allegatiRichiestiList || step.allegatiRichiestiList.length === 0) return;
  await tx.allegatoRichiesto.createMany({
    data: step.allegatiRichiestiList.map((a) => ({
      stepId,
      nomeAllegatoRichiesto: a.nomeAllegatoRichiesto,
      obbligatorio: a.obbligatorio,
      interno: a.interno,
      soggetto: a.soggetto,
    })),
  });
}

async function upsertPagamentoForStep(
  tx: PrismaClientOrTx,
  stepId: number,
  step: ServizioFormData['steps'][number],
) {
  if (!step.pagamento) return;

  await tx.pagamento.upsert({
    where: { stepId },
    create: {
      stepId,
      codiceTributo: step.pagamentoCodiceTributo || null,
      descrizioneTributo: step.pagamentoDescrizioneTributo || null,
      importo: step.pagamentoImportoVariabile ? null : (step.pagamentoImporto ?? null),
      importoVariabile: step.pagamentoImportoVariabile,
      causale: step.pagamentoCausale || null,
      causaleVariabile: step.pagamentoCausaleVariabile,
      obbligatorio: step.pagamentoObbligatorio,
      tipologiaPagamento: step.pagamentoTipologia || null,
    },
    update: {
      codiceTributo: step.pagamentoCodiceTributo || null,
      descrizioneTributo: step.pagamentoDescrizioneTributo || null,
      importo: step.pagamentoImportoVariabile ? null : (step.pagamentoImporto ?? null),
      importoVariabile: step.pagamentoImportoVariabile,
      causale: step.pagamentoCausale || null,
      causaleVariabile: step.pagamentoCausaleVariabile,
      obbligatorio: step.pagamentoObbligatorio,
      tipologiaPagamento: step.pagamentoTipologia || null,
    },
  });
}

// I campi opzionali svuotati dall'operatore vanno scritti come `null`, non come
// `undefined`: in un update Prisma ignora le chiavi `undefined`, quindi il valore
// precedente resterebbe in DB e il campo risulterebbe impossibile da svuotare.
// Fa eccezione `slug`, colonna NOT NULL: se vuoto si mantiene quello esistente.
function buildServizioData(validated: ServizioFormData) {
  return {
    titolo: validated.titolo,
    sottoTitolo: validated.sottoTitolo || null,
    descrizione: validated.descrizione || null,
    comeFare: validated.comeFare || null,
    cosaServe: validated.cosaServe || null,
    altreInfo: validated.altreInfo || null,
    contatti: validated.contatti || null,
    slug: validated.slug || undefined,
    icona: validated.icona || null,
    ordine: validated.ordine,
    attivo: validated.attivo,
    areaId: validated.areaId,
    ufficioId: validated.ufficioId ?? null,
    dataInizio: validated.dataInizio ? new Date(validated.dataInizio) : null,
    dataFine: validated.dataFine ? new Date(validated.dataFine) : null,
    unicoInvio: validated.unicoInvio,
    unicoInvioPerUtente: validated.unicoInvioPerUtente,
    campiUnicoInvio: validated.campiUnicoInvio || null,
    numeroMaxIstanze: validated.numeroMaxIstanze ?? null,
    msgSopraSoglia: validated.msgSopraSoglia || null,
    msgExtraServizio: validated.msgExtraServizio || null,
    campiInEvidenza: validated.campiInEvidenza || null,
    campiDaEsportare: validated.campiDaEsportare || null,
    // prevedeDocumentoFinale: validated.prevedeDocumentoFinale,
    // templateDocumentoFinale: validated.templateDocumentoFinale || null,
    // nomeDocumentoFinale: validated.nomeDocumentoFinale || null,
    attributi: validated.attributi || null,
    postFormValidation: validated.postFormValidation,
    postFormValidationAPI: validated.postFormValidationAPI || null,
    postFormValidationFields: validated.postFormValidationFields || null,
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

  // Crea il servizio senza step (le fasi devono esistere prima degli step)
  const servizio = await prisma.servizio.create({
    data: {
      ...buildServizioData(validated),
      ...(validated.ricevutaArt18 && {
        ricevuta: { create: buildRicevutaArt18Data(validated.ricevutaArt18) },
      }),
    },
  });

  // Crea le fasi
  const faseSalvate = await upsertFasi(prisma, servizio.id, validated.fasi);

  // Crea gli step con faseId
  const createdSteps: { id: number; ordine: number }[] = [];
  for (let i = 0; i < validated.steps.length; i++) {
    const step = validated.steps[i];
    const faseId = getFaseId(faseSalvate, step.faseOrdine);
    const created = await prisma.step.create({
      data: { ...buildStepData(step, faseId), ordine: i + 1, servizioId: servizio.id },
    });
    createdSteps.push({ id: created.id, ordine: i + 1 });
  }

  for (let i = 0; i < validated.steps.length; i++) {
    const step = validated.steps[i];
    const createdStep = createdSteps.find((s) => s.ordine === i + 1);
    if (createdStep) {
      if (step.pagamento) await upsertPagamentoForStep(prisma, createdStep.id, step);
      await createAllegatiRichiestiForStep(prisma, createdStep.id, step);
    }
  }

  revalidatePath('/amministrazione/servizi');
  return { success: true, message: 'Servizio creato con successo' };
}

export async function updateServizio(id: number, data: ServizioFormData) {
  const validated = servizioSchema.parse(data);

  // Tutto il salvataggio va in un'unica transazione: senza, un fallimento a
  // metà (per esempio nel ciclo sugli step) lascerebbe il servizio con le
  // fasi nuove ma gli step vecchi, uno stato incoerente in DB.
  await prisma.$transaction(async (tx) => {
    // IDs degli step presenti nel form (quelli già esistenti nel DB)
    const formStepIds = validated.steps
      .map((s) => s.id)
      .filter((sid): sid is number => sid !== undefined);

    // Step attualmente nel DB per questo servizio
    const existingSteps = await tx.step.findMany({
      where: { servizioId: id },
      select: { id: true },
    });
    const existingStepIds = existingSteps.map((s) => s.id);

    // Step rimossi dal form
    const removedIds = existingStepIds.filter((sid) => !formStepIds.includes(sid));

    // Per gli step rimossi: se referenziati da workflow → soft delete, altrimenti hard delete
    if (removedIds.length > 0) {
      const referencedIds = (
        await tx.workflow.findMany({
          where: { stepId: { in: removedIds } },
          select: { stepId: true },
          distinct: ['stepId'],
        })
      ).map((w) => w.stepId).filter((sid): sid is number => sid !== null);

      const toSoftDelete = removedIds.filter((sid) => referencedIds.includes(sid));
      const toHardDelete = removedIds.filter((sid) => !referencedIds.includes(sid));

      if (toSoftDelete.length > 0) {
        // L'indice univoco su (servizioId, ordine) è PARZIALE (WHERE attivo):
        // gli step disattivati non vi partecipano già, quindi non serve
        // liberarne l'ordine. Lo conservano, come valore storico.
        await tx.step.updateMany({
          where: { id: { in: toSoftDelete } },
          data: { attivo: false },
        });
      }
      if (toHardDelete.length > 0) {
        await tx.step.deleteMany({ where: { id: { in: toHardDelete } } });
      }
    }

    // Aggiorna i dati base del servizio e la ricevuta art18
    await tx.servizio.update({
      where: { id },
      data: {
        ...buildServizioData(validated),
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

    // Upsert delle fasi
    const faseSalvate = await upsertFasi(tx, id, validated.fasi);

    // Upsert degli step: crea i nuovi con un ordine temporaneo negativo e
    // aggiorna solo i campi non-ordine di quelli esistenti. L'ordine
    // definitivo è assegnato subito dopo tramite pianoRinumerazione, per
    // evitare le collisioni transitorie che una riscrittura sequenziale
    // (UPDATE ordine = i + 1 una alla volta) produrrebbe sull'indice univoco.
    const savedSteps: { id: number; ordine: number }[] = [];

    for (let i = 0; i < validated.steps.length; i++) {
      const step = validated.steps[i];
      const faseId = getFaseId(faseSalvate, step.faseOrdine);
      const stepData = buildStepData(step, faseId);

      if (step.id) {
        // Step esistente → update dei soli campi non-ordine
        await tx.step.update({
          where: { id: step.id },
          data: stepData,
        });
        savedSteps.push({ id: step.id, ordine: i + 1 });
      } else {
        // Nuovo step → create con ordine temporaneo negativo
        const created = await tx.step.create({
          data: { ...stepData, ordine: -(i + 1), servizioId: id },
        });
        savedSteps.push({ id: created.id, ordine: i + 1 });
      }
    }

    // Rinumerazione senza collisioni: prima tutti gli step escono dallo
    // spazio degli ordini finali (temporanei negativi), poi vengono portati
    // a destinazione (finali 1..n, nell'ordine del form).
    const piano = pianoRinumerazione(savedSteps.map((s) => ({ id: s.id })));
    for (const t of piano.temporanei) {
      await tx.step.update({ where: { id: t.id }, data: { ordine: t.ordine } });
    }
    for (const f of piano.finali) {
      await tx.step.update({ where: { id: f.id }, data: { ordine: f.ordine } });
    }

    // Aggiorna pagamento e allegati richiesti per ogni step
    for (let i = 0; i < validated.steps.length; i++) {
      const step = validated.steps[i];
      const saved = savedSteps.find((s) => s.ordine === i + 1);
      if (!saved) continue;

      // Pagamento: upsert se attivo, elimina se disattivato
      if (step.pagamento) {
        await upsertPagamentoForStep(tx, saved.id, step);
      } else {
        await tx.pagamento.deleteMany({ where: { stepId: saved.id } });
      }

      // AllegatiRichiesti: ricrea sempre (non hanno FK da workflow)
      await tx.allegatoRichiesto.deleteMany({ where: { stepId: saved.id } });
      await createAllegatiRichiestiForStep(tx, saved.id, step);
    }
  });

  revalidatePath('/amministrazione/servizi');
  revalidatePath(`/amministrazione/servizi/${id}`);
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

  revalidatePath('/amministrazione/servizi');
  return { success: true, message: 'Servizio eliminato con successo' };
}

export async function cloneServizio(id: number) {
  // In transazione: senza, un fallimento a metà (per esempio nel loop di
  // pagamenti/allegati) lascerebbe il servizio originale già disattivato
  // con un clone orfano, offline per i cittadini senza un sostituto valido.
  const clonedId = await prisma.$transaction(async (tx) => {
    const original = await tx.servizio.findUnique({
      where: { id },
      include: {
        steps: {
          include: { pagamentoConfig: true, allegatiRichiestiList: true },
          orderBy: { ordine: 'asc' },
        },
      },
    });

    if (!original) {
      return null;
    }

    // Deactivate original
    await tx.servizio.update({
      where: { id },
      data: { attivo: false },
    });

    // Generate new slug
    let newSlug = original.slug ? `${original.slug}-copia` : undefined;
    if (newSlug) {
      let counter = 1;
      while (await tx.servizio.findFirst({ where: { slug: newSlug } })) {
        newSlug = `${original.slug}-copia-${counter}`;
        counter++;
      }
    }

    const cloned = await tx.servizio.create({
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
      // orderBy id: gli step clonati sono creati nello stesso ordine
      // dell'array `original.steps` (id autoincrementali), quindi l'indice
      // di posizione i-esimo corrisponde all'i-esimo step originale.
      include: { steps: { orderBy: { id: 'asc' } } },
    });

    // Clone payment configs e allegati richiesti: corrispondenza
    // POSIZIONALE (stesso ordine di creazione fra i due array), non per
    // `ordine` — che con step disattivati può ripetersi, facendo collidere
    // più step originali sullo stesso step clonato (Pagamento.stepId @unique
    // → P2002, allegati accatastati su un solo step).
    for (let i = 0; i < original.steps.length; i++) {
      const originalStep = original.steps[i];
      const clonedStep = cloned.steps[i];
      if (!clonedStep) continue;

      if (originalStep.pagamentoConfig) {
        await tx.pagamento.create({
          data: {
            stepId: clonedStep.id,
            codiceTributo: originalStep.pagamentoConfig.codiceTributo,
            descrizioneTributo: originalStep.pagamentoConfig.descrizioneTributo,
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
        await tx.allegatoRichiesto.createMany({
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

    return cloned.id;
  });

  if (clonedId === null) {
    return { error: 'Servizio non trovato' };
  }

  revalidatePath('/amministrazione/servizi');
  redirect(`/amministrazione/servizi/${clonedId}`);
}
