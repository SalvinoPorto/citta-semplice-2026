import { sendEmail } from '@/lib/services/email';

export async function sendFaseTransitionEmail(params: {
  istanza: {
    id: number;
    protoNumero: string;
    utente: { nome: string; cognome: string };
    servizio: { titolo: string };
  };
  nuovaFase: {
    nome: string;
    ufficio?: { email?: string | null; nome: string } | null;
  };
  direzione: 'AVANZAMENTO' | 'ROLLBACK';
}): Promise<void> {
  const { istanza, nuovaFase, direzione } = params;
  const ufficioEmail = nuovaFase.ufficio?.email;
  if (!ufficioEmail) return;

  const isRollback = direzione === 'ROLLBACK';
  const subject = isRollback
    ? `[RIMANDO] Istanza ${istanza.protoNumero} — ${istanza.servizio.titolo}`
    : `[NUOVA FASE] Istanza ${istanza.protoNumero} — ${istanza.servizio.titolo}`;

  const html = `
    <p>L'istanza <strong>${istanza.protoNumero}</strong> relativa al servizio
    <em>${istanza.servizio.titolo}</em> (${istanza.utente.cognome} ${istanza.utente.nome})
    è stata ${isRollback ? 'rimandata alla fase' : 'trasferita alla fase'}
    <strong>${nuovaFase.nome}</strong> di competenza del vostro ufficio.</p>
    <p>Accedere al backoffice per prendere in carico la pratica.</p>
  `;

  await sendEmail({ to: ufficioEmail, subject, html });
}
