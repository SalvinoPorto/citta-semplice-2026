'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import { getCurrentUser, requireAuth } from '@/lib/auth/session';
import { sendEmail } from '@/lib/services/email';
import { sendFaseTransitionEmail } from '@/lib/services/faseTransitionEmail';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pmPayService } from '@/lib/external/pmpay';
import { protocolla } from '@/lib/services/protocollazione/UrbiProtocolloService';

// stato: operatoreId=null → In attesa, stato=0 → In lavorazione, stato=1 → Completata
const STATO_IN_LAVORAZIONE = 0;
const STATO_COMPLETATA = 1;

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getStatoLabel(operatoreId: number | null, stato: number): string {
  if (operatoreId === null) return 'In attesa';
  if (stato === 1) return 'Completata';
  return 'In lavorazione';
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

    if (istanza.conclusa || istanza.respinta) {
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
    const requiredAttachments = currentStep?.allegatiRichiestiList?.filter(a => a.obbligatorio && a.soggetto === 'operatore') || [];
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

    // --- Gestione protocollo step corrente ---
    let protoNumeroStep: string | undefined;
    let protoDataStep: Date | undefined;

    if (currentStep?.protocollo) {
        const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/allegati';
        const files = await Promise.all(
          (lastWorkflow?.allegati ?? []).map(async (a) => {
            try {
              const buf = await readFile(join(UPLOAD_DIR, a.nomeHash));
              return new File([buf], a.nomeFile, { type: 'application/pdf' });
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
        await prisma.istanza.update({
          where: { id: istanzaId },
          data: { protoNumero: result.numero, protoData: result.data },
        });
      
    }

    // Update current workflow to success (mantieni dataVariazione originale)
    if (lastWorkflow) {
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: {
          stato: STATO_COMPLETATA,
          note: note || lastWorkflow.note,
          operatoreId,
        },
      });
    }

    const currentFase = istanza.faseCorrente;

    // Cerca il prossimo step nella STESSA fase
    const nextStepSameFase = steps.find(
      (s) => s.faseId === currentStep?.faseId && s.ordine === currentStepOrder + 1
    );

    let resultMessage: string;

    if (nextStepSameFase) {
      // Avanzamento intra-fase: l'operatore rimane assegnato
      await prisma.workflow.create({
        data: {
          istanzaId,
          stepId: nextStepSameFase.id,
          dataVariazione: now,
          stato: STATO_IN_LAVORAZIONE,
          operatoreId,
        },
      });
      await prisma.istanza.update({
        where: { id: istanzaId },
        data: { lastStepId: nextStepSameFase.id, activeStep: nextStepSameFase.ordine },
      });
      resultMessage = `Avanzato allo step: ${nextStepSameFase.descrizione}`;
    } else {
      // Fine della fase corrente — cerca la fase successiva
      const allFasi = await prisma.fase.findMany({
        where: { servizioId: istanza.servizioId },
        orderBy: { ordine: 'asc' },
        include: {
          steps: { orderBy: { ordine: 'asc' } },
          ufficio: true,
        },
      });

      const nextFase = allFasi.find((f) => f.ordine === (currentFase?.ordine ?? 1) + 1);

      if (!nextFase) {
        // Nessuna fase successiva → istanza conclusa
        await prisma.istanza.update({
          where: { id: istanza.id },
          data: { conclusa: true },
        });
        resultMessage = 'Istanza conclusa con successo';
      } else {
        // Passaggio alla fase successiva
        const firstStepNextFase = nextFase.steps[0];

        // Chiudi WorkflowFase corrente
        if (currentFase) {
          await prisma.workflowFase.updateMany({
            where: { istanzaId: istanza.id, faseId: currentFase.id, dataCompletamento: null },
            data: {
              dataCompletamento: now,
              operatoreCompletamentoId: operatoreId,
            },
          });
        }

        // Apri nuovo WorkflowFase
        await prisma.workflowFase.create({
          data: {
            istanzaId: istanza.id,
            faseId: nextFase.id,
            dataInizio: now,
            direzione: 'AVANZAMENTO',
          },
        });

        const nextUfficioCorrenteId = nextFase.ufficioId ?? null;

        // Aggiorna istanza
        await prisma.istanza.update({
          where: { id: istanza.id },
          data: {
            faseCorrenteId: nextFase.id,
            ufficioCorrenteId: nextUfficioCorrenteId,
            lastStepId: firstStepNextFase.id,
            activeStep: firstStepNextFase.ordine,
          },
        });

        // Crea workflow per il primo step della nuova fase (operatoreId: null)
        await prisma.workflow.create({
          data: {
            istanzaId: istanza.id,
            stepId: firstStepNextFase.id,
            dataVariazione: now,
            stato: STATO_IN_LAVORAZIONE,
            // operatoreId: null — l'ufficio entrante prende in carico liberamente
          },
        });

        // Email notifica (condizionale)
        if (params.inviaEmailPassaggioFase !== false) {
          await sendFaseTransitionEmail({
            istanza: {
              id: istanza.id,
              protoNumero: istanza.protoNumero ?? '',
              utente: { nome: istanza.utente.nome, cognome: istanza.utente.cognome },
              servizio: { titolo: istanza.servizio.titolo },
            },
            nuovaFase: nextFase,
            direzione: 'AVANZAMENTO',
          });
        }

        resultMessage = `Trasferito alla fase: ${nextFase.nome}`;
      }
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

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: {
        servizio: {
          include: {
            steps: {
              where: { attivo: true },
              orderBy: { ordine: 'asc' },
            },
          },
        },
        workflows: {
          orderBy: { id: 'desc' },
          take: 1,
          include: { step: true },
        },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    if (istanza.conclusa || istanza.respinta) {
      return { success: false, message: 'Impossibile retrocedere: istanza già conclusa o respinta' };
    }

    const lastWorkflow = istanza.workflows[0];
    const currentStepOrder = lastWorkflow?.step?.ordine || 0;

    if (currentStepOrder <= 1) {
      return { success: false, message: 'Impossibile retrocedere: siamo già al primo step' };
    }

    const steps = istanza.servizio.steps;
    const prevStep = steps.find((s) => s.ordine === currentStepOrder - 1);

    if (!prevStep) {
      return { success: false, message: 'Step precedente non trovato' };
    }

    const now = new Date();

    // Mark current workflow as "retroceded"
    if (lastWorkflow) {
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: {
          stato: STATO_IN_LAVORAZIONE,
          note: note ? `[Retrocessione] ${note}` : '[Retrocessione]',
          dataVariazione: now,
          operatoreId,
        },
      });
    }

    // Create new workflow at previous step
    await prisma.workflow.create({
      data: {
        istanzaId,
        stepId: prevStep.id,
        stato: STATO_IN_LAVORAZIONE,
        operatoreId,
        dataVariazione: now,
        note: note ? `[Retrocessione da step ${currentStepOrder}] ${note}` : `[Retrocessione da step ${currentStepOrder}]`,
      },
    });

    // Update last step
    await prisma.istanza.update({
      where: { id: istanzaId },
      data: { lastStepId: prevStep.id },
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

    if (istanza.conclusa) {
      return { success: false, message: 'Istanza già conclusa' };
    }

    const now = new Date();
    const lastWorkflow = istanza.workflows[0];

    // Update last workflow to rejected
    if (lastWorkflow) {
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: {
          stato: STATO_IN_LAVORAZIONE,
          note: motivo,
          dataVariazione: now,
          operatoreId,
        },
      });
    }

    // Mark istanza as rejected
    await prisma.istanza.update({
      where: { id: istanzaId },
      data: { respinta: true },
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

    if (!istanza.respinta) {
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
          note: '',
          dataVariazione: now,
          operatoreId,
        },
      });
    }

    // Mark istanza as not rejected
    await prisma.istanza.update({
      where: { id: istanzaId },
      data: { respinta: false },
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
        operatoreId,
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

    const istanza = await prisma.istanza.findUnique({
      where: { id: istanzaId },
      include: {
        servizio: {
          include: {
            steps: {
              where: { attivo: true },
              orderBy: { ordine: 'asc' },
              take: 1,
            },
          },
        },
        workflows: {
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    if (istanza.conclusa || istanza.respinta) {
      return { success: false, message: 'Impossibile prendere in carico un\'istanza conclusa o respinta' };
    }

    const firstStep = istanza.servizio.steps[0];
    if (!firstStep) {
      return { success: false, message: 'Il servizio non ha step configurati' };
    }

    const lastWorkflow = istanza.workflows[0];

    // Se c'è già un workflow al primo step con operatore assegnato, è già in carico
    if (lastWorkflow?.stepId === firstStep.id && lastWorkflow.operatoreId !== null) {
      return { success: false, message: 'Istanza già presa in carico' };
    }

    const now = new Date();

    if (lastWorkflow?.stepId === firstStep.id && lastWorkflow.operatoreId === null) {
      // Workflow auto-creato all'invio: aggiorna solo l'operatore
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: { operatoreId },
      });
    } else {
      // Nessun workflow esistente: crea il primo step
      await prisma.workflow.create({
        data: {
          istanzaId,
          stepId: firstStep.id,
          stato: STATO_IN_LAVORAZIONE,
          operatoreId,
          dataVariazione: now,
          note: '',
        },
      });
    }

    await prisma.istanza.update({
      where: { id: istanzaId },
      data: { lastStepId: firstStep.id },
    });

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
        html: `<p>${testo.replace(/\n/g, '<br>')}</p>`,
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
  conclusa: boolean;
  respinta: boolean;
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

    const utente = await prisma.utente.findUnique({
      where: { codiceFiscale },
      include: {
        istanze: {
          orderBy: { dataInvio: 'desc' },
          take: 50,
          include: {
            servizio: { select: { titolo: true } },
            workflows: {
              orderBy: { id: 'desc' },
              take: 1,
              include: { step: true },
            },
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
      conclusa: i.conclusa,
      respinta: i.respinta,
      step: i.workflows[0]?.step?.descrizione ?? '-',
      status: getStatoLabel(i.workflows[0]?.operatoreId ?? null, i.workflows[0]?.stato ?? 0),
      dataVariazione: i.workflows[0]?.dataVariazione ?? null,
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

    if (istanza.conclusa) {
      return { success: false, message: 'Istanza già conclusa' };
    }

    if (istanza.respinta) {
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
      const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/allegati';
      const files = await Promise.all(
        (lastWorkflow?.allegati ?? []).map(async (a) => {
          try {
            const buf = await readFile(join(UPLOAD_DIR, a.nomeHash));
            return new File([buf], a.nomeFile, { type: 'application/pdf' });
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

    // Update last workflow to success
    if (lastWorkflow) {
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: {
          stato: STATO_COMPLETATA,
          note: note || lastWorkflow.note,
          dataVariazione: now,
          operatoreId,
        },
      });
    }

    // Mark istanza as concluded
    await prisma.istanza.update({
      where: { id: istanzaId },
      data: {
        conclusa: true,
        ...(protoFinaleNumero && { protoFinaleNumero, protoFinaleData }),
      },
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
  if (istanza.conclusa) return { success: false, message: "L'istanza è già conclusa" };
  if (istanza.respinta) return { success: false, message: "L'istanza è respinta" };
  if (!istanza.faseCorrente || istanza.faseCorrente.ordine <= 1) {
    return { success: false, message: 'Non è possibile tornare a una fase precedente: questa è già la prima fase' };
  }

  const fasePrecedente = istanza.servizio.fasi.find(
    (f) => f.ordine === istanza.faseCorrente!.ordine - 1
  );
  if (!fasePrecedente) return { success: false, message: 'Fase precedente non trovata' };

  const lastStepFasePrecedente = fasePrecedente.steps[fasePrecedente.steps.length - 1];
  if (!lastStepFasePrecedente) return { success: false, message: 'Nessuno step nella fase precedente' };

  const now = new Date();
  const operatoreId = parseInt(operatore.id);

  // Chiudi WorkflowFase corrente con direzione ROLLBACK
  await prisma.workflowFase.updateMany({
    where: { istanzaId: istanza.id, faseId: istanza.faseCorrente.id, dataCompletamento: null },
    data: {
      dataCompletamento: now,
      operatoreCompletamentoId: operatoreId,
      direzione: 'ROLLBACK',
    },
  });

  // Crea nuovo WorkflowFase per la fase precedente
  await prisma.workflowFase.create({
    data: {
      istanzaId: istanza.id,
      faseId: fasePrecedente.id,
      dataInizio: now,
      direzione: 'ROLLBACK',
    },
  });

  // Crea nuovo Workflow per l'ultimo step della fase precedente (operatore null — nuova presa in carico)
  await prisma.workflow.create({
    data: {
      istanzaId: istanza.id,
      stepId: lastStepFasePrecedente.id,
      dataVariazione: now,
      stato: STATO_IN_LAVORAZIONE,
      note: `[Rollback di fase] ${params.note}`,
      // operatoreId: null
    },
  });

  const rollbackUfficioCorrenteId = fasePrecedente.ufficioId ?? null;

  // Aggiorna istanza
  await prisma.istanza.update({
    where: { id: istanza.id },
    data: {
      faseCorrenteId: fasePrecedente.id,
      ufficioCorrenteId: rollbackUfficioCorrenteId,
      lastStepId: lastStepFasePrecedente.id,
      activeStep: lastStepFasePrecedente.ordine,
    },
  });

  // Email notifica (condizionale)
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
