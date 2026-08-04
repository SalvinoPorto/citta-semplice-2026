# Fondamenta: harness di test e `packages/db` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dotare il monorepo di un harness di test eseguibile (unitario e di integrazione su Postgres reale) e consolidare le tre copie dello schema Prisma in un unico package `@citta/db`.

**Architecture:** Vitest alla radice del monorepo, con test unitari sui package puri (`@citta/form-schema`) e test di integrazione che girano contro un Postgres effimero via Testcontainers. Lo schema Prisma canonico e il client generato si spostano in `packages/db`, che office e portal consumano come dipendenza di workspace; `sync-schema.sh` e `check-schema-drift.sh` vengono eliminati perché il problema che risolvevano cessa di esistere.

**Tech Stack:** npm workspaces, TypeScript ~5.7, Vitest 3, Testcontainers (`@testcontainers/postgresql`), Prisma 7.7.0 con `@prisma/adapter-pg`, PostgreSQL, Next.js 16.2.9 / React 19.2.4.

## Global Constraints

- **Monorepo npm workspaces**: `packages/*`, `citta-semplice-office`, `citta-semplice-portal`, `citta-semplice-migrations`. Un solo `node_modules` e un solo `package-lock.json`, entrambi alla radice.
- **I package condivisi sono ESM sorgente, senza build step**: `"type": "module"`, `"exports": { ".": "./src/index.ts" }`. Seguire il modello di `packages/form-schema/package.json`.
- **Prisma 7.7.0** esatta (`prisma` devDep) con `@prisma/client` e `@prisma/adapter-pg` `^7.7.0`. Il client è generato in una cartella `generated/prisma`, **non** in `node_modules`.
- **Naming di dominio in italiano** (entità, colonne, commenti), coerente con il codice esistente. I nomi di tabella usano `@@map` in snake_case plurale.
- **Nessuna modifica di comportamento in questo piano.** Ogni test scritto qui è di *caratterizzazione*: cattura ciò che il codice fa oggi, inclusi i comportamenti che i piani successivi cambieranno deliberatamente. Se un test fallisce alla prima scrittura, è il test a essere sbagliato, non il codice.
- **Prerequisito Docker**: i test di integrazione richiedono un runtime Docker attivo (Docker Desktop su Windows). I test unitari non lo richiedono.

---

## File Structure

**Creati:**
- `vitest.config.ts` — configurazione unica alla radice, due progetti (`unit`, `integration`)
- `packages/form-schema/test/condizioni.test.ts` — test unitari sulla valutazione delle condizioni
- `packages/form-schema/test/schema.test.ts` — test unitari su parsing, gerarchia, paginazione
- `packages/db/package.json` — manifest del package `@citta/db`
- `packages/db/prisma/schema.prisma` — schema canonico (spostato dalla radice)
- `packages/db/src/index.ts` — export del client e dei tipi
- `packages/db/tsconfig.json`
- `test/integration/postgres.ts` — helper Testcontainers riusabile dai piani 2–4
- `test/integration/schema.test.ts` — verifica che lo schema si applichi a un DB vuoto

**Modificati:**
- `package.json` (radice) — script `test`, devDependencies di test
- `citta-semplice-office/package.json` — dipendenza `@citta/db`, rimozione script Prisma locali
- `citta-semplice-portal/package.json` — idem
- `citta-semplice-office/src/lib/db/prisma.ts` — re-export da `@citta/db`
- `citta-semplice-portal/src/lib/db/prisma.ts` — idem

**Eliminati:**
- `prisma/schema.prisma`, `citta-semplice-office/prisma/schema.prisma`, `citta-semplice-portal/prisma/schema.prisma` (le tre copie)
- `sync-schema.sh`, `check-schema-drift.sh`

---

## Task 1: Harness Vitest e primi test unitari

**Files:**
- Create: `vitest.config.ts`
- Create: `packages/form-schema/test/condizioni.test.ts`
- Modify: `package.json` (radice)

