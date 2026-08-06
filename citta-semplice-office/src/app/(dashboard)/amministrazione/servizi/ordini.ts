/**
 * Piano di rinumerazione degli step di un servizio.
 *
 * Gli ordini sono globali sul servizio e devono risultare densi (1..n)
 * nell'ordine in cui il form li presenta. Riscriverli in sequenza produce
 * però collisioni transitorie: riordinando A(1), B(2) in B, A, la prima
 * UPDATE porterebbe B a 1 mentre A è ancora a 1. Con un indice univoco
 * questo fallisce, perché un indice unico non è differibile.
 *
 * Il piano passa quindi da ordini temporanei negativi, che non possono
 * coincidere con nessun ordine finale (sempre positivo): prima si spostano
 * tutti gli step fuori dallo spazio dei valori finali, poi li si porta a
 * destinazione. Entrambe le fasi vanno eseguite nella STESSA transazione.
 */
export interface StepDaRinumerare {
  id: number;
}

export interface PianoRinumerazione {
  temporanei: { id: number; ordine: number }[];
  finali: { id: number; ordine: number }[];
}

export function pianoRinumerazione(steps: StepDaRinumerare[]): PianoRinumerazione {
  return {
    temporanei: steps.map((s, i) => ({ id: s.id, ordine: -(i + 1) })),
    finali: steps.map((s, i) => ({ id: s.id, ordine: i + 1 })),
  };
}
