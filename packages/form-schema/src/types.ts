export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'time'
  | 'datetime'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'file'
  | 'hidden'
  | 'heading'
  | 'section'
  | 'paragraph'
  | 'divider'
  | 'pagebreak';

export interface FieldOption {
  value: string;
  label: string;
}

export type ConditionOperator = 'equals' | 'not_equals' | 'not_empty' | 'empty';

export interface FieldCondition {
  /**
   * Id del campo sorgente: riferimento stabile, non si rompe se l'operatore
   * rinomina il campo. `parseCampi` lo risolve in `fieldName`.
   */
  fieldId?: string;
  /**
   * Nome del campo sorgente: è la chiave con cui i valori sono indicizzati a
   * runtime. Negli schemi salvati prima dell'introduzione di `fieldId` è
   * l'unico riferimento disponibile.
   */
  fieldName: string;
  operator: ConditionOperator;
  value?: string;
}

export interface FieldValidation {
  required?: boolean;
  /** Se presente, il campo è obbligatorio solo quando questa condizione è vera. */
  requiredCondition?: FieldCondition;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  name: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  className?: string;
  //width?: 'full' | 'half' | 'third' | 'twothirds';
  width?: '1' | '2' | '3' | '4' | '6' | '8' | '9' | '10' | '12';
  accept?: string; // per file input
  multiple?: boolean; // per file e select
  rows?: number; // per textarea
  condition?: FieldCondition;
  /** Id del campo `section` che contiene questo campo. */
  parentId?: string;
  /**
   * Condizioni ereditate dai contenitori: derivate a runtime da `risolviGerarchia`,
   * non fanno parte dello schema salvato.
   */
  conditions?: FieldCondition[];
}

export interface FormSchema {
  fields: FormField[];
  version: string;
}

export interface FormPage {
  /** Etichetta del pagebreak che apre la pagina (vuota per la prima). */
  titolo: string;
  fields: FormField[];
}

/** Solo le sezioni possono contenere altri campi. */
export const CONTAINER_TYPE: FieldType = 'section';

/** Tipi puramente presentazionali: nessun valore da validare o riepilogare. */
export const LAYOUT_FIELD_TYPES = new Set<string>([
  'heading',
  'section',
  'paragraph',
  'divider',
  'pagebreak',
]);

/**
 * Tipi esclusi dai dati salvati e dal riepilogo: layout (nessun valore),
 * `hidden` e `file` (gli allegati hanno un flusso proprio).
 */
export const SKIP_FIELD_TYPES = new Set<string>([...LAYOUT_FIELD_TYPES, 'hidden', 'file']);
