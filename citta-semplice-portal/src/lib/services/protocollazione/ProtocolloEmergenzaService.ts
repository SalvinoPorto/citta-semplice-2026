/**
 * ProtocolloEmergenzaService (portal) — adapter sul modulo condiviso @citta/integrations.
 * Inietta lo store di emergenza col Prisma del portale.
 */
import { prisma } from "@/lib/db/prisma";
import * as urbi from "@citta/integrations/protocollazione";
import { ProtocolloResult } from "./Types";

/** Store di emergenza condiviso dagli adapter del portale (protocolla + generaProtocolloEmergenza). */
export const protocolloStore: urbi.ProtocolloEmergenzaStore = {
  async nextProgressivo(anno) {
    const rows = await prisma.$queryRaw<Array<{ progressivo: bigint }>>`
      INSERT INTO protocollo_emergenza_counters (anno, progressivo)
      VALUES (${anno}, 1)
      ON CONFLICT (anno) DO UPDATE
        SET progressivo = protocollo_emergenza_counters.progressivo + 1
      RETURNING progressivo
    `;
    return Number(rows[0].progressivo);
  },
  async logEmergenza(rec) {
    const record = await prisma.protocolloEmergenza.create({ data: rec });
    return record.id;
  },
};

export function generaProtocolloEmergenza(
  istanzaId: number | null,
  tipo: 'INGRESSO' | 'USCITA',
): Promise<ProtocolloResult> {
  return urbi.generaProtocolloEmergenza(protocolloStore, istanzaId, tipo);
}
