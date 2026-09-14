'use server';

import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth/config';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { generaProtocolloEmergenzaCon } from '@/lib/services/protocollazione/ProtocolloEmergenzaService';
// Preso direttamente dal package condiviso: il wrapper UrbiProtocolloService del
// portal non ha più chiamanti da quando l'invio non protocolla in linea, e
// passarci attraverso sarebbe un'indirezione che nessuno attraversa.
import { tentaProtocollazioneUrbiConBreaker } from '@citta/integrations/protocollazione';
import { generaDocumentoPdf } from '@/lib/services/documenti/DocumentiService';
import { validaDatiModulo } from '@/lib/form-validate';
import { getStorage } from '@/lib/storage';
import {
  sogliaIstanzeRaggiunta,
  verificaUnicoInvio,
  verificaUnicoInvioPerUtente,
  MSG_SOGLIA_DEFAULT,
} from '@/lib/servizio-regole';
import { cePostoInQuota, datiStato, whereStato } from '@citta/db';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Le bozze non sono mai state protocollate. */
const PROTO_BOZZA = 'Bozza non protocollata';

/**
 * Segnaposto per un'istanza che ha già PRENOTATO il suo posto nella quota ma
 * non è ancora stata protocollata. Vive quanto la chiamata a Urbi: il posto
 * risulta occupato da subito — è ciò che impedisce a due invii simultanei di
 * sfondare `numeroMaxIstanze` — e il numero vero arriva subito dopo.
 */
const PROTO_IN_ATTESA = 'In protocollazione';

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
  attivitaId: number,
) {
  if (files.length === 0) return;

  const now = new Date();
  const anno = String(now.getFullYear());
  const mese = String(now.getMonth() + 1).padStart(2, '0');
  const giorno = String(now.getDate()).padStart(2, '0');

  // Percorso relativo: anno/mese/giorno
  const relDir = join(anno, mese, giorno);
  const storage = getStorage();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const allegatoId = allegatiIds[i];
    const uuid = randomUUID();
    // Percorso relativo salvato in nomeHash: anno/mese/giorno/uuid
    const nomeHash = join(relDir, uuid);

    const bytes = await file.arrayBuffer();
    await storage.save(nomeHash, Buffer.from(bytes), 'application/pdf');

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
        attivitaId,
      },
    });
  }
}

/**
 * Tentativo di protocollazione IN LINEA, per i servizi a protocollazione
 * sincrona (`protocollazioneAsincrona = false`, il default).
 *
 * Va chiamata in fondo all'invio, dopo che modulo e ricevuta sono stati
 * persistiti: gli allegati si rileggono da storage esattamente come fa il
 * drenatore, invece di rigenerare il PDF. Due implementazioni diverse
 * manderebbero a Urbi allegati diversi a seconda del percorso, e il difetto si
 * vedrebbe solo in produzione e solo su alcune istanze.
 *
 * Se Urbi risponde, il numero interno assegnato in transazione viene sostituito
 * da quello vero e la riga di coda marcata rettificata: il cittadino esce con il
 * protocollo dell'ente. Se non risponde — o se il circuito è già aperto — non
 * succede nulla di male: il numero interno resta valido e
 * /api/cron/protocollazione rettificherà più tardi.
 *
 * Ritorna il protocollo definitivo, oppure `null` se resta quello interno.
 */
