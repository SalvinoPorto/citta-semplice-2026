/**
 * UrbiProtocolloService (portal) — adapter sul modulo condiviso @citta/integrations.
 * Il client Urbi vive nel package; qui iniettiamo lo store di emergenza del portale.
 */
import * as urbi from "@citta/integrations/protocollazione";
import { protocolloStore } from "./ProtocolloEmergenzaService";

export type { ProtocolloInput, ProtocolloResult } from "@citta/integrations/protocollazione";

export function protocolla(input: urbi.ProtocolloInput): Promise<urbi.ProtocolloResult> {
  return urbi.protocolla(input, protocolloStore);
}
