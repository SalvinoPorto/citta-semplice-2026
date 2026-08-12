'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import {
  whereVisibileAgliOperatori,
  datiStato,
  type StatoIstanzaValore,
  prossimoStepStessaFase,
  prossimaFase,
  stepPrecedenteStessaFase,
  fasePrecedente as trovaFasePrecedente,
  statoAttivita,
  ETICHETTE_STATO_ATTIVITA,
} from '@citta/db';
import { getCurrentUser, requireAuth } from '@/lib/auth/session';
import { sendEmail } from '@/lib/services/email';
import { sendFaseTransitionEmail } from '@/lib/services/faseTransitionEmail';
import { pmPayService } from '@/lib/external/pmpay';
import { getStorage } from '@/lib/storage';
import { protocolla } from '@/lib/services/protocollazione/UrbiProtocolloService';
import {
  getVisibilitaOperatore,
  istanzaVisibilityWhere,
  puoVedereIstanza,
  puoOperareSuIstanza,
} from '@/lib/auth/visibilita';

// stato: 0 → In lavorazione, 1 → Completata. Il terzo valore -1, mai
// memorizzato, è sparito con `getStatoLabel`: l'etichetta la deriva
// `statoAttivita` da (attività, contesto dell'istanza).
const STATO_IN_LAVORAZIONE = 0;
const STATO_COMPLETATA = 1;

/**
 * Controlla se un operatore può accedere a un'istanza.
 * Regola: tutti gli uffici che condividono un servizio vedono l'istanza (purché il
 * servizio sia fra quelli assegnati all'operatore), ma possono operare solo nella
 * fase di loro competenza.
 */
async function checkUfficioAccess(istanzaId: number, operatoreId: number, ruoli: string[]): Promise<boolean> {
  const visibilita = await getVisibilitaOperatore(operatoreId, ruoli);
  if (visibilita.isAdmin) return true;
  const istanza = await prisma.istanza.findUnique({
    where: { id: istanzaId },
    select: {
      servizioId: true,
      servizio: { select: { ufficioId: true, fasi: { select: { ufficioId: true } } } }
    },
  });
  if (!istanza) return false;
  return puoVedereIstanza(visibilita, istanza);
}

/**
 * Controlla se un operatore può operare (scrivere) su un'istanza.
 * Permette operazioni solo se il servizio gli è assegnato e l'ufficio corrisponde
 * alla fase corrente.
 */
