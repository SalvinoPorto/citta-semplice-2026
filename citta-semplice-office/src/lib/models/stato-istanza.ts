/**
 * Stato visualizzato di un'istanza — unica fonte di verità per il badge.
 * Prima ogni vista lo calcolava per conto suo: la dashboard guardava solo
 * conclusa/respinta e mostrava "In Lavorazione" anche per istanze non ancora
 * prese in carico, mentre lista e dettaglio le marcavano "In Attesa".
 *
 * Ordine di valutazione: conclusa → respinta → ultimo workflow.
 */
export type StatoIstanzaVariant = 'success' | 'danger' | 'secondary' | 'primary';

export interface StatoIstanza {
  label: string;
  variant: StatoIstanzaVariant;
}

export interface StatoIstanzaInput {
  conclusa: boolean;
  respinta: boolean;
  /** ultimo workflow (per dataVariazione desc), se presente */
  ultimoWorkflow?: { operatoreId: number | null; stato: number } | null;
}

export function getStatoIstanza(istanza: StatoIstanzaInput): StatoIstanza {
  if (istanza.conclusa) return { label: 'Conclusa', variant: 'success' };
  if (istanza.respinta) return { label: 'Respinta', variant: 'danger' };

  const wf = istanza.ultimoWorkflow;
  // Nessun workflow o ultimo step non assegnato → in attesa di presa in carico
  if (!wf || wf.operatoreId === null) return { label: 'In Attesa', variant: 'secondary' };
  if (wf.stato === 1) return { label: 'Completata', variant: 'success' };
  return { label: 'In Lavorazione', variant: 'primary' };
}
