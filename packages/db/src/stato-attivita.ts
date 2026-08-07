/**
 * Unica fonte di verità per lo stato mostrato di una singola attività (uno
 * step attivato su un'istanza).
 *
 * Prima l'etichetta nasceva dalla COPPIA (operatore_id, stato) sulla riga di
 * attività, con un terzo valore `-1` mai memorizzato che il codice
 * applicativo sintetizzava in lettura. Da quando l'assegnazione dell'istanza
 * vive su `Istanza.assegnatarioId`, la riga di attività da sola non basta
 * più a distinguere "in attesa" da "in lavorazione": serve sapere se
 * l'istanza è presa in carico e quale sia la sua attività corrente.
 */

export type StatoAttivita = 'COMPLETATA' | 'IN_LAVORAZIONE' | 'IN_ATTESA' | 'RETROCESSA';

export interface AttivitaPerStato {
  id: number;
  /** NULL = attività aperta. Sostituisce il vecchio `stato` binario. */
  completataAt: Date | null;
}

export interface ContestoIstanza {
  attivitaCorrenteId: number | null;
  /** NULL = istanza non presa in carico da nessun operatore. */
  assegnatarioId: number | null;
}

export function statoAttivita(attivita: AttivitaPerStato, contesto: ContestoIstanza): StatoAttivita {
  if (attivita.completataAt !== null) return 'COMPLETATA';
  // Un'attività aperta che non è più la corrente è stata scavalcata da un
  // rollback di fase senza essere mai chiusa.
  if (attivita.id !== contesto.attivitaCorrenteId) return 'RETROCESSA';
  return contesto.assegnatarioId !== null ? 'IN_LAVORAZIONE' : 'IN_ATTESA';
}

export const ETICHETTE_STATO_ATTIVITA: Record<StatoAttivita, string> = {
  COMPLETATA: 'Completata',
  IN_LAVORAZIONE: 'In lavorazione',
  IN_ATTESA: 'In attesa',
  RETROCESSA: 'Retrocesso',
};