async function checkUfficioWriteAccess(istanzaId: number, operatoreId: number, ruoli: string[]): Promise<boolean> {
  const visibilita = await getVisibilitaOperatore(operatoreId, ruoli);
  if (visibilita.isAdmin) return true;
  const istanza = await prisma.istanza.findUnique({
    where: { id: istanzaId },
    select: {
      servizioId: true,
      faseCorrente: { select: { ufficioId: true } }
    },
  });
  if (!istanza) return false;
  return puoOperareSuIstanza(visibilita, istanza);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getNumeroDocumento(codiceTributo: string, istanzaId: number): string {
  const prefix = `${codiceTributo}${process.env.PMPAY_ENTE_ID}${new Date().getFullYear()}`;
  const l = prefix.length;
  return prefix + istanzaId.toString().padStart(20 - l, '0');
}

export interface AdvanceWorkflowParams {
  istanzaId: number;
  note: string;
  inviaEmailPassaggioFase?: boolean; // default: true — usato solo se c'è cambio fase
  ufficioId?: number | null;
}

export interface GeneratePaymentParams {
  istanzaId: number;
  workflowId: number;
  importo?: number;
  causale?: string;
  // Dati del debitore (se diverso dal richiedente)
  cf?: string;
  nome?: string;
  cognome?: string;
  email?: string;
}

export async function advanceWorkflow(params: AdvanceWorkflowParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const operatoreId = parseInt(user.id);
    const { istanzaId, note } = params;

    if (!await checkUfficioAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Non autorizzato' };
    }
    if (!await checkUfficioWriteAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Puoi operare solo nella fase di tua competenza' };
    }

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: {
        utente: true,
        servizio: {
          include: {
            area: { select: { nome: true } },
            steps: {
              where: { attivo: true },
              orderBy: { ordine: 'asc' },
              include: { pagamentoConfig: true, allegatiRichiestiList: true, fase: true },
            },
          },
        },
        workflows: {
          orderBy: { id: 'desc' },
          take: 1,
          include: { step: { include: { pagamentoConfig: true, allegatiRichiestiList: true } }, allegati: true, pagamentoAtteso: true },
        },
        faseCorrente: { include: { ufficio: true } },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    if (istanza.stato === 'CONCLUSA' || istanza.stato === 'RESPINTA') {
      return { success: false, message: 'Istanza già conclusa o respinta' };
    }

    const lastWorkflow = istanza.workflows[0];
    const steps = istanza.servizio.steps;
    const currentStepOrder = lastWorkflow?.step?.ordine || 0;
    const currentStep = lastWorkflow?.step;

    const currentPayment = lastWorkflow?.pagamentoAtteso;
    const paymentStep = currentStep?.pagamento ?? false;
    const paymentRequired = currentStep?.pagamentoConfig?.obbligatorio ?? false;
    const paymentConfirmed = currentPayment?.stato === 'CON';

    if (paymentStep && paymentRequired && !paymentConfirmed) {
      return {
        success: false,
        message: 'Pagamento obbligatorio non confermato. Impossibile avanzare.'
      };
    }

    // Controllo allegati obbligatori per operatore
    const requiredAttachments = currentStep?.allegatiRichiestiList?.filter(a => a.obbligatorio && a.soggetto === 'OP') || [];
    const providedAttachments = lastWorkflow?.allegati || [];
    const missingAttachments = requiredAttachments.filter(req =>
      !providedAttachments.some(att => att.nomeFileRichiesto === req.nomeAllegatoRichiesto)
    );

    if (missingAttachments.length > 0) {
      return {
        success: false,
        message: `Allegati obbligatori mancanti: ${missingAttachments.map(a => a.nomeAllegatoRichiesto).join(', ')}. Impossibile avanzare.`
      };
    }

    const now = new Date();
    const currentFase = istanza.faseCorrente;
    // Il primo step attivo della stessa fase con ordine maggiore, non quello
    // con ordine esattamente +1: un buco nella sequenza (step disattivato,
    // riordino dal backoffice) faceva cadere l'avanzamento nel ramo "cambio
    // fase" senza errore, spostando l'istanza a un altro ufficio.
    const nextStepSameFase = prossimoStepStessaFase(steps, currentStep?.faseId, currentStepOrder);

    // --- Protocolla (external call — before the DB transaction, cannot be rolled back) ---
    let protoNumeroStep: string | undefined;
    let protoDataStep: Date | undefined;

    if (currentStep?.protocollo) {
        const storage = getStorage();
        const files = await Promise.all(
          (lastWorkflow?.allegati ?? []).map(async (a) => {
            try {
              const buf = await storage.read(a.nomeHash);
              return new File([new Uint8Array(buf)], a.nomeFile, { type: 'application/pdf' });
            } catch {
              return null;
            }
          })
        ).then((arr) => arr.filter((f): f is File => f !== null));

        const oggetto = `Richiesta - ${istanza.servizio.area?.nome ?? ''} - ${istanza.servizio.titolo} - ${istanza.utente.codiceFiscale}`;
        const result = await protocolla({
          istanzaId,
          oggetto,
          tipoProtocollo: (currentStep.tipoProtocollo as 'E' | 'U') ?? 'E',
          unitaOrganizzativa: currentStep.unitaOrganizzativa ?? '',
          utente: {
            codiceFiscale: istanza.utente.codiceFiscale,
            nome: istanza.utente.nome,
            cognome: istanza.utente.cognome,
          },
          files,
          isFinal: false,
        });
        protoNumeroStep = result.numero;
        protoDataStep = result.data;
    }

    // --- DB mutations (atomic) ---
    let resultMessage = '';
    let pendingFaseEmail: { nuovaFase: { nome: string; ufficio?: { email?: string | null; nome: string } | null } } | null = null;

    await prisma.$transaction(async (tx) => {
      if (protoNumeroStep) {
        await tx.istanza.update({
          where: { id: istanzaId },
          data: { protoNumero: protoNumeroStep, protoData: protoDataStep },
        });
      }

      if (lastWorkflow) {
        await tx.workflow.update({
          where: { id: lastWorkflow.id },
          data: {
            stato: STATO_COMPLETATA,
            completataAt: now,
            completataDaId: operatoreId,
            note: note || lastWorkflow.note,
            operatoreId,
          },
        });
      }

      if (nextStepSameFase) {
        await tx.workflow.create({
          data: {
            istanzaId,
            stepId: nextStepSameFase.id,
            dataVariazione: now,
            stato: STATO_IN_LAVORAZIONE,
          },
        });
        // L'attività corrente la imposta il trigger sull'INSERT. L'assegnatario
        // resta quello che era: si cambia fase, non ufficio.
        resultMessage = `Avanzato allo step: ${nextStepSameFase.descrizione}`;
      } else {
        const allFasi = await tx.fase.findMany({
          where: { servizioId: istanza.servizioId },
          orderBy: { ordine: 'asc' },
          include: {
            steps: { orderBy: { ordine: 'asc' } },
            ufficio: true,
          },
        });

        // Stessa correzione applicata alle fasi: la prima con ordine maggiore.
        const nextFase = prossimaFase(allFasi, currentFase?.ordine ?? 0);

        if (!nextFase) {
          await tx.istanza.update({
            where: { id: istanza.id },
            data: datiStato('CONCLUSA'),
          });
          resultMessage = 'Istanza conclusa con successo';
        } else {
          const firstStepNextFase = nextFase.steps
            .filter((s) => s.attivo)
            .sort((a, b) => a.ordine - b.ordine)[0];

          // Una fase può esistere senza step attivi (creata dal backoffice e non
          // ancora configurata). Prima della correzione della navigazione questo
          // ramo era irraggiungibile perché `ordine + 1` non trovava la fase;
          // ora la trova, e senza guardia si otterrebbe un TypeError dentro la
          // transazione, lasciando l'istanza in uno stato incoerente.
          if (!firstStepNextFase) {
            throw new Error(
              `La fase "${nextFase.nome}" non ha step attivi: configurala prima di trasferirvi l'istanza.`,
            );
          }

          if (currentFase) {
            await tx.workflowFase.updateMany({
              where: { istanzaId: istanza.id, faseId: currentFase.id, dataCompletamento: null },
              data: {
                dataCompletamento: now,
                operatoreCompletamentoId: operatoreId,
              },
            });
          }

          await tx.workflowFase.create({
            data: {
              istanzaId: istanza.id,
              faseId: nextFase.id,
              dataInizio: now,
              direzione: 'AVANZAMENTO',
            },
          });

          await tx.istanza.update({
            where: { id: istanza.id },
            data: { faseCorrenteId: nextFase.id },
          });

          await tx.workflow.create({
            data: {
              // Cambio di fase: il trigger su istanze ha già azzerato
              // l'assegnatario nell'UPDATE di fase_corrente_id qui sopra.
              // L'istanza si presenta come "Nuova" all'ufficio che la riceve.
              istanzaId: istanza.id,
              stepId: firstStepNextFase.id,
              dataVariazione: now,
              stato: STATO_IN_LAVORAZIONE,
            },
          });

          resultMessage = `Trasferito alla fase: ${nextFase.nome}`;

          if (params.inviaEmailPassaggioFase !== false) {
            pendingFaseEmail = { nuovaFase: nextFase };
          }
        }
      }
    });

    // --- Email (after transaction commits) ---
    if (pendingFaseEmail) {
      await sendFaseTransitionEmail({
        istanza: {
          id: istanza.id,
          protoNumero: istanza.protoNumero ?? '',
          utente: { nome: istanza.utente.nome, cognome: istanza.utente.cognome },
          servizio: { titolo: istanza.servizio.titolo },
        },
        nuovaFase: (pendingFaseEmail as { nuovaFase: { nome: string; ufficio?: { email?: string | null; nome: string } | null } }).nuovaFase,
        direzione: 'AVANZAMENTO',
      });
    }

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return {
      success: true,
      message: resultMessage,
      protoNumero: protoNumeroStep,
      protoData: protoDataStep,
    };
  } catch (error) {
    console.error('Error advancing workflow:', error);
    return { success: false, message: 'Errore durante l\'avanzamento' };
  }
}

export async function regressWorkflow(istanzaId: number, note: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const operatoreId = parseInt(user.id);

    if (!await checkUfficioAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Non autorizzato' };
    }
    if (!await checkUfficioWriteAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Puoi operare solo nella fase di tua competenza' };
    }

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: {
        servizio: {
          include: {
            steps: {
              where: { attivo: true },
              orderBy: { ordine: 'asc' },
              include: { fase: { select: { id: true, ordine: true, ufficioId: true } } },
            },
            // Serve solo per sapere se esiste una fase precedente, quando
            // `prevStep` non viene trovato (vedi sotto): distingue "sei al
            // primo step di questa fase, ma ce n'è una prima" da "sei
            // davvero all'inizio dell'iter".
            fasi: { select: { id: true, ordine: true }, orderBy: { ordine: 'asc' } },
          },
        },
        workflows: {
          orderBy: { id: 'desc' },
          take: 1,
          include: { step: { include: { fase: { select: { id: true, ordine: true } } } } },
        },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    if (istanza.stato === 'CONCLUSA' || istanza.stato === 'RESPINTA') {
      return { success: false, message: 'Impossibile retrocedere: istanza già conclusa o respinta' };
    }

    const lastWorkflow = istanza.workflows[0];
    const currentStep = lastWorkflow?.step;
    const currentStepOrder = currentStep?.ordine || 0;

    const steps = istanza.servizio.steps;
    // L'ultimo step attivo con ordine minore, nella stessa fase.
    const prevStep = stepPrecedenteStessaFase(steps, currentStep?.faseId, currentStepOrder);

    if (!prevStep) {
      const esisteFasePrecedente =
        currentStep?.fase != null &&
        trovaFasePrecedente(istanza.servizio.fasi, currentStep.fase.ordine) !== undefined;
      return {
        success: false,
        message: esisteFasePrecedente
          ? 'Impossibile retrocedere oltre il primo step della fase corrente. Usa "Rimanda a fase precedente".'
          : 'Impossibile retrocedere: siamo già al primo step dell\'iter.',
      };
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      if (lastWorkflow) {
        await tx.workflow.update({
          where: { id: lastWorkflow.id },
          data: {
            stato: STATO_IN_LAVORAZIONE,
            // Riaperta: `completataAt` torna NULL come `stato` torna a 0. Sono
            // la stessa informazione finché la contrazione non rimuove `stato`.
            completataAt: null,
            completataDaId: null,
            note: note ? `[Retrocessione] ${note}` : '[Retrocessione]',
            dataVariazione: now,
            operatoreId,
          },
        });
      }

      await tx.workflow.create({
        data: {
          istanzaId,
          stepId: prevStep.id,
          stato: STATO_IN_LAVORAZIONE,
          dataVariazione: now,
          note: note ? `[Retrocessione da step ${currentStepOrder}] ${note}` : `[Retrocessione da step ${currentStepOrder}]`,
        },
      });

      // Nessun update su istanza: la retrocessione resta dentro la stessa fase
    });

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return { success: true, message: `Retrocesso a: ${prevStep.descrizione}` };
  } catch (error) {
    console.error('Error regressing workflow:', error);
    return { success: false, message: 'Errore durante la retrocessione' };
  }
}

