import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          root: '.',
          environment: 'node',
          include: ['packages/*/test/**/*.test.ts'],
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

// Nota: `test/integration/**` non esiste ancora — la crea il Task 3 dello stesso
// piano. Fino ad allora `npm run test:integration` fallisce legittimamente con
// "No test files found" (exit 1): è uno stato transitorio atteso, non una
// rottura. Non abbiamo aggiunto `passWithNoTests` per non indebolire la
// garanzia che conta davvero — che `npm test` e `npm run test:unit` non
// possano MAI uscire con successo avendo eseguito zero test.
