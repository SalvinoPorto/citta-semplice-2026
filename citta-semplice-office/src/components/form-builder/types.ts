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

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}

export type ConditionOperator = 'equals' | 'not_equals' | 'not_empty' | 'empty';

export interface FieldCondition {
  /** Id del campo sorgente: riferimento stabile alla rinomina del campo. */
  fieldId?: string;
  /** Nome del campo sorgente: chiave con cui i valori sono indicizzati a runtime. */
  fieldName: string;
  operator: ConditionOperator;
  value?: string;
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

/** Solo le sezioni possono contenere altri campi. */
export const CONTAINER_TYPE: FieldType = 'section';

/**
 * Propaga la condizione di visibilità dei contenitori ai campi contenuti,
 * risalendo l'intera catena di `parentId`. Deve restare allineata a
 * `risolviGerarchia` del portale (`src/lib/form-pages.ts`).
 */
/**
 * Riscrive le condizioni espresse per `fieldId` valorizzandone il `fieldName`
 * corrente. Deve restare allineata a `risolviRiferimentiCondizioni` del portale.
 */
export function risolviRiferimentiCondizioni(fields: FormField[]): FormField[] {
  const nomiPerId = new Map(fields.filter((f) => f?.id).map((f) => [f.id, f.name]));

  return fields.map((field) => {
    const cond = field.condition;
    if (!cond?.fieldId) return field;
    const nome = nomiPerId.get(cond.fieldId);
    if (!nome) return { ...field, condition: undefined };
    return nome === cond.fieldName ? field : { ...field, condition: { ...cond, fieldName: nome } };
  });
}

export function risolviGerarchia(fields: FormField[]): FormField[] {
  const contenitori = new Map(
    fields.filter((f) => f?.id && f.type === CONTAINER_TYPE).map((f) => [f.id, f]),
  );
  if (contenitori.size === 0) return fields;

  return fields.map((field) => {
    const ereditate: FieldCondition[] = [];
    const visti = new Set<string>([field.id]);
    let padre = field.parentId ? contenitori.get(field.parentId) : undefined;
    // `visti` protegge da cicli in schemi malformati.
    while (padre && !visti.has(padre.id)) {
      visti.add(padre.id);
      if (padre.condition?.fieldName) ereditate.unshift(padre.condition);
      padre = padre.parentId ? contenitori.get(padre.parentId) : undefined;
    }
    return ereditate.length > 0 ? { ...field, conditions: ereditate } : field;
  });
}

/** Catena di contenitori di un campo, dal più esterno al più interno. */
export function catenaContenitori(field: FormField, fields: FormField[]): FormField[] {
  const contenitori = new Map(
    fields.filter((f) => f?.id && f.type === CONTAINER_TYPE).map((f) => [f.id, f]),
  );
  const catena: FormField[] = [];
  const visti = new Set<string>([field.id]);
  let padre = field.parentId ? contenitori.get(field.parentId) : undefined;
  while (padre && !visti.has(padre.id)) {
    visti.add(padre.id);
    catena.unshift(padre);
    padre = padre.parentId ? contenitori.get(padre.parentId) : undefined;
  }
  return catena;
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

/**
 * Divide un elenco piatto di campi in pagine usando i campi `pagebreak` come
 * separatori. Uno schema senza pagebreak produce una sola pagina: i moduli
 * esistenti continuano a funzionare senza modifiche.
 */
export function splitPages(fields: FormField[]): FormPage[] {
  const pages: FormPage[] = [{ titolo: '', fields: [] }];
  for (const field of fields) {
    if (field.type === 'pagebreak') {
      pages.push({ titolo: field.label, fields: [] });
    } else {
      pages[pages.length - 1].fields.push(field);
    }
  }
  // Un pagebreak a inizio/fine schema o due consecutivi non devono generare
  // pagine vuote; se restano zero pagine si torna a una pagina unica.
  const piene = pages.filter((p) => p.fields.length > 0);
  return piene.length > 0 ? piene : [{ titolo: '', fields: [] }];
}

export const FIELD_TYPES: { type: FieldType; label: string; icon: string; category: string }[] = [
  // Input
  { type: 'text', label: 'Testo', icon: 'T', category: 'Input' },
  { type: 'textarea', label: 'Area di Testo', icon: '¶', category: 'Input' },
  { type: 'number', label: 'Numero', icon: '#', category: 'Input' },
  { type: 'email', label: 'Email', icon: '@', category: 'Input' },
  { type: 'tel', label: 'Telefono', icon: '☎', category: 'Input' },
  { type: 'date', label: 'Data', icon: '📅', category: 'Input' },
  { type: 'time', label: 'Ora', icon: '⏰', category: 'Input' },
  { type: 'datetime', label: 'Data e Ora', icon: '📆', category: 'Input' },
  // Scelta
  { type: 'checkbox', label: 'Checkbox', icon: '☑', category: 'Scelta' },
  { type: 'radio', label: 'Radio', icon: '◉', category: 'Scelta' },
  { type: 'select', label: 'Select', icon: '▼', category: 'Scelta' },
  // File
  { type: 'file', label: 'File Upload', icon: '📎', category: 'File' },
  // Layout
  { type: 'heading', label: 'Titolo', icon: 'H', category: 'Layout' },
  { type: 'section', label: 'Sezione', icon: 'S', category: 'Layout' },
  { type: 'paragraph', label: 'Paragrafo', icon: 'P', category: 'Layout' },
  { type: 'divider', label: 'Separatore', icon: '—', category: 'Layout' },
  { type: 'pagebreak', label: 'Interruzione Pagina', icon: '📄', category: 'Layout' },
  // Hidden
  { type: 'hidden', label: 'Campo Nascosto', icon: '👁', category: 'Altro' },
];

export function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createDefaultField(type: FieldType): FormField {
  const base: FormField = {
    id: generateFieldId(),
    type,
    name: '',
    label: '',
    validation: {},
  };

  switch (type) {
    case 'text':
      return { ...base, name: 'campo_testo', label: 'Campo Testo', placeholder: 'Inserisci testo...' };
    case 'textarea':
      return { ...base, name: 'area_testo', label: 'Area di Testo', rows: 4 };
    case 'number':
      return { ...base, name: 'numero', label: 'Numero' };
    case 'email':
      return { ...base, name: 'email', label: 'Email', placeholder: 'esempio@email.it' };
    case 'tel':
      return { ...base, name: 'telefono', label: 'Telefono' };
    case 'date':
      return { ...base, name: 'data', label: 'Data' };
    case 'time':
      return { ...base, name: 'ora', label: 'Ora' };
    case 'datetime':
      return { ...base, name: 'data_ora', label: 'Data e Ora' };
    case 'checkbox':
      return { ...base, name: 'checkbox', label: 'Accetto le condizioni' };
    case 'radio':
      return {
        ...base,
        name: 'scelta_radio',
        label: 'Seleziona un\'opzione',
        options: [
          { value: 'opzione1', label: 'Opzione 1' },
          { value: 'opzione2', label: 'Opzione 2' },
        ],
      };
    case 'select':
      return {
        ...base,
        name: 'select',
        label: 'Seleziona',
        options: [
          { value: '', label: '-- Seleziona --' },
          { value: 'opzione1', label: 'Opzione 1' },
          { value: 'opzione2', label: 'Opzione 2' },
        ],
      };
    case 'file':
      return { ...base, name: 'allegato', label: 'Allegato', accept: '.pdf,.doc,.docx,.jpg,.png' };
    case 'heading':
      return { ...base, name: 'heading', label: 'Titolo' };
    case 'section':
      return { ...base, name: 'section', label: 'Sezione' };
    case 'paragraph':
      return { ...base, name: 'paragraph', label: 'Testo informativo da mostrare all\'utente.' };
    case 'divider':
      return { ...base, name: 'divider', label: '' };
    // L'etichetta di un pagebreak è il titolo della pagina che INIZIA dopo di esso.
    case 'pagebreak':
      return { ...base, name: 'pagebreak', label: 'Nuova pagina' };
    case 'hidden':
      return { ...base, name: 'campo_nascosto', label: 'Campo Nascosto', defaultValue: '' };
    default:
      return base;
  }
}
