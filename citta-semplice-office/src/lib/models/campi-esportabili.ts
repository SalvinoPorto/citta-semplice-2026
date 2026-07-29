/**
 * Colonne dinamiche per l'export CSV delle istanze.
 *
 * Ogni servizio dichiara in `Servizio.campiDaEsportare` una lista di `name` dei
 * campi del modulo (separati da virgola). I dati compilati stanno in
 * `Istanza.dati` come `[{ name, label, value }, ...]`.
 *
 * Un export può contenere istanze di servizi diversi, con campi disomogenei:
 * si costruisce l'UNIONE dei campi dei servizi presenti nel risultato, una
 * colonna per `name`. Le istanze di un servizio che non prevede quel campo
 * lasciano la cella vuota.
 */

export interface ServizioCampi {
  id: number;
  titolo: string;
  campiDaEsportare: string | null;
  /** JSON form schema: `{ fields: [{ name, label, ... }] }` */
  attributi: string | null;
}

export interface ColonneDinamiche {
  /** `name` dei campi, nell'ordine delle colonne */
  campi: string[];
  /** intestazione CSV per ogni campo (stesso indice di `campi`) */
  headers: string[];
  /** campi esclusi per il limite di colonne: confluiscono in un'unica colonna */
  campiOverflow: string[];
}

/** Oltre questa soglia i campi restanti finiscono in una sola colonna `Altri dati`. */
export const MAX_COLONNE_DINAMICHE = 300;

interface CampoSchema {
  name?: string;
  label?: string;
}

function parseFields(attributi: string | null): CampoSchema[] {
  if (!attributi) return [];
  try {
    const parsed = JSON.parse(attributi);
    const fields = Array.isArray(parsed) ? parsed : parsed?.fields;
    return Array.isArray(fields) ? (fields as CampoSchema[]) : [];
  } catch {
    return [];
  }
}

export function parseCampiDaEsportare(campiDaEsportare: string | null): string[] {
  if (!campiDaEsportare) return [];
  return campiDaEsportare
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Unione ordinata dei campi esportabili dei servizi passati.
 * L'ordine segue quello dei servizi (per titolo) e, dentro ciascuno, quello
 * configurato in `campiDaEsportare`.
 *
 * Intestazione: la `label` del campo presa dal form schema del primo servizio
 * che la dichiara; se la stessa label è usata da campi diversi (o manca) si
 * ricade sul `name`, che è la chiave univoca della colonna.
 */
export function buildColonneDinamiche(
  servizi: ServizioCampi[],
  maxColonne: number = MAX_COLONNE_DINAMICHE
): ColonneDinamiche {
  const labelPerCampo = new Map<string, string>();
  const campi: string[] = [];

  const ordinati = [...servizi].sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));

  for (const servizio of ordinati) {
    const labels = new Map(
      parseFields(servizio.attributi)
        .filter((f): f is CampoSchema & { name: string } => Boolean(f.name))
        .map((f) => [f.name, (f.label ?? '').trim()])
    );

    for (const campo of parseCampiDaEsportare(servizio.campiDaEsportare)) {
      if (!labelPerCampo.has(campo)) {
        campi.push(campo);
        labelPerCampo.set(campo, labels.get(campo) || '');
      } else if (!labelPerCampo.get(campo)) {
        labelPerCampo.set(campo, labels.get(campo) || '');
      }
    }
  }

  const selezionati = campi.slice(0, maxColonne);
  const campiOverflow = campi.slice(maxColonne);

  // Una label ripetuta su campi diversi renderebbe ambigue le intestazioni:
  // in quel caso si usa il `name`.
  const conteggioLabel = new Map<string, number>();
  for (const campo of selezionati) {
    const label = labelPerCampo.get(campo) || '';
    if (label) conteggioLabel.set(label, (conteggioLabel.get(label) ?? 0) + 1);
  }

  const headers = selezionati.map((campo) => {
    const label = labelPerCampo.get(campo) || '';
    if (!label || (conteggioLabel.get(label) ?? 0) > 1) return campo;
    return label;
  });

  return { campi: selezionati, headers, campiOverflow };
}

function formatValore(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(formatValore).filter(Boolean).join(' | ');
  if (typeof value === 'boolean') return value ? 'Sì' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** `Istanza.dati` → mappa `name` → valore già formattato per il CSV. */
export function valoriIstanza(dati: string | null): Map<string, string> {
  const valori = new Map<string, string>();
  if (!dati) return valori;

  let parsed: unknown;
  try {
    parsed = JSON.parse(dati);
  } catch {
    return valori;
  }
  if (!Array.isArray(parsed)) return valori;

  for (const voce of parsed as { name?: unknown; value?: unknown }[]) {
    if (!voce || typeof voce.name !== 'string') continue;
    valori.set(voce.name, formatValore(voce.value));
  }
  return valori;
}

/** Colonna di coda con i campi esclusi dal limite, in formato `nome=valore`. */
export function valoriOverflow(valori: Map<string, string>, campiOverflow: string[]): string {
  return campiOverflow
    .map((campo) => [campo, valori.get(campo) ?? ''] as const)
    .filter(([, valore]) => valore !== '')
    .map(([campo, valore]) => `${campo}=${valore}`)
    .join('; ');
}
