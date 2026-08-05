import { describe, it, expect } from 'vitest';
import {
  whereStato,
  whereVisibileAgliOperatori,
  datiStato,
  sqlStato,
} from '../src/stato-istanza';

describe('whereStato', () => {
  it('accetta un singolo stato e lo normalizza a lista', () => {
    expect(whereStato('CONCLUSA')).toEqual({ stato: { in: ['CONCLUSA'] } });
  });

  it('accetta una lista di stati', () => {
    expect(whereStato(['CONCLUSA', 'RESPINTA'])).toEqual({
      stato: { in: ['CONCLUSA', 'RESPINTA'] },
    });
  });
});

describe('whereVisibileAgliOperatori', () => {
  it('esclude solo le bozze', () => {
    expect(whereVisibileAgliOperatori()).toEqual({ stato: { not: 'BOZZA' } });
  });
});

describe('datiStato', () => {
  it('restituisce il solo stato, senza più i booleani', () => {
    expect(datiStato('BOZZA')).toEqual({ stato: 'BOZZA' });
    expect(datiStato('IN_LAVORAZIONE')).toEqual({ stato: 'IN_LAVORAZIONE' });
    expect(datiStato('CONCLUSA')).toEqual({ stato: 'CONCLUSA' });
    expect(datiStato('RESPINTA')).toEqual({ stato: 'RESPINTA' });
  });
});

describe('sqlStato', () => {
  it('produce una condizione IN con gli stati fra apici', () => {
    expect(sqlStato(['CONCLUSA', 'RESPINTA'], 'i')).toBe(
      `i.stato IN ('CONCLUSA','RESPINTA')`,
    );
  });

  it('accetta un singolo stato', () => {
    expect(sqlStato('BOZZA', 'x')).toBe(`x.stato IN ('BOZZA')`);
  });
});
