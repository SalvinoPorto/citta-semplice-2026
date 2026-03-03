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
      sottoTitolo: validated.sottoTitolo || null,
      descrizione: validated.descrizione || null,
      comeFare: validated.comeFare || null,
      cosaServe: validated.cosaServe || null,
      altreInfo: validated.altreInfo || null,
      contatti: validated.contatti || null,
      slug: validated.slug || null,
      icona: validated.icona || null,
      ordine: validated.ordine,
      attivo: validated.attivo,
      areaId: validated.areaId,
      moduloId: validated.moduloId || null,
      ufficioId: validated.ufficioId || null,
      dataInizio: validated.dataInizio ? new Date(validated.dataInizio) : null,
      dataFine: validated.dataFine ? new Date(validated.dataFine) : null,
      unicoInvio: validated.unicoInvio,
      unicoInvioPerUtente: validated.unicoInvioPerUtente,
      campiUnicoInvio: validated.campiUnicoInvio || null,
      numeroMaxIstanze: validated.numeroMaxIstanze || null,
      avvisoSoglia: validated.avvisoSoglia || null,
      msgExtraServizio: validated.msgExtraServizio || null,
      campiInEvidenza: validated.campiInEvidenza || null,
      campiDaEsportare: validated.campiDaEsportare || null,
      prevedeDocumentoFinale: validated.prevedeDocumentoFinale,
      templateDocumentoFinale: validated.templateDocumentoFinale || null,
      nomeDocumentoFinale: validated.nomeDocumentoFinale || null,
      steps: {
        create: validated.steps.map((step, idx) => ({
          descrizione: step.descrizione,
          ordine: idx + 1,
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

  revalidatePath('/servizi');
  redirect('/servizi');
}

export async function updateServizio(id: number, data: ServizioFormData) {
  const validated = servizioSchema.parse(data);

  await prisma.$transaction(async (tx) => {
    // Recreate steps
    await tx.step.deleteMany({ where: { servizioId: id } });

    await tx.servizio.update({
      where: { id },
      data: {
        titolo: validated.titolo,
        sottoTitolo: validated.sottoTitolo || null,
        descrizione: validated.descrizione || null,
        comeFare: validated.comeFare || null,
        cosaServe: validated.cosaServe || null,
        altreInfo: validated.altreInfo || null,
        contatti: validated.contatti || null,
        slug: validated.slug || null,
        icona: validated.icona || null,
        ordine: validated.ordine,
        attivo: validated.attivo,
        areaId: validated.areaId,
        moduloId: validated.moduloId || null,
        ufficioId: validated.ufficioId || null,
        dataInizio: validated.dataInizio ? new Date(validated.dataInizio) : null,
        dataFine: validated.dataFine ? new Date(validated.dataFine) : null,
        unicoInvio: validated.unicoInvio,
        unicoInvioPerUtente: validated.unicoInvioPerUtente,
        campiUnicoInvio: validated.campiUnicoInvio || null,
        numeroMaxIstanze: validated.numeroMaxIstanze || null,
        avvisoSoglia: validated.avvisoSoglia || null,
        msgExtraServizio: validated.msgExtraServizio || null,
        campiInEvidenza: validated.campiInEvidenza || null,
        campiDaEsportare: validated.campiDaEsportare || null,
        prevedeDocumentoFinale: validated.prevedeDocumentoFinale,
        templateDocumentoFinale: validated.templateDocumentoFinale || null,
        nomeDocumentoFinale: validated.nomeDocumentoFinale || null,
        steps: {
          create: validated.steps.map((step, idx) => ({
            descrizione: step.descrizione,
            ordine: idx + 1,
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

  revalidatePath('/servizi');
  revalidatePath(`/servizi/${id}`);
  redirect('/servizi');
}

export async function deleteServizio(id: number) {
  const istanzeCount = await prisma.istanza.count({
    where: { servizioId: id },
  });

  if (istanzeCount > 0) {
    return { error: `Impossibile eliminare: il servizio ha ${istanzeCount} istanze associate` };
  }

  await prisma.servizio.delete({
    where: { id },
  });

  revalidatePath('/servizi');
  redirect('/servizi');
}
