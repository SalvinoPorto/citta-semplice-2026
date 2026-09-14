/**
 * @citta/integrations — Protocollazione Urbi SMART (CONDIVISO office + portal)
 *
 * Client HTTP puro per il servizio di protocollazione Urbi SMART (cloud.urbi.it).
 * Flusso: lookup/creazione corrispondente → registrazione protocollo.
 *
 * La numerazione di emergenza (fallback) richiede accesso al DB: viene iniettata
 * tramite l'interfaccia `ProtocolloEmergenzaStore`, così il modulo resta privo di
 * dipendenze app-locali (no prisma, no @/). Ogni app fornisce la propria
 * implementazione dello store col proprio client Prisma.
 *
 * Variabili d'ambiente:
 *   URBI_BASE_URL, URBI_USERNAME, URBI_PASSWORD, URBI_ID_AOO, URBI_TIPO_MEZZO,
 *   URBI_CLASSIFICAZIONE, URBI_REGISTRATORE, URBI_TIMEOUT_MS, URBI_PRODUCT_NAME,
 *   PROTOCOL_FALLBACK_PREFIX
 */

import { CircuitBreaker } from './circuit-breaker';

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
  /** Può essere null quando il protocollo è ottenuto prima della creazione dell'istanza (bozza portale). */
  istanzaId: number | null;
  oggetto: string;
  tipoProtocollo: string; // 'E' = Entrata, 'U' = Uscita
  unitaOrganizzativa: string;
  utente: {
    codiceFiscale: string;
    nome: string;
    cognome: string;
  };
  files: File[];
  /** true per step di conclusione → fallback usa direzione USCITA. */
  isFinal?: boolean;
}

export interface ProtocolloResult {
  numero: string;
  data: Date;
  fallback: boolean;
  /** ID del record ProtocolloEmergenza creato, presente solo quando fallback=true. */
  emergenzaId?: number;
}

export interface UfficioUrbi {
  codice: string;
  descrizione: string;
}

export interface ElencoUfficiResult {
  uffici: UfficioUrbi[];
  /** false se l'API non è raggiungibile o non è configurata */
  disponibile: boolean;
  errore?: string;
}

/**
 * Astrazione DB per la numerazione di emergenza. Iniettata dall'app col suo Prisma.
 */
export interface ProtocolloEmergenzaStore {
  /** Incremento atomico del contatore annuale → nuovo progressivo. */
  nextProgressivo(anno: number): Promise<number>;
  /** Registra l'emissione di emergenza e restituisce l'id del record creato. */
  logEmergenza(rec: {
    anno: number;
    progressivo: number;
    tipo: 'INGRESSO' | 'USCITA';
    istanzaId: number | null;
  }): Promise<number>;
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
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
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
export async function generaProtocolloEmergenza(
  store: ProtocolloEmergenzaStore,
  istanzaId: number | null,
  tipo: 'INGRESSO' | 'USCITA',
  prefix?: string,
): Promise<ProtocolloResult> {
  const pfx = prefix ?? getConfig().fallbackPrefix;
  const anno = new Date().getFullYear();

  const progressivo = await store.nextProgressivo(anno);
  const numero = `${pfx}${anno}_${String(progressivo).padStart(4, '0')}`;
  const emergenzaId = await store.logEmergenza({ anno, progressivo, tipo, istanzaId });

  console.warn(`[Protocollo] Emergenza ${tipo} istanza ${istanzaId ?? '(non ancora creata)'}: ${numero}`);
  return { numero, data: new Date(), fallback: true, emergenzaId };
}

async function fallback(
  store: ProtocolloEmergenzaStore,
  config: ReturnType<typeof getConfig>,
  isFinal: boolean,
  istanzaId: number | null,
): Promise<ProtocolloResult> {
  const tipo = isFinal ? 'USCITA' : 'INGRESSO';
  return generaProtocolloEmergenza(store, istanzaId, tipo, config.fallbackPrefix);
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
/**
 * Elenco uffici con esito esplicito: permette a chi chiama di distinguere
 * «API non disponibile» da «API raggiungibile ma elenco vuoto». Senza questa
 * distinzione l'UI non può sapere se una unità organizzativa già configurata
 * è stata rimossa o solo non è caricabile in questo momento.
 */
export async function getElencoUfficiResult(): Promise<ElencoUfficiResult> {
  const config = getConfig();

  if (!config.baseUrl || !config.username || !config.password) {
    console.warn('[Protocollo] getElencoUffici: configurazione mancante');
    return { uffici: [], disponibile: false, errore: 'configurazione mancante' };
  }

  const auth = buildAuthHeader(config.username, config.password);
  const url = `${config.baseUrl}?WTDK_REQ=getElencoUffici`;

  let res: Response;
  try {
    res = await urbiRequest(url, { method: 'GET', headers: { Authorization: auth } }, config.timeoutMs);
  } catch (err) {
    const errore = err instanceof Error ? err.message : String(err);
    console.error(`[Protocollo] getElencoUffici: errore di rete — ${errore}`);
    return { uffici: [], disponibile: false, errore: `errore di rete: ${errore}` };
  }

  if (!res.ok) {
    console.error(`[Protocollo] getElencoUffici: HTTP ${res.status}`);
    return { uffici: [], disponibile: false, errore: `HTTP ${res.status}` };
  }

  const body = await res.text();
  return { uffici: parseElencoUffici(body), disponibile: true };
}

export async function getElencoUffici(): Promise<UfficioUrbi[]> {
  const { uffici } = await getElencoUfficiResult();
  return uffici;
}

function parseElencoUffici(xml: string): UfficioUrbi[] {
  const rowRegex = /<Ufficio>([\s\S]*?)<\/Ufficio>/gi;
  const uffici: UfficioUrbi[] = [];
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(xml)) !== null) {
    const row = match[1];
    const codice = estraiCampoXml(row, 'Codice') ?? '';
    const descrizione = estraiCampoXml(row, 'Descrizione') ?? codice;
    if (codice) uffici.push({ codice, descrizione });
  }

