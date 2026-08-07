import { describe, it, expect } from 'vitest';
import { statoAttivita, ETICHETTE_STATO_ATTIVITA } from '../src/stato-attivita';

const CORRENTE = { id: 7, completataAt: null };
const CHIUSA = { id: 3, completataAt: new Date('2026-01-01T10:00:00Z') };

describe('statoAttivita', () => {
  it('è COMPLETATA quando completataAt è valorizzata, anche se è l attività corrente', () => {
    const stato = statoAttivita(
      { id: 7, completataAt: new Date('2026-01-01T10:00:00Z') },
      { attivitaCorrenteId: 7, assegnatarioId: 42 },
    );
    expect(stato).toBe('COMPLETATA');
  });

  it('è IN_LAVORAZIONE quando è l attività corrente e l istanza ha un assegnatario', () => {
    const stato = statoAttivita(CORRENTE, { attivitaCorrenteId: 7, assegnatarioId: 42 });
    expect(stato).toBe('IN_LAVORAZIONE');
  });

  it('è IN_ATTESA quando è l attività corrente e l istanza non è presa in carico', () => {
    const stato = statoAttivita(CORRENTE, { attivitaCorrenteId: 7, assegnatarioId: null });
    expect(stato).toBe('IN_ATTESA');
  });

  it('è RETROCESSA per un attività aperta che non è più la corrente', () => {
    // Il caso che il codice fabbricava con il valore sentinella -1: un
    // attività scavalcata da un rollback di fase senza essere mai chiusa.
    const stato = statoAttivita({ id: 5, completataAt: null }, { attivitaCorrenteId: 7, assegnatarioId: 42 });
    expect(stato).toBe('RETROCESSA');
  });

  it('non confonde l assegnatario dell istanza con il completamento di un altra attività', () => {
    // Regressione della doppia semantica di operatore_id: un istanza presa in
    // carico non rende "in lavorazione" le attività già chiuse.
    expect(statoAttivita(CHIUSA, { attivitaCorrenteId: 7, assegnatarioId: 42 })).toBe('COMPLETATA');
  });

  it('tratta un istanza senza attività corrente come non posizionata', () => {
    expect(statoAttivita(CORRENTE, { attivitaCorrenteId: null, assegnatarioId: null })).toBe('RETROCESSA');
  });

  it('espone un etichetta per ognuno dei quattro stati', () => {
    expect(ETICHETTE_STATO_ATTIVITA).toEqual({
      COMPLETATA: 'Completata',
      IN_LAVORAZIONE: 'In lavorazione',
      IN_ATTESA: 'In attesa',
      RETROCESSA: 'Retrocesso',
    });
  });
});
