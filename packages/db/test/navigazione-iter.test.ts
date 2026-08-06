import { describe, it, expect } from 'vitest';
import {
  prossimoStepStessaFase,
  prossimaFase,
  stepPrecedenteStessaFase,
  fasePrecedente,
  type StepPerNavigazione,
  type FasePerNavigazione,
} from '../src/navigazione-iter';

describe('prossimoStepStessaFase', () => {
  it('salta i buchi negli ordini invece di fermarsi', () => {
    const steps: StepPerNavigazione[] = [
      { faseId: 1, ordine: 1 },
      { faseId: 1, ordine: 5 }, // buco fra 1 e 5
    ];
    // Con l'aritmetica `ordine + 1` qui non si troverebbe nulla e
    // l'avanzamento cadrebbe nel ramo "cambio fase", in silenzio.
    expect(prossimoStepStessaFase(steps, 1, 1)).toEqual({ faseId: 1, ordine: 5 });
  });

  it('ignora gli step disattivati', () => {
    const steps: StepPerNavigazione[] = [
      { faseId: 1, ordine: 1 },
      { faseId: 1, ordine: 2, attivo: false },
      { faseId: 1, ordine: 3 },
    ];
    expect(prossimoStepStessaFase(steps, 1, 1)).toEqual({ faseId: 1, ordine: 3 });
  });

  it('restituisce undefined sull ultimo step della fase', () => {
    const steps: StepPerNavigazione[] = [{ faseId: 1, ordine: 1 }];
    expect(prossimoStepStessaFase(steps, 1, 1)).toBeUndefined();
  });

  it('non attraversa la fase: uno step con ordine maggiore in una fase diversa non conta', () => {
    const steps: StepPerNavigazione[] = [
      { faseId: 1, ordine: 1 },
      { faseId: 2, ordine: 2 },
    ];
    expect(prossimoStepStessaFase(steps, 1, 1)).toBeUndefined();
  });
});

describe('prossimaFase', () => {
  it('salta i buchi negli ordini fra fasi', () => {
    const fasi: FasePerNavigazione[] = [{ ordine: 1 }, { ordine: 4 }];
    expect(prossimaFase(fasi, 1)).toEqual({ ordine: 4 });
  });

  it('restituisce undefined dopo l ultima fase', () => {
    const fasi: FasePerNavigazione[] = [{ ordine: 1 }];
    expect(prossimaFase(fasi, 1)).toBeUndefined();
  });

  it('con ordine corrente 0 (nessuna fase corrente) restituisce la prima fase, non la seconda', () => {
    // Copre la correzione del default `?? 1` → `?? 0`: con `?? 1` un'istanza
    // priva di fase corrente cercava la fase di ordine 2, saltando la prima.
    const fasi: FasePerNavigazione[] = [{ ordine: 1 }, { ordine: 2 }];
    expect(prossimaFase(fasi, 0)).toEqual({ ordine: 1 });
  });
});

describe('stepPrecedenteStessaFase', () => {
  it('trova l ultimo step con ordine minore nella stessa fase, saltando i buchi', () => {
    const steps: StepPerNavigazione[] = [
      { faseId: 1, ordine: 1 },
      { faseId: 1, ordine: 5 },
      { faseId: 1, ordine: 9 },
    ];
    expect(stepPrecedenteStessaFase(steps, 1, 9)).toEqual({ faseId: 1, ordine: 5 });
  });

  it('ignora gli step disattivati', () => {
    const steps: StepPerNavigazione[] = [
      { faseId: 1, ordine: 1 },
      { faseId: 1, ordine: 2, attivo: false },
      { faseId: 1, ordine: 3 },
    ];
    expect(stepPrecedenteStessaFase(steps, 1, 3)).toEqual({ faseId: 1, ordine: 1 });
  });

  it('restituisce undefined quando siamo al primo step attivo della fase', () => {
    const steps: StepPerNavigazione[] = [{ faseId: 1, ordine: 1 }];
    expect(stepPrecedenteStessaFase(steps, 1, 1)).toBeUndefined();
  });

  it('non attraversa la fase: uno step con ordine minore in una fase diversa non conta', () => {
    // Questo è il caso che regressWorkflow deve distinguere con un
    // messaggio diverso ("usa Rimanda a fase precedente"): la funzione pura
    // si limita a restituire undefined, la scelta del messaggio spetta al
    // chiamante.
    const steps: StepPerNavigazione[] = [
      { faseId: 1, ordine: 5 }, // fase precedente
      { faseId: 2, ordine: 6 }, // primo step della fase corrente
    ];
    expect(stepPrecedenteStessaFase(steps, 2, 6)).toBeUndefined();
  });
});

describe('fasePrecedente', () => {
  it('salta i buchi negli ordini invece di fermarsi (usata da rollbackFase)', () => {
    // Una fase eliminata lascia un buco: ordini 1, 3, 5. Con `ordine - 1`
    // la ricerca della fase precedente da ordine=5 cercherebbe ordine=4 e
    // non lo troverebbe, pur esistendo la fase di ordine 3.
    const fasi: FasePerNavigazione[] = [{ ordine: 1 }, { ordine: 3 }, { ordine: 5 }];
    expect(fasePrecedente(fasi, 5)).toEqual({ ordine: 3 });
  });

  it('restituisce undefined quando siamo alla prima fase, anche se gli ordini non partono da 1', () => {
    // Copre la rimozione della guardia `ordine <= 1`, che presumeva una
    // numerazione che parte da 1: qui la prima fase ha ordine 2.
    const fasi: FasePerNavigazione[] = [{ ordine: 2 }, { ordine: 4 }];
    expect(fasePrecedente(fasi, 2)).toBeUndefined();
  });

  it('trova la fase precedente anche quando gli ordini non partono da 1', () => {
    const fasi: FasePerNavigazione[] = [{ ordine: 2 }, { ordine: 4 }];
    expect(fasePrecedente(fasi, 4)).toEqual({ ordine: 2 });
  });
});
