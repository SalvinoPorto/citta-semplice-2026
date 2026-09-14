import type { Prisma } from '../generated/prisma/client';
import { whereStato, type StatoIstanzaValore } from './stato-istanza';

/**
 * Stati che occupano un posto nella quota `servizi.numero_max_istanze`.
 *
 * Una RESPINTA resta conteggiata: la quota è capienza di lavorazione, non un
 * diritto individuale, e un'istanza respinta un posto l'ha comunque occupato.
 * È lo stesso insieme di `STATI_CONTEGGIATI_NELLA_QUOTA` nel portale — vive qui
 * perché il conteggio che decide l'ammissione deve stare dove sta il lock.
 */
export const STATI_IN_QUOTA: readonly StatoIstanzaValore[] = [
  'IN_LAVORAZIONE',
  'CONCLUSA',
  'RESPINTA',
];

/**
 * Verifica che ci sia ancora posto nella quota del servizio, SERIALIZZANDO le
 * verifiche concorrenti sullo stesso servizio.
 *
 * Il problema che risolve: contare e poi inserire sono due operazioni distinte.
 * Con N invii simultanei tutti leggono lo stesso conteggio "99 su 100" prima
 * che uno qualsiasi abbia inserito, e passano tutti — un bando da 100 posti ne
 * accetta centinaia. Non è un caso limite teorico: è esattamente ciò che accade
 * in un click day, cioè quando la quota serve davvero.
 *
 * Il lock è sulla RIGA del servizio e dura quanto la transazione. Perché questo
 * sia accettabile la transazione deve restare breve: conteggio e inserimento,
 * MAI una chiamata esterna. La protocollazione verso Urbi (fino a 30 s) deve
 * stare fuori — un lock tenuto per tutta quella durata sarebbe peggio del bug
 * che stiamo chiudendo.
 *
 * Ritorna `true` se c'è posto: il chiamante DEVE inserire l'istanza nella
 * stessa transazione, altrimenti il posto non risulta occupato e la garanzia
 * decade.
 */
export async function cePostoInQuota(
  tx: Prisma.TransactionClient,
  servizioId: number,
  numeroMaxIstanze: number | null,
): Promise<boolean> {
  // Quota non configurata (null o 0) = nessun limite: niente lock, nessun costo
  // per la stragrande maggioranza dei servizi.
  if (!numeroMaxIstanze || numeroMaxIstanze <= 0) return true;

  // Unica istruzione grezza, e il suo solo scopo è il lock: le altre
  // transazioni che vogliono lo stesso servizio si mettono in fila qui.
  await tx.$queryRaw`SELECT id FROM servizi WHERE id = ${servizioId} FOR UPDATE`;

  // Il conteggio riusa `whereStato` invece di riscrivere l'elenco degli stati
  // in SQL: un secondo elenco da tenere allineato a mano è il modo tipico in
  // cui due regole finiscono per rispondere diversamente sullo stesso caso.
  const occupati = await tx.istanza.count({
    where: { servizioId, ...whereStato([...STATI_IN_QUOTA]) },
  });

  return occupati < numeroMaxIstanze;
}
