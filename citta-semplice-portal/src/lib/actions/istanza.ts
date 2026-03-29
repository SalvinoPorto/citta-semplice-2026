'use server';

import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { protocolla, generaProtocolloEmergenza } from '@/lib/services/protocollazione/UrbiProtocolloService';
import { generaModuloBuffer, generaDocumentoPdf } from '@/lib/services/documenti/DocumentiService';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/allegati';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Normalizza il nome del file: sostituisce caratteri problematici con underscore,
 * aggiunge sempre l'estensione .pdf.
 */
function normalizzaNomeFile(nomeOriginale: string): string {
  const senzaExt = nomeOriginale.replace(/\.pdf$/i, '');
  const normalizzato = senzaExt
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (normalizzato || 'allegato') + '.pdf';
}

/**
 * Valida che il file sia un PDF e non superi 10 MB.
 * Restituisce un messaggio di errore oppure null se valido.
 */
function validaFile(file: File): string | null {
  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return `"${file.name}" non è un file PDF. Sono ammessi solo file PDF.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" supera la dimensione massima consentita di 10 MB.`;
  }
  return null;
}

async function salvaFileAllegati(
  files: File[],
  allegatiIds: number[],
  workflowId: number,
) {
  if (files.length === 0) return;

  const now = new Date();
  const anno = String(now.getFullYear());
  const mese = String(now.getMonth() + 1).padStart(2, '0');
  const giorno = String(now.getDate()).padStart(2, '0');

  // Percorso relativo: anno/mese/giorno
  const relDir = join(anno, mese, giorno);
  const absDir = join(UPLOAD_DIR, relDir);
  await mkdir(absDir, { recursive: true });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const allegatoId = allegatiIds[i];
    const uuid = randomUUID();
    // Percorso relativo salvato in nomeHash: anno/mese/giorno/uuid
    const nomeHash = join(relDir, uuid);

    const bytes = await file.arrayBuffer();
    await writeFile(join(absDir, uuid), Buffer.from(bytes));

    const allegatoRichiesto = allegatoId
      ? await prisma.allegatoRichiesto.findUnique({ where: { id: allegatoId } })
      : null;

    await prisma.allegato.create({
      data: {
        nomeFile: normalizzaNomeFile(file.name),
        nomeHash,
        nomeFileRichiesto: allegatoRichiesto?.nomeAllegatoRichiesto ?? null,
        mimeType: 'application/pdf',
        invUtente: true,
        visto: false,
        dataInserimento: now,
        workflowId,
      },
    });
  }
}

function estraiDatiInEvidenza(
  datiRaw: string | null | undefined,
  campiInEvidenza: string | null | undefined,
): string | null {
  if (!datiRaw || !campiInEvidenza) return null;
  const campi = campiInEvidenza.split(',').map((c) => c.trim()).filter(Boolean);
  if (campi.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(datiRaw);
  } catch {
    return null;
  }

  // I dati sono serializzati come array [{name, label, value}] da buildDatiConLabel
  let datiMap: Record<string, string>;
  if (Array.isArray(parsed)) {
    datiMap = Object.fromEntries(
      (parsed as Array<{ name: string; value: string }>)
        .filter((e) => e.name)
        .map((e) => [e.name, e.value ?? ''])
    );
  } else if (parsed && typeof parsed === 'object') {
    datiMap = parsed as Record<string, string>;
  } else {
    return null;
  }

  const valori = campi
    .map((campo) => {
      const val = datiMap[campo];
      return val !== null && val !== undefined && val !== '' ? String(val) : null;
    })
    .filter((v): v is string => v !== null);
  return valori.length > 0 ? valori.join(' | ') : null;
}

type DatiDocumenti = {
  istanza: { id: number; protoNumero: string | null; protoData: Date | null; dataInvio: Date | null; municipalita: string | null };
  servizio: { titolo: string; areaNome: string };
  ricevuta: { intestazione: string | null; corpo: string | null; footer: string | null } | null;
  datiRaw: string | null;
};

async function salvaDocumentiInterni(
  istanzaId: number,
  workflowId: number | null,
  dati: DatiDocumenti,
): Promise<void> {
  if (!workflowId) return;

  try {
    // Documento finale: modulo con proto numero + ricevuta art.18 accodata (se configurata)
    const doc = await generaDocumentoPdf(dati.istanza, dati.servizio, dati.datiRaw, dati.ricevuta);
    await prisma.allegato.create({
      data: {
        nomeFile: doc.nomeFile,
        nomeHash: doc.nomeHash,
        nomeFileRichiesto: dati.ricevuta ? 'Modulo e ricevuta art. 18' : 'Modulo istanza',
        mimeType: 'application/pdf',
        invUtente: false,
        visto: false,
        dataInserimento: new Date(),
        workflowId,
      },
    });
  } catch (err) {
    console.error(`Errore generazione documento PDF (istanza ${istanzaId}):`, err);
  }
}

