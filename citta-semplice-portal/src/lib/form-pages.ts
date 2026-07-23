import { FieldCondition } from './form-condition';

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'date'
  | 'time'
  | 'datetime'
  | 'number'
  | 'email'
  | 'tel'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'hidden'
  | 'heading'
  | 'section'
  | 'paragraph'
  | 'divider'
  | 'pagebreak';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  //width?: 'full' | 'half' | 'third' | 'twothirds';
  width?: '1' | '2' | '3' | '4' | '6' | '8' | '9' | '10' | '12';
  placeholder?: string;
  defaultValue?: string;
  helpText?: string;
  rows?: number;
  accept?: string;
  multiple?: boolean;
  options?: FieldOption[];
  validation?: FieldValidation;
  condition?: FieldCondition;
  /** Id del campo `section` che contiene questo campo. */
  parentId?: string;
  /**
   * Condizioni ereditate dai contenitori. Derivate a runtime da `risolviGerarchia`,
   * non presenti nello schema salvato.
   */
  conditions?: FieldCondition[];
}

export interface FormPage {
  /** Etichetta del pagebreak che apre la pagina (vuota per la prima). */
  titolo: string;
  fields: FormField[];
}

/** Tipi puramente presentazionali: nessun valore da validare o riepilogare. */
export const LAYOUT_FIELD_TYPES = new Set<string>([
  'heading',
  'section',
  'paragraph',
  'divider',
  'pagebreak',
]);

/**
 * Propaga la condizione di visibilità dei contenitori (`section`) ai campi che
 * vi appartengono tramite `parentId`, risalendo l'intera catena di contenitori.
 * Le condizioni ereditate si sommano in AND a quella propria del campo: un
 * campo dentro una sezione nascosta resta nascosto.
 */
/**
 * Riscrive le condizioni che puntano al campo sorgente per `fieldId`,
 * valorizzandone il `fieldName` corrente: a runtime i valori del form sono
 * indicizzati per nome. Le condizioni dei moduli più vecchi, prive di
 * `fieldId`, restano invariate.
 */
export function risolviRiferimentiCondizioni(campi: FormField[]): FormField[] {
  const nomiPerId = new Map(campi.filter((c) => c?.id).map((c) => [c.id, c.name]));

  return campi.map((campo) => {
    const cond = campo.condition;
    if (!cond?.fieldId) return campo;
    const nome = nomiPerId.get(cond.fieldId);
    // Sorgente cancellata: la condizione diventa inapplicabile e viene ignorata.
    if (!nome) return { ...campo, condition: undefined };
    return nome === cond.fieldName ? campo : { ...campo, condition: { ...cond, fieldName: nome } };
  });
}

export function risolviGerarchia(campi: FormField[]): FormField[] {
  const contenitori = new Map(
    campi.filter((c) => c?.id && c.type === 'section').map((c) => [c.id, c]),
  );
  if (contenitori.size === 0) return campi;

  return campi.map((campo) => {
    const ereditate: FieldCondition[] = [];
    const visti = new Set<string>([campo.id]);
    let padre = campo.parentId ? contenitori.get(campo.parentId) : undefined;
    // `visti` protegge da cicli in schemi malformati (A dentro B dentro A).
    while (padre && !visti.has(padre.id)) {
      visti.add(padre.id);
      if (padre.condition?.fieldName) ereditate.unshift(padre.condition);
      padre = padre.parentId ? contenitori.get(padre.parentId) : undefined;
    }
    return ereditate.length > 0 ? { ...campo, conditions: ereditate } : campo;
  });
}

export function parseCampi(attributi: string | null | undefined): FormField[] {
  if (!attributi) return [];
  try {
    const parsed = JSON.parse(attributi);
    // Prima i riferimenti (fieldId → fieldName), poi la propagazione ai contenuti:
    // così le condizioni ereditate sono già risolte.
    if (Array.isArray(parsed)) return risolviGerarchia(risolviRiferimentiCondizioni(parsed));
    if (parsed && Array.isArray(parsed.fields))
      return risolviGerarchia(risolviRiferimentiCondizioni(parsed.fields));
    return [];
  } catch {
    return [];
  }
}

/**
 * Divide i campi in pagine usando i `pagebreak` come separatori. Uno schema
 * senza pagebreak produce una sola pagina, quindi i moduli già pubblicati
 * continuano a comportarsi come prima.
 */
export function splitPages(campi: FormField[]): FormPage[] {
  const pages: FormPage[] = [{ titolo: '', fields: [] }];
  for (const campo of campi) {
    if (campo.type === 'pagebreak') {
      pages.push({ titolo: campo.label, fields: [] });
    } else {
      pages[pages.length - 1].fields.push(campo);
    }
  }
  const piene = pages.filter((p) => p.fields.length > 0);
  return piene.length > 0 ? piene : [{ titolo: '', fields: [] }];
}
