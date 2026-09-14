/**
 * ProtocolloEmergenzaService (portal) — adapter sul modulo condiviso @citta/integrations.
 * Inietta lo store di emergenza col Prisma del portale.
 */
import { prisma } from "@/lib/db/prisma";
import * as urbi from "@citta/integrations/protocollazione";
import { ProtocolloResult } from "./Types";

/**
 * Client minimo che serve allo store: lo soddisfa il `prisma` globale, ma anche
 * il client di una transazione interattiva. È questo che permette di coniare il
 * numero DENTRO la transazione che prenota il posto in quota, invece che su una
 * connessione separata — se la prenotazione fallisce il progressivo non viene
 * consumato, e non resta un buco nella numerazione.
 */
type ClientPrisma = Pick<typeof prisma, '$queryRaw' | 'protocolloEmergenza'>;

/** Costruisce lo store legandolo a un client: il globale, oppure una transazione. */
export function creaProtocolloStore(client: ClientPrisma): urbi.ProtocolloEmergenzaStore {
  return {
    async nextProgressivo(anno) {
      const rows = await client.$queryRaw<Array<{ progressivo: bigint }>>`
        INSERT INTO protocollo_emergenza_counters (anno, progressivo)
        VALUES (${anno}, 1)
        ON CONFLICT (anno) DO UPDATE
          SET progressivo = protocollo_emergenza_counters.progressivo + 1
        RETURNING progressivo
      `;
      return Number(rows[0].progressivo);
    },
    async logEmergenza(rec) {
      const record = await client.protocolloEmergenza.create({ data: rec });
      return record.id;
    },
  };
}

/** Store di emergenza condiviso dagli adapter del portale (protocolla + generaProtocolloEmergenza). */
export const protocolloStore: urbi.ProtocolloEmergenzaStore = creaProtocolloStore(prisma);

export function generaProtocolloEmergenza(
  istanzaId: number | null,
  tipo: 'INGRESSO' | 'USCITA',
): Promise<ProtocolloResult> {
  return urbi.generaProtocolloEmergenza(protocolloStore, istanzaId, tipo);
}

/**
 * Come sopra, ma su un client di transazione: il progressivo e la riga di
 * emergenza nascono DENTRO la stessa transazione che prenota il posto in quota.
 * Se quella fallisce non resta un numero consumato a vuoto, cioè un buco nella
 * numerazione di protocollo — che in un ente non è un dettaglio contabile.
 */
export function generaProtocolloEmergenzaCon(
  client: ClientPrisma,
  istanzaId: number | null,
  tipo: 'INGRESSO' | 'USCITA',
): Promise<ProtocolloResult> {
  return urbi.generaProtocolloEmergenza(creaProtocolloStore(client), istanzaId, tipo);
}
