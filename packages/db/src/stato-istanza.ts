/**
 * Unica fonte di verità per leggere e scrivere lo stato di un'istanza.
 *
 * I tre booleani `in_bozza`/`conclusa`/`respinta` e il vincolo CHECK che li
 * teneva mutuamente esclusivi non esistono più: lo stato è l'enum, e gli
 * stati impossibili non sono rappresentabili invece che vietati a posteriori.
 */

export type StatoIstanzaValore = 'BOZZA' | 'IN_LAVORAZIONE' | 'CONCLUSA' | 'RESPINTA';

function normalizza(stati: StatoIstanzaValore | StatoIstanzaValore[]): StatoIstanzaValore[] {
  return Array.isArray(stati) ? stati : [stati];
}

export function whereStato(stati: StatoIstanzaValore | StatoIstanzaValore[]) {
  return { stato: { in: normalizza(stati) } };
}

/**
 * Tutto tranne le bozze. Le bozze sono del cittadino e non devono comparire
 * in nessun elenco, conteggio, ricerca o export dell'office.
 */
export function whereVisibileAgliOperatori() {
  return { stato: { not: 'BOZZA' as const } };
}

export function datiStato(stato: StatoIstanzaValore) {
  return { stato };
}

/**
 * Equivalente di `whereStato` per le query raw. Gli stati sono un enum
 * chiuso definito qui sopra, non input utente: l'interpolazione è sicura.
 */
export function sqlStato(stati: StatoIstanzaValore | StatoIstanzaValore[], alias: string): string {
  const lista = normalizza(stati).map((s) => `'${s}'`).join(',');
  return `${alias}.stato IN (${lista})`;
}
