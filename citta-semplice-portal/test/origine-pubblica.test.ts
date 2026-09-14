import { afterEach, describe, expect, it, vi } from 'vitest';

import { originPubblica } from '../src/lib/auth/origine-pubblica';

// Nel container standalone è questa l'origin che Next attribuisce alla richiesta.
const richiestaStandalone = { nextUrl: { origin: 'http://0.0.0.0:3000' } };

describe('originPubblica', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('usa NEXTAUTH_URL al posto dell’indirizzo di ascolto del server', () => {
    vi.stubEnv('AUTH_URL', '');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3001');

    expect(originPubblica(richiestaStandalone)).toBe('http://localhost:3001');
  });

  it('dà precedenza ad AUTH_URL, come Auth.js', () => {
    vi.stubEnv('AUTH_URL', 'https://servizi.comune.catania.it');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3001');

    expect(originPubblica(richiestaStandalone)).toBe('https://servizi.comune.catania.it');
  });

  it('scarta percorso e query della variabile, tenendo solo l’origin', () => {
    vi.stubEnv('AUTH_URL', '');
    vi.stubEnv('NEXTAUTH_URL', 'https://servizi.comune.catania.it/portale/?x=1');

    expect(originPubblica(richiestaStandalone)).toBe('https://servizi.comune.catania.it');
  });

  it('senza configurazione ripiega sull’origin della richiesta', () => {
    vi.stubEnv('AUTH_URL', '');
    vi.stubEnv('NEXTAUTH_URL', '');

    expect(originPubblica({ nextUrl: { origin: 'http://localhost:3001' } })).toBe(
      'http://localhost:3001',
    );
  });
});
