'use client';

import { useState } from 'react';
import { FormField, FieldOption, FieldCondition, ConditionOperator } from './types';
import { Input, Select, Textarea } from '@/components/ui';

interface FieldEditorProps {
  field: FormField;
  allFields: FormField[];
  onUpdate: (field: FormField) => void;
}

export function FieldEditor({ field, allFields, onUpdate }: FieldEditorProps) {
  const [optionsText, setOptionsText] = useState(
    field.options?.map((o) => `${o.value}|${o.label}`).join('\n') || ''
  );

  const handleChange = (key: keyof FormField, value: unknown) => {
    onUpdate({ ...field, [key]: value });
  };

  const handleValidationChange = (key: string, value: unknown) => {
    onUpdate({
      ...field,
      validation: {
        ...field.validation,
        [key]: value,
      },
    });
  };

  const handleOptionsChange = (text: string) => {
    setOptionsText(text);
    const options: FieldOption[] = text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [value, label] = line.split('|');
        return {
          value: value?.trim() || '',
          label: label?.trim() || value?.trim() || '',
        };
      });
    onUpdate({ ...field, options });
  };

  const isInputField = ['text', 'textarea', 'number', 'email', 'tel', 'date', 'time', 'datetime'].includes(
    field.type
  );
  const hasOptions = ['select', 'radio'].includes(field.type);
  const isLayoutField = ['heading', 'paragraph', 'divider'].includes(field.type);

  return (
    <div className="field-editor">
      {/* Basic Properties */}
      <div className="mb-3">
        <label className="form-label small fw-bold">Nome Campo (ID)</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={field.name}
          onChange={(e) => handleChange('name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
          placeholder="nome_campo"
        />
        <small className="text-muted">Usato per identificare il campo nel form</small>
      </div>

      {!isLayoutField && field.type !== 'hidden' && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Etichetta</label>
          <input
            type="text"
            className="form-control form-control-sm"
            value={field.label}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Etichetta del campo"
          />
        </div>
      )}

      {isLayoutField && (
        <div className="mb-3">
          <label className="form-label small fw-bold">
            {field.type === 'heading' ? 'Testo Titolo' : 'Contenuto'}
          </label>
          {field.type === 'paragraph' ? (
            <textarea
              className="form-control form-control-sm"
              value={field.label}
              onChange={(e) => handleChange('label', e.target.value)}
              rows={3}
            />
          ) : field.type !== 'divider' ? (
            <input
              type="text"
              className="form-control form-control-sm"
              value={field.label}
              onChange={(e) => handleChange('label', e.target.value)}
            />
          ) : null}
        </div>
      )}

      {isInputField && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Placeholder</label>
          <input
            type="text"
            className="form-control form-control-sm"
            value={field.placeholder || ''}
            onChange={(e) => handleChange('placeholder', e.target.value)}
            placeholder="Testo di esempio..."
          />
        </div>
      )}

      {field.type === 'hidden' && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Valore Predefinito</label>
          <input
            type="text"
            className="form-control form-control-sm"
            value={field.defaultValue || ''}
            onChange={(e) => handleChange('defaultValue', e.target.value)}
          />
        </div>
      )}

      {/* Help Text */}
      {!isLayoutField && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Testo di Aiuto</label>
          <input
            type="text"
            className="form-control form-control-sm"
            value={field.helpText || ''}
            onChange={(e) => handleChange('helpText', e.target.value)}
            placeholder="Istruzioni per l'utente"
          />
        </div>
      )}

      {/* Options for select/radio */}
      {hasOptions && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Opzioni</label>
          <textarea
            className="form-control form-control-sm"
            value={optionsText}
            onChange={(e) => handleOptionsChange(e.target.value)}
            rows={5}
            placeholder="valore1|Etichetta 1&#10;valore2|Etichetta 2"
          />
          <small className="text-muted">
            Una opzione per riga: <code>valore|etichetta</code>
          </small>
        </div>
      )}

      {/* File accept */}
      {field.type === 'file' && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Formati Accettati</label>
          <input
            type="text"
            className="form-control form-control-sm"
            value={field.accept || ''}
            onChange={(e) => handleChange('accept', e.target.value)}
            placeholder=".pdf,.doc,.jpg"
          />
          <small className="text-muted">Separati da virgola</small>
        </div>
      )}

      {/* Textarea rows */}
      {field.type === 'textarea' && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Righe</label>
          <input
            type="number"
            className="form-control form-control-sm"
            value={field.rows || 4}
            onChange={(e) => handleChange('rows', parseInt(e.target.value) || 4)}
            min={2}
            max={20}
          />
        </div>
      )}

      {/* Width */}
      {!isLayoutField && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Larghezza</label>
          <select
            className="form-select form-select-sm"
            value={field.width || 'full'}
            onChange={(e) => handleChange('width', e.target.value)}
          >
            <option value="full">Intera riga</option>
            <option value="half">Metà riga</option>
            <option value="third">Un terzo</option>
          </select>
        </div>
      )}

      <hr />

      {/* Validation */}
      {!isLayoutField && field.type !== 'hidden' && (
        <>
          <h6 className="mb-3">Validazione</h6>

          <div className="form-check mb-2">
            <input
              type="checkbox"
              className="form-check-input"
              id="required"
              checked={field.validation?.required || false}
              onChange={(e) => handleValidationChange('required', e.target.checked)}
            />
            <label className="form-check-label" htmlFor="required">
              Campo obbligatorio
            </label>
          </div>

          {isInputField && field.type !== 'date' && field.type !== 'time' && (
            <>
              <div className="row mb-2">
                <div className="col-6">
                  <label className="form-label small">Min. caratteri</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={field.validation?.minLength || ''}
                    onChange={(e) =>
                      handleValidationChange('minLength', e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    min={0}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small">Max. caratteri</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={field.validation?.maxLength || ''}
                    onChange={(e) =>
                      handleValidationChange('maxLength', e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    min={0}
                  />
                </div>
              </div>
            </>
          )}

          {field.type === 'number' && (
            <div className="row mb-2">
              <div className="col-6">
                <label className="form-label small">Valore minimo</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={field.validation?.min ?? ''}
                  onChange={(e) =>
                    handleValidationChange('min', e.target.value ? parseInt(e.target.value) : undefined)
                  }
                />
              </div>
              <div className="col-6">
                <label className="form-label small">Valore massimo</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={field.validation?.max ?? ''}
                  onChange={(e) =>
                    handleValidationChange('max', e.target.value ? parseInt(e.target.value) : undefined)
                  }
                />
              </div>
            </div>
          )}

          {isInputField && (
            <>
              <div className="mb-2">
                <label className="form-label small">Pattern RegEx</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={field.validation?.pattern || ''}
                  onChange={(e) => handleValidationChange('pattern', e.target.value || undefined)}
                  placeholder="^[A-Z]{6}[0-9]{2}..."
                />
              </div>

              {field.validation?.pattern && (
                <div className="mb-2">
                  <label className="form-label small">Messaggio Errore Pattern</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={field.validation?.patternMessage || ''}
                    onChange={(e) => handleValidationChange('patternMessage', e.target.value || undefined)}
                    placeholder="Il formato non è valido"
                  />
                </div>
              )}
            </>
          )}

          {/* Common Patterns */}
          {isInputField && (
            <div className="mt-3">
              <label className="form-label small fw-bold">Pattern Comuni</label>
              <div className="d-flex flex-wrap gap-1">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() =>
                    onUpdate({ ...field, validation: { ...field.validation, pattern: '^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$', patternMessage: 'Codice fiscale non valido' } })
                  }
                >
                  C.F.
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() =>
                    onUpdate({ ...field, validation: { ...field.validation, pattern: '^[0-9]{5}$', patternMessage: 'CAP non valido' } })
                  }
                >
                  CAP
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() =>
                    onUpdate({ ...field, validation: { ...field.validation, pattern: '^[0-9]{11}$', patternMessage: 'Partita IVA non valida' } })
                  }
                >
                  P.IVA
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() =>
                    onUpdate({ ...field, validation: { ...field.validation, pattern: '^IT[0-9]{2}[A-Z][0-9]{22}$', patternMessage: 'IBAN non valido' } })
                  }
                >
                  IBAN
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() =>
                    onUpdate({ ...field, validation: { ...field.validation, pattern: undefined, patternMessage: undefined } })
                  }
                >
                  Rimuovi
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Conditional Visibility */}
      {(() => {
        const candidateFields = allFields.filter(
          (f) =>
            f.id !== field.id &&
            !['heading', 'paragraph', 'divider', 'hidden'].includes(f.type)
        );
        const hasCondition = !!field.condition;
        const operator = field.condition?.operator ?? 'equals';
        const needsValue = operator === 'equals' || operator === 'not_equals';

        const setCondition = (patch: Partial<NonNullable<FormField['condition']>>) =>
          onUpdate({
            ...field,
            condition: {
              fieldName: field.condition?.fieldName ?? '',
              operator: field.condition?.operator ?? 'equals',
              value: field.condition?.value,
              ...patch,
            },
          });

        return (
          <>
            <hr />
            <h6 className="mb-3">Visibilità Condizionale</h6>
            <div className="form-check mb-3">
              <input
                type="checkbox"
                className="form-check-input"
                id="enableCondition"
                checked={hasCondition}
                onChange={(e) =>
                  onUpdate({
                    ...field,
                    condition: e.target.checked
                      ? { fieldName: '', operator: 'equals', value: '' }
                      : undefined,
                  })
                }
              />
              <label className="form-check-label" htmlFor="enableCondition">
                Mostra solo se...
              </label>
            </div>

            {hasCondition && (
              <>
                {candidateFields.length === 0 ? (
                  <small className="text-muted">
                    Aggiungi altri campi al form per usare le condizioni.
                  </small>
                ) : (
                  <>
                    <div className="mb-2">
                      <label className="form-label small">Campo</label>
                      <select
                        className="form-select form-select-sm"
                        value={field.condition?.fieldName ?? ''}
                        onChange={(e) => setCondition({ fieldName: e.target.value })}
                      >
                        <option value="">-- Seleziona campo --</option>
                        {candidateFields.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-2">
                      <label className="form-label small">Condizione</label>
                      <select
                        className="form-select form-select-sm"
                        value={operator}
                        onChange={(e) =>
                          setCondition({ operator: e.target.value as ConditionOperator })
                        }
                      >
                        <option value="equals">è uguale a</option>
                        <option value="not_equals">è diverso da</option>
                        <option value="not_empty">non è vuoto</option>
                        <option value="empty">è vuoto</option>
                      </select>
                    </div>

                    {needsValue && (
                      <div className="mb-2">
                        <label className="form-label small">Valore</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={field.condition?.value ?? ''}
                          onChange={(e) => setCondition({ value: e.target.value })}
                          placeholder="Valore atteso..."
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        );
      })()}

      <style jsx>{`
        .field-editor {
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