  return uffici;
}

// ---------------------------------------------------------------------------
// Protocollazione principale
// ---------------------------------------------------------------------------
/**
 * Tenta la protocollazione su Urbi e basta: ritorna `null` se non riesce, senza
 * coniare alcun numero di ripiego.
 *
 * Esiste separata da `protocolla()` perché i due comportamenti — «tenta» e
 * «ripiega» — servono a chiamanti diversi. Chi RITENTA (il drenatore della coda
 * in /api/cron/protocollazione) deve poter fallire senza conseguenze: se usasse
 * `protocolla()`, ogni tentativo andato male conierebbe un nuovo numero
 * d'emergenza e creerebbe una nuova riga in `protocollo_emergenza`, bruciando
 * un progressivo a ogni giro di cron e per ogni istanza non ancora rettificata.
 *
 * `protocolla()` resta il punto d'ingresso per chi un numero lo vuole comunque,
 * ed è ora scritta in termini di questa funzione: comportamento invariato.
 */
export async function tentaProtocollazioneUrbi(
  input: ProtocolloInput,
): Promise<{ numero: string; data: Date } | null> {
  const config = getConfig();

  if (!config.baseUrl || !config.username || !config.password) {
    console.warn('[Protocollo] Configurazione mancante');
    return null;
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
    return null;
  }

  const bodyText = await res.text();

  if (!res.ok) {
    console.error(`[Protocollo] HTTP ${res.status} — ${bodyText.slice(0, 200)}`);
    return null;
  }

  // 4. Estrai numero e data
  const numero = estraiCampoXml(bodyText, 'NumeroProtocollo') ?? estraiCampoXml(bodyText, 'Numero');
  const dataStr = estraiCampoXml(bodyText, 'DataProtocollo') ?? estraiCampoXml(bodyText, 'Data');

  if (!numero) {
    console.error(`[Protocollo] Numero non trovato nella risposta: ${bodyText.slice(0, 300)}`);
    return null;
  }

  const data = dataStr ? parseDataUrbi(dataStr) ?? new Date() : new Date();
  console.info(`[Protocollo] Istanza ${input.istanzaId} protocollata: ${numero}`);
  return { numero, data };
}

/**
 * Protocolla su Urbi, e se non riesce conia un numero interno di emergenza.
 * Comportamento invariato rispetto a prima dell'estrazione di
 * `tentaProtocollazioneUrbi`: non solleva mai eccezioni e un numero lo
 * restituisce sempre.
 */
export async function protocolla(
  input: ProtocolloInput,
  store: ProtocolloEmergenzaStore,
): Promise<ProtocolloResult> {
  const esito = await tentaProtocollazioneUrbi(input);
  if (esito) return { ...esito, fallback: false };
  return fallback(store, getConfig(), input.isFinal ?? false, input.istanzaId);
}

// ---------------------------------------------------------------------------
// Circuit breaker su Urbi
// ---------------------------------------------------------------------------
/**
 * Stato di salute di Urbi, condiviso da tutto il processo. Le soglie sono
 * configurabili perché dipendono dal comportamento del protocollo dell'ente,
 * che non è lo stesso ovunque.
 */
export const breakerUrbi = new CircuitBreaker({
  soglia: Number(process.env.URBI_BREAKER_SOGLIA ?? '5'),
  raffreddamentoMs: Number(process.env.URBI_BREAKER_RAFFREDDAMENTO_MS ?? '60000'),
});

/**
 * Come `tentaProtocollazioneUrbi`, ma consulta e aggiorna il breaker.
 *
 * Restituisce `null` sia quando Urbi fallisce sia quando il circuito è già
 * aperto: per chi chiama le due cose sono equivalenti — «non aspettare, vai per
 * la via asincrona» — e quella via è comunque completa, perché il numero interno
 * è già stato assegnato e il cron rettifica dopo.
 *
 * È una funzione a parte, e non una modifica di `tentaProtocollazioneUrbi`,
 * perché quella ha cinque punti d'uscita: strumentarli tutti avrebbe sparso la
 * logica del breaker dentro il client HTTP invece di tenerla in un solo posto.
 */
export async function tentaProtocollazioneUrbiConBreaker(
  input: ProtocolloInput,
): Promise<{ numero: string; data: Date } | null> {
  if (!breakerUrbi.consentito()) {
    console.warn('[Protocollo] circuito aperto: salto il tentativo verso Urbi');
    return null;
  }

  const esito = await tentaProtocollazioneUrbi(input);
  if (esito) {
    breakerUrbi.registraSuccesso();
  } else {
    breakerUrbi.registraFallimento();
  }
  return esito;
}