export async function rejectIstanza(istanzaId: number, motivo: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const operatoreId = parseInt(user.id);

    if (!await checkUfficioAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Non autorizzato' };
    }
    if (!await checkUfficioWriteAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Puoi operare solo nella fase di tua competenza' };
    }

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: {
        workflows: {
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    if (istanza.stato === 'CONCLUSA') {
      return { success: false, message: 'Istanza già conclusa' };
    }

    const now = new Date();
    const lastWorkflow = istanza.workflows[0];

    // Update last workflow to rejected
    if (lastWorkflow) {
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: {
          stato: STATO_COMPLETATA,//STATO_IN_LAVORAZIONE,
          completataAt: now,
          completataDaId: operatoreId,
          note: motivo,
          dataVariazione: now,
          operatoreId,
        },
      });
    }

    // Mark istanza as rejected
    await prisma.istanza.update({
      where: { id: istanzaId },
      data: datiStato('RESPINTA'),
    });

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return { success: true, message: 'Istanza respinta' };
  } catch (error) {
    console.error('Error rejecting istanza:', error);
    return { success: false, message: 'Errore durante il rifiuto' };
  }
}

export async function reopenIstanza(istanzaId: number) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const operatoreId = parseInt(user.id);

    if (!await checkUfficioAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Non autorizzato' };
    }
    if (!await checkUfficioWriteAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Puoi operare solo nella fase di tua competenza' };
    }

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: {
        workflows: {
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    if (istanza.stato !== 'RESPINTA') {
      return { success: false, message: 'L\'istanza non è respinta' };
    }

    const now = new Date();
    const lastWorkflow = istanza.workflows[0];

    // Update last workflow back to elaborazione
    if (lastWorkflow) {
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: {
          stato: STATO_IN_LAVORAZIONE,
          // Riaperta: `completataAt` torna NULL come `stato` torna a 0.
          completataAt: null,
          completataDaId: null,
          note: '',
          dataVariazione: now,
          operatoreId,
        },
      });
    }

    // Mark istanza as not rejected
    await prisma.istanza.update({
      where: { id: istanzaId },
      data: datiStato('IN_LAVORAZIONE'),
    });

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return { success: true, message: 'Istanza riaperta' };
  } catch (error) {
    console.error('Error reopening istanza:', error);
    return { success: false, message: 'Errore durante la riapertura' };
  }
}

