import { Prisma, whereStato, whereVisibileAgliOperatori } from '@citta/db';

/**
 * I `where` dei tab della lista istanze, in un solo posto.
 *
 * Prima erano `$queryRaw` con una subquery correlata che materializzava in
 * memoria Node TUTTI gli id corrispondenti, per rimandarli al database come
 * `WHERE id IN (...)`; e la stessa subquery era ripetuta sei volte fra lista e
 * contatori. Da quando l'assegnazione è una colonna indicizzata su `istanze`,
 * sono tre condizioni ordinarie — ed essendo condivise, lista e contatori non
 * possono più divergere.
 */
export function whereTab(tab: string, operatoreId: number): Prisma.IstanzaWhereInput {
  switch (tab) {
    case 'nuove':
      return { ...whereStato('IN_LAVORAZIONE'), assegnatarioId: null };
    case 'mie':
      return { ...whereStato('IN_LAVORAZIONE'), assegnatarioId: operatoreId };
    case 'altri':
      // La condizione voluta è "assegnata E non a me". `NOT` da solo basta —
      // Prisma 7.7 traduce il negato su colonna nullable in modo che i NULL
      // restino fuori, verificato togliendo la prima clausola e osservando i
      // tab restare una partizione — ma la si scrive comunque: è la metà
      // "assegnata" della condizione, e non deve dipendere da come Prisma
      // decide di tradurre il negato.
      return {
        ...whereStato('IN_LAVORAZIONE'),
        assegnatarioId: { not: null },
        NOT: { assegnatarioId: operatoreId },
      };
    case 'respinte':
      return whereStato('RESPINTA');
    case 'concluse':
      return whereStato('CONCLUSA');
    default:
      return whereVisibileAgliOperatori();
  }
}

export const TAB_CONTEGGIATI = ['nuove', 'mie', 'altri', 'respinte', 'concluse'] as const;
