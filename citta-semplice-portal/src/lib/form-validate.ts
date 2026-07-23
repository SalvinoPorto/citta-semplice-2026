import { isFieldVisible } from './form-condition';
import { FormField, LAYOUT_FIELD_TYPES, parseCampi } from './form-pages';

/**
 * Tipi esclusi dai dati salvati: layout (nessun valore), hidden e file
 * (gli allegati hanno un flusso proprio). Deve restare allineato a
 * `SKIP_FIELD_TYPES` di IstanzaStepper.
 */
const SKIP_FIELD_TYPES = new Set<string>([...LAYOUT_FIELD_TYPES, 'hidden', 'file']);

type DatoConLabel = { name: string; label: string; value: string };

export type RisultatoValidazione =
  | { ok: true; dati: string | null }
  | { ok: false; errore: string };

/** Accetta sia l'array [{name,label,value}] sia una mappa name→value. */
function parseValori(datiRaw: string | null | undefined): Record<string, string> {
  if (!datiRaw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(datiRaw);
  } catch {
    return {};
  }
  if (Array.isArray(parsed)) {
    return Object.fromEntries(
      (parsed as DatoConLabel[])
        .filter((d) => d && typeof d.name === 'string')
        .map((d) => [d.name, d.value !== undefined && d.value !== null ? String(d.value) : '']),
    );
  }
  if (parsed && typeof parsed === 'object') {
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
        k,
        v !== undefined && v !== null ? String(v) : '',
      ]),
    );
  }
  return {};
}

function validaCampo(campo: FormField, valore: string): string | null {
  const etichetta = campo.label || campo.name;
  const required = campo.validation?.required ?? false;

  if (campo.type === 'checkbox') {
    if (required && valore !== 'true') return `Il campo "${etichetta}" è obbligatorio.`;
    return null;
  }

  if (valore === '') {
    return required ? `Il campo "${etichetta}" è obbligatorio.` : null;
  }

  if (campo.type === 'number') {
    const n = Number(valore);
    if (Number.isNaN(n)) return `Il campo "${etichetta}" deve essere un numero.`;
    if (campo.validation?.min !== undefined && n < campo.validation.min) {
      return `Il campo "${etichetta}" deve essere almeno ${campo.validation.min}.`;
    }
    if (campo.validation?.max !== undefined && n > campo.validation.max) {
      return `Il campo "${etichetta}" non può superare ${campo.validation.max}.`;
    }
    return null;
  }

  const { minLength, maxLength, pattern, patternMessage } = campo.validation ?? {};
  if (minLength && valore.length < minLength) {
    return `Il campo "${etichetta}" richiede almeno ${minLength} caratteri.`;
  }
  if (maxLength && valore.length > maxLength) {
    return `Il campo "${etichetta}" non può superare ${maxLength} caratteri.`;
  }
  if (pattern) {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      return null; // pattern malformato lato configurazione: non blocca il cittadino
    }
    if (!regex.test(valore)) {
      return patternMessage
        ? `${etichetta}: ${patternMessage}`
        : `Il campo "${etichetta}" non ha un formato valido.`;
    }
  }
  return null;
}

/**
 * Rivalida lato server i dati del modulo contro lo schema `attributi` del
 * servizio: la validazione del client (ModuloStep) è aggirabile.
 *
 * Le condizioni di visibilità sono rivalutate sui valori ricevuti, quindi i
 * campi di una sezione non applicabile non sono richiesti e i valori inviati
 * per campi invisibili vengono scartati. In caso di esito positivo restituisce
 * i dati normalizzati (solo campi visibili, label prese dallo schema).
 */
export function validaDatiModulo(
  attributi: string | null | undefined,
  datiRaw: string | null | undefined,
): RisultatoValidazione {
  const campi = parseCampi(attributi);
  if (campi.length === 0) return { ok: true, dati: datiRaw ? String(datiRaw) : null };

  const valori = parseValori(datiRaw);
  const puliti: DatoConLabel[] = [];

  for (const campo of campi) {
    if (!campo?.name || SKIP_FIELD_TYPES.has(campo.type)) continue;
    if (!isFieldVisible(campo, valori)) continue;

    const valore = valori[campo.name] ?? '';
    const errore = validaCampo(campo, valore);
    if (errore) return { ok: false, errore };

    puliti.push({ name: campo.name, label: campo.label, value: valore });
  }

  return { ok: true, dati: JSON.stringify(puliti) };
}
