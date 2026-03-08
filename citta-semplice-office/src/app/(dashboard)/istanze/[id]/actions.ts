'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { sendEmail } from '@/lib/services/email';
import { pmPayService } from '@/lib/external/pmpay';
import { urbiSmartService } from '@/lib/external/urbismart';

const STATUS_ELABORAZIONE = 1;
const STATUS_SUCCESSO = 2;
const STATUS_RESPINTA = 4;

export interface AdvanceWorkflowParams {
  istanzaId: number;
  note: string;
  // Pagamento (se lo step corrente ha pagamento)
  pagamentoImporto?: number;
  pagamentoCausale?: string;
  // Protocollo (se lo step corrente ha protocollo)
  protocolloManuale?: boolean;
  protoNumero?: string;
  protoData?: string;
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
            steps: {
              where: { attivo: true },
              orderBy: { ordine: 'asc' },
              include: { pagamentoConfig: true },
            },
          },
        },
        workflows: {
          orderBy: { dataVariazione: 'desc' },
          take: 1,
          include: { step: { include: { pagamentoConfig: true } } },
        },
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
    const nextStep = steps.find((s) => s.ordine === currentStepOrder + 1);

    const now = new Date();

    // --- Gestione pagamento step corrente ---
    let pagamentoEffettuatoId: number | undefined;
    if (currentStep?.pagamento && currentStep.pagamentoConfig) {
      const cfg = currentStep.pagamentoConfig;
      const importo = cfg.importoVariabile
        ? (params.pagamentoImporto ?? 0)
        : (cfg.importo ?? 0);
      const causale = cfg.causaleVariabile
        ? (params.pagamentoCausale ?? '')
        : (cfg.causale ?? '');

      if (importo > 0 && cfg.codiceTributoId) {
        const tributo = await prisma.tributo.findUnique({
          where: { id: cfg.codiceTributoId },
        });

        if (tributo) {
          const payResult = await pmPayService.createPayment({
            importo,
            causale,
            codiceTributo: tributo.codice,
            codiceFiscale: istanza.utente.codiceFiscale,
            nome: istanza.utente.nome,
            cognome: istanza.utente.cognome,
            email: istanza.utente.email ?? undefined,
          });

          if (payResult.success && payResult.iuv) {
            const pagEff = await prisma.pagamentoEffettuato.create({
              data: {
                workflowId: lastWorkflow!.id,
                iuv: payResult.iuv,
                importoTotale: importo,
                stato: 'PENDING',
                causale,
                cfUtente: istanza.utente.codiceFiscale,
                nomeUtente: istanza.utente.nome,
                cognomeUtente: istanza.utente.cognome,
                emailUtente: istanza.utente.email,
              },
            });
            pagamentoEffettuatoId = pagEff.id;
          }
        }
      }
    }

    // --- Gestione protocollo step corrente ---
    if (currentStep?.protocollo && !params.protocolloManuale) {
      // Chiamata automatica a Urbismart (se configurato)
      try {
        const tipo = (currentStep.tipoProtocollo as 'E' | 'U' | null) ?? 'E';
        const unitaOrg = currentStep.unitaOrganizzativa ?? '';
        await urbiSmartService.registraProtocollo({
          tipo,
          oggetto: `Istanza #${istanzaId} - ${istanza.servizio.titolo}`,
          tipoMezzo: 'PEC',
          corrispondente: {
            cognome: istanza.utente.cognome,
            nome: istanza.utente.nome,
            codiceFiscale: istanza.utente.codiceFiscale,
          },
          unitaOrganizzativa: unitaOrg,
          nomeFile: `istanza_${istanzaId}.pdf`,
          filePath: '',
          classificazione: 'V/5',
        });
      } catch {
        // Non blocchiamo l'avanzamento per errori di protocollo
      }
    }

    // Protocollo manuale
    if (currentStep?.protocollo && params.protocolloManuale && params.protoNumero) {
      await prisma.istanza.update({
        where: { id: istanzaId },
        data: {
          protoNumero: params.protoNumero,
          protoData: params.protoData ? new Date(params.protoData) : now,
        },
      });
    }

    // Update current workflow to success
    if (lastWorkflow) {
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: {
          statusId: STATUS_SUCCESSO,
          note: note || lastWorkflow.note,
          dataVariazione: now,
          operatoreId,
        },
      });
    }

    if (nextStep) {
      // Create new workflow for next step
      await prisma.workflow.create({
        data: {
          istanzaId,
          stepId: nextStep.id,
          statusId: STATUS_ELABORAZIONE,
          operatoreId,
          dataVariazione: now,
          note: '',
        },
      });

      // Update istanza last step
      await prisma.istanza.update({
        where: { id: istanzaId },
        data: { lastStepId: nextStep.id },
      });
    } else {
      // No more steps - mark as concluded
      await prisma.istanza.update({
        where: { id: istanzaId },
        data: { conclusa: true },
      });
    }

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return {
      success: true,
      message: nextStep
        ? `Avanzato allo step: ${nextStep.descrizione}`
        : 'Istanza conclusa con successo',
      pagamentoEffettuatoId,
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
          orderBy: { dataVariazione: 'desc' },
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
          statusId: STATUS_ELABORAZIONE,
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
        statusId: STATUS_ELABORAZIONE,
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
          orderBy: { dataVariazione: 'desc' },
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
          statusId: STATUS_RESPINTA,
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
          orderBy: { dataVariazione: 'desc' },
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
          statusId: STATUS_ELABORAZIONE,
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
          orderBy: { dataVariazione: 'desc' },
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
        statusId: lastWorkflow?.statusId ?? STATUS_ELABORAZIONE,
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
        workflows: {
          orderBy: { dataVariazione: 'desc' },
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

    const now = new Date();
    const lastWorkflow = istanza.workflows[0];

    if (lastWorkflow) {
      // Update last workflow to assign operator
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: {
          operatoreId,
          dataVariazione: now,
        },
      });
    } else {
      // Create first workflow entry
      await prisma.workflow.create({
        data: {
          istanzaId,
          statusId: STATUS_ELABORAZIONE,
          operatoreId,
          dataVariazione: now,
          note: '',
        },
      });
    }

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return { success: true, message: 'Istanza presa in carico' };
  } catch (error) {
    console.error('Error taking charge:', error);
    return { success: false, message: 'Errore durante la presa in carico' };
  }
}

