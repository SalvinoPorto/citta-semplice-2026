import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          root: '.',
          environment: 'node',
          // Copre sia i package condivisi (packages/*) sia il codice applicativo
          // delle due app (citta-semplice-office, citta-semplice-portal): chi
          // vorrà testare per esempio citta-semplice-portal/src/lib/form-validate.ts
          // può aggiungere citta-semplice-portal/test/**/*.test.ts senza dover
          // toccare questa configurazione. Nessun `passWithNoTests` qui né alla
          // radice: se uno di questi glob si rompe (typo, cartella spostata) e
          // smette di trovare file, la suite fallisce con "No test files found"
          // invece di uscire verde avendone eseguiti zero.
          include: ['packages/*/test/**/*.test.ts', 'citta-semplice-*/test/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          root: '.',
          environment: 'node',
          include: ['test/integration/**/*.test.ts'],
          // I container Postgres impiegano qualche secondo ad avviarsi.
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // Un solo container condiviso: i test di integrazione non girano in parallelo.
          fileParallelism: false,
        },
      },
    ],
  },
});

// Nota: `test/integration/**` esiste (vedi test/integration/postgres.ts e
// test/integration/schema.test.ts) e richiede Docker attivo per girare. Non
// abbiamo aggiunto `passWithNoTests` da nessuna parte per non indebolire la
// garanzia che conta davvero — che `npm test` e `npm run test:unit` non
// possano MAI uscire con successo avendo eseguito zero test.
