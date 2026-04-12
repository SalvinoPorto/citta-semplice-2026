'use client';

import { useState } from 'react';
import { FormField, FieldCondition } from './types';

interface FormPreviewProps {
  fields: FormField[];
}

function evaluateCondition(condition: FieldCondition, values: Record<string, string>): boolean {
  const val = values[condition.fieldName] ?? '';
  switch (condition.operator) {
    case 'equals':
      return val === (condition.value ?? '');
    case 'not_equals':
      return val !== (condition.value ?? '');
    case 'not_empty':
      return val !== '';
    case 'empty':
      return val === '';
  }
}

export function FormPreview({ fields }: FormPreviewProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const setValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const isVisible = (field: FormField): boolean => {
    if (!field.condition || !field.condition.fieldName) return true;
    return evaluateCondition(field.condition, values);
  };

  const getWidthClass = (width?: string) => {
    switch (width) {
      case 'half':
        return 'col-md-6';
      case 'third':
        return 'col-md-4';
      default:
        return 'col-12';
    }
  };

  const renderField = (field: FormField) => {
    const requiredMark = field.validation?.required ? (
      <span className="text-danger ms-1">*</span>
    ) : null;

    switch (field.type) {
      case 'heading':
        return <h4 className="mt-4 mb-3">{field.label}</h4>;

      case 'paragraph':
        return <p className="text-muted mb-3">{field.label}</p>;

      case 'divider':
        return <hr className="my-4" />;

      case 'hidden':
        return <input type="hidden" name={field.name} value={field.defaultValue} />;

      case 'checkbox':
        return (
          <div className="mb-3">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                name={field.name}
                id={field.id}
                checked={values[field.name] === 'true'}
                onChange={(e) => setValue(field.name, e.target.checked ? 'true' : 'false')}
                required={field.validation?.required}
              />
              <label className="form-check-label" htmlFor={field.id}>
                {field.label}
                {requiredMark}
              </label>
            </div>
            {field.helpText && <small className="text-muted">{field.helpText}</small>}
          </div>
        );

      case 'radio':
        return (
          <div className="mb-3">
            <label className="form-label">
              {field.label}
              {requiredMark}
            </label>
            {field.options?.map((opt, i) => (
              <div key={i} className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  name={field.name}
                  id={`${field.id}_${i}`}
                  value={opt.value}
                  checked={values[field.name] === opt.value}
                  onChange={() => setValue(field.name, opt.value)}
                  required={field.validation?.required}
                />
                <label className="form-check-label" htmlFor={`${field.id}_${i}`}>
                  {opt.label}
                </label>
              </div>
            ))}
            {field.helpText && <small className="text-muted">{field.helpText}</small>}
          </div>
        );

      case 'select':
        return (
          <div className="mb-3">
            <label className="form-label" htmlFor={field.id}>
              {field.label}
              {requiredMark}
            </label>
            <select
              className="form-select"
              name={field.name}
              id={field.id}
              value={values[field.name] ?? ''}
              onChange={(e) => setValue(field.name, e.target.value)}
              required={field.validation?.required}
              multiple={field.multiple}
            >
              {field.options?.map((opt, i) => (
                <option key={i} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {field.helpText && <small className="text-muted">{field.helpText}</small>}
          </div>
        );

      case 'textarea':
        return (
          <div className="mb-3">
            <label className="form-label" htmlFor={field.id}>
              {field.label}
              {requiredMark}
            </label>
            <textarea
              className="form-control"
              name={field.name}
              id={field.id}
              placeholder={field.placeholder}
              rows={field.rows || 4}
              value={values[field.name] ?? ''}
              onChange={(e) => setValue(field.name, e.target.value)}
              required={field.validation?.required}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
            />
            {field.helpText && <small className="text-muted">{field.helpText}</small>}
            {field.validation?.maxLength && (
              <small className="text-muted d-block">
                Max {field.validation.maxLength} caratteri
              </small>
            )}
          </div>
        );

      case 'file':
        return (
          <div className="mb-3">
            <label className="form-label" htmlFor={field.id}>
              {field.label}
              {requiredMark}
            </label>
            <input
              type="file"
              className="form-control"
              name={field.name}
              id={field.id}
              accept={field.accept}
              multiple={field.multiple}
              required={field.validation?.required}
            />
            {field.helpText && <small className="text-muted">{field.helpText}</small>}
            {field.accept && (
              <small className="text-muted d-block">Formati accettati: {field.accept}</small>
            )}
          </div>
        );

      default:
        return (
          <div className="mb-3">
            <label className="form-label" htmlFor={field.id}>
              {field.label}
              {requiredMark}
            </label>
            <input
              type={field.type}
              className="form-control"
              name={field.name}
              id={field.id}
              placeholder={field.placeholder}
              value={values[field.name] ?? field.defaultValue ?? ''}
              onChange={(e) => setValue(field.name, e.target.value)}
              required={field.validation?.required}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
              min={field.validation?.min}
              max={field.validation?.max}
              pattern={field.validation?.pattern}
              title={field.validation?.patternMessage}
            />
            {field.helpText && <small className="text-muted">{field.helpText}</small>}
            {field.validation?.pattern && field.validation?.patternMessage && (
              <small className="text-muted d-block">
                Formato: {field.validation.patternMessage}
              </small>
            )}
          </div>
        );
    }
  };

  // Group visible fields by rows based on width
  const visibleFields = fields.filter(isVisible);

  const rows: FormField[][] = [];
  let currentRow: FormField[] = [];
  let currentWidth = 0;

  visibleFields.forEach((field) => {
    const fieldWidth =
      field.width === 'half' ? 6 : field.width === 'third' ? 4 : 12;

    if (['heading', 'paragraph', 'divider'].includes(field.type)) {
      if (currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentWidth = 0;
      }
      rows.push([field]);
      return;
    }

    if (currentWidth + fieldWidth > 12) {
      rows.push(currentRow);
      currentRow = [field];
      currentWidth = fieldWidth;
    } else {
      currentRow.push(field);
      currentWidth += fieldWidth;
    }
  });

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return (
    <div className="form-preview p-4 bg-white border rounded">
      <div>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="row">
            {row.map((field) => (
              <div key={field.id} className={getWidthClass(field.width)}>
                {renderField(field)}
              </div>
            ))}
          </div>
        ))}

        {fields.length > 0 && (
          <div className="mt-4 pt-3 border-top">
            <button type="button" className="btn btn-primary" disabled>
              Invia
            </button>
            <button type="button" className="btn btn-secondary ms-2" disabled>
              Annulla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
