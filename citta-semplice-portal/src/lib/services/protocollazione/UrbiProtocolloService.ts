/**
 * UrbiProtocolloService
 *
 * Client per il servizio di protocollazione Urbi SMART (cloud.urbi.it).
 * Implementa il flusso: lookup/creazione corrispondente → registrazione protocollo.
 *
 * Variabili d'ambiente richieste:
 *   URBI_BASE_URL, URBI_USERNAME, URBI_PASSWORD,
 *   URBI_ID_AOO, URBI_TIPO_MEZZO, URBI_CLASSIFICAZIONE,
 *   URBI_REGISTRATORE, URBI_TIMEOUT_MS
 */

import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function getConfig() {
  return {
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
  /** Può essere null quando il protocollo viene ottenuto prima della creazione dell'istanza */
  istanzaId: number | null;
  servizioTitolo: string;
  tipoProtocollo: string;       // 'E' = Entrata, 'U' = Uscita
  unitaOrganizzativa: string;
  utente: {
    codiceFiscale: string;
    nome: string;
    cognome: string;
  };
  files: File[];
}

export interface ProtocolloResult {
  numero: string;
  data: Date;
  fallback: boolean;
  /** ID del record ProtocolloEmergenza creato, presente solo quando fallback=true */
  emergenzaId?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAuthHeader(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

/**
 * Esegue una richiesta HTTP verso Urbi con timeout e headers di autenticazione.
 */
async function urbiRequest(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Estrae un campo dal body della risposta (XML o testo semplice Urbi).
 * Urbi risponde con XML del tipo:
 *   <NumeroProtocollo>2025/123456</NumeroProtocollo>
 *   <DataProtocollo>27/03/2025</DataProtocollo>
 *
 * Se il parsing fallisce, restituisce null.
 */
function estraiCampoXml(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const m = xml.match(regex);
  return m ? m[1].trim() : null;
}

/**
 * Analizza la data nel formato dd/MM/yyyy restituito da Urbi.
 */
function parseDataUrbi(dateStr: string): Date | null {
  // formato atteso: dd/MM/yyyy
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const d = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const y = Number(parts[2]);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      return new Date(y, m, d);
    }
  }
  // fallback ISO
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
  istanzaId: number | null,
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
  const record = await prisma.protocolloEmergenza.create({
    data: { anno, progressivo, tipo, istanzaId },
  });

  console.warn(`[Protocollo] Emergenza ${tipo} istanza ${istanzaId ?? '(non ancora creata)'}: ${numero}`);
  return { numero, data: new Date(), fallback: true, emergenzaId: record.id };
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

  let searchRes: Response;
  try {
    searchRes = await urbiRequest(searchUrl, {
      method: 'GET',
      headers: { Authorization: auth },
    }, config.timeoutMs);
  } catch {
    console.error('[Protocollo] getElencoCorrispondenti: errore di rete');
    return null;
  }

  if (searchRes.ok) {
    const body = await searchRes.text();
    const codice = estraiCampoXml(body, 'CodiceSoggetto');
    if (codice) return codice;
  }

  // Non trovato → crea
  const createUrl =
    `${config.baseUrl}?WTDK_REQ=insCorrispondente` +
    `&PRCORE03_99991007_TipoPersona=F` +
    `&PRCORE03_99991007_Nome=${encodeURIComponent(utente.nome)}` +
    `&PRCORE03_99991007_Cognome=${encodeURIComponent(utente.cognome)}` +
    `&PRCORE03_99991007_CodiceFiscale=${encodeURIComponent(utente.codiceFiscale)}`;

  try {
    const createRes = await urbiRequest(createUrl, {
      method: 'GET',
      headers: { Authorization: auth },
    }, config.timeoutMs);

    if (createRes.ok) {
      const body = await createRes.text();
      const codice = estraiCampoXml(body, 'CodiceSoggetto');
      if (codice) return codice;
    }
  } catch {
    console.error('[Protocollo] insCorrispondente: errore di rete');
  }

  return null;
}

// ---------------------------------------------------------------------------
// Protocollazione principale
// ---------------------------------------------------------------------------
export async function protocolla(input: ProtocolloInput): Promise<ProtocolloResult> {
  const config = getConfig();

  if (!config.baseUrl || !config.username || !config.password) {
    console.warn('[Protocollo] Configurazione mancante, uso numerazione interna');
    return fallback(config, input.istanzaId);
  }

  const auth = buildAuthHeader(config.username, config.password);

  // 1. Risolvi corrispondente
  const codiceSoggetto = await getOrCreateCorrispondente(config, input.utente);

  // Sezione: E=Entrata → A, U=Uscita → P
  const sezione = input.tipoProtocollo === 'U' ? 'P' : 'A';

  // 2. Costruisci il form multipart
  const form = new FormData();
  form.append('WTDK_REQ', 'insProtocollo');
  form.append('PRCORE03_99991009_IDAOO', config.idAoo);
  form.append('PRCORE03_99991009_Sezione', sezione);
  form.append('PRCORE03_99991009_Oggetto', input.servizioTitolo);
  form.append('PRCORE03_99991009_Utente_Registratore', config.registratore);
  form.append('PRCORE03_99991009_Num_Uffici_Destinatari', '1');
  form.append('PRCORE03_99991009_1_Ufficio_Destinatario', input.unitaOrganizzativa);
  form.append('PRCORE03_99991009_1_Ufficio_Destinatario_Utenti_CO_Automatici', 'S');
  form.append('PRCORE03_99991009_Num_Corrispondenti', '1');
  form.append(
    'PRCORE03_99991009_1_Corrispondente_CodiceSoggetto',
    codiceSoggetto ?? '1',
  );
  form.append('PRCORE03_99991009_TipoMezzo', config.tipoMezzo);

  if (sezione === 'P') {
    form.append('PRCORE03_99991009_Num_Uffici_Mittenti', '1');
    form.append('PRCORE03_99991009_1_Ufficio_Mittente', input.unitaOrganizzativa);
  }

  // Allegati
  const filesValidi = input.files.filter((f) => f.size > 0);
  form.append('PRCORE03_99991009_Num_Allegati', String(filesValidi.length));
  for (let i = 0; i < filesValidi.length; i++) {
    form.append(`PRCORE03_99991009_${i}_Allegato_PathFile`, filesValidi[i]);
    form.append(`PRCORE03_99991009_${i}_Allegato_Classificazione_1`, config.classificazione);
  }

  // 3. Chiama il servizio
  let res: Response;
  try {
    res = await urbiRequest(config.baseUrl, {
      method: 'POST',
      headers: { Authorization: auth },
      body: form,
    }, config.timeoutMs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Protocollo] Errore chiamata insProtocollo: ${msg}`);
    return fallback(config, input.istanzaId);
  }

  const bodyText = await res.text();

  if (!res.ok) {
    console.error(`[Protocollo] HTTP ${res.status} - ${bodyText.slice(0, 200)}`);
    return fallback(config, input.istanzaId);
  }

  // 4. Estrai numero e data dalla risposta XML
  const numero = estraiCampoXml(bodyText, 'NumeroProtocollo')
    ?? estraiCampoXml(bodyText, 'Numero');
  const dataStr = estraiCampoXml(bodyText, 'DataProtocollo')
    ?? estraiCampoXml(bodyText, 'Data');

  if (!numero) {
    console.error(`[Protocollo] Numero non trovato nella risposta: ${bodyText.slice(0, 300)}`);
    return fallback(config, input.istanzaId);
  }

  const data = dataStr ? parseDataUrbi(dataStr) ?? new Date() : new Date();

  console.info(`[Protocollo] Protocollata istanza ${input.istanzaId}: ${numero}`);
  return { numero, data, fallback: false };
}

async function fallback(config: ReturnType<typeof getConfig>, istanzaId: number | null): Promise<ProtocolloResult> {
  return generaProtocolloEmergenza(istanzaId, 'INGRESSO', config.fallbackPrefix);
}
