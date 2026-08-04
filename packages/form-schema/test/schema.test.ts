import { describe, it, expect } from 'vitest';
import {
  parseCampi,
  risolviGerarchia,
  risolviRiferimentiCondizioni,
  splitPages,
} from '../src/schema';
import type { FormField } from '../src/types';

const campo = (over: Partial<FormField> & { id: string; name: string }): FormField => ({
  type: 'text',
  label: over.name,
  ...over,
});

describe('parseCampi', () => {
  it('accetta sia il formato {fields:[...]} sia un array piatto', () => {
    const uno = parseCampi(JSON.stringify({ fields: [campo({ id: 'a', name: 'nome' })] }));
    const due = parseCampi(JSON.stringify([campo({ id: 'a', name: 'nome' })]));
    expect(uno).toHaveLength(1);
    expect(due).toHaveLength(1);
    expect(uno[0].name).toBe('nome');
  });

  it('restituisce un elenco vuoto su input nullo, vuoto o JSON non valido', () => {
    expect(parseCampi(null)).toEqual([]);
    expect(parseCampi(undefined)).toEqual([]);
    expect(parseCampi('')).toEqual([]);
    expect(parseCampi('{non json')).toEqual([]);
    expect(parseCampi(JSON.stringify({ altro: 1 }))).toEqual([]);
  });
});

describe('risolviRiferimentiCondizioni', () => {
  it('riallinea fieldName al nome corrente del campo puntato da fieldId', () => {
    const campi = [
      campo({ id: 'src', name: 'nome_nuovo' }),
      campo({
        id: 'dst',
        name: 'dipendente',
        condition: { fieldId: 'src', fieldName: 'nome_vecchio', operator: 'not_empty' },
      }),
    ];
    const out = risolviRiferimentiCondizioni(campi);
    expect(out[1].condition?.fieldName).toBe('nome_nuovo');
  });

  it('rimuove la condizione quando il campo sorgente non esiste piu', () => {
    const campi = [
      campo({
        id: 'dst',
        name: 'dipendente',
        condition: { fieldId: 'cancellato', fieldName: 'x', operator: 'not_empty' },
      }),
    ];
    expect(risolviRiferimentiCondizioni(campi)[0].condition).toBeUndefined();
  });

  it('lascia invariate le condizioni prive di fieldId (schemi antecedenti)', () => {
    const cond = { fieldName: 'legacy', operator: 'equals' as const, value: '1' };
    const campi = [campo({ id: 'a', name: 'a', condition: cond })];
    expect(risolviRiferimentiCondizioni(campi)[0].condition).toBe(cond);
  });
});

describe('risolviGerarchia', () => {
  it('propaga ai figli la condizione della sezione contenitore', () => {
    const campi = [
      campo({
        id: 'sez',
        name: 'sezione',
        type: 'section',
        condition: { fieldName: 'mostra', operator: 'equals', value: 'si' },
      }),
      campo({ id: 'figlio', name: 'figlio', parentId: 'sez' }),
    ];
    const out = risolviGerarchia(campi);
    expect(out[1].conditions).toEqual([
      { fieldName: 'mostra', operator: 'equals', value: 'si' },
    ]);
  });

  it('accumula le condizioni dal contenitore piu esterno al piu interno', () => {
    const campi = [
      campo({
        id: 'est',
        name: 'esterna',
        type: 'section',
        condition: { fieldName: 'a', operator: 'equals', value: '1' },
      }),
      campo({
        id: 'int',
        name: 'interna',
        type: 'section',
        parentId: 'est',
        condition: { fieldName: 'b', operator: 'equals', value: '2' },
      }),
      campo({ id: 'figlio', name: 'figlio', parentId: 'int' }),
    ];
    const conds = risolviGerarchia(campi)[2].conditions;
    expect(conds?.map((c) => c.fieldName)).toEqual(['a', 'b']);
  });

  it('non entra in ciclo su una gerarchia malformata', () => {
    const campi = [
      campo({ id: 'a', name: 'a', type: 'section', parentId: 'b' }),
      campo({ id: 'b', name: 'b', type: 'section', parentId: 'a' }),
    ];
    expect(() => risolviGerarchia(campi)).not.toThrow();
  });
});

describe('splitPages', () => {
  it('produce una sola pagina se non ci sono pagebreak', () => {
    const pagine = splitPages([campo({ id: 'a', name: 'a' }), campo({ id: 'b', name: 'b' })]);
    expect(pagine).toHaveLength(1);
    expect(pagine[0].fields).toHaveLength(2);
  });

  it('usa il label del pagebreak come titolo della pagina che apre', () => {
    const pagine = splitPages([
      campo({ id: 'a', name: 'a' }),
      campo({ id: 'pb', name: 'pb', type: 'pagebreak', label: 'Seconda pagina' }),
      campo({ id: 'b', name: 'b' }),
    ]);
    expect(pagine).toHaveLength(2);
    expect(pagine[0].titolo).toBe('');
    expect(pagine[1].titolo).toBe('Seconda pagina');
  });

  it('scarta le pagine vuote generate da pagebreak consecutivi o ai bordi', () => {
    const pagine = splitPages([
      campo({ id: 'pb1', name: 'pb1', type: 'pagebreak', label: 'Uno' }),
      campo({ id: 'pb2', name: 'pb2', type: 'pagebreak', label: 'Due' }),
      campo({ id: 'a', name: 'a' }),
    ]);
    expect(pagine).toHaveLength(1);
    expect(pagine[0].titolo).toBe('Due');
  });

  it('restituisce una pagina unica vuota su elenco vuoto', () => {
    expect(splitPages([])).toEqual([{ titolo: '', fields: [] }]);
  });
});
