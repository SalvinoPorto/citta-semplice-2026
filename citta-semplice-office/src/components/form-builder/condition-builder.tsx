'use client';

import { FormField, FieldCondition, ConditionOperator } from './types';

interface ConditionBuilderProps {
  condition: FieldCondition;
  candidateFields: FormField[];
  onChange: (condition: FieldCondition) => void;
}

/**
 * Editor di una singola condizione (campo sorgente + operatore + valore).
 * Estratto dalla sezione Visibilità per essere riusato dall'Obbligatorietà.
 * Identifica la sorgente per `fieldId` (stabile alla rinomina), tenendo
 * allineato `fieldName` con cui i valori sono indicizzati a runtime.
 */
export function ConditionBuilder({ condition, candidateFields, onChange }: ConditionBuilderProps) {
  const operator = condition.operator ?? 'equals';
  const needsValue = operator === 'equals' || operator === 'not_equals';

  const sorgente =
    candidateFields.find((f) => f.id === condition.fieldId) ??
    candidateFields.find((f) => f.name && f.name === condition.fieldName);

  const setCondition = (patch: Partial<FieldCondition>) =>
    onChange({
      fieldId: condition.fieldId,
      fieldName: condition.fieldName ?? '',
      operator: condition.operator ?? 'equals',
      value: condition.value,
      ...patch,
    });

  const setSorgente = (id: string) => {
    const f = candidateFields.find((c) => c.id === id);
    // Cambiare campo sorgente invalida il valore atteso.
    setCondition({ fieldId: f?.id, fieldName: f?.name ?? '', value: '' });
  };

  if (candidateFields.length === 0) {
    return (
      <small className="text-muted">
        Aggiungi altri campi al form per usare le condizioni.
      </small>
    );
  }

  return (
    <>
      <div className="mb-2">
        <label className="form-label small">Campo</label>
        <select
          className="form-select form-select-sm"
          value={sorgente?.id ?? ''}
          onChange={(e) => setSorgente(e.target.value)}
        >
          <option value="">-- Seleziona campo --</option>
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
          onChange={(e) => setCondition({ operator: e.target.value as ConditionOperator })}
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
            <select
              className="form-select form-select-sm"
              value={condition.value ?? ''}
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
              value={condition.value ?? ''}
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
              value={condition.value ?? ''}
              onChange={(e) => setCondition({ value: e.target.value })}
              placeholder="Valore atteso..."
            />
          )}
        </div>
      )}
    </>
  );
}