**Interfaces:**
- Consumes: `evaluateCondition`, `isFieldVisible`, `requiredEffettivo` da `packages/form-schema/src/condizioni.ts` (già esistenti, firme invariate).
- Produces: comando `npm test` alla radice; convenzione `**/test/**/*.test.ts` per i test unitari.

- [ ] **Step 1: Installare Vitest**

```bash
npm install -D -w . vitest@^3
```

- [ ] **Step 2: Creare la configurazione Vitest**

Create `vitest.config.ts`:

```ts
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
```

- [ ] **Step 3: Aggiungere gli script di test**

Modify `package.json` (radice), nella sezione `"scripts"`, aggiungere:

```json
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:watch": "vitest"
```

- [ ] **Step 4: Scrivere i test di caratterizzazione sulle condizioni**

Create `packages/form-schema/test/condizioni.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  condizioniEffettive,
  isFieldVisible,
  requiredEffettivo,
} from '../src/condizioni';

describe('evaluateCondition', () => {
  it('confronta i booleani dopo averli normalizzati a stringa', () => {
    expect(
      evaluateCondition({ fieldName: 'consenso', operator: 'equals', value: 'true' }, { consenso: true }),
    ).toBe(true);
    expect(
      evaluateCondition({ fieldName: 'consenso', operator: 'equals', value: 'false' }, { consenso: false }),
    ).toBe(true);
  });

  it('tratta un campo assente come stringa vuota', () => {
    expect(evaluateCondition({ fieldName: 'assente', operator: 'empty' }, {})).toBe(true);
    expect(evaluateCondition({ fieldName: 'assente', operator: 'not_empty' }, {})).toBe(false);
  });

  it('considera vuota anche la stringa letterale "undefined"', () => {
    // Caratterizzazione di una stranezza voluta: valori serializzati male a
    // monte arrivano come "undefined" e non devono contare come compilati.
    expect(evaluateCondition({ fieldName: 'x', operator: 'empty' }, { x: 'undefined' })).toBe(true);
  });

  it('equipara un value mancante alla stringa vuota', () => {
    expect(evaluateCondition({ fieldName: 'x', operator: 'equals' }, { x: '' })).toBe(true);
    expect(evaluateCondition({ fieldName: 'x', operator: 'not_equals' }, { x: 'a' })).toBe(true);
  });
});

describe('condizioniEffettive', () => {
  it('mette le condizioni ereditate prima di quella propria', () => {
    const ereditata = { fieldName: 'sezione', operator: 'equals' as const, value: 'si' };
    const propria = { fieldName: 'campo', operator: 'not_empty' as const };
    expect(condizioniEffettive({ condition: propria, conditions: [ereditata] })).toEqual([
      ereditata,
      propria,
    ]);
  });

  it('scarta le condizioni prive di fieldName', () => {
    expect(condizioniEffettive({ condition: { fieldName: '', operator: 'empty' } })).toEqual([]);
  });
});

describe('isFieldVisible', () => {
  it('richiede che tutte le condizioni siano vere (AND)', () => {
    const campo = {
      condition: { fieldName: 'b', operator: 'equals' as const, value: '2' },
      conditions: [{ fieldName: 'a', operator: 'equals' as const, value: '1' }],
    };
    expect(isFieldVisible(campo, { a: '1', b: '2' })).toBe(true);
    expect(isFieldVisible(campo, { a: '1', b: 'altro' })).toBe(false);
    expect(isFieldVisible(campo, { a: 'altro', b: '2' })).toBe(false);
  });

  it('e visibile quando non ha alcuna condizione', () => {
    expect(isFieldVisible({}, {})).toBe(true);
  });
});

describe('requiredEffettivo', () => {
  it('e obbligatorio quando required e true, senza valutare la condizione', () => {
    expect(requiredEffettivo({ validation: { required: true } }, {})).toBe(true);
  });

  it('e obbligatorio solo se la requiredCondition e soddisfatta', () => {
    const campo = {
      validation: {
        requiredCondition: { fieldName: 'tipo', operator: 'equals' as const, value: 'azienda' },
      },
    };
    expect(requiredEffettivo(campo, { tipo: 'azienda' })).toBe(true);
    expect(requiredEffettivo(campo, { tipo: 'privato' })).toBe(false);
  });

  it('non e obbligatorio senza validation', () => {
    expect(requiredEffettivo({}, {})).toBe(false);
  });
});
```

