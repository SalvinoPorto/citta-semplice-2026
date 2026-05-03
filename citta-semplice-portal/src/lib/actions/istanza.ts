'use server';

import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { protocolla } from '@/lib/services/protocollazione/UrbiProtocolloService';
import { generaProtocolloEmergenza } from '@/lib/services/protocollazione/ProtocolloEmergenzaService';
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
  ricevuta: { 
    id: number;
    servizioId: number;
    richiestaArt18: boolean;
    unitaOrganizzativaCompetente: string | null;
    ufficioCompetente: string | null;
    responsabileProcedimento: string | null;
    durataMassimaProcedimento: number | null;
    responsabileProvvedimentoFinale: string | null;
    personaPotereSostitutivo: string | null;
    urlServizioWeb: string | null;
    ufficioRicevimento: string | null;
   } | null;
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
    const ente = await prisma.ente.findFirst();
    const doc = await generaDocumentoPdf(ente?.nome ?? 'Comune di Prova', ente?.sede ?? 'Prova', dati.istanza, dati.servizio, dati.datiRaw, dati.ricevuta);
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

    // Limite 10 bozze: se l'utente ha già 10 bozze, elimina la più vecchia
    const contaBozze = await prisma.istanza.count({
      where: { utenteId: utente.id, inBozza: true },
    });
    if (contaBozze >= 10) {
      const piuVecchia = await prisma.istanza.findFirst({
        where: { utenteId: utente.id, inBozza: true },
        orderBy: { dataInvio: 'asc' },
      });
      if (piuVecchia) {
        await prisma.istanza.delete({ where: { id: piuVecchia.id } });
      }
    }

    const nuovaBozza = await prisma.istanza.create({
      data: {
        dati: datiRaw ? String(datiRaw) : null,
        protoNumero: 'Bozza non protocollata',
        dataInvio: new Date(),
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

export async function eliminaBozza(bozzaId: number) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Non autenticato' };
  }

  const utente = await prisma.utente.findUnique({
    where: { id: Number(session.user.id) },
  });
  if (!utente) return { error: 'Utente non trovato' };

  const bozza = await prisma.istanza.findFirst({
    where: { id: bozzaId, utenteId: utente.id, inBozza: true },
  });
  if (!bozza) return { error: 'Bozza non trovata' };

  try {
    await prisma.istanza.delete({ where: { id: bozzaId } });
    return { success: true };
  } catch (error) {
    console.error('Errore eliminazione bozza:', error);
    return { error: 'Errore durante la cancellazione della bozza.' };
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
        include: {
          allegatiRichiestiList: { where: { interno: false } },
          fase: { select: { id: true, ufficioId: true } },
        },
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

  const utenteId = Number(session.user.id);
  const utente = await prisma.utente.findUnique({
    where: { id: utenteId },
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
  try {
    if (bozzaId) {
      const bozza = await prisma.istanza.findFirst({
        where: { id: bozzaId, utenteId: utente.id, inBozza: true },
      });
      if (!bozza) return { error: 'Bozza non trovata' };

      const datiFinali = datiRaw ? String(datiRaw) : bozza.dati;

      // 1. Genera il modulo in memoria (senza proto) da inviare al protocollo esterno
      const ente = await prisma.ente.findFirst();
      const moduloBuffer = await generaModuloBuffer(
        ente?.nome ?? 'Comune di Prova',
        ente?.sede ?? 'Prova',
        { id: bozzaId, protoNumero: null, protoData: null, dataInvio: new Date(), municipalita: null },
        datiServizioDoc,
        datiFinali,
      );
      const moduloFile = new File([moduloBuffer], `modulo_${bozzaId}.pdf`, { type: 'application/pdf' });

      // 2. Protocollazione PRIMA di confermare l'istanza
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

      // 3. Solo dopo il protocollo: conferma l'istanza con tutti i dati
      await prisma.istanza.update({
        where: { id: bozzaId },
        data: {
          dati: datiFinali,
          datiInEvidenza: estraiDatiInEvidenza(datiFinali, servizio.campiInEvidenza),
          dataInvio: new Date(),
          inBozza: false,
          activeStep: null,
          faseCorrenteId: primoStep?.faseId ?? null,
          ufficioCorrenteId: primoStep?.fase?.ufficioId ?? null,
          lastStepId: primoStep?.id ?? null,
          protoNumero: protoResult.numero,
          protoData: protoResult.data,
        },
      });

      let workflowId: number | null = null;
      if (primoStep) {
        const wf = await prisma.workflow.create({
          data: {
            istanzaId: bozzaId,
            stepId: primoStep.id,
            operatoreId: null,
            stato: 0,
            dataVariazione: new Date(),
          },
        });
        workflowId = wf.id;
      }

      if (workflowId) {
        await salvaFileAllegati(files, allegatiIds, workflowId);
      }

      await salvaDocumentiInterni(bozzaId, workflowId, {
        istanza: { id: bozzaId, protoNumero: protoResult.numero, protoData: protoResult.data, dataInvio: new Date(), municipalita: null },
        servizio: datiServizioDoc,
        ricevuta: servizio.ricevuta,
        datiRaw: datiFinali,
      });

      return { success: true, istanzaId: bozzaId, protoNumero: protoResult.numero, protoData: protoResult.data };
    }

    // Nuova istanza: ottieni il protocollo PRIMA di creare il record
    const datiFinali = datiRaw ? String(datiRaw) : null;

    // 1. Genera il modulo in memoria (id=0 come placeholder: non usato nel contenuto PDF)
    const ente = await prisma.ente.findFirst();
    const moduloBuffer = await generaModuloBuffer(
      ente?.nome ?? 'Comune di Prova',
      ente?.sede ?? 'Prova',
      { id: 0, protoNumero: null, protoData: null, dataInvio: new Date(), municipalita: null },
      datiServizioDoc,
      datiFinali,
    );
    const moduloFile = new File([moduloBuffer], `modulo_istanza_nuovo.pdf`, { type: 'application/pdf' });

    // 2. Protocollazione PRIMA di creare l'istanza (istanzaId=null: non ancora esistente)
    const protoResult =
      primoStep?.protocollo && primoStep.unitaOrganizzativa
        ? await protocolla({
            istanzaId: null,
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
      : await generaProtocolloEmergenza(null, 'INGRESSO');

    // 3. Crea l'istanza con il numero di protocollo già assegnato
    const istanza = await prisma.istanza.create({
      data: {
        dati: datiFinali,
        datiInEvidenza: estraiDatiInEvidenza(datiFinali, servizio.campiInEvidenza),
        dataInvio: new Date(),
        inBozza: false,
        protoNumero: protoResult.numero,
        protoData: protoResult.data,
        utenteId: utente.id,
        servizioId,
        faseCorrenteId: primoStep?.faseId ?? null,
        ufficioCorrenteId: primoStep?.fase?.ufficioId ?? null,
        lastStepId: primoStep?.id ?? null,
        workflows: primoStep
          ? {
              create: {
                stepId: primoStep.id,
                operatoreId: null,
                stato: 0,
                dataVariazione: new Date(),
              },
            }
          : undefined,
      },
    });

    // 4. Se era un protocollo di emergenza, aggiorna il record con l'id istanza reale
    if (protoResult.fallback && protoResult.emergenzaId) {
      await prisma.protocolloEmergenza.update({
        where: { id: protoResult.emergenzaId },
        data: { istanzaId: istanza.id },
      });
    }

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
