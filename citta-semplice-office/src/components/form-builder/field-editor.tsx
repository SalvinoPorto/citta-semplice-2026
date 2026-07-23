'use client';

import { useState } from 'react';
import {
  FormField,
  FieldOption,
  FieldValidation,
  ConditionOperator,
  CONTAINER_TYPE,
  catenaContenitori,
} from './types';
import { Input, Select, Textarea } from '@/components/ui';
import { ConditionBuilder } from './condition-builder';

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'è uguale a',
  not_equals: 'è diverso da',
  not_empty: 'non è vuoto',
  empty: 'è vuoto',
};

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

  const setValidation = (patch: Partial<FieldValidation>) =>
    onUpdate({ ...field, validation: { ...field.validation, ...patch } });

  // Campi utilizzabili come sorgente di una condizione (visibilità o obbligo).
  const candidateFields = allFields.filter(
    (f) =>
      f.id !== field.id &&
      !['heading', 'section', 'paragraph', 'divider', 'pagebreak', 'hidden'].includes(f.type),
  );

  const isInputField = ['text', 'textarea', 'number', 'email', 'tel', 'date', 'time', 'datetime'].includes(
    field.type
  );
  const hasOptions = ['select', 'radio'].includes(field.type);
  const isLayoutField = ['heading', 'section', 'paragraph', 'divider', 'pagebreak'].includes(field.type);

  // Il pagebreak non ha proprietà oltre al titolo della pagina che apre.
  if (field.type === 'pagebreak') {
    return (
      <div className="field-editor">
        <div className="mb-3">
          <label className="form-label small fw-bold">Titolo della pagina</label>
          <input
            type="text"
            className="form-control form-control-sm"
            value={field.label}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Es. Dati di residenza"
          />
          <small className="text-muted">
            Mostrato al cittadino come titolo della pagina che inizia da qui.
          </small>
        </div>
      </div>
    );
  }

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
        {allFields.some((f) => f.id !== field.id && f.name && f.name === field.name) ? (
          <small className="text-danger">
            Nome già usato da un altro campo: i valori si sovrascrivono e le condizioni
            diventano ambigue.
          </small>
        ) : (
          <small className="text-muted">Usato per identificare il campo nel form</small>
        )}
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
            {field.type === 'heading' ? 'Testo Titolo' : field.type === 'section' ? 'Etichetta Sezione' : 'Contenuto'}
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

      {/* Valore predefinito per select/radio */}
      {hasOptions && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Valore predefinito</label>
          <select
            className="form-select form-select-sm"
            value={field.defaultValue ?? ''}
            onChange={(e) => handleChange('defaultValue', e.target.value || undefined)}
          >
            <option value="">-- Nessuno --</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label || o.value} ({o.value})
              </option>
            ))}
          </select>
          <small className="text-muted">Opzione preselezionata all'apertura del modulo.</small>
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
            {/*  
            <option value="full">Intera riga</option>
            <option value="half">Metà riga</option>
            <option value="twothirds">Due terzi</option>
            <option value="third">Un terzo</option> 
            */}
            <option value="12">12 - Intera riga</option>
            <option value="10">10 colonne</option>
            <option value="9">9 - Tre quarti</option>
            <option value="8">8 - Due terzi</option>
            <option value="6">6 - Metà riga</option>
            <option value="4">4 - Un terzo</option>
            <option value="3">3 - Un quarto</option>
            <option value="2">2 - Due colonne</option>
            <option value="1">1 - Una colonna</option>            
          </select>
        </div>
      )}

      <hr />

      {/* Validation */}
      {!isLayoutField && field.type !== 'hidden' && (
        <>
          <h6 className="mb-3">Validazione</h6>

          <div className="mb-3">
            <label className="form-label small fw-bold d-block">Obbligatorietà</label>
            {(() => {
              const mode: 'never' | 'always' | 'conditional' = field.validation?.requiredCondition
                ? 'conditional'
                : field.validation?.required
                  ? 'always'
                  : 'never';
              const setMode = (m: 'never' | 'always' | 'conditional') => {
                if (m === 'never') setValidation({ required: false, requiredCondition: undefined });
                else if (m === 'always') setValidation({ required: true, requiredCondition: undefined });
                else
                  setValidation({
                    required: false,
                    requiredCondition: { fieldName: '', operator: 'equals', value: '' },
                  });
              };
              return (
                <>
                  <div className="form-check">
                    <input
                      type="radio"
                      className="form-check-input"
                      id="req_never"
                      name="requiredMode"
                      checked={mode === 'never'}
                      onChange={() => setMode('never')}
                    />
                    <label className="form-check-label" htmlFor="req_never">Mai</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="radio"
                      className="form-check-input"
                      id="req_always"
                      name="requiredMode"
                      checked={mode === 'always'}
                      onChange={() => setMode('always')}
                    />
                    <label className="form-check-label" htmlFor="req_always">Sempre</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="radio"
                      className="form-check-input"
                      id="req_conditional"
                      name="requiredMode"
                      checked={mode === 'conditional'}
                      onChange={() => setMode('conditional')}
                    />
                    <label className="form-check-label" htmlFor="req_conditional">Solo se…</label>
                  </div>
                  {mode === 'conditional' && (
                    <div className="mt-2 ps-3 border-start">
                      <ConditionBuilder
                        condition={field.validation!.requiredCondition!}
                        candidateFields={candidateFields}
                        onChange={(c) => setValidation({ requiredCondition: c })}
                      />
                    </div>
                  )}
                </>
              );
            })()}
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

      {/* Contenitore */}
      {(() => {
        // Un contenitore non può finire dentro se stesso o dentro un proprio discendente.
        const discendenti = new Set<string>([field.id]);
        let cresciuto = true;
        while (cresciuto) {
          cresciuto = false;
          for (const f of allFields) {
            if (f.parentId && discendenti.has(f.parentId) && !discendenti.has(f.id)) {
              discendenti.add(f.id);
              cresciuto = true;
            }
          }
        }
        const sezioni = allFields.filter(
          (f) => f.type === CONTAINER_TYPE && !discendenti.has(f.id)
        );
        const catena = catenaContenitori(field, allFields);
        const ereditate = catena.filter((c) => c.condition?.fieldName);

        return (
          <>
            <hr />
            <h6 className="mb-3">Contenitore</h6>
            {sezioni.length === 0 ? (
              <small className="text-muted">
                Aggiungi una Sezione al form per poterci inserire questo campo.
              </small>
            ) : (
              <>
                <Select
                  label="Appartiene alla sezione"
                  value={field.parentId ?? ''}
                  onChange={(e) =>
                    onUpdate({ ...field, parentId: e.target.value || undefined })
                  }
                  options={[
                    { value: '', label: '-- Nessuna --' },
                    ...sezioni.map((s) => ({
                      value: s.id,
                      label: `${s.name || '(sezione senza nome)'}${s.label ? ` — ${s.label}` : ''}`,
                    })),
                  ]}
                />
                {ereditate.length > 0 && (
                  <div className="alert alert-info py-2 px-3 small mt-2 mb-0">
                    Eredita la visibilità dalla sezione:{' '}
                    {ereditate
                      .map(
                        (c) =>
                          `"${c.name}" (${c.condition!.fieldName} ${OPERATOR_LABELS[c.condition!.operator]}${c.condition!.value ? ` "${c.condition!.value}"` : ''})`
                      )
                      .join(' + ')}
                    . Non serve ripetere la condizione sul campo.
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}

      {/* Conditional Visibility */}
      {(() => {
        const hasCondition = !!field.condition;

        return (
          <>
            <hr />
            <h6 className="mb-3">Visibilità Condizionale</h6>
            {field.type === CONTAINER_TYPE && (
              <p className="text-muted small">
                La condizione di una sezione si applica anche a tutti i campi che le
                appartengono.
              </p>
            )}
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
              <ConditionBuilder
                condition={field.condition!}
                candidateFields={candidateFields}
                onChange={(c) => onUpdate({ ...field, condition: c })}
              />
            )}
          </>
        );
      })()}

      <style>{`
        .field-editor {
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