export async function assignProtocollo(
  istanzaId: number,
  protoNumero: string,
  protoData: Date
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    await prisma.istanza.update({
      where: { id: istanzaId },
      data: {
        protoNumero,
        protoData,
      },
    });

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return { success: true, message: 'Protocollo assegnato' };
  } catch (error) {
    console.error('Error assigning protocollo:', error);
    return { success: false, message: 'Errore durante l\'assegnazione del protocollo' };
  }
}

export async function addNote(istanzaId: number, noteText: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const operatoreId = parseInt(user.id);

    if (!await checkUfficioAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Non autorizzato' };
    }
    if (!await checkUfficioWriteAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Puoi operare solo nella fase di tua competenza' };
    }

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: {
        workflows: {
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    const lastWorkflow = istanza.workflows[0];
    const now = new Date();

    // Create workflow entry with same step/status but new note
    await prisma.workflow.create({
      data: {
        istanzaId,
        stepId: lastWorkflow?.stepId,
        stato: lastWorkflow?.stato ?? STATO_IN_LAVORAZIONE,
        // La nota ricalca lo stato dell'attività precedente: se quella era
        // chiusa lo è anche questa. Senza `operatoreId`, che non significa più
        // "assegnata a": l'assegnazione vive su istanze.assegnatario_id.
        completataAt: lastWorkflow?.completataAt ?? null,
        completataDaId: lastWorkflow?.completataDaId ?? null,
        dataVariazione: now,
        note: noteText,
      },
    });

    revalidatePath(`/istanze/${istanzaId}`);

    return { success: true, message: 'Nota aggiunta' };
  } catch (error) {
    console.error('Error adding note:', error);
    return { success: false, message: 'Errore durante l\'aggiunta della nota' };
  }
}

export async function takeCharge(istanzaId: number) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const operatoreId = parseInt(user.id);

    if (!await checkUfficioAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Non autorizzato' };
    }
    if (!await checkUfficioWriteAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Puoi operare solo nella fase di tua competenza' };
    }

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: {
        servizio: {
          include: {
            steps: {
              where: { attivo: true },
              orderBy: { ordine: 'asc' },
              take: 1,
              include: { fase: { select: { id: true, ufficioId: true } } },
            },
          },
        },
        workflows: {
          // `dataVariazione` e non `id`: "ultimo" ha una sola definizione.
          orderBy: { dataVariazione: 'desc' },
          take: 1,
        },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    if (istanza.stato === 'CONCLUSA' || istanza.stato === 'RESPINTA') {
      return { success: false, message: 'Impossibile prendere in carico un\'istanza conclusa o respinta' };
    }

    const firstStep = istanza.servizio.steps[0];
    if (!firstStep) {
      return { success: false, message: 'Il servizio non ha step configurati' };
    }

    const lastWorkflow = istanza.workflows[0];

    if (istanza.assegnatarioId !== null) {
      return { success: false, message: 'Istanza già presa in carico' };
    }

    const now = new Date();

    // L'assegnazione vive su istanze.assegnatario_id, non sulla riga di
    // attività: una sola UPDATE, che imposta anche la fase corrente per le
    // istanze migrate che ce l'hanno a NULL. Il trigger di azzeramento non
    // scatta in quel caso (guardia su OLD.fase_corrente_id IS NOT NULL), ma
    // scatterebbe se le due scritture fossero separate e la seconda cambiasse
    // la fase dopo aver assegnato.
    await prisma.istanza.update({
      where: { id: istanzaId },
      data: {
        assegnatarioId: operatoreId,
        ...(istanza.faseCorrenteId === null && firstStep.faseId
          ? { faseCorrenteId: firstStep.faseId }
          : {}),
      },
    });

    if (!lastWorkflow) {
      // Edge case: nessuna attività esistente (legacy) — creala al primo step
      // del servizio. Senza operatoreId: chi la prende in carico è
      // sull'istanza.
      await prisma.workflow.create({
        data: {
          istanzaId,
          stepId: firstStep.id,
          stato: STATO_IN_LAVORAZIONE,
          dataVariazione: now,
          note: '',
        },
      });
    }

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return { success: true, message: `Presa in carico — step: ${firstStep.descrizione}` };
  } catch (error) {
    console.error('Error taking charge:', error);
    return { success: false, message: 'Errore durante la presa in carico' };
  }
}