export async function sendCommunication(
  istanzaId: number,
  subject: string,
  message: string,
  notificaId?: number
) {
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
        workflows: {
          orderBy: { dataVariazione: 'desc' },
          take: 1,
        },
      },
    });

    if (!istanza) {
      return { success: false, message: 'Istanza non trovata' };
    }

    const now = new Date();
    const lastWorkflow = istanza.workflows[0];

    // Create workflow entry for communication
    await prisma.workflow.create({
      data: {
        istanzaId,
        stepId: lastWorkflow?.stepId,
        statusId: lastWorkflow?.statusId ?? STATUS_ELABORAZIONE,
        operatoreId,
        dataVariazione: now,
        note: `[Comunicazione] ${subject}: ${message}`,
        notificaId: notificaId || null,
      },
    });

    // Send email to citizen if they have an address
    let emailSent = false;
    if (istanza.utente.email) {
      const emailResult = await sendEmail({
        to: istanza.utente.email,
        subject,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
        text: message,
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
    console.error('Error sending communication:', error);
    return { success: false, message: 'Errore durante l\'invio della comunicazione' };
  }
}

export async function addAvviso(istanzaId: number, testo: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    if (!testo.trim()) {
      return { success: false, message: "Inserire il testo dell'avviso" };
    }

    await prisma.avvisoIstanza.create({
      data: {
        istanzaId,
        avviso: testo.trim(),
        dataAvviso: new Date(),
        visibile: true,
      },
    });

    revalidatePath(`/istanze/${istanzaId}`);
    return { success: true, message: 'Avviso inserito' };
  } catch (error) {
    console.error('Error adding avviso:', error);
    return { success: false, message: "Errore durante l'inserimento dell'avviso" };
  }
}

export async function deleteAvviso(avvisoId: number, istanzaId: number) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Non autorizzato' };
    }

    await prisma.avvisoIstanza.update({
      where: { id: avvisoId },
      data: { visibile: false },
    });

    revalidatePath(`/istanze/${istanzaId}`);
    return { success: true, message: 'Avviso eliminato' };
  } catch (error) {
    console.error('Error deleting avviso:', error);
    return { success: false, message: "Errore durante l'eliminazione" };
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
              orderBy: { dataVariazione: 'desc' },
              take: 1,
              include: { status: true, step: true },
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
      status: i.workflows[0]?.status?.stato ?? '-',
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
        workflows: {
          orderBy: { dataVariazione: 'desc' },
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

    if (istanza.respinta) {
      return { success: false, message: 'Impossibile concludere un\'istanza respinta' };
    }

    const now = new Date();
    const lastWorkflow = istanza.workflows[0];

    // Update last workflow to success
    if (lastWorkflow) {
      await prisma.workflow.update({
        where: { id: lastWorkflow.id },
        data: {
          statusId: STATUS_SUCCESSO,
          note: note || lastWorkflow.note,
          dataVariazione: now,
          operatoreId,
        },
      });
    }

    // Mark istanza as concluded
    await prisma.istanza.update({
      where: { id: istanzaId },
      data: { conclusa: true },
    });

    revalidatePath(`/istanze/${istanzaId}`);
    revalidatePath('/istanze');

    return { success: true, message: 'Istanza conclusa con successo' };
  } catch (error) {
    console.error('Error concluding istanza:', error);
    return { success: false, message: 'Errore durante la conclusione' };
  }
}
