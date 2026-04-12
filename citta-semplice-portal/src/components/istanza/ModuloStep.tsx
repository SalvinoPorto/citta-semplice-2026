'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useImperativeHandle, forwardRef } from 'react';

interface FieldOption {
  label: string;
  value: string;
}

interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}

type ConditionOperator = 'equals' | 'not_equals' | 'not_empty' | 'empty';

interface FieldCondition {
  fieldName: string;
  operator: ConditionOperator;
  value?: string;
}

interface FormField {
  id: string;
  name: string;
  label: string;
  type:
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
    | 'paragraph'
    | 'divider';
  width?: 'full' | 'half' | 'third';
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

interface Servizio {
  attributi?: string | null;
  moduloCorpo?: string | null;
}

export interface ModuloStepHandle {
  validate: () => Promise<boolean>;
}

interface Props {
  servizio: Servizio;
  dati: Record<string, unknown>;
  onChangeDati: (dati: Record<string, unknown>) => void;
}

function parseCampi(attributi: string | null | undefined): FormField[] {
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

function evaluateCondition(condition: FieldCondition, values: Record<string, unknown>): boolean {
  const raw = values[condition.fieldName];
  const val = raw === true ? 'true' : raw === false ? 'false' : String(raw ?? '');
  switch (condition.operator) {
    case 'equals':     return val === (condition.value ?? '');
    case 'not_equals': return val !== (condition.value ?? '');
    case 'not_empty':  return val !== '' && val !== 'undefined';
    case 'empty':      return val === '' || val === 'undefined';
  }
}

function isFieldVisible(campo: FormField, values: Record<string, unknown>): boolean {
  if (!campo.condition || !campo.condition.fieldName) return true;
  return evaluateCondition(campo.condition, values);
}

// Conditional required fields are made optional in the base schema;
// their required check is handled separately in validate() via setError.
function buildSchema(campi: FormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const campo of campi) {
    if (['heading', 'paragraph', 'divider', 'hidden'].includes(campo.type)) continue;

    const required = (campo.validation?.required ?? false) && !campo.condition;

    // Checkbox — il preprocess converte stringhe ("true"/"false"/"") in boolean
    // per gestire valori ripristinati da bozza serializzata con String()
    if (campo.type === 'checkbox') {
      const coerce = z.preprocess(
        (v) => (v === 'true' || v === true ? true : v === 'false' || v === '' || v === false ? false : v),
        z.boolean(),
      );
      shape[campo.name] = required
        ? coerce.refine((v) => v === true, 'Campo obbligatorio')
        : coerce.optional();
      continue;
    }

    // File
    if (campo.type === 'file') {
      shape[campo.name] = required
        ? z.any().refine((v) => v && v.length > 0, 'Campo obbligatorio')
        : z.any().optional();
      continue;
    }

    // Number
    if (campo.type === 'number') {
      let n = z.coerce.number();
      if (campo.validation?.min !== undefined) n = n.min(campo.validation.min, `Valore minimo: ${campo.validation.min}`);
      if (campo.validation?.max !== undefined) n = n.max(campo.validation.max, `Valore massimo: ${campo.validation.max}`);
      shape[campo.name] = required ? n : z.union([z.literal(''), n]).optional();
      continue;
    }

    // String fields
    if (required) {
      let s = z.string().min(1, 'Campo obbligatorio');
      if (campo.validation?.minLength) s = s.min(campo.validation.minLength, `Minimo ${campo.validation.minLength} caratteri`);
      if (campo.validation?.maxLength) s = s.max(campo.validation.maxLength, `Massimo ${campo.validation.maxLength} caratteri`);
      if (campo.validation?.pattern) s = s.regex(new RegExp(campo.validation.pattern), campo.validation.patternMessage ?? 'Formato non valido');
      shape[campo.name] = s;
    } else {
      const minLen = campo.validation?.minLength;
      const maxLen = campo.validation?.maxLength;
      const pat = campo.validation?.pattern;
      const patMsg = campo.validation?.patternMessage ?? 'Formato non valido';
      shape[campo.name] = z.string().optional()
        .refine((v) => !v || !minLen || v.length >= minLen, `Minimo ${minLen} caratteri`)
        .refine((v) => !v || !maxLen || v.length <= maxLen, `Massimo ${maxLen} caratteri`)
        .refine((v) => !v || !pat || new RegExp(pat).test(v), patMsg);
    }
  }

  return z.object(shape);
}

function getWidthClass(width?: string) {
  switch (width) {
    case 'half':  return 'col-md-6';
    case 'third': return 'col-md-4';
    default:      return 'col-12';
  }
}

export const ModuloStep = forwardRef<ModuloStepHandle, Props>(function ModuloStep(
  { servizio, dati, onChangeDati },
  ref
) {
  const campi = parseCampi(servizio.attributi);
  const schema = buildSchema(campi);

  const {
    register,
    watch,
    trigger,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: dati as Record<string, string | boolean>,
    mode: 'onChange',
  });

  useImperativeHandle(ref, () => ({
    validate: async () => {
      const baseResult = await trigger();
      const currentValues = watch() as Record<string, unknown>;

      // Validate required conditional fields based on current visibility
      let conditionalValid = true;
      for (const campo of campi) {
        if (!campo.condition || !campo.validation?.required) continue;
        if (['heading', 'paragraph', 'divider', 'hidden'].includes(campo.type)) continue;

        if (isFieldVisible(campo, currentValues)) {
          const val = currentValues[campo.name];
          const isEmpty = val === undefined || val === null || val === '' ||
            (campo.type === 'checkbox' && val !== true) ||
            (campo.type === 'file' && (!val || (val as FileList).length === 0));
          if (isEmpty) {
            setError(campo.name as string, { message: 'Campo obbligatorio' });
            conditionalValid = false;
          } else {
            clearErrors(campo.name as string);
          }
        } else {
          clearErrors(campo.name as string);
        }
      }

      return baseResult && conditionalValid;
    },
  }));

  const values = watch();

  useEffect(() => {
    onChangeDati(values);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  if (campi.length === 0 && servizio.moduloCorpo) {
    return (
      <div className="container">
        <div dangerouslySetInnerHTML={{ __html: servizio.moduloCorpo }} />
      </div>
    );
  }

  if (campi.length === 0) {
    return (
      <div className="container">
        <div className="alert alert-info">
          Nessun campo aggiuntivo richiesto per questo servizio.
        </div>
      </div>
    );
  }

  const renderField = (campo: FormField) => {
    const requiredMark = campo.validation?.required ? (
      <span className="text-danger ms-1">*</span>
    ) : null;
    const errorMsg = errors[campo.name]?.message
      ? String(errors[campo.name]?.message)
      : null;

    switch (campo.type) {
      case 'heading':
        return <h4 className="mt-4 mb-3">{campo.label}</h4>;

      case 'paragraph':
        return <p className="text-muted mb-3">{campo.label}</p>;

      case 'divider':
        return <hr className="my-4" />;

      case 'hidden':
        return <input type="hidden" {...register(campo.name)} defaultValue={campo.defaultValue} />;

      case 'checkbox':
        return (
          <div className="mb-3">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id={campo.id}
                {...register(campo.name)}
              />
              <label className="form-check-label" htmlFor={campo.id}>
                {campo.label}
                {requiredMark}
              </label>
            </div>
            {campo.helpText && <small className="text-muted">{campo.helpText}</small>}
            {errorMsg && <div className="invalid-feedback d-block">{errorMsg}</div>}
          </div>
        );

      case 'radio':
        return (
          <div className="mb-3">
            <label className="form-label">
              {campo.label}
              {requiredMark}
            </label>
            {campo.options?.map((opt, i) => (
              <div key={i} className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id={`${campo.id}_${i}`}
                  value={opt.value}
                  {...register(campo.name)}
                />
                <label className="form-check-label" htmlFor={`${campo.id}_${i}`}>
                  {opt.label}
                </label>
              </div>
            ))}
            {campo.helpText && <small className="text-muted">{campo.helpText}</small>}
            {errorMsg && <div className="invalid-feedback d-block">{errorMsg}</div>}
          </div>
        );

      case 'select':
        return (
          <div className="mb-3">
            <label className="form-label" htmlFor={campo.id}>
              {campo.label}
              {requiredMark}
            </label>
            <select
              className={`form-select${errorMsg ? ' is-invalid' : ''}`}
              id={campo.id}
              multiple={campo.multiple}
              {...register(campo.name)}
            >
              <option value="">Seleziona...</option>
              {campo.options?.map((opt, i) => (
                <option key={i} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {campo.helpText && <small className="text-muted">{campo.helpText}</small>}
            {errorMsg && <div className="invalid-feedback">{errorMsg}</div>}
          </div>
        );

      case 'textarea':
        return (
          <div className="mb-3">
            <label className="form-label" htmlFor={campo.id}>
              {campo.label}
              {requiredMark}
            </label>
            <textarea
              className={`form-control${errorMsg ? ' is-invalid' : ''}`}
              id={campo.id}
              placeholder={campo.placeholder}
              rows={campo.rows || 4}
              {...register(campo.name)}
            />
            {campo.helpText && <small className="text-muted">{campo.helpText}</small>}
            {campo.validation?.maxLength && (
              <small className="text-muted d-block">Max {campo.validation.maxLength} caratteri</small>
            )}
            {errorMsg && <div className="invalid-feedback">{errorMsg}</div>}
          </div>
        );

      case 'file':
        return (
          <div className="mb-3">
            <label className="form-label" htmlFor={campo.id}>
              {campo.label}
              {requiredMark}
            </label>
            <input
              type="file"
              className={`form-control${errorMsg ? ' is-invalid' : ''}`}
              id={campo.id}
              accept={campo.accept}
              multiple={campo.multiple}
              {...register(campo.name)}
            />
            {campo.helpText && <small className="text-muted">{campo.helpText}</small>}
            {campo.accept && (
              <small className="text-muted d-block">Formati accettati: {campo.accept}</small>
            )}
            {errorMsg && <div className="invalid-feedback">{errorMsg}</div>}
          </div>
        );

      default: {
        const isText = campo.type === 'text';
        const { onChange: rhfOnChange, ...restReg } = register(campo.name);
        return (
          <div className="mb-3">
            <label className="form-label" htmlFor={campo.id}>
              {campo.label}
              {requiredMark}
            </label>
            <input
              type={campo.type}
              className={`form-control${errorMsg ? ' is-invalid' : ''}`}
              id={campo.id}
              placeholder={campo.placeholder}
              style={isText ? { textTransform: 'uppercase' } : undefined}
              onChange={isText
                ? (e) => { e.target.value = e.target.value.toUpperCase(); rhfOnChange(e); }
                : rhfOnChange}
              {...restReg}
            />
            {campo.helpText && <small className="text-muted">{campo.helpText}</small>}
            {campo.validation?.pattern && campo.validation?.patternMessage && (
              <small className="text-muted d-block">Formato: {campo.validation.patternMessage}</small>
            )}
            {errorMsg && <div className="invalid-feedback">{errorMsg}</div>}
          </div>
        );
      }
    }
  };

  // Filtra i campi visibili e raggruppa in righe per larghezza
  const campiVisibili = campi.filter((campo) => isFieldVisible(campo, values as Record<string, unknown>));

  const rows: FormField[][] = [];
  let currentRow: FormField[] = [];
  let currentWidth = 0;

  campiVisibili.forEach((campo) => {
    const fieldWidth = campo.width === 'half' ? 6 : campo.width === 'third' ? 4 : 12;

    if (['heading', 'paragraph', 'divider'].includes(campo.type)) {
      if (currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentWidth = 0;
      }
      rows.push([campo]);
      return;
    }

    if (currentWidth + fieldWidth > 12) {
      rows.push(currentRow);
      currentRow = [campo];
      currentWidth = fieldWidth;
    } else {
      currentRow.push(campo);
      currentWidth += fieldWidth;
    }
  });

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return (
    <div className="container">
      <h3 className="mb-4">Compila il modulo</h3>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="row">
          {row.map((campo) => (
            <div key={campo.id} className={getWidthClass(campo.width)}>
              {renderField(campo)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});
