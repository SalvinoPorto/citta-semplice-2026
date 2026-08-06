import { describe, it, expect } from 'vitest';
import { pianoRinumerazione } from '../src/app/(dashboard)/amministrazione/servizi/ordini';

describe('pianoRinumerazione', () => {
  it('assegna ordini densi 1..n nell ordine del form', () => {
    const piano = pianoRinumerazione([{ id: 10 }, { id: 11 }, { id: 12 }]);
    expect(piano.finali).toEqual([
      { id: 10, ordine: 1 },
      { id: 11, ordine: 2 },
      { id: 12, ordine: 3 },
    ]);
  });

  it('passa da ordini temporanei negativi, che non possono collidere con quelli finali', () => {
    const piano = pianoRinumerazione([{ id: 10 }, { id: 11 }]);
    expect(piano.temporanei.every((t) => t.ordine < 0)).toBe(true);
    // Nessun ordine temporaneo coincide con un ordine finale: è ciò che rende
    // impossibile la collisione durante la riscrittura sequenziale.
    const finali = new Set(piano.finali.map((f) => f.ordine));
    expect(piano.temporanei.some((t) => finali.has(t.ordine))).toBe(false);
  });

  it('assegna un temporaneo distinto a ogni step', () => {
    const piano = pianoRinumerazione([{ id: 10 }, { id: 11 }, { id: 12 }]);
    const ordini = piano.temporanei.map((t) => t.ordine);
    expect(new Set(ordini).size).toBe(ordini.length);
  });

  it('gestisce l elenco vuoto senza produrre istruzioni', () => {
    const piano = pianoRinumerazione([]);
    expect(piano.temporanei).toEqual([]);
    expect(piano.finali).toEqual([]);
  });
});
