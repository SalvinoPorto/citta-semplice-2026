import { describe, it, expect } from 'vitest';
import { getStatoIstanza } from '../src/lib/models/stato-istanza';

/**
 * `statoAttivita` è già testata in packages/db, ma nessun test ne esercitava
 * un CHIAMANTE: reintrodurre la derivazione inline qui dentro avrebbe lasciato
 * verdi tutti i test sulla funzione pura, semplicemente non più chiamata.
 */
describe('getStatoIstanza', () => {
  it('mostra "In Attesa" per un istanza in lavorazione non presa in carico', () => {
    expect(getStatoIstanza({
      stato: 'IN_LAVORAZIONE',
      attivitaCorrente: { id: 1, completataAt: null },
      attivitaCorrenteId: 1,
      assegnatarioId: null,
    })).toEqual({ label: 'In Attesa', variant: 'secondary' });
  });

  it('mostra "In Lavorazione" quando l istanza ha un assegnatario', () => {
    expect(getStatoIstanza({
      stato: 'IN_LAVORAZIONE',
      attivitaCorrente: { id: 1, completataAt: null },
      attivitaCorrenteId: 1,
      assegnatarioId: 42,
    })).toEqual({ label: 'In Lavorazione', variant: 'primary' });
  });

  it('lo stato terminale vince sull assegnazione', () => {
    expect(getStatoIstanza({
      stato: 'CONCLUSA',
      attivitaCorrente: { id: 1, completataAt: null },
      attivitaCorrenteId: 1,
      assegnatarioId: 42,
    })).toEqual({ label: 'Conclusa', variant: 'success' });
  });
});
