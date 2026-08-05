/**
 * Unica fonte di verità per leggere e scrivere lo stato di un'istanza.
 *
 * Durante la transizione dai tre booleani all'enum, `datiStato` scrive
 * ENTRAMBE le rappresentazioni: finché `in_bozza`/`conclusa`/`respinta`
 * esistono nel database, devono restare coerenti con `stato`, altrimenti
 * il vincolo `istanze_stato_esclusivo_chk` salta o le due rappresentazioni
 * divergono. La migrazione di contrazione elimina i booleani e a quel punto
 * questa funzione si riduce al solo `stato`.
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
  return {
    stato,
    inBozza: stato === 'BOZZA',
    conclusa: stato === 'CONCLUSA',
    respinta: stato === 'RESPINTA',
  };
}

/**
 * Equivalente di `whereStato` per le query raw. Gli stati sono un enum
 * chiuso definito qui sopra, non input utente: l'interpolazione è sicura.
 */
export function sqlStato(stati: StatoIstanzaValore | StatoIstanzaValore[], alias: string): string {
  const lista = normalizza(stati).map((s) => `'${s}'`).join(',');
  return `${alias}.stato IN (${lista})`;
}
