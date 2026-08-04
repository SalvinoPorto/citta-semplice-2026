import { describe, it, expect } from 'vitest';
import { costruisciRiepilogo } from '../src/riepilogo';
import type { FormField } from '../src/types';

const campo = (over: Partial<FormField> & { id: string; name: string; type: FormField['type'] }): FormField => ({
  label: over.name,
  ...over,
});

/** `valore` di test: legge da una mappa nome->valore; assente o vuota => omesso dal riepilogo. */
const valoreDa = (dati: Record<string, string>) => (c: FormField) => {
  const v = dati[c.name];
  return v ? { label: c.label, value: v } : null;
};

describe('costruisciRiepilogo', () => {
  it('emette il titolo di una sezione che ha almeno un figlio valorizzato', () => {
    const campi = [
      campo({ id: 'sez', name: 'sezione', type: 'section', label: 'Dati anagrafici' }),
      campo({ id: 'nome', name: 'nome', type: 'text' }),
    ];
    const voci = costruisciRiepilogo(campi, valoreDa({ nome: 'Mario' }));
    expect(voci).toEqual([
      { kind: 'titolo', label: 'Dati anagrafici' },
      { kind: 'campo', name: 'nome', label: 'nome', value: 'Mario' },
    ]);
  });

  it('scarta il titolo di una sezione senza alcun figlio valorizzato', () => {
    const campi = [
      campo({ id: 'sez', name: 'sezione', type: 'section', label: 'Dati anagrafici' }),
      campo({ id: 'nome', name: 'nome', type: 'text' }),
    ];
    // 'nome' non e nella mappa dati: `valore` restituisce null, il titolo resta
    // in sospeso e non viene mai emesso.
    const voci = costruisciRiepilogo(campi, valoreDa({}));
    expect(voci).toEqual([]);
  });

  it('annidamento per parentId: i titoli esterno e interno vengono emessi entrambi, in ordine, davanti al primo figlio valorizzato', () => {
    const campi = [
      campo({ id: 'est', name: 'esterna', type: 'section', label: 'Sezione esterna' }),
      campo({ id: 'int', name: 'interna', type: 'section', label: 'Sezione interna', parentId: 'est' }),
      campo({ id: 'nome', name: 'nome', type: 'text', parentId: 'int' }),
    ];
    const voci = costruisciRiepilogo(campi, valoreDa({ nome: 'Mario' }));
    expect(voci).toEqual([
      { kind: 'titolo', label: 'Sezione esterna' },
      { kind: 'titolo', label: 'Sezione interna' },
      { kind: 'campo', name: 'nome', label: 'nome', value: 'Mario' },
    ]);
  });

  it('un titolo non annidato (parentId non corrispondente) scarica dallo stack i titoli in sospeso non ancora seguiti da un campo', () => {
    // 'a' e 'b' sono allo stesso livello (nessun parentId): quando arriva 'b',
    // il top dello stack ('a') non ha id === b.parentId (undefined), quindi
    // viene scaricato senza mai essere emesso.
    const campi = [
      campo({ id: 'a', name: 'a', type: 'section', label: 'Titolo A' }),
      campo({ id: 'b', name: 'b', type: 'section', label: 'Titolo B' }),
      campo({ id: 'c', name: 'c', type: 'text' }),
    ];
    const voci = costruisciRiepilogo(campi, valoreDa({ c: 'valore' }));
    expect(voci).toEqual([
      { kind: 'titolo', label: 'Titolo B' },
      { kind: 'campo', name: 'c', label: 'c', value: 'valore' },
    ]);
  });

  it('un titolo con label vuota (anche solo spazi) non entra mai in sospeso', () => {
    const campi = [
      campo({ id: 'sez', name: 'sezione', type: 'section', label: '   ' }),
      campo({ id: 'nome', name: 'nome', type: 'text' }),
    ];
    const voci = costruisciRiepilogo(campi, valoreDa({ nome: 'Mario' }));
    expect(voci).toEqual([{ kind: 'campo', name: 'nome', label: 'nome', value: 'Mario' }]);
  });

  it('scarta i campi di tipo SKIP (es. hidden, file) anche quando `valore` restituirebbe un dato', () => {
    const campi = [
      campo({ id: 'h', name: 'nascosto', type: 'hidden' }),
      campo({ id: 'f', name: 'allegato', type: 'file' }),
    ];
    // `valore` risponderebbe con un dato per entrambi, se venisse interpellato.
    const voci = costruisciRiepilogo(campi, () => ({ label: 'x', value: 'y' }));
    expect(voci).toEqual([]);
  });

  it('ignora le voci falsy nell\'elenco dei campi', () => {
    const campi = [null, undefined, campo({ id: 'nome', name: 'nome', type: 'text' })] as unknown as FormField[];
    const voci = costruisciRiepilogo(campi, valoreDa({ nome: 'Mario' }));
    expect(voci).toEqual([{ kind: 'campo', name: 'nome', label: 'nome', value: 'Mario' }]);
  });
});
