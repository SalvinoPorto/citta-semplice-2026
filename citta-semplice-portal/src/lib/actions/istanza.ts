'use server';

import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth/config';

export async function submitIstanza(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Non autenticato' };
  }

  const servizioId = Number(formData.get('servizioId'));
  const datiRaw = formData.get('dati');

  if (!servizioId || isNaN(servizioId)) {
    return { error: 'Servizio non valido' };
  }

  // Verifica che il servizio esista e sia attivo
  const servizio = await prisma.servizio.findFirst({
    where: { id: servizioId, attivo: true },
    include: { steps: { where: { attivo: true }, orderBy: { ordine: 'asc' } } },
  });

  if (!servizio) {
    return { error: 'Servizio non trovato o non disponibile' };
  }

  // Verifica disponibilità temporale
  const ora = new Date();
  if (
    (servizio.dataInizio && servizio.dataInizio > ora) ||
    (servizio.dataFine && servizio.dataFine < ora)
  ) {
    return { error: servizio.msgExtraServizio ?? 'Il servizio non è attualmente disponibile' };
  }

  // Trova l'utente
  const utente = await prisma.utente.findUnique({
    where: { id: Number(session.user.id) },
  });

  if (!utente) {
    return { error: 'Utente non trovato' };
  }

  // Verifica unicoInvioPerUtente
  if (servizio.unicoInvioPerUtente) {
    const esistente = await prisma.istanza.findFirst({
      where: { servizioId, utenteId: utente.id },
    });
    if (esistente) {
      return { error: 'Hai già inviato una richiesta per questo servizio' };
    }
  }

  // Verifica numero massimo istanze
  if (servizio.numeroMaxIstanze && servizio.numeroMaxIstanze > 0) {
    const count = await prisma.istanza.count({ where: { servizioId } });
    if (count >= servizio.numeroMaxIstanze) {
      return { error: servizio.msgSopraSoglia ?? 'Il numero massimo di istanze è stato raggiunto' };
    }
  }

  const primoStep = servizio.steps[0];

  const primoStatus = await prisma.status.findFirst({ orderBy: { ordine: 'asc' } });
  if (!primoStatus) {
    return { error: 'Configurazione stati non trovata' };
  }

  try {
    const istanza = await prisma.istanza.create({
      data: {
        dati: datiRaw ? String(datiRaw) : null,
        dataInvio: new Date(),
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

    return { success: true, istanzaId: istanza.id };
  } catch (error) {
    console.error('Errore creazione istanza:', error);
    return { error: 'Errore durante il salvataggio della richiesta. Riprova.' };
  }
}
