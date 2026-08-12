import type { StatoIstanzaValore } from '@citta/db';
// Sottopercorso: questo modulo è importato anche da componenti client, e
// l'indice di `@citta/db` istanzia PrismaClient. `import type` non basta —
// `statoAttivita` è un import di runtime.
import { statoAttivita, type AttivitaPerStato } from '@citta/db/stato-attivita';

/**
 * Stato visualizzato di un'istanza — unica fonte di verità per il badge.
 * Prima ogni vista lo calcolava per conto suo: la dashboard guardava solo
 * conclusa/respinta e mostrava "In Lavorazione" anche per istanze non ancora
 * prese in carico, mentre lista e dettaglio le marcavano "In Attesa".
 *
 * Ordine di valutazione: stato terminale → attività corrente.
 */
export type StatoIstanzaVariant = 'success' | 'danger' | 'secondary' | 'primary';

export interface StatoIstanza {
  label: string;
  variant: StatoIstanzaVariant;
}

export interface StatoIstanzaInput {
  stato: StatoIstanzaValore;
  /** attività corrente dell'istanza, se ne ha una */
  attivitaCorrente?: AttivitaPerStato | null;
  attivitaCorrenteId: number | null;
  assegnatarioId: number | null;
}

export function getStatoIstanza(istanza: StatoIstanzaInput): StatoIstanza {
  if (istanza.stato === 'CONCLUSA') return { label: 'Conclusa', variant: 'success' };
  if (istanza.stato === 'RESPINTA') return { label: 'Respinta', variant: 'danger' };
  if (istanza.stato === 'BOZZA') return { label: 'Bozza', variant: 'secondary' };

  if (!istanza.attivitaCorrente) return { label: 'In Attesa', variant: 'secondary' };

  switch (statoAttivita(istanza.attivitaCorrente, istanza)) {
    case 'COMPLETATA': return { label: 'Completata', variant: 'success' };
    case 'IN_LAVORAZIONE': return { label: 'In Lavorazione', variant: 'primary' };
    default: return { label: 'In Attesa', variant: 'secondary' };
  }
}