- [ ] **Step 5: Eseguire i test**

Run: `npm run test:unit`
Expected: PASS — 11 test. Se un test fallisce, correggere **il test** per riflettere il comportamento reale: sono test di caratterizzazione, non di specifica.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json packages/form-schema/test/condizioni.test.ts
git commit -m "test: harness vitest e caratterizzazione delle condizioni di modulo"
```

---

## Task 2: Caratterizzazione di parsing, gerarchia e paginazione

**Files:**
- Create: `packages/form-schema/test/schema.test.ts`

**Interfaces:**
- Consumes: `parseCampi`, `risolviGerarchia`, `risolviRiferimentiCondizioni`, `splitPages` da `packages/form-schema/src/schema.ts`.
- Produces: nessuna nuova interfaccia. Questi test proteggono il comportamento che il **piano 2** cambierà passando da `Servizio.attributi` (stringa) a `ModuloVersione.schema` (jsonb): serviranno da rete di sicurezza in quel passaggio.

- [ ] **Step 1: Scrivere i test**

Create `packages/form-schema/test/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  parseCampi,
  risolviGerarchia,
  risolviRiferimentiCondizioni,
  splitPages,
} from '../src/schema';
import type { FormField } from '../src/types';

const campo = (over: Partial<FormField> & { id: string; name: string }): FormField => ({
  type: 'text',
  label: over.name,
  ...over,
});

describe('parseCampi', () => {
  it('accetta sia il formato {fields:[...]} sia un array piatto', () => {
    const uno = parseCampi(JSON.stringify({ fields: [campo({ id: 'a', name: 'nome' })] }));
    const due = parseCampi(JSON.stringify([campo({ id: 'a', name: 'nome' })]));
    expect(uno).toHaveLength(1);
    expect(due).toHaveLength(1);
    expect(uno[0].name).toBe('nome');
  });

  it('restituisce un elenco vuoto su input nullo, vuoto o JSON non valido', () => {
    expect(parseCampi(null)).toEqual([]);
    expect(parseCampi(undefined)).toEqual([]);
    expect(parseCampi('')).toEqual([]);
    expect(parseCampi('{non json')).toEqual([]);
    expect(parseCampi(JSON.stringify({ altro: 1 }))).toEqual([]);
  });
});

describe('risolviRiferimentiCondizioni', () => {
  it('riallinea fieldName al nome corrente del campo puntato da fieldId', () => {
    const campi = [
      campo({ id: 'src', name: 'nome_nuovo' }),
      campo({
        id: 'dst',
        name: 'dipendente',
        condition: { fieldId: 'src', fieldName: 'nome_vecchio', operator: 'not_empty' },
      }),
    ];
    const out = risolviRiferimentiCondizioni(campi);
    expect(out[1].condition?.fieldName).toBe('nome_nuovo');
  });

  it('rimuove la condizione quando il campo sorgente non esiste piu', () => {
    const campi = [
      campo({
        id: 'dst',
        name: 'dipendente',
        condition: { fieldId: 'cancellato', fieldName: 'x', operator: 'not_empty' },
      }),
    ];
    expect(risolviRiferimentiCondizioni(campi)[0].condition).toBeUndefined();
  });

  it('lascia invariate le condizioni prive di fieldId (schemi antecedenti)', () => {
    const cond = { fieldName: 'legacy', operator: 'equals' as const, value: '1' };
    const campi = [campo({ id: 'a', name: 'a', condition: cond })];
    expect(risolviRiferimentiCondizioni(campi)[0].condition).toBe(cond);
  });
});

