// ---------------------------------------------------------------------------
// Numerazione di emergenza (transazionale, senza buchi nell'anno)
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db/prisma";
import { ProtocolloResult } from "./Types";
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function getConfig() {
  return {
    /* baseUrl: process.env.URBI_BASE_URL ?? '',
    username: process.env.URBI_USERNAME ?? '',
    password: process.env.URBI_PASSWORD ?? '',
    idAoo: process.env.URBI_ID_AOO ?? '1',
    tipoMezzo: process.env.URBI_TIPO_MEZZO ?? 'ISTANZA ONLINE',
    classificazione: process.env.URBI_CLASSIFICAZIONE ?? '15',
    registratore: process.env.URBI_REGISTRATORE ?? '',
    timeoutMs: Number(process.env.URBI_TIMEOUT_MS ?? '30000'), */
    fallbackPrefix: process.env.PROTOCOL_FALLBACK_PREFIX ?? 'PE_',
  };
}

/**
 * Genera un numero di protocollo di emergenza univoco nell'anno, usando un
 * contatore atomico PostgreSQL (INSERT ... ON CONFLICT ... DO UPDATE RETURNING).
 * Registra ogni emissione nella tabella protocollo_emergenza.
 */
export async function generaProtocolloEmergenza(
  istanzaId: number | null,
  tipo: 'INGRESSO' | 'USCITA'
): Promise<ProtocolloResult> {
  const config = getConfig();
  const pfx = config.fallbackPrefix;
  const anno = new Date().getFullYear();

  // Incremento atomico del contatore annuale
  const rows = await prisma.$queryRaw<Array<{ progressivo: bigint }>>`
    INSERT INTO protocollo_emergenza_counters (anno, progressivo)
    VALUES (${anno}, 1)
    ON CONFLICT (anno) DO UPDATE
      SET progressivo = protocollo_emergenza_counters.progressivo + 1
    RETURNING progressivo
  `;

  const progressivo = Number(rows[0].progressivo);
  const numero = `${pfx}${anno}_${String(progressivo).padStart(4, '0')}`;

  // Registra nella tabella di log
  const record = await prisma.protocolloEmergenza.create({
    data: { anno, progressivo, tipo, istanzaId },
  });

  console.warn(`[Protocollo] Emergenza ${tipo} istanza ${istanzaId ?? '(non ancora creata)'}: ${numero}`);
  return { numero, data: new Date(), fallback: true, emergenzaId: record.id };
}