export interface AllegatoComunicazione {
  nome: string;
  obbligatorio: boolean;
}

export async function sendComunicazione(
  istanzaId: number,
  testo: string,
  richiedeRisposta: boolean,
  allegatiRichiesti: AllegatoComunicazione[]
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const operatoreId = parseInt(user.id);

    if (!await checkUfficioAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Non autorizzato' };
    }
    if (!await checkUfficioWriteAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Puoi operare solo nella fase di tua competenza' };
    }

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: { utente: true },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    await prisma.comunicazione.create({
      data: {
        istanzaId,
        operatoreId,
        testo,
        richiedeRisposta,
        allegatiRichiesti: allegatiRichiesti.length > 0
          ? JSON.stringify(allegatiRichiesti)
          : null,
      },
    });

    // Send email to citizen if they have an address
    let emailSent = false;
    if (istanza.utente.email) {
      const emailResult = await sendEmail({
        to: istanza.utente.email,
        subject: 'Comunicazione dal Comune',
        html: `<p>${escapeHtml(testo).replace(/\n/g, '<br>')}</p>`,
        text: testo,
      });
      emailSent = emailResult.success;
    }

    revalidatePath(`/istanze/${istanzaId}`);

    return {
      success: true,
      message: istanza.utente.email
        ? emailSent
          ? 'Comunicazione registrata e inviata via email'
          : 'Comunicazione registrata (invio email fallito)'
        : 'Comunicazione registrata (utente senza email)',
    };
  } catch (error) {
    console.error('Error sending comunicazione:', error);
    return { success: false, message: "Errore durante l'invio della comunicazione" };
  }
}

