import { Prisma } from '../../../generated/prisma/client';
import prisma from '@/lib/db/prisma';
import { ROLES } from './roles';

/**
 * Visibilità di un operatore sulle istanze.
 *
 * Due livelli, in AND fra loro:
 *  1. UFFICIO  — l'operatore vede le istanze la cui FASE CORRENTE appartiene al suo
 *                ufficio (`faseCorrente.ufficioId`). Le istanze senza fase corrente
 *                (chiuse, o migrate dal legacy) ricadono sugli uffici che lavorano
 *                il servizio. `ufficioId = null` → nessun filtro d'ufficio.
 *  2. SERVIZI  — sottoinsieme di servizi esplicitamente assegnati all'operatore
 *                (`operatori_servizi`). Lista VUOTA → nessun filtro: l'operatore vede
 *                tutti i servizi del suo ufficio (comportamento pre-esistente).
 *
 * Esempio: Alice e Bob stanno entrambi in ANAGRAFE; ad Alice è assegnato
 * "Certificato di nascita", a Bob "Cambio di domicilio": ognuno vede solo le proprie.
 *
 * Tutti gli ELENCHI e i CONTEGGI (lista istanze, dashboard, statistiche, ricerche,
 * export) usano lo stesso filtro `istanzaVisibilityWhere`: quello che compare in
 * dashboard si ritrova in /istanze. L'apertura per link diretto è invece più
 * permissiva (`puoVedereIstanza`): chi condivide il servizio può consultare
 * l'istanza in sola lettura anche quando la fase corrente è di un altro ufficio.
 */
export interface VisibilitaOperatore {
  operatoreId: number;
  isAdmin: boolean;
  ufficioId: number | null;
  /** null = nessuna restrizione per servizio; array = solo questi servizi */
  servizioIds: number[] | null;
}

export const VISIBILITA_ADMIN: VisibilitaOperatore = {
  operatoreId: 0,
  isAdmin: true,
  ufficioId: null,
  servizioIds: null,
};

/** Carica ufficio + servizi assegnati dell'operatore. */
export async function getVisibilitaOperatore(
  operatoreId: number,
  ruoli: string[] | undefined
): Promise<VisibilitaOperatore> {
  const isAdmin = (ruoli ?? []).includes(ROLES.ADMIN);
  if (isAdmin) return { ...VISIBILITA_ADMIN, operatoreId };

  const operatore = await prisma.operatore.findUnique({
    where: { id: operatoreId },
    select: {
      ufficioId: true,
      servizi: { select: { servizioId: true } },
    },
  });

  const servizioIds = operatore?.servizi.map((s) => s.servizioId) ?? [];

  return {
    operatoreId,
    isAdmin: false,
    ufficioId: operatore?.ufficioId ?? null,
    servizioIds: servizioIds.length > 0 ? servizioIds : null,
  };
}

/** True se non c'è nessun vincolo da applicare (admin o operatore senza restrizioni). */
export function isVisibilitaTotale(v: VisibilitaOperatore): boolean {
  return v.isAdmin || (v.ufficioId === null && v.servizioIds === null);
}

/**
 * Filtro Prisma sulle istanze: ufficio della fase corrente + servizi assegnati.
 * Restituisce un oggetto da mettere in AND con gli altri filtri
 * (usa sempre `AND: [...]` per non collidere con OR di ricerca).
 */
