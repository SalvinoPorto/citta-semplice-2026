/**
 * UrbiProtocolloService
 *
 * Client per il servizio di protocollazione Urbi SMART (cloud.urbi.it).
 * Flusso: lookup/creazione corrispondente → registrazione protocollo.
 *
 * Variabili d'ambiente richieste:
 *   URBI_BASE_URL, URBI_USERNAME, URBI_PASSWORD,
 *   URBI_ID_AOO, URBI_TIPO_MEZZO, URBI_CLASSIFICAZIONE,
 *   URBI_REGISTRATORE, URBI_TIMEOUT_MS
 */

import prisma from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function getConfig() {
  return {
    productName: process.env.URBI_PRODUCT_NAME ?? 'Protocollo Ente',
    baseUrl: process.env.URBI_BASE_URL ?? '',
    username: process.env.URBI_USERNAME ?? '',
    password: process.env.URBI_PASSWORD ?? '',
    idAoo: process.env.URBI_ID_AOO ?? '1',
    tipoMezzo: process.env.URBI_TIPO_MEZZO ?? 'ISTANZA ONLINE',
    classificazione: process.env.URBI_CLASSIFICAZIONE ?? '15',
    registratore: process.env.URBI_REGISTRATORE ?? '',
    timeoutMs: Number(process.env.URBI_TIMEOUT_MS ?? '30000'),
    fallbackPrefix: process.env.PROTOCOL_FALLBACK_PREFIX ?? 'PE_',
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ProtocolloInput {
  istanzaId: number;
  oggetto: string;
  tipoProtocollo: string; // 'E' = Entrata, 'U' = Uscita
  unitaOrganizzativa: string;
  utente: {
    codiceFiscale: string;
    nome: string;
    cognome: string;
  };
  files: File[];
  isFinal?: boolean; // true per step conclusione → usa protoFinaleNumero nel fallback
}

export interface ProtocolloResult {
  numero: string;
  data: Date;
  fallback: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildAuthHeader(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

async function urbiRequest(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function estraiCampoXml(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

function parseDataUrbi(dateStr: string): Date | null {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const d = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const y = Number(parts[2]);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
  }
  const iso = new Date(dateStr);
  return isNaN(iso.getTime()) ? null : iso;
}

// ---------------------------------------------------------------------------
// Numerazione di emergenza (transazionale, senza buchi nell'anno)
// ---------------------------------------------------------------------------

/**
 * Genera un numero di protocollo di emergenza univoco nell'anno, usando un
 * contatore atomico PostgreSQL (INSERT ... ON CONFLICT ... DO UPDATE RETURNING).
 * Registra ogni emissione nella tabella protocollo_emergenza.
 */
export async function generaProtocolloEmergenza(
  istanzaId: number,
  tipo: 'INGRESSO' | 'USCITA',
  prefix?: string,
): Promise<ProtocolloResult> {
  const config = getConfig();
  const pfx = prefix ?? config.fallbackPrefix;
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
  await prisma.protocolloEmergenza.create({
    data: { anno, progressivo, tipo, istanzaId },
  });

  console.warn(`[Protocollo] Emergenza ${tipo} istanza ${istanzaId}: ${numero}`);
  return { numero, data: new Date(), fallback: true };
}

async function fallback(
  config: ReturnType<typeof getConfig>,
  isFinal: boolean,
  istanzaId: number,
): Promise<ProtocolloResult> {
  const tipo = isFinal ? 'USCITA' : 'INGRESSO';
  return generaProtocolloEmergenza(istanzaId, tipo, config.fallbackPrefix);
}

// ---------------------------------------------------------------------------
// Corrispondente: lookup o creazione
// ---------------------------------------------------------------------------
async function getOrCreateCorrispondente(
  config: ReturnType<typeof getConfig>,
  utente: ProtocolloInput['utente'],
): Promise<string | null> {
  const auth = buildAuthHeader(config.username, config.password);

  const searchUrl =
    `${config.baseUrl}?WTDK_REQ=getElencoCorrispondenti` +
    `&PRCORE03_99991006_CodiceFiscale=${encodeURIComponent(utente.codiceFiscale)}` +
    `&PRCORE03_99991006_EseguiUguale=S`;

  try {
    const res = await urbiRequest(searchUrl, { method: 'GET', headers: { Authorization: auth } }, config.timeoutMs);
    if (res.ok) {
      const body = await res.text();
      const codice = estraiCampoXml(body, 'CodiceSoggetto');
      if (codice) return codice;
    }
  } catch {
    console.error('[Protocollo] getElencoCorrispondenti: errore di rete');
    return null;
  }

  // Non trovato → crea
  const createUrl =
    `${config.baseUrl}?WTDK_REQ=insCorrispondente` +
    `&PRCORE03_99991007_TipoPersona=F` +
    `&PRCORE03_99991007_Nome=${encodeURIComponent(utente.nome)}` +
    `&PRCORE03_99991007_Cognome=${encodeURIComponent(utente.cognome)}` +
    `&PRCORE03_99991007_CodiceFiscale=${encodeURIComponent(utente.codiceFiscale)}`;

  try {
    const res = await urbiRequest(createUrl, { method: 'GET', headers: { Authorization: auth } }, config.timeoutMs);
    if (res.ok) {
      const body = await res.text();
      const codice = estraiCampoXml(body, 'CodiceSoggetto');
      if (codice) return codice;
    }
  } catch {
    console.error('[Protocollo] insCorrispondente: errore di rete');
  }

  return null;
}

// ---------------------------------------------------------------------------
// Product name (usato nell'UI per identificare il servizio di protocollo)
// ---------------------------------------------------------------------------
export function getUrbiProductName(): string {
  return process.env.URBI_PRODUCT_NAME ?? 'Urbi SMART';
}

// ---------------------------------------------------------------------------
// Elenco Uffici
// ---------------------------------------------------------------------------
export interface UfficioUrbi {
  codice: string;
  descrizione: string;
}

/**
 * Recupera l'elenco degli uffici/unità organizzative dal servizio Urbi SMART.
 * Urbi risponde con una lista XML di Ufficio contenenti Codice e Descrizione.
 * Se il servizio non è configurato o risponde con errore restituisce un array vuoto.
 */
export async function getElencoUffici(): Promise<UfficioUrbi[]> {
  const config = getConfig();

  if (!config.baseUrl || !config.username || !config.password) {
    console.warn('[Protocollo] getElencoUffici: configurazione mancante');
    return [];
  }

  const auth = buildAuthHeader(config.username, config.password);
  const url = `${config.baseUrl}?WTDK_REQ=getElencoUffici`;

  let res: Response;
  try {
    res = await urbiRequest(url, { method: 'GET', headers: { Authorization: auth } }, config.timeoutMs);
  } catch (err) {
    console.error(`[Protocollo] getElencoUffici: errore di rete — ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  if (!res.ok) {
    console.error(`[Protocollo] getElencoUffici: HTTP ${res.status}`);
    return [];
  }

  const body = await res.text();
  return parseElencoUffici(body);
}

/**
 * Parsa l'XML della risposta getElencoUffici.
 * Struttura attesa (ripetuta per ogni ufficio):
 *   <Ufficio><Codice>...</Codice><Descrizione>...</Descrizione></Ufficio>
 */
function parseElencoUffici(xml: string): UfficioUrbi[] {
  const rowRegex = /<Ufficio>([\s\S]*?)<\/Ufficio>/gi;
  const uffici: UfficioUrbi[] = [];
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(xml)) !== null) {
    const row = match[1];
    const codice = estraiCampoXml(row, 'Codice') ?? '';
    const descrizione = estraiCampoXml(row, 'Descrizione') ?? codice;

    if (codice) {
      uffici.push({ codice, descrizione });
    }
  }

  return uffici;
}

// ---------------------------------------------------------------------------
// Protocollazione principale
// ---------------------------------------------------------------------------
export async function protocolla(input: ProtocolloInput): Promise<ProtocolloResult> {
  const config = getConfig();
  const isFinal = input.isFinal ?? false;

  if (!config.baseUrl || !config.username || !config.password) {
    console.warn('[Protocollo] Configurazione mancante, uso numerazione interna');
    return fallback(config, isFinal, input.istanzaId);
  }

  const auth = buildAuthHeader(config.username, config.password);

  // 1. Risolvi corrispondente
  const codiceSoggetto = await getOrCreateCorrispondente(config, input.utente);

  // Sezione: E=Entrata → A, U=Uscita → P
  const sezione = input.tipoProtocollo === 'U' ? 'P' : 'A';

  // 2. Costruisci form multipart
  const form = new FormData();
  form.append('WTDK_REQ', 'insProtocollo');
  form.append('PRCORE03_99991009_IDAOO', config.idAoo);
  form.append('PRCORE03_99991009_Sezione', sezione);
  form.append('PRCORE03_99991009_Oggetto', input.oggetto);
  form.append('PRCORE03_99991009_Utente_Registratore', config.registratore);
  form.append('PRCORE03_99991009_Num_Uffici_Destinatari', '1');
  form.append('PRCORE03_99991009_1_Ufficio_Destinatario', input.unitaOrganizzativa);
  form.append('PRCORE03_99991009_1_Ufficio_Destinatario_Utenti_CO_Automatici', 'S');
  form.append('PRCORE03_99991009_Num_Corrispondenti', '1');
  form.append('PRCORE03_99991009_1_Corrispondente_CodiceSoggetto', codiceSoggetto ?? '1');
  form.append('PRCORE03_99991009_TipoMezzo', config.tipoMezzo);

  if (sezione === 'P') {
    form.append('PRCORE03_99991009_Num_Uffici_Mittenti', '1');
    form.append('PRCORE03_99991009_1_Ufficio_Mittente', input.unitaOrganizzativa);
  }

  const filesValidi = input.files.filter((f) => f.size > 0);
  form.append('PRCORE03_99991009_Num_Allegati', String(filesValidi.length));
  for (let i = 0; i < filesValidi.length; i++) {
    form.append(`PRCORE03_99991009_${i}_Allegato_PathFile`, filesValidi[i]);
    form.append(`PRCORE03_99991009_${i}_Allegato_Classificazione_1`, config.classificazione);
  }

  // 3. Chiama il servizio
  let res: Response;
  try {
    res = await urbiRequest(config.baseUrl, { method: 'POST', headers: { Authorization: auth }, body: form }, config.timeoutMs);
  } catch (err) {
    console.error(`[Protocollo] Errore chiamata insProtocollo: ${err instanceof Error ? err.message : String(err)}`);
    return fallback(config, isFinal, input.istanzaId);
  }

  const bodyText = await res.text();

  if (!res.ok) {
    console.error(`[Protocollo] HTTP ${res.status} — ${bodyText.slice(0, 200)}`);
    return fallback(config, isFinal, input.istanzaId);
  }

  // 4. Estrai numero e data
  const numero = estraiCampoXml(bodyText, 'NumeroProtocollo') ?? estraiCampoXml(bodyText, 'Numero');
  const dataStr = estraiCampoXml(bodyText, 'DataProtocollo') ?? estraiCampoXml(bodyText, 'Data');

  if (!numero) {
    console.error(`[Protocollo] Numero non trovato nella risposta: ${bodyText.slice(0, 300)}`);
    return fallback(config, isFinal, input.istanzaId);
  }

  const data = dataStr ? parseDataUrbi(dataStr) ?? new Date() : new Date();
  console.info(`[Protocollo] Istanza ${input.istanzaId} protocollata: ${numero}`);
  return { numero, data, fallback: false };
}
