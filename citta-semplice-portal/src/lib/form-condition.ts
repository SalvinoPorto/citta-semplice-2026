type ConditionOperator = 'equals' | 'not_equals' | 'not_empty' | 'empty';

export interface FieldCondition {
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

export function isFieldVisible(
  campo: { condition?: FieldCondition | null },
  values: Record<string, unknown>,
): boolean {
  if (!campo.condition?.fieldName) return true;
  return evaluateCondition(campo.condition, values);
}