describe('risolviGerarchia', () => {
  it('propaga ai figli la condizione della sezione contenitore', () => {
    const campi = [
      campo({
        id: 'sez',
        name: 'sezione',
        type: 'section',
        condition: { fieldName: 'mostra', operator: 'equals', value: 'si' },
      }),
      campo({ id: 'figlio', name: 'figlio', parentId: 'sez' }),
    ];
    const out = risolviGerarchia(campi);
    expect(out[1].conditions).toEqual([
      { fieldName: 'mostra', operator: 'equals', value: 'si' },
    ]);
  });

  it('accumula le condizioni dal contenitore piu esterno al piu interno', () => {
    const campi = [
      campo({
        id: 'est',
        name: 'esterna',
        type: 'section',
        condition: { fieldName: 'a', operator: 'equals', value: '1' },
      }),
      campo({
        id: 'int',
        name: 'interna',
        type: 'section',
        parentId: 'est',
        condition: { fieldName: 'b', operator: 'equals', value: '2' },
      }),
      campo({ id: 'figlio', name: 'figlio', parentId: 'int' }),
    ];
    const conds = risolviGerarchia(campi)[2].conditions;
    expect(conds?.map((c) => c.fieldName)).toEqual(['a', 'b']);
  });

  it('non entra in ciclo su una gerarchia malformata', () => {
    const campi = [
      campo({ id: 'a', name: 'a', type: 'section', parentId: 'b' }),
      campo({ id: 'b', name: 'b', type: 'section', parentId: 'a' }),
    ];
    expect(() => risolviGerarchia(campi)).not.toThrow();
  });
});

describe('splitPages', () => {
  it('produce una sola pagina se non ci sono pagebreak', () => {
    const pagine = splitPages([campo({ id: 'a', name: 'a' }), campo({ id: 'b', name: 'b' })]);
    expect(pagine).toHaveLength(1);
    expect(pagine[0].fields).toHaveLength(2);
  });

  it('usa il label del pagebreak come titolo della pagina che apre', () => {
    const pagine = splitPages([
      campo({ id: 'a', name: 'a' }),
      campo({ id: 'pb', name: 'pb', type: 'pagebreak', label: 'Seconda pagina' }),
      campo({ id: 'b', name: 'b' }),
    ]);
    expect(pagine).toHaveLength(2);
    expect(pagine[0].titolo).toBe('');
    expect(pagine[1].titolo).toBe('Seconda pagina');
  });

  it('scarta le pagine vuote generate da pagebreak consecutivi o ai bordi', () => {
    const pagine = splitPages([
      campo({ id: 'pb1', name: 'pb1', type: 'pagebreak', label: 'Uno' }),
      campo({ id: 'pb2', name: 'pb2', type: 'pagebreak', label: 'Due' }),
      campo({ id: 'a', name: 'a' }),
    ]);
    expect(pagine).toHaveLength(1);
    expect(pagine[0].titolo).toBe('Due');
  });

  it('restituisce una pagina unica vuota su elenco vuoto', () => {
    expect(splitPages([])).toEqual([{ titolo: '', fields: [] }]);
  });
});
```

- [ ] **Step 2: Eseguire i test**

Run: `npm run test:unit`
Expected: PASS — tutti i test dei due file. Come sopra: se un test fallisce, allineare il test al comportamento reale e annotare nel commento cosa fa davvero.

- [ ] **Step 3: Commit**

```bash
git add packages/form-schema/test/schema.test.ts
git commit -m "test: caratterizzazione di parsing, gerarchia e paginazione dei moduli"
```

---

## Task 3: Harness di integrazione su Postgres effimero

**Files:**
- Create: `test/integration/postgres.ts`
- Create: `test/integration/schema.test.ts`
- Modify: `package.json` (radice)

**Interfaces:**
- Produces: `avviaPostgres(): Promise<UrlDatabase>` e `applicaSchema(url: string, percorsoSchema: string): Promise<void>` da `test/integration/postgres.ts`. **I piani 2, 3 e 4 dipendono da queste due funzioni** per i loro test di integrazione: le firme sono vincolanti.

```ts
export type UrlDatabase = string;
export async function avviaPostgres(): Promise<UrlDatabase>;
export async function fermaPostgres(): Promise<void>;
export async function applicaSchema(url: UrlDatabase, percorsoSchema: string): Promise<void>;
```

- [ ] **Step 1: Installare Testcontainers**

```bash
npm install -D -w . @testcontainers/postgresql@^10
```

- [ ] **Step 2: Scrivere l'helper**

Create `test/integration/postgres.ts`:

```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';