export async function assignAttributo(istanzaId: number, attributoId: number | null) {
  // AttributoType/Attributo is not active in the current schema
  return { success: false, message: 'Funzionalità non disponibile' };
}

export interface IstanzaUtenteItem {
  id: number;
  modulo: string;
  dataInvio: Date;
  protoNumero: string | null;
  stato: StatoIstanzaValore;
  step: string;
  status: string;
  dataVariazione: Date | null;
}

export async function getIstanzeUtente(codiceFiscale: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, data: [] as IstanzaUtenteItem[], message: 'Non autorizzato' };
    }

    const visibilita = await getVisibilitaOperatore(parseInt(user.id), user.ruoli);

    const utente = await prisma.utente.findUnique({
      where: { codiceFiscale },
      include: {
        istanze: {
          // Solo le istanze che l'operatore può vedere (ufficio + servizi assegnati)
          where: { ...whereVisibileAgliOperatori(), AND: [istanzaVisibilityWhere(visibilita)] },
          orderBy: { dataInvio: 'desc' },
          take: 50,
          include: {
            servizio: { select: { titolo: true } },
            attivitaCorrente: { include: { step: true } },
          },
        },
      },
    });

    if (!utente) {
      return { success: true, data: [] as IstanzaUtenteItem[] };
    }

    const data: IstanzaUtenteItem[] = utente.istanze.map((i) => ({
      id: i.id,
      modulo: i.servizio.titolo,
      dataInvio: i.dataInvio,
      protoNumero: i.protoNumero,
      stato: i.stato,
      step: i.attivitaCorrente?.step?.descrizione ?? '-',
      status: i.attivitaCorrente
        ? ETICHETTE_STATO_ATTIVITA[statoAttivita(i.attivitaCorrente, i)]
        : ETICHETTE_STATO_ATTIVITA.IN_ATTESA,
      dataVariazione: i.attivitaCorrente?.dataVariazione ?? null,
    }));

    return { success: true, data };
  } catch (error) {
    console.error('Error getting istanze utente:', error);
    return { success: false, data: [] as IstanzaUtenteItem[], message: 'Errore durante il recupero' };
  }
}

