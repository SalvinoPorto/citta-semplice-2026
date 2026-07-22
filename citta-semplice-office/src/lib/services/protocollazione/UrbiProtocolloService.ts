/**
 * UrbiProtocolloService (office) — adapter sul modulo condiviso @citta/integrations.
 * Il client Urbi vive nel package; qui iniettiamo lo store di emergenza col Prisma office.
 */
import prisma from '@/lib/db/prisma';
import * as urbi from '@citta/integrations/protocollazione';

export type {
  ProtocolloInput,
  ProtocolloResult,
  UfficioUrbi,
  ProtocolloEmergenzaStore,
} from '@citta/integrations/protocollazione';
export { getElencoUffici, getUrbiProductName } from '@citta/integrations/protocollazione';

const store: urbi.ProtocolloEmergenzaStore = {
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

export function protocolla(input: urbi.ProtocolloInput): Promise<urbi.ProtocolloResult> {
  return urbi.protocolla(input, store);
}

export function generaProtocolloEmergenza(
  istanzaId: number | null,
  tipo: 'INGRESSO' | 'USCITA',
  prefix?: string,
): Promise<urbi.ProtocolloResult> {
  return urbi.generaProtocolloEmergenza(store, istanzaId, tipo, prefix);
}
