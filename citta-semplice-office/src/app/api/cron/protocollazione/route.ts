import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { getStorage } from '@/lib/storage';
import { tentaProtocollazioneUrbi } from '@/lib/services/protocollazione/UrbiProtocolloService';
// La generazione PDF vive in un package condiviso proprio per essere
// raggiungibile da qui: la ricevuta incorpora il numero di protocollo, quindi
// dopo la rettifica va rifatta, altrimenti resta in mano al cittadino un
// documento con un numero diverso da quello agli atti.
import { generaDocumentoPdf } from '@citta/documenti';
import { sendEmail } from '@/lib/services/email';

export const dynamic = 'force-dynamic';

/**
 * Drenatore della coda di protocollazione.
 *
 * PERCHÉ ESISTE
 *   L'invio di un'istanza non chiama più Urbi: conia subito un numero interno
 *   dentro la transazione che prenota il posto in quota, e risponde. Il
 *   cittadino esce sempre con un numero e una ricevuta, e un click day non
 *   resta appeso ai 30 s di timeout del protocollo moltiplicati per N invii.
 *   Questo endpoint è la seconda metà: ripesca le istanze rimaste con
 *   numerazione interna e le rettifica col numero vero di Urbi.
 *
 * LA CODA NON È UNA TABELLA NUOVA
 *   È `protocollo_emergenza` con `rettificato = false`. La riga veniva già
 *   scritta a ogni ripiego e non la leggeva nessuno; il campo `rettificato`
 *   era previsto in schema e mai implementato.
 *
 * PERCHÉ NON USA `protocolla()`
 *   Quella funzione, fallendo, conia un ALTRO numero d'emergenza e scrive
 *   un'ALTRA riga: ritentare con essa brucerebbe un progressivo per ogni
 *   istanza a ogni giro di cron. `tentaProtocollazioneUrbi` fallisce e basta.
 *
 * CONCORRENZA
 *   Nessun lock resta aperto durante la chiamata a Urbi: sarebbe lo stesso
 *   errore che la prenotazione in quota evita con cura. La protezione contro
 *   esecuzioni sovrapposte è l'aggiornamento CONDIZIONATO (`rettificato: false`
 *   nella where): due drenatori possono provare la stessa istanza — sprecando
 *   una chiamata — ma solo uno applica l'esito. È «al più una volta efficace»,
 *   non «esattamente una volta».
 */

/** Quante istanze per esecuzione. Oltre, si aspetta il giro successivo. */
const LOTTO_PREDEFINITO = 25;