export async function concludeIstanza(istanzaId: number, note?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const operatoreId = parseInt(user.id);

    if (!await checkUfficioAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Non autorizzato' };
    }
    if (!await checkUfficioWriteAccess(istanzaId, operatoreId, user.ruoli ?? [])) {
      return { success: false, message: 'Puoi operare solo nella fase di tua competenza' };
    }

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: {
        utente: true,
        servizio: { include: { area: { select: { nome: true } } } },
        workflows: {
          orderBy: { id: 'desc' },
          take: 1,
          include: { step: { include: { allegatiRichiestiList: true } }, allegati: true },
        },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    if (istanza.stato === 'CONCLUSA') {
      return { success: false, message: 'Istanza già conclusa' };
    }

    if (istanza.stato === 'RESPINTA') {
      return { success: false, message: "Impossibile concludere un'istanza respinta" };
    }

    const now = new Date();
    const lastWorkflow = istanza.workflows[0];
    const lastStep = lastWorkflow?.step;

    // Controllo allegati obbligatori per operatore
    const requiredAttachments = lastStep?.allegatiRichiestiList?.filter(a => a.obbligatorio && a.soggetto === 'OP') || [];
    const providedAttachments = lastWorkflow?.allegati || [];
    const missingAttachments = requiredAttachments.filter(req =>
      !providedAttachments.some(att => att.nomeFileRichiesto === req.nomeAllegatoRichiesto)
    );

    if (missingAttachments.length > 0) {
      return {
        success: false,
        message: `Allegati obbligatori mancanti: ${missingAttachments.map(a => a.nomeAllegatoRichiesto).join(', ')}. Impossibile concludere.`
      };
    }

    // --- Protocollo finale (sempre Uscita) ---
    let protoFinaleNumero: string | undefined;
    let protoFinaleData: Date | undefined;

    if (lastStep?.protocollo) {
      const storage = getStorage();
      const files = await Promise.all(
        (lastWorkflow?.allegati ?? []).map(async (a) => {
          try {
            const buf = await storage.read(a.nomeHash);
            return new File([new Uint8Array(buf)], a.nomeFile, { type: 'application/pdf' });
          } catch {
            return null;
          }
        })
      ).then((arr) => arr.filter((f): f is File => f !== null));

      const oggetto = `Richiesta - ${istanza.servizio?.area?.nome ?? ''} - ${istanza.servizio?.titolo ?? ''} - ${istanza.utente.codiceFiscale}`;
      const result = await protocolla({
        istanzaId,
        oggetto,
        tipoProtocollo: 'U',
        unitaOrganizzativa: lastStep.unitaOrganizzativa ?? '',
        utente: {
          codiceFiscale: istanza.utente.codiceFiscale,
          nome: istanza.utente.nome,
          cognome: istanza.utente.cognome,
        },
        files,
        isFinal: true,
      });
      protoFinaleNumero = result.numero;
      protoFinaleData = result.data;
    }

    await prisma.$transaction(async (tx) => {
      if (lastWorkflow) {
        await tx.workflow.update({
          where: { id: lastWorkflow.id },
          data: {
            stato: STATO_COMPLETATA,
            completataAt: now,
            completataDaId: operatoreId,
            note: note || lastWorkflow.note,
            dataVariazione: now,
            operatoreId,
          },
        });
      }

      await tx.istanza.update({
        where: { id: istanzaId },
        data: {
          ...datiStato('CONCLUSA'),
          ...(protoFinaleNumero && { protoFinaleNumero, protoFinaleData }),
        },
      });
    });

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return {
      success: true,
      message: 'Istanza conclusa con successo',
      protoFinaleNumero,
      protoFinaleData,
    };
  } catch (error) {
    console.error('Error concluding istanza:', error);
    return { success: false, message: 'Errore durante la conclusione' };
  }
}

export async function generatePayment(params: GeneratePaymentParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    const { istanzaId, workflowId, importo, causale, cf, nome, cognome, email } = params;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        step: { include: { pagamentoConfig: true } },
        istanza: { include: { utente: true } },
      },
    });

    if (!workflow) {
      return { success: false, message: 'Workflow non trovato' };
    }

    if (!workflow.step?.pagamento || !workflow.step.pagamentoConfig) {
      return { success: false, message: 'Questo step non prevede pagamenti' };
    }

    const cfg = workflow.step.pagamentoConfig;
    const paymentImporto = cfg.importoVariabile ? (importo ?? 0) : (cfg.importo ?? 0);
    const paymentCausale = cfg.causaleVariabile ? (causale ?? '') : (cfg.causale ?? '');
    const codiceTributo = cfg.codiceTributo ?? '';

    if (paymentImporto <= 0) {
      return { success: false, message: 'Importo non valido' };
    }

    if (!codiceTributo) {
      return { success: false, message: 'Codice tributo non configurato' };
    }

    // Annulla pagamento esistente se presente
    const existingPayment = await prisma.pagamentoAtteso.findUnique({
      where: { workflowId },
    });
    if (existingPayment) {
      await prisma.pagamentoAtteso.delete({
        where: { workflowId },
      });
    }

    // Crea nuovo pagamento
    const dataInizioValidita = new Date();
    const dataScadenza = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 giorni

    const payResult = await pmPayService.createPayment({
      documento: getNumeroDocumento(codiceTributo, istanzaId),
      dataInizioValidita: formatDate(dataInizioValidita),
      dataScadenza: formatDate(dataScadenza),
      importo: paymentImporto,
      causale: paymentCausale,
      codiceTributo,
      codiceFiscale: cf || workflow.istanza.utente.codiceFiscale,
      nome: nome || workflow.istanza.utente.nome,
      cognome: cognome || workflow.istanza.utente.cognome,
      email: email || workflow.istanza.utente.email || undefined,
    });

    if (!payResult.success || !payResult.iuv) {
      return { success: false, message: 'Errore nella creazione del pagamento' };
    }

    const pagAtt = await prisma.pagamentoAtteso.create({
      data: {
        workflowId,
        iuv: payResult.iuv,
        dataScadenza,
        dataEmissione: dataInizioValidita,
        numeroDocumento: payResult.numeroAvviso,
        importoTotale: paymentImporto,
        stato: 'ATT',
        causale: paymentCausale,
        paganteCodiceFiscale: cf || workflow.istanza.utente.codiceFiscale,
        pagante: nome || workflow.istanza.utente.nome,
        paganteEmail: email || workflow.istanza.utente.email,
      },
    });

    revalidatePath(`/istanze/${istanzaId}`);

    return {
      success: true,
      message: existingPayment ? 'Pagamento annullato e rigenerato' : 'Pagamento generato con successo',
      pagamentoAttesoId: pagAtt.id,
    };
  } catch (error) {
    console.error('Error generating payment:', error);
    return { success: false, message: 'Errore durante la generazione del pagamento' };
  }
}