export type UrlDatabase = string;

let container: StartedPostgreSqlContainer | undefined;

/**
 * Avvia un Postgres effimero e restituisce la sua connection string.
 * Il container e condiviso da tutti i test di integrazione: `fileParallelism`
 * e disattivato in vitest.config.ts perche i test non si calpestino.
 */
export async function avviaPostgres(): Promise<UrlDatabase> {
  if (!container) {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('citta_semplice_test')
      .withUsername('test')
      .withPassword('test')
      .start();
  }
  return container.getConnectionUri();
}

export async function fermaPostgres(): Promise<void> {
  await container?.stop();
  container = undefined;
}

/**
 * Applica lo schema Prisma al database indicato con `prisma db push`.
 * Si usa `db push` e non `migrate deploy` perche i test partono sempre da un
 * database vuoto: interessa lo stato finale dello schema, non la storia.
 */
export async function applicaSchema(url: UrlDatabase, percorsoSchema: string): Promise<void> {
  execFileSync(
    'npx',
    ['prisma', 'db', 'push', '--schema', percorsoSchema, '--skip-generate', '--accept-data-loss'],
    { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', shell: process.platform === 'win32' },
  );
}
```

- [ ] **Step 3: Scrivere il test che prova l'harness**

Create `test/integration/schema.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { resolve } from 'node:path';
import { avviaPostgres, fermaPostgres, applicaSchema, type UrlDatabase } from './postgres';

let url: UrlDatabase;

beforeAll(async () => {
  url = await avviaPostgres();
  applicaSchema(url, resolve(process.cwd(), 'prisma/schema.prisma'));
}, 120_000);

afterAll(async () => {
  await fermaPostgres();
});

describe('schema Prisma', () => {
  it('si applica a un database vuoto e crea le tabelle del dominio', async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const tabelle = rows.map((r) => r.table_name);
      expect(tabelle).toContain('istanze');
      expect(tabelle).toContain('servizi');
      expect(tabelle).toContain('workflows');
      expect(tabelle).toContain('fasi');
      expect(tabelle).toContain('steps');
    } finally {
      await client.end();
    }
  });

  it('impedisce a una istanza di essere insieme conclusa e respinta', async () => {
    // Caratterizza il vincolo CHECK che il piano 2 sostituira con StatoIstanza.
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint WHERE conrelid = 'istanze'::regclass AND contype = 'c'`,
      );
      expect(rows.map((r) => r.conname)).toContain('istanze_stato_esclusivo_chk');
    } finally {
      await client.end();
    }
  });
});
```

- [ ] **Step 4: Installare `pg` come dipendenza di test alla radice**

```bash
npm install -D -w . pg@^8 @types/pg@^8
```

- [ ] **Step 5: Eseguire i test di integrazione**

Run: `npm run test:integration`
Expected: PASS — 2 test. Richiede Docker attivo.

Se il secondo test fallisce perché il vincolo ha un nome diverso, leggere il nome reale dall'output della query e correggere l'asserzione: il vincolo è documentato in `prisma/schema.prisma:337-338` come creato dalla migrazione `20260720120000`.

- [ ] **Step 6: Commit**

```bash
git add test/integration/postgres.ts test/integration/schema.test.ts package.json package-lock.json
git commit -m "test: harness di integrazione su Postgres effimero via testcontainers"
```

---

## Task 4: `packages/db` — schema Prisma unico

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/prisma/schema.prisma` (contenuto spostato da `prisma/schema.prisma`)
- Modify: `citta-semplice-office/src/lib/db/prisma.ts`
- Modify: `citta-semplice-portal/src/lib/db/prisma.ts`
- Modify: `citta-semplice-office/package.json`, `citta-semplice-portal/package.json`, `package.json` (radice)
- Modify: `test/integration/schema.test.ts:19` (percorso dello schema)
- Delete: `prisma/schema.prisma`, `citta-semplice-office/prisma/schema.prisma`, `citta-semplice-portal/prisma/schema.prisma`, `sync-schema.sh`, `check-schema-drift.sh`

**Interfaces:**
- Consumes: `avviaPostgres`, `applicaSchema` da Task 3.
- Produces: `import { prisma, Prisma, type Istanza } from '@citta/db'` — client singleton e tipi generati, usati da **tutti i piani successivi** al posto degli import locali da `../../generated/prisma/client`.

- [ ] **Step 1: Prendere atto delle due configurazioni attuali**

I due singleton sono **identici** tranne che per lo stile di export. Contenuto attuale di entrambi:

```ts
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Le differenze, che determinano la forma dello shim allo Step 8:

| | office | portal |
|---|---|---|
| export | `export default prisma` | `export const prisma` |
| import nei consumatori | `import prisma from '@/lib/db/prisma'` | `import { prisma } from '@/lib/db/prisma'` |

Lo shim deve quindi esporre **sia** il default **sia** il named, altrimenti una delle due app non compila.

Nessuna opzione di `log` è configurata in nessuna delle due: non aggiungerne.

- [ ] **Step 2: Creare il manifest del package**

Create `packages/db/package.json`:

```json
{
  "name": "@citta/db",
  "version": "1.0.0",
  "description": "Schema Prisma canonico e client condiviso tra office e portal",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "files": [
    "src",
    "prisma",
    "generated"
  ],
  "scripts": {
    "db:generate": "prisma generate --schema prisma/schema.prisma",
    "db:push": "prisma db push --schema prisma/schema.prisma",
    "db:migrate": "prisma migrate dev --schema prisma/schema.prisma",
    "db:studio": "prisma studio --schema prisma/schema.prisma"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.7.0",
    "@prisma/client": "^7.7.0",
    "pg": "^8"
  },
  "devDependencies": {
    "prisma": "7.7.0"
  }
}
```

- [ ] **Step 3: Creare il tsconfig del package**

Create `packages/db/tsconfig.json` (stesso profilo di `packages/form-schema/tsconfig.json`):

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["ES2021"],
    "types": ["node"],
    "strict": true,
    "declaration": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Spostare lo schema canonico**

```bash
mkdir -p packages/db/prisma
git mv prisma/schema.prisma packages/db/prisma/schema.prisma
```

Poi modificare in `packages/db/prisma/schema.prisma` il blocco `generator`, perché l'output è ora relativo al package:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
```

e sostituire l'intestazione del file (le prime 6 righe, che descrivono la sincronizzazione ora superata) con:

```prisma
// ============================================================================
// SCHEMA CANONICO — UNICA FONTE DI VERITÀ
// office e portal consumano questo schema tramite il package @citta/db.
// Non esistono più copie da sincronizzare.
// ============================================================================
```

- [ ] **Step 5: Scrivere l'export del package**

Create `packages/db/src/index.ts` — trasposizione fedele della configurazione dello Step 1, con l'aggiunta del re-export dei tipi generati:

```ts
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Tipi e namespace generati (Prisma, Istanza, Servizio, ...): i consumatori
// importano tutto da '@citta/db', mai dal percorso di generazione.
export * from '../generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function creaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? creaClient();

// In sviluppo il hot reload di Next ricrea i moduli a ogni modifica: senza
// questa cache si aprirebbe un pool di connessioni nuovo a ogni ricompilazione.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

`pg` va aggiunto alle `dependencies` di `packages/db/package.json` (`"pg": "^8"`), perché il `Pool` è costruito qui.

- [ ] **Step 6: Generare il client e verificare che il package compili**

```bash
npm install
npm run db:generate -w @citta/db
npx tsc --noEmit -p packages/db/tsconfig.json
```

Expected: nessun errore. Il client compare in `packages/db/generated/prisma`.

- [ ] **Step 7: Aggiungere `generated` al .gitignore del package**

Append a `.gitignore` (radice):

```
# client Prisma generato: si rigenera con `npm run db:generate -w @citta/db`
packages/db/generated
```

- [ ] **Step 8: Puntare i due singleton applicativi al package**

Modify `citta-semplice-office/src/lib/db/prisma.ts` — sostituire l'intero contenuto con:

```ts
// Il client vive in @citta/db: qui resta solo il re-export, così gli import
// esistenti (`@/lib/db/prisma`) continuano a funzionare senza modifiche.
export { prisma, prisma as default } from '@citta/db';
```

Modify `citta-semplice-portal/src/lib/db/prisma.ts` — stesso contenuto.

- [ ] **Step 9: Dichiarare la dipendenza nelle due app**

In `citta-semplice-office/package.json` e `citta-semplice-portal/package.json`, aggiungere alle `dependencies`:

```json
    "@citta/db": "*",
```

e rimuovere dalle rispettive `scripts` le voci `db:generate`, `db:push`, `db:migrate`, `db:migrater`, `db:studio` (ora esposte da `@citta/db`). Mantenere `db:seed` e `db:hash`, che sono script applicativi.

- [ ] **Step 10: Aggiornare gli script alla radice**

In `package.json` (radice), sostituire:

```json
    "sync-schema": "./sync-schema.sh",
    "check-schema-drift": "./check-schema-drift.sh",
```

con:

```json
    "db:generate": "npm run db:generate -w @citta/db",
    "db:push": "npm run db:push -w @citta/db",
    "db:migrate": "npm run db:migrate -w @citta/db",
```

e rimuovere la vecchia voce `db:generate` che invocava i due workspace applicativi.

- [ ] **Step 11: Aggiornare il percorso dello schema nel test di integrazione**

Modify `test/integration/schema.test.ts:19` — sostituire:

```ts
  applicaSchema(url, resolve(process.cwd(), 'prisma/schema.prisma'));
```

con:

```ts
  applicaSchema(url, resolve(process.cwd(), 'packages/db/prisma/schema.prisma'));
```

- [ ] **Step 12: Eliminare le copie e gli script di sincronizzazione**

```bash
git rm citta-semplice-office/prisma/schema.prisma citta-semplice-portal/prisma/schema.prisma
git rm sync-schema.sh check-schema-drift.sh
```

- [ ] **Step 13: Verificare che tutto regga**

```bash
npm install
npm run db:generate
npx tsc --noEmit -p citta-semplice-office/tsconfig.json
npx tsc --noEmit -p citta-semplice-portal/tsconfig.json
npm test
```

Expected: typecheck pulito su entrambe le app, tutti i test verdi.

Se il typecheck segnala import residui da `../../generated/prisma/client` (per esempio in `citta-semplice-office/src/lib/auth/visibilita.ts:1`, che importa `Prisma`), redirigerli su `@citta/db`:

```ts
import { Prisma } from '@citta/db';
```

- [ ] **Step 14: Verificare che le due app costruiscano davvero**

```bash
npm run build
```

Expected: build di office e portal completate. Il typecheck non intercetta i problemi di risoluzione dei moduli a runtime di Next; questo passaggio sì.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "refactor: schema Prisma unico in @citta/db, via le tre copie sincronizzate"
```

---

## Self-Review

**Copertura rispetto all'obiettivo del piano:**

| Obiettivo | Task |
|---|---|
| Harness di test unitario eseguibile | Task 1 |
| Comportamento dei moduli protetto prima del piano 2 | Task 1, Task 2 |
| Harness di integrazione su Postgres reale | Task 3 |
| D9 — `packages/db` unico | Task 4 |

**Fuori da questo piano, per progetto:** D1–D8 (piano 2), partizionamento e importer legacy (piano 3), idempotenza delle integrazioni (piano 4).

**Debito noto lasciato aperto, da riprendere nel piano 3:**
`citta-semplice-migrations/migrate-dati.js:26,34` contiene le credenziali dei database sorgente e destinazione in chiaro, ed è tracciato in git. Vanno spostate su variabili d'ambiente **e le password vanno ruotate**, perché restano nella storia del repository. Non è incluso qui perché tocca l'importer, che è oggetto del piano 3; ma se le credenziali sono valide su un database raggiungibile, la rotazione va fatta subito e indipendentemente da questo piano.