export async function GET(request: NextRequest) {
  if (process.env.ENABLE_CRON_JOBS !== 'true') {
    return NextResponse.json({ error: 'Cron jobs disabilitati' }, { status: 503 });
  }

  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const richiesto = Number(request.nextUrl.searchParams.get('lotto') ?? LOTTO_PREDEFINITO);
  const lotto = Number.isFinite(richiesto) && richiesto > 0 ? Math.min(richiesto, 200) : LOTTO_PREDEFINITO;
  const inizio = Date.now();

  try {
    // Le più vecchie per prime: un'istanza non deve restare indietro solo
    // perché ne arrivano continuamente di nuove.
    const daRettificare = await prisma.protocolloEmergenza.findMany({
      where: { rettificato: false, istanzaId: { not: null } },
      orderBy: { data: 'asc' },
      take: lotto,
    });

    let rettificate = 0;
    let ancoraIndisponibile = 0;
    let saltate = 0;

    for (const emergenza of daRettificare) {
      const istanzaId = emergenza.istanzaId;
      if (!istanzaId) continue;

      const istanza = await prisma.istanza.findUnique({
        where: { id: istanzaId },
        include: {
          utente: true,
          servizio: {
            include: {
              area: { select: { nome: true } },
              steps: { where: { attivo: true }, orderBy: { ordine: 'asc' } },
              // Serve a rigenerare la ricevuta com'era: decide se accodare la
              // pagina art. 18. Senza, il documento rifatto sarebbe diverso
              // dall'originale, e nessuno se ne accorgerebbe.
              ricevuta: true,
            },
          },
          attivita: {
            orderBy: { iniziataAt: 'asc' },
            take: 1,
            include: { allegati: true },
          },
        },
      });

      // L'istanza può non esserci più (bozza scartata, cancellazione): la riga
      // resta come traccia contabile del progressivo consumato, ma non c'è
      // nulla da rettificare. La marchiamo per non riprovarci a ogni giro.
      if (!istanza) {
        await prisma.protocolloEmergenza.updateMany({
          where: { id: emergenza.id, rettificato: false },
          data: { rettificato: true },
        });
        saltate++;
        continue;
      }

      const primoStep = istanza.servizio.steps[0];
      if (!primoStep?.protocollo || !primoStep.unitaOrganizzativa) {
        // Il servizio non prevede protocollazione esterna: il numero interno è
        // definitivo, non un ripiego da correggere.
        await prisma.protocolloEmergenza.updateMany({
          where: { id: emergenza.id, rettificato: false },
          data: { rettificato: true },
        });
        saltate++;
        continue;
      }

      // Gli allegati sono già persistiti (modulo e ricevuta inclusi): si
      // rileggono da storage invece di rigenerarli.
      const storage = getStorage();
      const files = await Promise.all(
        (istanza.attivita[0]?.allegati ?? []).map(async (a) => {
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

      const esito = await tentaProtocollazioneUrbi({
        istanzaId,
        oggetto: `Richiesta - ${istanza.servizio.area?.nome ?? ''} - ${istanza.servizio.titolo} - ${istanza.utente.codiceFiscale}`,
        tipoProtocollo: (primoStep.tipoProtocollo as 'E' | 'U') ?? 'E',
        unitaOrganizzativa: primoStep.unitaOrganizzativa,
        utente: {
          codiceFiscale: istanza.utente.codiceFiscale,
          nome: istanza.utente.nome,
          cognome: istanza.utente.cognome,
        },
        files,
      });

      if (!esito) {
        // Urbi ancora non risponde: si riprova al prossimo giro. Nessun numero
        // consumato, nessuna riga aggiunta.
        ancoraIndisponibile++;
        continue;
      }

      // Rettifica: numero vero sull'istanza e riga marcata, nella stessa
      // transazione. La `updateMany` condizionata rende l'operazione inerte se
      // un altro drenatore è arrivato prima.
      const applicata = await prisma.$transaction(async (tx) => {
        const marcata = await tx.protocolloEmergenza.updateMany({
          where: { id: emergenza.id, rettificato: false },
          data: { rettificato: true },
        });
        if (marcata.count === 0) return false;
        await tx.istanza.update({
          where: { id: istanzaId },
          data: {
            protoNumero: esito.numero,
            protoData: esito.data,
            // Il numero è ora quello dell'ente: l'istanza smette di essere
            // provvisoria, e la ricevuta rigenerata poco sotto lo rispecchia.
            protocolloProvvisorio: false,
          },
        });
        return true;
      });

      // Un altro drenatore ci ha preceduto: ha già rettificato e rigenerato lui.
      if (!applicata) {
        saltate++;
        continue;
      }

      // Ricevuta: il PDF incorpora il numero, quindi va rifatto col numero vero.
      // Fuori dalla transazione di proposito — è lavoro CPU-bound e I/O su
      // storage, e tenerlo dentro allungherebbe una transazione che deve
      // restare breve.
      //
      // Si AGGIORNA la riga esistente invece di crearne una seconda: il
      // cittadino deve vedere una ricevuta sola, quella giusta. Il vecchio file
      // resta orfano nello storage, perché StorageProvider non espone una
      // cancellazione: è un lavoro a sé, non silenziato qui.
      try {
        const ricevutaEsistente = await prisma.allegato.findFirst({
          where: { attivitaId: istanza.attivita[0]?.id, invUtente: false },
          orderBy: { dataInserimento: 'desc' },
        });

        if (ricevutaEsistente) {
          const ente = await prisma.ente.findFirst();
          const doc = await generaDocumentoPdf(
            ente?.nome ?? 'Comune di Prova',
            ente?.sede ?? 'Prova',
            {
              id: istanza.id,
              protoNumero: esito.numero,
              protoData: esito.data,
              dataInvio: istanza.dataInvio,
              municipalita: istanza.municipalita,
              // Si rigenera DOPO la rettifica: il numero è quello dell'ente,
              // quindi la ricevuta può affermarlo senza mentire.
              protocolloProvvisorio: false,
            },
            {
              titolo: istanza.servizio.titolo,
              areaNome: istanza.servizio.area?.nome ?? '',
              attributi: istanza.servizio.attributi,
            },
            istanza.dati,
            istanza.servizio.ricevuta,
          );

          await prisma.allegato.update({
            where: { id: ricevutaEsistente.id },
            data: { nomeFile: doc.nomeFile, nomeHash: doc.nomeHash },
          });
        }
      } catch (err) {
        // La rettifica del protocollo è già avvenuta e resta valida: un errore
        // qui lascia la ricevuta col numero vecchio, che è un disallineamento
        // da correggere, non un motivo per far fallire il lotto intero.
        console.error(
          `[CRON protocollazione] rettifica ok ma rigenerazione ricevuta fallita (istanza ${istanzaId}):`,
          err,
        );
      }

      // Avviso al recapito indicato in fase di invio, se c'è. È l'unico modo
      // perché il cittadino conosca il numero definitivo senza tornare a
      // controllare da solo sul portale.
      //
      // `emailNotifica` è il recapito di QUESTA istanza, non `utenti.email`:
      // chi ha inviato può essere un delegato, e l'avviso deve raggiungere chi
      // è stato indicato al momento della presentazione.
      //
      // Nessun collegamento al portale nel messaggio: l'office non ne conosce
      // l'indirizzo, e un link inventato sarebbe un link rotto in una
      // comunicazione ai cittadini.
      if (istanza.emailNotifica) {
        try {
          await sendEmail({
            to: istanza.emailNotifica,
            subject: `Protocollo assegnato — ${istanza.servizio.titolo}`,
            html: `
              <p>La richiesta relativa al servizio <strong>${istanza.servizio.titolo}</strong>
              è stata registrata al Protocollo generale con il numero
              <strong>${esito.numero}</strong>.</p>
              <p>Il numero provvisorio assegnato al momento dell'invio non è più valido:
              fa fede quello indicato qui sopra.</p>
              <p>La ricevuta aggiornata è disponibile nell'area personale del portale,
              nella sezione «Le mie istanze».</p>
            `,
          });
        } catch (err) {
          // La rettifica resta valida: un avviso non partito non è un motivo
          // per rifare il lavoro al giro successivo.
          console.error(
            `[CRON protocollazione] rettifica ok ma avviso non inviato (istanza ${istanzaId}):`,
            err,
          );
        }
      }

      rettificate++;
    }

    const durataMs = Date.now() - inizio;
    console.info(
      `[CRON protocollazione] esaminate ${daRettificare.length}, rettificate ${rettificate}, ` +
        `Urbi indisponibile per ${ancoraIndisponibile}, saltate ${saltate} (${durataMs} ms)`,
    );

    return NextResponse.json({
      esaminate: daRettificare.length,
      rettificate,
      ancoraIndisponibile,
      saltate,
      durataMs,
    });
  } catch (error) {
    console.error('[CRON protocollazione] errore:', error);
    return NextResponse.json({ error: 'Errore durante la rettifica dei protocolli' }, { status: 500 });
  }
}
