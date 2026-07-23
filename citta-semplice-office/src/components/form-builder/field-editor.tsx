'use client';

import { useState } from 'react';
import {
  FormField,
  FieldOption,
  FieldCondition,
  ConditionOperator,
  CONTAINER_TYPE,
  catenaContenitori,
} from './types';
import { Input, Select, Textarea } from '@/components/ui';

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
        const candidateFields = allFields.filter(
          (f) =>
            f.id !== field.id &&
            !['heading', 'section', 'paragraph', 'divider', 'pagebreak', 'hidden'].includes(f.type)
        );
        const hasCondition = !!field.condition;
        const operator = field.condition?.operator ?? 'equals';
        const needsValue = operator === 'equals' || operator === 'not_equals';

        // La condizione punta al campo per id; il name viene tenuto allineato
        // perché a runtime i valori del form sono indicizzati per nome.
        const sorgente =
          candidateFields.find((f) => f.id === field.condition?.fieldId) ??
          // Schemi salvati prima di `fieldId`: si risale dal nome.
          candidateFields.find((f) => f.name && f.name === field.condition?.fieldName);

        const setCondition = (patch: Partial<NonNullable<FormField['condition']>>) =>
          onUpdate({
            ...field,
            condition: {
              fieldId: field.condition?.fieldId,
              fieldName: field.condition?.fieldName ?? '',
              operator: field.condition?.operator ?? 'equals',
              value: field.condition?.value,
              ...patch,
            },
          });

        const setSorgente = (id: string) => {
          const f = candidateFields.find((c) => c.id === id);
          // Cambiare campo sorgente invalida il valore atteso.
          setCondition({ fieldId: f?.id, fieldName: f?.name ?? '', value: '' });
        };

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
                        value={sorgente?.id ?? ''}
                        onChange={(e) => setSorgente(e.target.value)}
                      >
                        <option value="">-- Seleziona campo --</option>
                        {/* Si identifica il campo per name: le etichette possono
                            ripetersi, il name no. */}
                        {candidateFields.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name || `(${f.type} senza nome)`}
                            {f.label ? ` — ${f.label}` : ''}
                          </option>
                        ))}
                      </select>
                      {sorgente && !sorgente.name && (
                        <small className="text-danger">
                          Il campo selezionato non ha un Nome Campo (ID): assegnaglielo,
                          altrimenti la condizione non può essere valutata.
                        </small>
                      )}
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
                        {sorgente?.options?.length ? (
                          // Il confronto avviene sul `value` dell'opzione, non
                          // sull'etichetta: si sceglie dalla lista per non sbagliarlo.
                          <select
                            className="form-select form-select-sm"
                            value={field.condition?.value ?? ''}
                            onChange={(e) => setCondition({ value: e.target.value })}
                          >
                            <option value="">-- Seleziona valore --</option>
                            {sorgente.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label || o.value} ({o.value})
                              </option>
                            ))}
                          </select>
                        ) : sorgente?.type === 'checkbox' ? (
                          <select
                            className="form-select form-select-sm"
                            value={field.condition?.value ?? ''}
                            onChange={(e) => setCondition({ value: e.target.value })}
                          >
                            <option value="">-- Seleziona valore --</option>
                            <option value="true">Selezionato</option>
                            <option value="false">Non selezionato</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={field.condition?.value ?? ''}
                            onChange={(e) => setCondition({ value: e.target.value })}
                            placeholder="Valore atteso..."
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
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