async function protocollaSubitoSePossibile(
  istanzaId: number,
  attivitaId: number | null,
  emergenzaId: number | undefined,
  step: { protocollo: boolean; tipoProtocollo: string | null; unitaOrganizzativa: string | null } | undefined,
  servizio: { titolo: string; area: { nome: string } },
  utente: { codiceFiscale: string; nome: string; cognome: string },
): Promise<{ numero: string; data: Date } | null> {
  if (!step?.protocollo || !step.unitaOrganizzativa || !attivitaId) return null;

  const allegati = await prisma.allegato.findMany({ where: { attivitaId } });
  const storage = getStorage();
  const files = await Promise.all(
    allegati.map(async (a) => {
      try {
        const buf = await storage.read(a.nomeHash);
        return new File([new Uint8Array(buf)], a.nomeFile, {
          type: a.mimeType ?? 'application/pdf',
        });
      } catch {
        return null;
      }
    }),
  ).then((arr) => arr.filter((f): f is File => f !== null));

  const esito = await tentaProtocollazioneUrbiConBreaker({
    istanzaId,
    oggetto: `Richiesta - ${servizio.area.nome} - ${servizio.titolo} - ${utente.codiceFiscale}`,
    tipoProtocollo: (step.tipoProtocollo as 'E' | 'U') ?? 'E',
    unitaOrganizzativa: step.unitaOrganizzativa,
    utente,
    files,
  });
  if (!esito) return null;

  // Rettifica immediata, stessa forma di quella del drenatore: la `updateMany`
  // condizionata rende l'operazione inerte se il cron è arrivato prima.
  await prisma.$transaction(async (tx) => {
    await tx.istanza.update({
      where: { id: istanzaId },
      data: {
        protoNumero: esito.numero,
        protoData: esito.data,
        // Ora il numero è quello dell'ente: l'istanza non è più provvisoria, e
        // ricevuta e interfacce possono dirlo senza mentire.
        protocolloProvvisorio: false,
      },
    });
    if (emergenzaId) {
      await tx.protocolloEmergenza.updateMany({
        where: { id: emergenzaId, rettificato: false },
        data: { rettificato: true },
      });
    }
  });

  // La ricevuta era stata generata poco fa col numero interno — doveva esistere
  // su storage per poter essere spedita a Urbi. Ora che il numero è quello
  // dell'ente va rifatta, altrimenti il percorso SINCRONO, che è il default,
  // lascerebbe al cittadino un documento che si dichiara provvisorio mentre il
  // dato non lo è più.
  //
  // Stessa forma del drenatore (aggiorna la riga esistente, non ne crea una
  // seconda) perché i due percorsi non devono poter divergere. Un fallimento
  // qui non annulla la rettifica, che è già valida: si registra e si prosegue.
  try {
    const ricevuta = await prisma.allegato.findFirst({
      where: { attivitaId, invUtente: false },
      orderBy: { dataInserimento: 'desc' },
    });
    if (ricevuta) {
      const ente = await prisma.ente.findFirst();
      const istanzaAggiornata = await prisma.istanza.findUnique({
        where: { id: istanzaId },
        include: { servizio: { include: { area: true, ricevuta: true } } },
      });
      if (istanzaAggiornata) {
        const doc = await generaDocumentoPdf(
          ente?.nome ?? 'Comune di Prova',
          ente?.sede ?? 'Prova',
          {
            id: istanzaId,
            protoNumero: esito.numero,
            protoData: esito.data,
            dataInvio: istanzaAggiornata.dataInvio,
            municipalita: istanzaAggiornata.municipalita,
            protocolloProvvisorio: false,
          },
          {
            titolo: istanzaAggiornata.servizio.titolo,
            areaNome: istanzaAggiornata.servizio.area?.nome ?? '',
            attributi: istanzaAggiornata.servizio.attributi,
          },
          istanzaAggiornata.dati,
          istanzaAggiornata.servizio.ricevuta,
        );
        await prisma.allegato.update({
          where: { id: ricevuta.id },
          data: { nomeFile: doc.nomeFile, nomeHash: doc.nomeHash },
        });
      }
    }
  } catch (err) {
    console.error(
      `[submitIstanza] protocollo rettificato ma ricevuta non rigenerata (istanza ${istanzaId}):`,
      err,
    );
  }

  return esito;
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
  istanza: { id: number; protoNumero: string | null; protoData: Date | null; dataInvio: Date | null; municipalita: string | null; protocolloProvvisorio: boolean };
  servizio: { titolo: string; areaNome: string; attributi?: string | null };
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
  attivitaId: number | null,
  dati: DatiDocumenti,
): Promise<void> {
  if (!attivitaId) return;

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
        attivitaId,
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
  const bozzaPagina = Number(formData.get('paginaModulo') ?? 0);
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
        where: { id: bozzaId, utenteId: utente.id, ...whereStato('BOZZA') },
      });
      if (!bozza) return { error: 'Bozza non trovata' };

      await prisma.istanza.update({
        where: { id: bozzaId },
        data: {
          dati: datiRaw ? String(datiRaw) : null,
          activeStep,
          bozzaPagina,
        },
      });
      return { success: true, bozzaId };
    }

    const bozzaEsistente = await prisma.istanza.findFirst({
      where: { servizioId, utenteId: utente.id, ...whereStato('BOZZA') },
    });

    if (bozzaEsistente) {
      await prisma.istanza.update({
        where: { id: bozzaEsistente.id },
        data: {
          dati: datiRaw ? String(datiRaw) : null,
          activeStep,
          bozzaPagina,
        },
      });
      return { success: true, bozzaId: bozzaEsistente.id };
    }

    // Limite 10 bozze: se l'utente ha già 10 bozze, elimina la più vecchia
    const contaBozze = await prisma.istanza.count({
      where: { utenteId: utente.id, ...whereStato('BOZZA') },
    });
    if (contaBozze >= 10) {
      const piuVecchia = await prisma.istanza.findFirst({
        where: { utenteId: utente.id, ...whereStato('BOZZA') },
        orderBy: { dataInvio: 'asc' },
      });
      if (piuVecchia) {
        await prisma.istanza.delete({ where: { id: piuVecchia.id } });
      }
    }

    const nuovaBozza = await prisma.istanza.create({
      data: {
        dati: datiRaw ? String(datiRaw) : null,
        protoNumero: PROTO_BOZZA,
        dataInvio: new Date(),
        ...datiStato('BOZZA'),
        activeStep,
        bozzaPagina,
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
    where: { id: bozzaId, utenteId: utente.id, ...whereStato('BOZZA') },
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
  // Recapito per l'avviso di protocollazione: appartiene a QUESTA istanza, non
  // all'anagrafica di chi ha effettuato l'accesso, che può essere un delegato.
  // Facoltativo: vuoto significa nessuna notifica, non un errore.
  const emailNotifica = formData.get('emailNotifica')?.toString().trim() || null;
  
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
        },
      },
    },
  });

  if (!servizio) {
    return { error: 'Servizio non trovato o non disponibile' };
  }

  // Valida tutti i file prima di procedere
  for (const file of files) {
    const errore = validaFile(file);
    if (errore) return { error: errore };
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

  const erroreUnicoPerUtente = await verificaUnicoInvioPerUtente(servizio, utente.id);
  if (erroreUnicoPerUtente) {
    return { error: erroreUnicoPerUtente };
  }

  // Controllo di cortesia: fallisce subito e senza prendere alcun lock, così un
  // servizio già pieno non fa generare un PDF né contattare Urbi per nulla.
  // NON è ciò che garantisce la quota: sotto invii simultanei due richieste
  // possono superarlo entrambe. La garanzia sta in `cePostoInQuota`, dentro la
  // transazione di prenotazione più sotto.
  if (await sogliaIstanzeRaggiunta(servizio)) {
    return { error: servizio.msgSopraSoglia ?? MSG_SOGLIA_DEFAULT };
  }

  const datiServizioDoc = {
    titolo: servizio.titolo,
    areaNome: servizio.area.nome,
    attributi: servizio.attributi,
  };

  const primoStep = servizio.steps[0];
  try {
    if (bozzaId) {
      const bozza = await prisma.istanza.findFirst({
        where: { id: bozzaId, utenteId: utente.id, ...whereStato('BOZZA') },
      });
      if (!bozza) return { error: 'Bozza non trovata' };

      const validazione = validaDatiModulo(servizio.attributi, datiRaw ? String(datiRaw) : bozza.dati);
      if (!validazione.ok) return { error: validazione.errore };
      const datiFinali = validazione.dati;

      const erroreUnicoInvio = await verificaUnicoInvio(servizio, datiFinali);
      if (erroreUnicoInvio) return { error: erroreUnicoInvio };

      // Il modulo PDF non viene più generato qui: serviva solo ad allegarlo alla
      // chiamata Urbi, che ora non avviene durante l'invio. Il drenatore rilegge
      // gli allegati già persistiti da `salvaDocumentiInterni`, quindi
      // renderizzarlo in questo punto era lavoro sprecato — e costoso, perché è
      // CPU-bound e stava sul percorso caldo dell'invio.

      // 1. PRENOTAZIONE e NUMERAZIONE, in una sola transazione e senza rete.
      //    Il posto in quota e il numero di protocollo nascono insieme: se la
      //    transazione fallisce non resta né un posto occupato né un
      //    progressivo bruciato.
      //    Urbi NON viene contattato qui. Il cittadino riceve subito un numero
      //    interno valido; /api/cron/protocollazione lo rettificherà col numero
      //    Urbi appena il protocollo risponde. È ciò che toglie dal percorso di
      //    invio una chiamata esterna da 30 s — il collo di bottiglia che in un
      //    click day teneva appeso un worker Node per ogni invio.
      //    La bozza non occupa quota (BOZZA non è fra gli stati conteggiati):
      //    è questa transizione a consumare il posto.
      const protoResult = await prisma.$transaction(async (tx) => {
        if (!(await cePostoInQuota(tx, servizioId, servizio.numeroMaxIstanze))) return null;
        const proto = await generaProtocolloEmergenzaCon(tx, bozzaId, 'INGRESSO');
        await tx.istanza.update({
          where: { id: bozzaId },
          data: {
            dati: datiFinali,
            datiInEvidenza: estraiDatiInEvidenza(datiFinali, servizio.campiInEvidenza),
            dataInvio: new Date(),
            ...datiStato('IN_LAVORAZIONE'),
            activeStep: null,
            bozzaPagina: null,
            faseCorrenteId: primoStep?.faseId ?? null,
            protoNumero: proto.numero,
            protoData: proto.data,
            // Il numero è ancora quello interno: lo si dichiara, così ricevuta
            // e interfacce non spacciano per protocollo dell'ente ciò che non
            // lo è. Viene azzerato alla rettifica.
            protocolloProvvisorio: true,
            emailNotifica,
          },
        });
        return proto;
      });
      if (!protoResult) {
        return { error: servizio.msgSopraSoglia ?? MSG_SOGLIA_DEFAULT };
      }

      let attivitaId: number | null = null;
      if (primoStep) {
        const wf = await prisma.istanzaAttivita.create({
          data: {
            istanzaId: bozzaId,
            stepId: primoStep.id,
            // Nessun operatoreId: l'invio non assegna nessuno, e
            // istanze.assegnatario_id è già NULL per default.
            iniziataAt: new Date(),
          },
        });
        attivitaId = wf.id;
      }

      if (attivitaId) {
        await salvaFileAllegati(files, allegatiIds, attivitaId);
      }

      await salvaDocumentiInterni(bozzaId, attivitaId, {
        // Provvisorio: in questo punto il numero è sempre quello interno, perché
        // la ricevuta dev'essere già su storage quando (ed è il caso dei servizi
        // sincroni) viene spedita a Urbi subito dopo.
        istanza: { id: bozzaId, protoNumero: protoResult.numero, protoData: protoResult.data, dataInvio: new Date(), municipalita: null, protocolloProvvisorio: true },
        servizio: datiServizioDoc,
        ricevuta: servizio.ricevuta,
        datiRaw: datiFinali,
      });

      // Servizio a protocollazione sincrona: si tenta Urbi ORA, così il
      // cittadino esce con il numero vero dell'ente. Sui servizi ad alta
      // affluenza il flag salta questo passo e il cron rettifica dopo.
      const definitivo = servizio.protocollazioneAsincrona
        ? null
        : await protocollaSubitoSePossibile(
            bozzaId,
            attivitaId,
            protoResult.emergenzaId,
            primoStep,
            { titolo: servizio.titolo, area: { nome: servizio.area.nome } },
            utente,
          );

      return {
        success: true,
        istanzaId: bozzaId,
        protoNumero: definitivo?.numero ?? protoResult.numero,
        protoData: definitivo?.data ?? protoResult.data,
      };
    }

    // Nuova istanza: il posto si prenota PRIMA di protocollare, come nel ramo bozza
    const validazione = validaDatiModulo(servizio.attributi, datiRaw ? String(datiRaw) : null);
    if (!validazione.ok) return { error: validazione.errore };
    const datiFinali = validazione.dati;

    const erroreUnicoInvio = await verificaUnicoInvio(servizio, datiFinali);
    if (erroreUnicoInvio) return { error: erroreUnicoInvio };

    // Il modulo PDF non viene più generato qui: serviva solo ad allegarlo alla
    // chiamata Urbi, che ora non avviene durante l'invio. Il drenatore rilegge
    // gli allegati già persistiti da `salvaDocumentiInterni`, quindi renderizzare
    // il PDF in questo punto era lavoro sprecato — e costoso, perché è CPU-bound
    // e stava sul percorso caldo dell'invio.

    // 1. PRENOTAZIONE, CREAZIONE e NUMERAZIONE, in una sola transazione e senza
    //    rete: stesso disegno del ramo bozza e per le stesse ragioni.
    //    L'ordine conta: l'istanza nasce prima, così il numero di protocollo
    //    viene registrato con il suo id reale invece di `null` da correggere
    //    dopo. `PROTO_IN_ATTESA` è solo il valore transitorio fra la `create` e
    //    l'assegnazione, richiesto perché `proto_numero` è NOT NULL: non esce
    //    mai dalla transazione e nessuno lo vede.
    //    L'attività non nasce qui — la transazione resta minima.
    const creazione = await prisma.$transaction(async (tx) => {
      if (!(await cePostoInQuota(tx, servizioId, servizio.numeroMaxIstanze))) return null;
      const nuova = await tx.istanza.create({
        data: {
          dati: datiFinali,
          datiInEvidenza: estraiDatiInEvidenza(datiFinali, servizio.campiInEvidenza),
          dataInvio: new Date(),
          ...datiStato('IN_LAVORAZIONE'),
          protoNumero: PROTO_IN_ATTESA,
          utenteId: utente.id,
          servizioId,
          faseCorrenteId: primoStep?.faseId ?? null,
          // Vedi il ramo bozza: vero finché il numero non è quello dell'ente.
          protocolloProvvisorio: true,
          emailNotifica,
        },
      });
      const proto = await generaProtocolloEmergenzaCon(tx, nuova.id, 'INGRESSO');
      const conProtocollo = await tx.istanza.update({
        where: { id: nuova.id },
        data: { protoNumero: proto.numero, protoData: proto.data },
      });
      return { istanza: conProtocollo, proto };
    });
    if (!creazione) {
      return { error: servizio.msgSopraSoglia ?? MSG_SOGLIA_DEFAULT };
    }
    const { istanza, proto: protoResult } = creazione;

    // 2. L'attività nasce dopo la prenotazione, fuori dalla transazione.
    let wfId: number | null = null;
    if (primoStep) {
      const wf = await prisma.istanzaAttivita.create({
        data: {
          istanzaId: istanza.id,
          // Nessun operatoreId: l'invio non assegna nessuno, e
          // istanze.assegnatario_id è già NULL per default.
          stepId: primoStep.id,
          iniziataAt: istanza.dataInvio,
        },
      });
      wfId = wf.id;
      if (files.length > 0) {
        await salvaFileAllegati(files, allegatiIds, wf.id);
      }
    }

    await salvaDocumentiInterni(istanza.id, wfId, {
      // Vedi il ramo bozza: qui il numero è sempre ancora quello interno.
      istanza: { id: istanza.id, protoNumero: protoResult.numero, protoData: protoResult.data, dataInvio: new Date(), municipalita: null, protocolloProvvisorio: true },
      servizio: datiServizioDoc,
      ricevuta: servizio.ricevuta,
      datiRaw: datiFinali,
    });

    // Stessa biforcazione del ramo bozza, e per le stesse ragioni.
    const definitivo = servizio.protocollazioneAsincrona
      ? null
      : await protocollaSubitoSePossibile(
          istanza.id,
          wfId,
          protoResult.emergenzaId,
          primoStep,
          { titolo: servizio.titolo, area: { nome: servizio.area.nome } },
          utente,
        );

    return {
      success: true,
      istanzaId: istanza.id,
      protoNumero: definitivo?.numero ?? protoResult.numero,
      protoData: definitivo?.data ?? protoResult.data,
    };
  } catch (error) {
    console.error('Errore creazione istanza:', error);
    return { error: 'Errore durante il salvataggio della richiesta. Riprova.' };
  }
}
