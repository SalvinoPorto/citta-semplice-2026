type ConditionOperator = 'equals' | 'not_equals' | 'not_empty' | 'empty';

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

export function evaluateCondition(condition: FieldCondition, values: Record<string, unknown>): boolean {
  const raw = values[condition.fieldName];
  const val = raw === true ? 'true' : raw === false ? 'false' : String(raw ?? '');
  switch (condition.operator) {
    case 'equals':     return val === (condition.value ?? '');
    case 'not_equals': return val !== (condition.value ?? '');
    case 'not_empty':  return val !== '' && val !== 'undefined';
    case 'empty':      return val === '' || val === 'undefined';
  }
}

/** Condizione propria del campo + quelle ereditate dai contenitori (in AND). */
export function condizioniEffettive(campo: {
  condition?: FieldCondition | null;
  conditions?: FieldCondition[];
}): FieldCondition[] {
  const proprie = campo.condition?.fieldName ? [campo.condition] : [];
  const ereditate = (campo.conditions ?? []).filter((c) => c?.fieldName);
  return [...ereditate, ...proprie];
}

/** True se il campo ha almeno una regola di visibilità (propria o ereditata). */
export function hasVisibilityRule(campo: {
  condition?: FieldCondition | null;
  conditions?: FieldCondition[];
}): boolean {
  return condizioniEffettive(campo).length > 0;
}

export function isFieldVisible(
  campo: { condition?: FieldCondition | null; conditions?: FieldCondition[] },
  values: Record<string, unknown>,
): boolean {
  return condizioniEffettive(campo).every((c) => evaluateCondition(c, values));
}

/**
 * Obbligo effettivo di un campo sui valori correnti: obbligatorio sempre
 * (`required === true`) oppure solo quando `requiredCondition` è vera. Non
 * tiene conto della visibilità: il chiamante applica l'obbligo ai soli campi
 * visibili.
 */
export function requiredEffettivo(
  campo: { validation?: { required?: boolean; requiredCondition?: FieldCondition } },
  values: Record<string, unknown>,
): boolean {
  if (campo.validation?.required === true) return true;
  const rc = campo.validation?.requiredCondition;
  return rc?.fieldName ? evaluateCondition(rc, values) : false;
}