export function istanzaVisibilityWhere(v: VisibilitaOperatore): Prisma.IstanzaWhereInput {
  if (isVisibilitaTotale(v)) return {};

  const conditions: Prisma.IstanzaWhereInput[] = [];

  if (v.ufficioId !== null) {
    conditions.push({
      OR: [
        { faseCorrente: { ufficioId: v.ufficioId } },
        // Le istanze chiuse (concluse/respinte) non hanno fase corrente: senza
        // questo ramo sparirebbero dai tab "Respinte"/"Concluse". Si ricade sugli
        // uffici che lavorano il servizio.
        {
          faseCorrenteId: null,
          servizio: { fasi: { some: { ufficioId: v.ufficioId } } },
        },
      ],
    });
  }

  if (v.servizioIds !== null) {
    conditions.push({ servizioId: { in: v.servizioIds } });
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

/** Filtro Prisma sui servizi (liste, filtri a tendina, statistiche per servizio). */
export function servizioVisibilityWhere(v: VisibilitaOperatore): Prisma.ServizioWhereInput {
  if (isVisibilitaTotale(v)) return {};

  const conditions: Prisma.ServizioWhereInput[] = [];

  if (v.ufficioId !== null) {
    conditions.push({ fasi: { some: { ufficioId: v.ufficioId } } });
  }

  if (v.servizioIds !== null) {
    conditions.push({ id: { in: v.servizioIds } });
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

/** True se l'operatore è abilitato a quel servizio (ignora l'ufficio). */
export function servizioAssegnato(v: VisibilitaOperatore, servizioId: number): boolean {
  if (v.isAdmin || v.servizioIds === null) return true;
  return v.servizioIds.includes(servizioId);
}

/**
 * Condizione SQL equivalente a `istanzaVisibilityWhere`, per le query raw.
 * `alias` è l'alias della tabella `istanze` nella query (es. `i`).
 * Restituisce già preceduta da AND, oppure `Prisma.empty`.
 */
export function istanzaVisibilitySql(v: VisibilitaOperatore, alias: string): Prisma.Sql {
  if (isVisibilitaTotale(v)) return Prisma.empty;

  const parts: Prisma.Sql[] = [];

  if (v.ufficioId !== null) {
    parts.push(Prisma.sql`(
      EXISTS (
        SELECT 1 FROM fasi f WHERE f.id = ${Prisma.raw(alias)}.fase_corrente_id AND f.ufficio_id = ${v.ufficioId}
      )
      OR (${Prisma.raw(alias)}.fase_corrente_id IS NULL AND EXISTS (
        SELECT 1 FROM fasi f WHERE f.servizio_id = ${Prisma.raw(alias)}.servizio_id AND f.ufficio_id = ${v.ufficioId}
      ))
    )`);
  }

  if (v.servizioIds !== null) {
    parts.push(
      v.servizioIds.length === 0
        ? Prisma.sql`false`
        : Prisma.sql`${Prisma.raw(alias)}.servizio_id IN (${Prisma.join(v.servizioIds)})`
    );
  }

  return Prisma.sql` AND ${Prisma.join(parts, ' AND ')}`;
}

/**
 * Accesso in lettura a una singola istanza: l'ufficio dell'operatore deve
 * partecipare al servizio e il servizio deve essergli assegnato.
 */
export function puoVedereIstanza(
  v: VisibilitaOperatore,
  istanza: {
    servizioId: number;
    servizio: { ufficioId: number | null; fasi: { ufficioId: number }[] };
  }
): boolean {
  if (v.isAdmin) return true;
  if (!servizioAssegnato(v, istanza.servizioId)) return false;
  if (v.ufficioId === null) return true;

  const ufficiDelServizio: number[] = [];
  if (istanza.servizio.ufficioId) ufficiDelServizio.push(istanza.servizio.ufficioId);
  istanza.servizio.fasi.forEach((f) => ufficiDelServizio.push(f.ufficioId));

  return ufficiDelServizio.includes(v.ufficioId);
}

/**
 * Accesso in scrittura: oltre alla lettura, l'ufficio della fase corrente deve
 * coincidere con quello dell'operatore.
 */
export function puoOperareSuIstanza(
  v: VisibilitaOperatore,
  istanza: {
    servizioId: number;
    faseCorrente: { ufficioId: number } | null;
  }
): boolean {
  if (v.isAdmin) return true;
  if (!servizioAssegnato(v, istanza.servizioId)) return false;
  if (v.ufficioId === null) return true;

  const ufficioCorrente = istanza.faseCorrente?.ufficioId ?? null;
  return ufficioCorrente === null || ufficioCorrente === v.ufficioId;
}