export async function salvaBozza(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Non autenticato' };
  }

  const servizioId = Number(formData.get('servizioId'));
  const datiRaw = formData.get('dati');
  const activeStep = Number(formData.get('activeStep') ?? 0);
  const bozzaId = formData.get('bozzaId') ? Number(formData.get('bozzaId')) : null;

  if (!servizioId || isNaN(servizioId)) {
    return { error: 'Servizio non valido' };
  }

  const utente = await prisma.utente.findUnique({
    where: { id: Number(session.user.id) },
  });

  if (!utente) {
    return { error: 'Utente non trovato' };
  }

  try {
    if (bozzaId) {
      const bozza = await prisma.istanza.findFirst({
        where: { id: bozzaId, utenteId: utente.id, inBozza: true },
      });
      if (!bozza) return { error: 'Bozza non trovata' };

      await prisma.istanza.update({
        where: { id: bozzaId },
        data: {
          dati: datiRaw ? String(datiRaw) : null,
          activeStep,
        },
      });
      return { success: true, bozzaId };
    }

    const bozzaEsistente = await prisma.istanza.findFirst({
      where: { servizioId, utenteId: utente.id, inBozza: true },
    });

    if (bozzaEsistente) {
      await prisma.istanza.update({
        where: { id: bozzaEsistente.id },
        data: {
          dati: datiRaw ? String(datiRaw) : null,
          activeStep,
        },
      });
      return { success: true, bozzaId: bozzaEsistente.id };
    }

    const nuovaBozza = await prisma.istanza.create({
      data: {
        dati: datiRaw ? String(datiRaw) : null,
        inBozza: true,
        activeStep,
        utenteId: utente.id,
        servizioId,
      },
    });
    return { success: true, bozzaId: nuovaBozza.id };
  } catch (error) {
    console.error('Errore salvataggio bozza:', error);
    return { error: 'Errore durante il salvataggio della bozza. Riprova.' };
  }
}

