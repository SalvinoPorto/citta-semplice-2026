import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  condizioniEffettive,
  isFieldVisible,
  requiredEffettivo,
} from '../src/condizioni';

describe('evaluateCondition', () => {
  it('confronta i booleani dopo averli normalizzati a stringa', () => {
    expect(
      evaluateCondition({ fieldName: 'consenso', operator: 'equals', value: 'true' }, { consenso: true }),
    ).toBe(true);
    expect(
      evaluateCondition({ fieldName: 'consenso', operator: 'equals', value: 'false' }, { consenso: false }),
    ).toBe(true);
  });

  it('tratta un campo assente come stringa vuota', () => {
    expect(evaluateCondition({ fieldName: 'assente', operator: 'empty' }, {})).toBe(true);
    expect(evaluateCondition({ fieldName: 'assente', operator: 'not_empty' }, {})).toBe(false);
  });

  it('considera vuota anche la stringa letterale "undefined"', () => {
    // Caratterizzazione di una stranezza voluta: valori serializzati male a
    // monte arrivano come "undefined" e non devono contare come compilati.
    expect(evaluateCondition({ fieldName: 'x', operator: 'empty' }, { x: 'undefined' })).toBe(true);
  });

  it('equipara un value mancante alla stringa vuota', () => {
    expect(evaluateCondition({ fieldName: 'x', operator: 'equals' }, { x: '' })).toBe(true);
    expect(evaluateCondition({ fieldName: 'x', operator: 'not_equals' }, { x: 'a' })).toBe(true);
  });
});

describe('condizioniEffettive', () => {
  it('mette le condizioni ereditate prima di quella propria', () => {
    const ereditata = { fieldName: 'sezione', operator: 'equals' as const, value: 'si' };
    const propria = { fieldName: 'campo', operator: 'not_empty' as const };
    expect(condizioniEffettive({ condition: propria, conditions: [ereditata] })).toEqual([
      ereditata,
      propria,
    ]);
  });

  it('scarta le condizioni prive di fieldName', () => {
    expect(condizioniEffettive({ condition: { fieldName: '', operator: 'empty' } })).toEqual([]);
  });
});

describe('isFieldVisible', () => {
  it('richiede che tutte le condizioni siano vere (AND)', () => {
    const campo = {
      condition: { fieldName: 'b', operator: 'equals' as const, value: '2' },
      conditions: [{ fieldName: 'a', operator: 'equals' as const, value: '1' }],
    };
    expect(isFieldVisible(campo, { a: '1', b: '2' })).toBe(true);
    expect(isFieldVisible(campo, { a: '1', b: 'altro' })).toBe(false);
    expect(isFieldVisible(campo, { a: 'altro', b: '2' })).toBe(false);
  });

  it('e visibile quando non ha alcuna condizione', () => {
    expect(isFieldVisible({}, {})).toBe(true);
  });
});

describe('requiredEffettivo', () => {
  it('e obbligatorio quando required e true, senza valutare la condizione', () => {
    // requiredCondition qui sarebbe FALSA sui valori dati (tipo: 'privato' !=
    // 'azienda'): se requiredEffettivo la valutasse comunque, il risultato
    // sarebbe false. Il risultato atteso true dimostra lo short-circuit su
    // `required: true`.
    const campo = {
      validation: {
        required: true,
        requiredCondition: { fieldName: 'tipo', operator: 'equals' as const, value: 'azienda' },
      },
    };
    expect(requiredEffettivo(campo, { tipo: 'privato' })).toBe(true);
  });

  it('e obbligatorio solo se la requiredCondition e soddisfatta', () => {
    const campo = {
      validation: {
        requiredCondition: { fieldName: 'tipo', operator: 'equals' as const, value: 'azienda' },
      },
    };
    expect(requiredEffettivo(campo, { tipo: 'azienda' })).toBe(true);
    expect(requiredEffettivo(campo, { tipo: 'privato' })).toBe(false);
  });

  it('non e obbligatorio senza validation', () => {
    expect(requiredEffettivo({}, {})).toBe(false);
  });
});
