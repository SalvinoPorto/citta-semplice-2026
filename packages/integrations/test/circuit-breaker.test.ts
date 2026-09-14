import { describe, expect, it } from 'vitest';

import { CircuitBreaker } from '../src/circuit-breaker';

/**
 * L'orologio è simulato: il comportamento da provare è temporale, e un test
 * appeso al tempo reale sarebbe lento e ballerino.
 */
function conOrologio(soglia = 3, raffreddamentoMs = 1000) {
  let ora = 0;
  const breaker = new CircuitBreaker({
    soglia,
    raffreddamentoMs,
    adesso: () => ora,
  });
  return { breaker, avanza: (ms: number) => (ora += ms) };
}

describe('CircuitBreaker', () => {
  it('parte chiuso e lascia passare', () => {
    const { breaker } = conOrologio();
    expect(breaker.stato()).toBe('chiuso');
    expect(breaker.consentito()).toBe(true);
  });

  it('resta chiuso finché i fallimenti non raggiungono la soglia', () => {
    const { breaker } = conOrologio(3);
    breaker.registraFallimento();
    breaker.registraFallimento();
    expect(breaker.stato()).toBe('chiuso');
    expect(breaker.consentito()).toBe(true);
  });

  it('apre al raggiungimento della soglia e blocca', () => {
    const { breaker } = conOrologio(3);
    breaker.registraFallimento();
    breaker.registraFallimento();
    breaker.registraFallimento();
    expect(breaker.stato()).toBe('aperto');
    expect(breaker.consentito()).toBe(false);
  });

  it('un successo azzera il conteggio: fallimenti alternati non aprono', () => {
    const { breaker } = conOrologio(3);
    breaker.registraFallimento();
    breaker.registraFallimento();
    breaker.registraSuccesso();
    breaker.registraFallimento();
    breaker.registraFallimento();
    expect(breaker.stato()).toBe('chiuso');
  });

  it('passa a semiaperto quando il raffreddamento è scaduto', () => {
    const { breaker, avanza } = conOrologio(2, 1000);
    breaker.registraFallimento();
    breaker.registraFallimento();
    expect(breaker.consentito()).toBe(false);

    avanza(999);
    expect(breaker.stato()).toBe('aperto');

    avanza(1);
    expect(breaker.stato()).toBe('semiaperto');
    // In semiaperto si concede il tentativo di prova.
    expect(breaker.consentito()).toBe(true);
  });

  it('un successo in semiaperto richiude del tutto il circuito', () => {
    const { breaker, avanza } = conOrologio(2, 1000);
    breaker.registraFallimento();
    breaker.registraFallimento();
    avanza(1000);

    breaker.registraSuccesso();

    expect(breaker.stato()).toBe('chiuso');
    expect(breaker.consentito()).toBe(true);
  });

  it('un solo fallimento in semiaperto riapre subito, senza riconcedere la soglia intera', () => {
    const { breaker, avanza } = conOrologio(2, 1000);
    breaker.registraFallimento();
    breaker.registraFallimento();
    avanza(1000);
    expect(breaker.stato()).toBe('semiaperto');

    // La prova fallisce: il servizio non si è ripreso.
    breaker.registraFallimento();

    expect(breaker.stato()).toBe('aperto');
    expect(breaker.consentito()).toBe(false);
    // E il nuovo raffreddamento riparte da adesso.
    avanza(999);
    expect(breaker.stato()).toBe('aperto');
    avanza(1);
    expect(breaker.stato()).toBe('semiaperto');
  });
});