export async function rollbackFase(params: {
  istanzaId: number;
  note: string;
  inviaEmail?: boolean;
}): Promise<{ success: boolean; message: string }> {
  const operatore = await requireAuth();

  if (!await checkUfficioAccess(params.istanzaId, parseInt(operatore.id), operatore.ruoli ?? [])) {
    return { success: false, message: 'Non autorizzato' };
  }
  if (!await checkUfficioWriteAccess(params.istanzaId, parseInt(operatore.id), operatore.ruoli ?? [])) {
    return { success: false, message: 'Puoi operare solo nella fase di tua competenza' };
  }

  const istanza = await prisma.istanza.findUnique({
    where: { id: params.istanzaId },
    include: {
      servizio: {
        include: {
          fasi: {
            include: {
              steps: { orderBy: { ordine: 'asc' } },
              ufficio: true,
            },
            orderBy: { ordine: 'asc' },
          },
        },
      },
      faseCorrente: { include: { ufficio: true } },
      utente: true,
    },
  });

  if (!istanza) return { success: false, message: 'Istanza non trovata' };
  if (istanza.stato === 'CONCLUSA') return { success: false, message: "L'istanza è già conclusa" };
  if (istanza.stato === 'RESPINTA') return { success: false, message: "L'istanza è respinta" };
  if (!istanza.faseCorrente) {
    return { success: false, message: 'Non è possibile tornare a una fase precedente: questa è già la prima fase' };
  }

  // L'ultima fase con ordine minore di quella corrente, non "ordine - 1": un
  // buco negli ordini delle fasi (una fase eliminata, ordini 1,3,5) faceva
  // fallire la ricerca pur esistendo una fase precedente, e la vecchia
  // guardia `ordine <= 1` presumeva che gli ordini partissero da 1 e fossero
  // contigui. La condizione vera è "non esiste alcuna fase con ordine
  // minore", cioè il risultato di questa ricerca è assente.
  const fasePrecedente = trovaFasePrecedente(istanza.servizio.fasi, istanza.faseCorrente.ordine);
  if (!fasePrecedente) {
    return { success: false, message: 'Non è possibile tornare a una fase precedente: questa è già la prima fase' };
  }

  const lastStepFasePrecedente = fasePrecedente.steps
    .filter((s) => s.attivo)
    .sort((a, b) => b.ordine - a.ordine)[0];
  if (!lastStepFasePrecedente) return { success: false, message: 'Nessuno step nella fase precedente' };

  const now = new Date();
  const operatoreId = parseInt(operatore.id);

  await prisma.$transaction(async (tx) => {
    await tx.workflowFase.updateMany({
      where: { istanzaId: istanza.id, faseId: istanza.faseCorrente!.id, dataCompletamento: null },
      data: {
        dataCompletamento: now,
        operatoreCompletamentoId: operatoreId,
        direzione: 'ROLLBACK',
      },
    });

    await tx.workflowFase.create({
      data: {
        istanzaId: istanza.id,
        faseId: fasePrecedente.id,
        dataInizio: now,
        direzione: 'ROLLBACK',
      },
    });

    await tx.workflow.create({
      data: {
        istanzaId: istanza.id,
        stepId: lastStepFasePrecedente.id,
        dataVariazione: now,
        stato: STATO_IN_LAVORAZIONE,
        note: `[Rollback di fase] ${params.note}`,
      },
    });

    await tx.istanza.update({
      where: { id: istanza.id },
      data: { faseCorrenteId: fasePrecedente.id },
    });
  });

  // Email (after transaction commits)
  if (params.inviaEmail !== false) {
    await sendFaseTransitionEmail({
      istanza: {
        id: istanza.id,
        protoNumero: istanza.protoNumero ?? '',
        utente: { nome: istanza.utente.nome, cognome: istanza.utente.cognome },
        servizio: { titolo: istanza.servizio.titolo },
      },
      nuovaFase: fasePrecedente,
      direzione: 'ROLLBACK',
    });
  }

  revalidatePath(`/istanze/${istanza.id}`);
  revalidatePath('/istanze');

  return { success: true, message: `Pratica rimandata alla fase: ${fasePrecedente.nome}` };
}
