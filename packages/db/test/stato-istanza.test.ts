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
  it('scrive enum e booleani coerenti per ogni stato', () => {
    expect(datiStato('BOZZA')).toEqual({
      stato: 'BOZZA', inBozza: true, conclusa: false, respinta: false,
    });
    expect(datiStato('IN_LAVORAZIONE')).toEqual({
      stato: 'IN_LAVORAZIONE', inBozza: false, conclusa: false, respinta: false,
    });
    expect(datiStato('CONCLUSA')).toEqual({
      stato: 'CONCLUSA', inBozza: false, conclusa: true, respinta: false,
    });
    expect(datiStato('RESPINTA')).toEqual({
      stato: 'RESPINTA', inBozza: false, conclusa: false, respinta: true,
    });
  });

  it('non produce mai due booleani veri insieme (vincolo istanze_stato_esclusivo_chk)', () => {
    const stati = ['BOZZA', 'IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA'] as const;
    for (const s of stati) {
      const d = datiStato(s);
      const veri = [d.inBozza, d.conclusa, d.respinta].filter(Boolean).length;
      expect(veri, `stato ${s}`).toBeLessThanOrEqual(1);
    }
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
