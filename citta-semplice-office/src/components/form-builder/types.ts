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
  | 'paragraph'
  | 'divider';

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
  width?: 'full' | 'half' | 'third';
  accept?: string; // per file input
  multiple?: boolean; // per file e select
  rows?: number; // per textarea
  condition?: FieldCondition;
}

export interface FormSchema {
  fields: FormField[];
  version: string;
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
  { type: 'paragraph', label: 'Paragrafo', icon: 'P', category: 'Layout' },
  { type: 'divider', label: 'Separatore', icon: '—', category: 'Layout' },
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
      return { ...base, name: 'heading', label: 'Sezione' };
    case 'paragraph':
      return { ...base, name: 'paragraph', label: 'Testo informativo da mostrare all\'utente.' };
    case 'divider':
      return { ...base, name: 'divider', label: '' };
    case 'hidden':
      return { ...base, name: 'campo_nascosto', label: 'Campo Nascosto', defaultValue: '' };
    default:
      return base;
  }
}
