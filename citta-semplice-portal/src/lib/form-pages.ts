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
  width?: 'full' | 'half' | 'third' | 'twothirds';
  placeholder?: string;
  defaultValue?: string;
  helpText?: string;
  rows?: number;
  accept?: string;
  multiple?: boolean;
  options?: FieldOption[];
  validation?: FieldValidation;
  condition?: FieldCondition;
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

export function parseCampi(attributi: string | null | undefined): FormField[] {
  if (!attributi) return [];
  try {
    const parsed = JSON.parse(attributi);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.fields)) return parsed.fields;
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
