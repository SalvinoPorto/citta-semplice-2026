import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A livello di root: il progetto "integration" non ha ancora file (arriveranno
    // nel Task 3) e senza questo flag `vitest run --project integration` fallirebbe
    // con "No test files found" pur non essendoci nulla di rotto.
    passWithNoTests: true,
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
          passWithNoTests: true,
        },
      },
    ],
  },
});