export async function submitIstanza(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Non autenticato' };
  }

  const servizioId = Number(formData.get('servizioId'));
  const datiRaw = formData.get('dati');
  const bozzaId = formData.get('bozzaId') ? Number(formData.get('bozzaId')) : null;
  const files = formData.getAll('allegati').filter((f): f is File => f instanceof File && f.size > 0);
  const allegatiIds = formData.getAll('allegatiIds').map(Number);
  
  if (!servizioId || isNaN(servizioId)) {
    return { error: 'Servizio non valido' };
  }
  
  const servizio = await prisma.servizio.findFirst({
    where: { id: servizioId, attivo: true },
    include: {
      area: { select: { nome: true } },
      ricevuta: true,
      steps: {
        where: { attivo: true },
        orderBy: { ordine: 'asc' },
        include: { allegatiRichiestiList: { where: { interno: false } } },
      },
    },
  });

  // Valida tutti i file prima di procedere
  for (const file of files) {
    const errore = validaFile(file);
    if (errore) return { error: errore };
  }

  if (!servizio) {
    return { error: 'Servizio non trovato o non disponibile' };
  }

  const ora = new Date();
  if (
    (servizio.dataInizio && servizio.dataInizio > ora) ||
    (servizio.dataFine && servizio.dataFine < ora)
  ) {
    return { error: servizio.msgExtraServizio ?? 'Il servizio non è attualmente disponibile' };
  }

  const utente = await prisma.utente.findUnique({
    where: { id: Number(session.user.id) },
  });

  if (!utente) {
    return { error: 'Utente non trovato' };
  }

  if (servizio.unicoInvioPerUtente) {
    const esistente = await prisma.istanza.findFirst({
      where: { servizioId, utenteId: utente.id, inBozza: false },
    });
    if (esistente) {
      return { error: 'Hai già inviato una richiesta per questo servizio' };
    }
  }

  if (servizio.numeroMaxIstanze && servizio.numeroMaxIstanze > 0) {
    const count = await prisma.istanza.count({ where: { servizioId, inBozza: false } });
    if (count >= servizio.numeroMaxIstanze) {
      return { error: servizio.msgSopraSoglia ?? 'Il numero massimo di istanze è stato raggiunto' };
    }
  }

  const datiServizioDoc = { titolo: servizio.titolo, areaNome: servizio.area.nome };

  const primoStep = servizio.steps[0];
  const primoStatus = await prisma.status.findFirst({ orderBy: { ordine: 'asc' } });
  if (!primoStatus) {
    return { error: 'Configurazione stati non trovata' };
  }

  try {
    if (bozzaId) {
      const bozza = await prisma.istanza.findFirst({
        where: { id: bozzaId, utenteId: utente.id, inBozza: true },
      });
      if (!bozza) return { error: 'Bozza non trovata' };

      const datiFinali = datiRaw ? String(datiRaw) : bozza.dati;
      await prisma.istanza.update({
        where: { id: bozzaId },
        data: {
          dati: datiFinali,
          datiInEvidenza: estraiDatiInEvidenza(datiFinali, servizio.campiInEvidenza),
          dataInvio: new Date(),
          inBozza: false,
          activeStep: null,
          lastStepId: primoStep?.id ?? null,
        },
      });

      let workflowId: number | null = null;
      if (primoStep) {
        const wf = await prisma.workflow.create({
          data: {
            istanzaId: bozzaId,
            stepId: primoStep.id,
            operatoreId: null,
            statusId: primoStatus.id,
            dataVariazione: new Date(),
          },
        });
        workflowId = wf.id;
      }

      if (workflowId) {
        await salvaFileAllegati(files, allegatiIds, workflowId);
      }

      // Genera il modulo in memoria (senza proto) da inviare al protocollo esterno
      const moduloBuffer = await generaModuloBuffer(
        { id: bozzaId, protoNumero: null, protoData: null, dataInvio: new Date(), municipalita: null },
        datiServizioDoc,
        datiFinali,
      );
      const moduloFile = new File([moduloBuffer], `modulo_istanza_${bozzaId}.pdf`, { type: 'application/pdf' });

      // Protocollazione: sempre obbligatoria (reale o di emergenza)
      const protoResult =
        primoStep?.protocollo && primoStep.unitaOrganizzativa
          ? await protocolla({
              istanzaId: bozzaId,
              servizioTitolo: servizio.titolo,
              tipoProtocollo: primoStep.tipoProtocollo ?? 'E',
              unitaOrganizzativa: primoStep.unitaOrganizzativa,
              utente: {
                codiceFiscale: utente.codiceFiscale,
                nome: utente.nome,
                cognome: utente.cognome,
              },
              files: [...files, moduloFile],
            })
          : await generaProtocolloEmergenza(bozzaId, 'INGRESSO');

      await prisma.istanza.update({
        where: { id: bozzaId },
        data: { protoNumero: protoResult.numero, protoData: protoResult.data },
      });

      await salvaDocumentiInterni(bozzaId, workflowId, {
        istanza: { id: bozzaId, protoNumero: protoResult.numero, protoData: protoResult.data, dataInvio: new Date(), municipalita: null },
        servizio: datiServizioDoc,
        ricevuta: servizio.ricevuta,
        datiRaw: datiFinali,
      });

      return { success: true, istanzaId: bozzaId, protoNumero: protoResult.numero, protoData: protoResult.data };
    }

    // Nuova istanza
    const datiFinali = datiRaw ? String(datiRaw) : null;
    const istanza = await prisma.istanza.create({
      data: {
        dati: datiFinali,
        datiInEvidenza: estraiDatiInEvidenza(datiFinali, servizio.campiInEvidenza),
        dataInvio: new Date(),
        inBozza: false,
        utenteId: utente.id,
        servizioId,
        lastStepId: primoStep?.id ?? null,
        workflows: primoStep
          ? {
              create: {
                stepId: primoStep.id,
                operatoreId: null,
                statusId: primoStatus.id,
                dataVariazione: new Date(),
              },
            }
          : undefined,
      },
    });

    let wfId: number | null = null;
    if (primoStep) {
      const wf = await prisma.workflow.findFirst({ where: { istanzaId: istanza.id } });
      if (wf) {
        wfId = wf.id;
        if (files.length > 0) {
          await salvaFileAllegati(files, allegatiIds, wf.id);
        }
      }
    }

    // Genera il modulo in memoria (senza proto) da inviare al protocollo esterno
    const moduloBuffer = await generaModuloBuffer(
      { id: istanza.id, protoNumero: null, protoData: null, dataInvio: new Date(), municipalita: null },
      datiServizioDoc,
      datiFinali,
    );
    const moduloFile = new File([moduloBuffer], `modulo_istanza_${istanza.id}.pdf`, { type: 'application/pdf' });

    // Protocollazione: sempre obbligatoria (reale o di emergenza)
    const protoResult =
      primoStep?.protocollo && primoStep.unitaOrganizzativa
        ? await protocolla({
            istanzaId: istanza.id,
            servizioTitolo: servizio.titolo,
            tipoProtocollo: primoStep.tipoProtocollo ?? 'E',
            unitaOrganizzativa: primoStep.unitaOrganizzativa,
            utente: {
              codiceFiscale: utente.codiceFiscale,
              nome: utente.nome,
              cognome: utente.cognome,
            },
            files: [...files, moduloFile],
          })
        : await generaProtocolloEmergenza(istanza.id, 'INGRESSO');

    await prisma.istanza.update({
      where: { id: istanza.id },
      data: { protoNumero: protoResult.numero, protoData: protoResult.data },
    });

    await salvaDocumentiInterni(istanza.id, wfId, {
      istanza: { id: istanza.id, protoNumero: protoResult.numero, protoData: protoResult.data, dataInvio: new Date(), municipalita: null },
      servizio: datiServizioDoc,
      ricevuta: servizio.ricevuta,
      datiRaw: datiFinali,
    });

    return { success: true, istanzaId: istanza.id, protoNumero: protoResult.numero, protoData: protoResult.data };
  } catch (error) {
    console.error('Errore creazione istanza:', error);
    return { error: 'Errore durante il salvataggio della richiesta. Riprova.' };
  }
}
