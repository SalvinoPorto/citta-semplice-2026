# Posizione corrente e assegnazione dell'istanza — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere interrogabili la posizione corrente e l'assegnazione di un'istanza, eliminando dalla lista paginata le query raw con materializzazione degli ID in memoria, e chiudendo la doppia semantica di `Workflow.operatoreId`.

**Architecture:** Espansione → conversione → contrazione. La migrazione di espansione aggiunge colonne, trigger e indici senza rimuovere nulla, così il codice esistente continua a girare; poi si convertono scritture, lista e letture; solo alla fine si rimuovono le colonne vecchie e si esegue il rename, in un commit meccanico isolato. Le due colonne denormalizzate le mantiene il database — un trigger per ciascuna, per ragioni diverse — perché due applicazioni scrivono su questo schema e il precedente di `last_step_id` dice come finisce affidarle al codice applicativo.

**Tech Stack:** npm workspaces, TypeScript ~5.7, Vitest 3, Testcontainers (`@testcontainers/postgresql`), `pg` 8, Prisma 7.7.0 con `@prisma/adapter-pg`, PostgreSQL 16, Next.js 16.2.9 / React 19.2.4.

## Global Constraints

- **Specifica di riferimento:** `docs/superpowers/specs/2026-08-07-posizione-corrente-e-assegnazione-design.md` (decisioni B1-B5), che raffina D4 di `docs/superpowers/specs/2026-08-04-nucleo-dominio-design.md`.
- **Le migrazioni sono la fonte di verità dello schema, non il DSL.** L'harness di integrazione esegue `prisma migrate deploy`. `prisma migrate dev --create-only` **fallisce in questo ambiente con P3014** (l'utente del database non può creare lo shadow database): le migrazioni si scrivono a mano, e nessuno strumento verifica la corrispondenza fra SQL e schema Prisma. La revisione deve controllarla esplicitamente.
- **Schema e client Prisma vivono in `packages/db`** (`@citta/db`). Il client si importa sempre da `@citta/db`, mai da percorsi `generated/prisma`.
- Prisma 7.7.0 esatta. Client generato in `packages/db/generated/prisma`, rigenerato da `npm run db:generate`. **Dopo ogni modifica a `schema.prisma` va rigenerato il client**, altrimenti `tsc` non vede i campi nuovi.
- Monorepo npm workspaces: un solo `node_modules` e un solo `package-lock.json` alla radice. La root non è un workspace nominato: `npm install -D <pkg>` senza `-w`.
- **Naming di dominio in italiano** (entità, colonne, funzioni, commenti, messaggi).
- **Ogni task lascia l'albero che compila e i test verdi.** Al termine di ogni task: `npm test`, `npx tsc --noEmit` in `citta-semplice-office` e in `citta-semplice-portal`, `npm run build`.
- **Un test vale solo se fallisce quando la cosa che protegge si rompe.** Un test su una migrazione deve **leggere il file da disco ed eseguirlo**, mai riprodurne il contenuto. Una logica va estratta in funzione pura e testata direttamente, mai riprodotta nel test in un altro linguaggio. Ogni test non banale va accompagnato da una **verifica negativa** — rompere deliberatamente ciò che protegge e osservarla fallire — eseguita come **ultimo passo prima del commit**, perché un'interruzione a metà lascerebbe nel working tree la versione sabotata.
- **Estrarre in funzione pura non basta se nessun test esercita il chiamante:** reintrodurre la logica inline nella UI lascerebbe verdi tutti i test sulla funzione pura, semplicemente non chiamata.
- **Gli elenchi di file in questo piano sono punti di partenza, non censimenti.** Riverificali con `grep`: il risultato del `grep` prevale. Nel piano 2a un elenco di 12 file ne richiedeva 16.
- Prerequisito Docker attivo per i test di integrazione.
- Il database di sviluppo non riceve le migrazioni automaticamente: allinealo con `npm run db:migrate` prima di avviare le applicazioni in locale.

## Contesto: cosa c'è oggi

`Workflow` (tabella `workflows`) ha una riga per attivazione di step. Il campo `operatore_id` significa **due cose diverse a seconda della riga**: sulle righe chiuse è "chi ha completato lo step", sulla riga aperta è "a chi è assegnata l'istanza". Da lì discendono i tre difetti che questo piano chiude.

| # | File:riga | Difetto |
|---|---|---|
| A1 | `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts:257-263` | `advanceWorkflow` crea l'attività successiva con `operatoreId` = chi ha avanzato **anche quando la nuova fase compete a un altro ufficio**: l'istanza arriva già "presa in carico" da chi non ci lavorerà, e non compare fra le "Nuove" di nessuno. |
| A2 | stesso file, `:1249` | `rollbackFase` crea l'attività **senza** `operatoreId`: comportamento opposto ad A1 sullo stesso campo. Nessuno dei due è documentato come scelta. |
| A3 | `citta-semplice-office/src/app/api/istanze/paged/route.ts:51-77, 229-268` | I tre tab e i tre contatori sono `$queryRaw` con subquery correlata che materializza **tutti** gli ID in memoria Node per rimandarli come `WHERE id IN (...)`. La stessa subquery compare sei volte. |
| A4 | `actions.ts:735` vs `paged/route.ts:232` | "Ultimo workflow" è `ORDER BY id DESC` in un punto e `data_variazione DESC` nell'altro: due definizioni di "corrente". |
| A5 | `packages/db/prisma/schema.prisma:425-427` + 5 punti di UI | `Workflow.stato` è dichiarato binario (0/1) ma in lettura circola un terzo valore `-1` mai memorizzato, sintetizzato da `le-mie-istanze.ts:83` e tradotto da `getStatoLabel`. L'etichetta reale nasce dalla **coppia** `(operatoreId, stato)`. |

**Conseguenza che governa l'ordine dei task:** spostare l'assegnazione su `Istanza` toglie alla riga di attività l'informazione con cui oggi distingue "In attesa" da "In lavorazione". La funzione pura di derivazione (Task 2) deve quindi esistere **prima** che le letture vengano convertite.

---

## File Structure

**Creati:**
- `test/integration/global-setup.ts` — avvia un solo container Postgres per l'intera suite di integrazione e ne pubblica l'URL via `provide`
- `packages/db/src/stato-attivita.ts` — funzione pura di derivazione dello stato di un'attività (B2)
- `packages/db/test/stato-attivita.test.ts` — test unitari della funzione pura
- `packages/db/prisma/migrations/20260807100000_posizione_corrente_espansione/migration.sql`
- `packages/db/prisma/migrations/20260807110000_posizione_corrente_contrazione/migration.sql`
- `packages/db/prisma/migrations/20260807120000_rinomina_istanza_attivita/migration.sql`
- `test/integration/posizione-corrente.test.ts` — trigger, backfill, unicità (esegue i file di migrazione da disco)
- `test/integration/tab-istanze.test.ts` — equivalenza dei tre tab e dei sei contatori
- `test/integration/tab-istanze-volume.test.ts` — test opt-in su 100.000 istanze con `EXPLAIN`
- `citta-semplice-office/src/lib/istanze/filtri-tab.ts` — costruzione dei `where` dei tab, condivisa fra lista e contatori

**Modificati:**
- `packages/db/prisma/schema.prisma` — modelli `Istanza`, `Workflow`, `Operatore`
- `packages/db/src/index.ts` — riesporta `./stato-attivita`
- `test/integration/postgres.ts` — l'avvio del container si sposta in `global-setup.ts`
- `vitest.config.ts` — registra `globalSetup` sul progetto `integration`
- `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts` — scritture di assegnazione e completamento
- `citta-semplice-office/src/app/api/istanze/paged/route.ts` — via le `$queryRaw` dei tab e dei contatori
- `citta-semplice-office/src/lib/models/stato-istanza.ts` — badge derivato dalla funzione pura
- `citta-semplice-office/src/app/(dashboard)/istanze/[id]/workflow-timeline.tsx` — etichette e classi dalla funzione pura
- `citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx` — letture dell'attività corrente
- `citta-semplice-office/src/app/(dashboard)/istanze/istanze-client.tsx` — tipo della riga di lista
- `citta-semplice-portal/src/lib/actions/le-mie-istanze.ts` — via il valore sentinella `-1`
- `citta-semplice-portal/src/app/(portal)/le-mie-istanze/[id]/page.tsx` — badge e etichette per riga

**Rinominati (Task 10, commit meccanico):** `Workflow` → `IstanzaAttivita`, `workflows` → `istanza_attivita`, `WorkflowFase` → `IstanzaFase`, `workflow_fasi` → `istanza_fasi`, `workflow-timeline.tsx` → `attivita-timeline.tsx`.

---

## Task 1: Un solo container Postgres per l'intera suite di integrazione

Oggi ogni file di integrazione avvia il proprio container (~10 s l'uno) perché con il pool `forks` di Vitest 3 ogni file ottiene un registry di moduli nuovo, quindi la variabile a livello di modulo in `test/integration/postgres.ts` non sopravvive fra file. Questo piano porta i file di integrazione da 3 a 6: va fatto per primo, altrimenti il costo si paga per tutta la sua durata.

**Files:**
- Create: `test/integration/global-setup.ts`
- Modify: `test/integration/postgres.ts`
- Modify: `vitest.config.ts:22-33`
- Modify: `test/integration/schema.test.ts`, `test/integration/stato-istanza.test.ts`, `test/integration/ordini-step.test.ts` (i tre `beforeAll`)

**Interfaces:**
- Produces: `inject('urlPostgres'): string` — connection string di un Postgres già migrato con l'intera storia delle migrazioni. Tutti i task successivi che scrivono test di integrazione la usano al posto di `avviaPostgres()` + `applicaSchema()`.
- Produces: `applicaSchema(url, percorsoSchema)` resta esportata da `test/integration/postgres.ts` e invariata: la usa `global-setup.ts`.

- [ ] **Step 1: Scrivere il global setup**

Create `test/integration/global-setup.ts`:

```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';
import { applicaSchema } from './postgres';

/**
 * Un solo container Postgres per l'INTERA suite di integrazione.
 *
 * Con il pool `forks` di Vitest 3 ogni file di test ottiene un registry di
 * moduli nuovo: una variabile a livello di modulo non sopravvive fra file, e
 * infatti prima di questo setup ogni file avviava il proprio container (~10 s
 * l'uno). `globalSetup` gira invece una volta sola nel processo principale, e
 * `provide` è il canale con cui passa un valore ai file di test, che lo
 * leggono con `inject`.
 *
 * Lo schema si applica QUI, una volta: i file di test trovano il database già
 * migrato. `fileParallelism: false` (in vitest.config.ts) resta necessario —
 * ora non per evitare container concorrenti ma perché i file condividono lo
 * stesso database e non devono scriverci in parallelo.
 */
export default async function setup(project: TestProject) {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('citta_semplice_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const url = container.getConnectionUri();
  await applicaSchema(url, resolve(process.cwd(), 'packages/db/prisma/schema.prisma'));

  project.provide('urlPostgres', url);

  return async () => {
    await container.stop();
  };
}

declare module 'vitest' {
  interface ProvidedContext {
    urlPostgres: string;
  }
}
```

- [ ] **Step 2: Registrare il global setup**

Modify `vitest.config.ts`, nel progetto `integration`, subito dopo `include`:

```ts
          include: ['test/integration/**/*.test.ts'],
          globalSetup: ['test/integration/global-setup.ts'],
```

E aggiorna il commento sotto, che oggi dice "Un solo container condiviso: i test di integrazione non girano in parallelo":

```ts
          // I file di integrazione condividono l'unico container avviato da
          // `globalSetup`: non devono scrivere sullo stesso database in
          // parallelo.
          fileParallelism: false,
```

- [ ] **Step 3: Ridurre `postgres.ts` a quel che resta usato**

Modify `test/integration/postgres.ts`: rimuovi `avviaPostgres`, `fermaPostgres`, la variabile `container` e l'import di `PostgreSqlContainer`. Sostituisci il blocco di commento di quelle funzioni (righe 8-36) con:

```ts
export type UrlDatabase = string;
```

`applicaSchema` e il suo blocco di commento (righe 38-91) restano **invariati**: li usa `global-setup.ts`.

- [ ] **Step 4: Convertire i tre file di test esistenti**

In `test/integration/schema.test.ts`, `test/integration/stato-istanza.test.ts` e `test/integration/ordini-step.test.ts`, sostituisci il `beforeAll`/`afterAll` con questa forma (esempio da `stato-istanza.test.ts`):

```ts
import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let client: Client;

beforeAll(async () => {
  client = new Client({ connectionString: inject('urlPostgres') });
  await client.connect();
});

afterAll(async () => {
  await client?.end();
});
```

Rimuovi da questi file gli import di `avviaPostgres`, `fermaPostgres`, `applicaSchema` e la variabile `url`, e i timeout `180_000` sui `beforeAll` (non c'è più niente di lento da attendere lì). `readFileSync` / `resolve` restano dove già usati.

- [ ] **Step 5: Eseguire la suite di integrazione**

Run: `npm run test:integration`
Expected: PASS, tutti e tre i file. Nel log compare **un solo** avvio di container.

Se un test fallisce per dati residui di un altro file, è il rischio noto della condivisione: i file esistenti usano già suffissi univoci per le righe che inseriscono (`creaDipendenze(suffisso)`), quindi non dovrebbe accadere. Se accade, rendi univoco il suffisso in conflitto — **non** reintrodurre un container per file.

- [ ] **Step 6: Misurare il guadagno**

Run: `npm run test:integration`
Annota il tempo totale e confrontalo con quello prima del task (`git stash` + esecuzione, se non l'hai misurato). Atteso: circa 20 secondi in meno.

- [ ] **Step 7: Commit**

```bash
git add test/integration/global-setup.ts test/integration/postgres.ts vitest.config.ts test/integration/schema.test.ts test/integration/stato-istanza.test.ts test/integration/ordini-step.test.ts
git commit -m "test: un solo container Postgres per l'intera suite di integrazione"
```

---

## Task 2: Funzione pura di derivazione dello stato di un'attività

Chiude A5. Non tocca lo schema: è puro TypeScript, testabile subito, e deve esistere prima che le letture vengano convertite (Task 6 e 7).

**Files:**
- Create: `packages/db/src/stato-attivita.ts`
- Create: `packages/db/test/stato-attivita.test.ts`
- Modify: `packages/db/src/index.ts:11`

**Interfaces:**
- Produces: `type StatoAttivita = 'COMPLETATA' | 'IN_LAVORAZIONE' | 'IN_ATTESA' | 'RETROCESSA'`
- Produces: `statoAttivita(attivita: AttivitaPerStato, contesto: ContestoIstanza): StatoAttivita`
- Produces: `interface AttivitaPerStato { id: number; completataAt: Date | null }`
- Produces: `interface ContestoIstanza { attivitaCorrenteId: number | null; assegnatarioId: number | null }`
- Produces: `ETICHETTE_STATO_ATTIVITA: Record<StatoAttivita, string>`
- Tutto riesportato da `@citta/db`. Lo usano Task 6 (office) e Task 7 (portale).

- [ ] **Step 1: Scrivere i test che falliscono**

Create `packages/db/test/stato-attivita.test.ts`:

```ts
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
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx vitest run --project unit packages/db/test/stato-attivita.test.ts`
Expected: FAIL — `Failed to load ../src/stato-attivita`.

- [ ] **Step 3: Scrivere la funzione pura**

Create `packages/db/src/stato-attivita.ts`:

```ts
/**
 * Unica fonte di verità per lo stato mostrato di una singola attività (uno
 * step attivato su un'istanza).
 *
 * Prima l'etichetta nasceva dalla COPPIA (operatore_id, stato) sulla riga di
 * attività, con un terzo valore `-1` mai memorizzato che il codice
 * applicativo sintetizzava in lettura. Da quando l'assegnazione dell'istanza
 * vive su `Istanza.assegnatarioId`, la riga di attività da sola non basta
 * più a distinguere "in attesa" da "in lavorazione": serve sapere se
 * l'istanza è presa in carico e quale sia la sua attività corrente.
 */

export type StatoAttivita = 'COMPLETATA' | 'IN_LAVORAZIONE' | 'IN_ATTESA' | 'RETROCESSA';

export interface AttivitaPerStato {
  id: number;
  /** NULL = attività aperta. Sostituisce il vecchio `stato` binario. */
  completataAt: Date | null;
}

export interface ContestoIstanza {
  attivitaCorrenteId: number | null;
  /** NULL = istanza non presa in carico da nessun operatore. */
  assegnatarioId: number | null;
}

export function statoAttivita(attivita: AttivitaPerStato, contesto: ContestoIstanza): StatoAttivita {
  if (attivita.completataAt !== null) return 'COMPLETATA';
  // Un'attività aperta che non è più la corrente è stata scavalcata da un
  // rollback di fase senza essere mai chiusa.
  if (attivita.id !== contesto.attivitaCorrenteId) return 'RETROCESSA';
  return contesto.assegnatarioId !== null ? 'IN_LAVORAZIONE' : 'IN_ATTESA';
}

export const ETICHETTE_STATO_ATTIVITA: Record<StatoAttivita, string> = {
  COMPLETATA: 'Completata',
  IN_LAVORAZIONE: 'In lavorazione',
  IN_ATTESA: 'In attesa',
  RETROCESSA: 'Retrocesso',
};
```

- [ ] **Step 4: Riesportare da `@citta/db`**

Modify `packages/db/src/index.ts`, dopo la riga `export * from './navigazione-iter';`:

```ts
export * from './stato-attivita';
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npx vitest run --project unit packages/db/test/stato-attivita.test.ts`
Expected: PASS, 7 test.

- [ ] **Step 6: Verifica negativa**

Modifica temporaneamente `statoAttivita` invertendo l'ultima riga in `return contesto.assegnatarioId === null ? 'IN_LAVORAZIONE' : 'IN_ATTESA';`.

Run: `npx vitest run --project unit packages/db/test/stato-attivita.test.ts`
Expected: FAIL su "è IN_LAVORAZIONE quando..." e "è IN_ATTESA quando...".

**Ripristina la riga corretta e riesegui il test prima di committare.** Un'interruzione a metà di questo passo lascerebbe nel working tree la versione sabotata.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/stato-attivita.ts packages/db/test/stato-attivita.test.ts packages/db/src/index.ts
git commit -m "feat(db): stato di un'attivita derivato da una funzione pura, via il valore sentinella -1"
```

---

## Task 3: Migrazione di espansione — colonne, backfill, trigger, indici

Non rimuove nulla: al termine di questo task il codice esistente gira ancora sulle colonne vecchie e i test restano verdi.

**Files:**
- Create: `packages/db/prisma/migrations/20260807100000_posizione_corrente_espansione/migration.sql`
- Create: `test/integration/posizione-corrente.test.ts`
- Modify: `packages/db/prisma/schema.prisma` — modelli `Istanza` (righe 344-406), `Workflow` (413-437), `Operatore`

**Interfaces:**
- Produces (schema Prisma): `Istanza.attivitaCorrenteId: number | null`, `Istanza.attivitaCorrente: Workflow | null`, `Istanza.assegnatarioId: number | null`, `Istanza.assegnatario: Operatore | null`, `Workflow.completataAt: Date | null`, `Workflow.completataDaId: number | null`, `Workflow.completataDa: Operatore | null`. Li usano i Task 4-8.
- Produces (database): trigger `attivita_corrente_su_insert` e `assegnatario_al_cambio_fase`; indici `istanze_stato_assegnatario_id_idx`, `istanze_fase_corrente_id_idx`, `istanze_attivita_corrente_id_key`.

- [ ] **Step 1: Scrivere la migrazione**

Create `packages/db/prisma/migrations/20260807100000_posizione_corrente_espansione/migration.sql`:

```sql
-- Espansione: posizione corrente e assegnazione dell'istanza (specifica B1-B4).
-- Non rimuove nulla. `workflows.stato` e `workflows.operatore_id` restano al
-- loro posto finché il codice non è convertito: la contrazione è una
-- migrazione separata.

-- AddColumn: posizione corrente e assegnazione sull'istanza
ALTER TABLE "istanze"
  ADD COLUMN "attivita_corrente_id" INTEGER,
  ADD COLUMN "assegnatario_id"      INTEGER;

-- AddColumn: completamento sull'attività
ALTER TABLE "workflows"
  ADD COLUMN "completata_at"     TIMESTAMP(3),
  ADD COLUMN "completata_da_id"  INTEGER;

-- Backfill 1: attività corrente e assegnatario.
-- "Ultima attività" = la più recente per data_variazione, con l'id a
-- dirimere la parità. È la definizione oggi usata dai tab della lista
-- (paged/route.ts), NON "una qualsiasi attività con operatore": quella
-- contava anche le istanze già prese in carico da altri.
WITH ultima AS (
  SELECT DISTINCT ON ("istanza_id")
         "istanza_id", "id", "operatore_id"
  FROM "workflows"
  ORDER BY "istanza_id", "data_variazione" DESC, "id" DESC
)
UPDATE "istanze" i
SET "attivita_corrente_id" = u."id",
    "assegnatario_id"      = u."operatore_id"
FROM ultima u
WHERE u."istanza_id" = i."id";

-- Backfill 2: chi ha chiuso l'attività, SOLO per le righe già completate.
-- Sulle righe aperte `operatore_id` significava assegnazione, che ora vive
-- su istanze.assegnatario_id: copiarlo qui trasformerebbe un'attività aperta
-- in una chiusa.
UPDATE "workflows" SET "completata_da_id" = "operatore_id" WHERE "stato" = 1;

-- Backfill 3: quando l'attività è stata chiusa. Il dato non esiste da
-- nessuna parte. Il proxy è la data_variazione dell'attività SUCCESSIVA
-- della stessa istanza — quando è partita la successiva, la precedente era
-- chiusa — con fallback sulla propria data_variazione per una riga chiusa
-- senza successiva. È un'approssimazione, e riguarda solo dati di sviluppo:
-- il sistema è in pre-produzione, non esistono istanze reali di cittadini.
UPDATE "workflows" w
SET "completata_at" = COALESCE(s."successiva", w."data_variazione")
FROM (
  SELECT "id",
         LEAD("data_variazione") OVER (PARTITION BY "istanza_id" ORDER BY "data_variazione", "id") AS "successiva"
  FROM "workflows"
) s
WHERE s."id" = w."id" AND w."stato" = 1;

-- Trigger 1: l'attività corrente è per definizione l'ultima inserita.
-- Nessuna applicazione scrive mai questa colonna, quindi non può divergere.
-- Chiude anche la divergenza fra "ORDER BY id DESC" e "data_variazione DESC":
-- sparisce la nozione di "ultimo per ordinamento".
CREATE OR REPLACE FUNCTION "imposta_attivita_corrente"() RETURNS trigger AS $$
BEGIN
  UPDATE "istanze" SET "attivita_corrente_id" = NEW."id" WHERE "id" = NEW."istanza_id";
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "attivita_corrente_su_insert"
AFTER INSERT ON "workflows"
FOR EACH ROW EXECUTE FUNCTION "imposta_attivita_corrente"();

-- Trigger 2: l'assegnazione decade a ogni cambio di fase (specifica B1).
-- La visibilità delle istanze è determinata dall'ufficio della fase
-- corrente: un'istanza che entra in una fase di un altro ufficio portandosi
-- dietro l'assegnatario precedente risulta, per quell'ufficio, già presa in
-- carico da chi non ci lavorerà. La regola sta qui e non nel codice perché
-- i percorsi di scrittura sono quattro, distribuiti su due applicazioni che
-- condividono questo database.
--
-- La guardia su OLD.fase_corrente_id IS NOT NULL è necessaria: `takeCharge`
-- valorizza la fase corrente delle istanze migrate che ce l'hanno a NULL, e
-- senza guardia quella prima assegnazione verrebbe azzerata nello stesso
-- statement che la crea.
CREATE OR REPLACE FUNCTION "azzera_assegnatario_al_cambio_fase"() RETURNS trigger AS $$
BEGIN
  IF OLD."fase_corrente_id" IS NOT NULL
     AND NEW."fase_corrente_id" IS DISTINCT FROM OLD."fase_corrente_id" THEN
    NEW."assegnatario_id" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assegnatario_al_cambio_fase"
BEFORE UPDATE ON "istanze"
FOR EACH ROW EXECUTE FUNCTION "azzera_assegnatario_al_cambio_fase"();

-- CreateIndex
CREATE UNIQUE INDEX "istanze_attivita_corrente_id_key" ON "istanze"("attivita_corrente_id");
CREATE INDEX "istanze_stato_assegnatario_id_idx" ON "istanze"("stato", "assegnatario_id");
CREATE INDEX "istanze_fase_corrente_id_idx" ON "istanze"("fase_corrente_id");

-- AddForeignKey
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_assegnatario_id_fkey"
  FOREIGN KEY ("assegnatario_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_attivita_corrente_id_fkey"
  FOREIGN KEY ("attivita_corrente_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_completata_da_id_fkey"
  FOREIGN KEY ("completata_da_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 2: Allineare lo schema Prisma a mano**

`prisma migrate dev --create-only` fallisce con P3014 in questo ambiente: lo schema si allinea a mano e la corrispondenza con l'SQL va controllata in revisione.

Modify `packages/db/prisma/schema.prisma`, nel modello `Istanza`, dopo il blocco `faseCorrente` (righe 394-395):

```prisma
  // Posizione corrente e assegnazione: colonne denormalizzate mantenute dal
  // DATABASE, non dal codice applicativo (specifica B3).
  //   - attivitaCorrenteId: trigger AFTER INSERT su istanza_attivita. Nessuna
  //     applicazione la scrive: la corrente è l'ultima inserita.
  //   - assegnatarioId: scritta da takeCharge, ma azzerata da un trigger
  //     BEFORE UPDATE quando cambia faseCorrenteId.
  // Il precedente di `last_step_id` (introdotta, andata fuori sincrono,
  // rimossa) è la ragione per cui non sono affidate al codice: due
  // applicazioni scrivono su questo database.
  attivitaCorrenteId  Int?      @unique @map("attivita_corrente_id")
  attivitaCorrente    Workflow? @relation("AttivitaCorrente", fields: [attivitaCorrenteId], references: [id], onDelete: SetNull)

  assegnatarioId      Int?       @map("assegnatario_id")
  assegnatario        Operatore? @relation("IstanzeAssegnate", fields: [assegnatarioId], references: [id], onDelete: SetNull)
```

E aggiungi agli indici del modello `Istanza` (dopo `@@index([stato])`):

```prisma
  @@index([stato, assegnatarioId])
  @@index([faseCorrenteId])
```

Nel modello `Workflow`, dopo il blocco `operatoreId`/`operatore` (righe 428-429):

```prisma
  // Completamento dell'attività. `completataDaId` è chi l'ha CHIUSA: storico,
  // non assegnazione. `completataAt` NULL = attività aperta, e sostituisce il
  // vecchio `stato` binario (rimosso nella migrazione di contrazione).
  completataAt    DateTime?  @map("completata_at")
  completataDaId  Int?       @map("completata_da_id")
  completataDa    Operatore? @relation("AttivitaCompletate", fields: [completataDaId], references: [id])

  istanzaCorrentePer Istanza? @relation("AttivitaCorrente")
```

Nel modello `Operatore`, accanto alle relazioni esistenti:

```prisma
  istanzeAssegnate    Istanza[]  @relation("IstanzeAssegnate")
  attivitaCompletate  Workflow[] @relation("AttivitaCompletate")
```

- [ ] **Step 3: Rigenerare il client Prisma**

Run: `npm run db:generate`
Expected: nessun errore. Se Prisma segnala una relazione ambigua, controlla di aver dato un nome (`@relation("...")`) a **tutte e tre** le nuove relazioni su entrambi i lati.

- [ ] **Step 4: Scrivere i test di integrazione**

Create `test/integration/posizione-corrente.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { Client } from 'pg';

let client: Client;

beforeAll(async () => {
  client = new Client({ connectionString: inject('urlPostgres') });
  await client.connect();
});

afterAll(async () => {
  await client?.end();
});

/** Crea area, servizio, due fasi con un ufficio ciascuna, un utente e un operatore. */
async function creaScenario(suffisso: string) {
  const ufficioA = await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ($1) RETURNING id`, [`Ufficio A ${suffisso}`]);
  const ufficioB = await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ($1) RETURNING id`, [`Ufficio B ${suffisso}`]);
  const area = await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ($1, $2) RETURNING id`, [`Area ${suffisso}`, `area-${suffisso}`]);
  const servizio = await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ($1, $2, $3) RETURNING id`,
    [`Servizio ${suffisso}`, `servizio-${suffisso}`, area.rows[0].id]);
  const faseUno = await client.query<{ id: number }>(
    `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ('Prima', 1, $1, $2) RETURNING id`,
    [servizio.rows[0].id, ufficioA.rows[0].id]);
  const faseDue = await client.query<{ id: number }>(
    `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ('Seconda', 2, $1, $2) RETURNING id`,
    [servizio.rows[0].id, ufficioB.rows[0].id]);
  const utente = await client.query<{ id: number }>(
    `INSERT INTO utenti (codice_fiscale, nome, cognome) VALUES ($1, 'Mario', 'Rossi') RETURNING id`,
    [`CF${suffisso}`.padEnd(16, 'X')]);
  const operatore = await client.query<{ id: number }>(
    `INSERT INTO operatori (username, nome, cognome, password) VALUES ($1, 'Anna', 'Bianchi', 'x') RETURNING id`,
    [`op-${suffisso}`]);
  return {
    servizioId: servizio.rows[0].id,
    faseUnoId: faseUno.rows[0].id,
    faseDueId: faseDue.rows[0].id,
    utenteId: utente.rows[0].id,
    operatoreId: operatore.rows[0].id,
  };
}

async function creaIstanza(s: { servizioId: number; utenteId: number; faseUnoId: number }, suffisso: string) {
  const res = await client.query<{ id: number }>(
    `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, fase_corrente_id)
     VALUES ($1, now(), $2, $3, $4) RETURNING id`,
    [`PROTO-${suffisso}`, s.utenteId, s.servizioId, s.faseUnoId]);
  return res.rows[0].id;
}

async function creaStep(faseId: number, servizioId: number, ordine: number) {
  const res = await client.query<{ id: number }>(
    `INSERT INTO steps (descrizione, ordine, fase_id, servizio_id, attivo)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [`Step ${ordine}`, ordine, faseId, servizioId]);
  return res.rows[0].id;
}

describe('attivita_corrente_id', () => {
  it('viene impostata dal trigger a ogni inserimento di attività, senza che nessuno la scriva', async () => {
    const s = await creaScenario('corrente');
    const istanzaId = await creaIstanza(s, 'corrente');
    const stepId = await creaStep(s.faseUnoId, s.servizioId, 1);

    const prima = await client.query<{ id: number }>(
      `INSERT INTO workflows (istanza_id, step_id, data_variazione) VALUES ($1, $2, now()) RETURNING id`,
      [istanzaId, stepId]);
    const dopo = await client.query<{ id: number }>(
      `INSERT INTO workflows (istanza_id, step_id, data_variazione) VALUES ($1, $2, now()) RETURNING id`,
      [istanzaId, stepId]);

    const { rows } = await client.query<{ attivita_corrente_id: number }>(
      `SELECT attivita_corrente_id FROM istanze WHERE id = $1`, [istanzaId]);
    expect(rows[0].attivita_corrente_id).toBe(dopo.rows[0].id);
    expect(rows[0].attivita_corrente_id).not.toBe(prima.rows[0].id);
  });

  it('è unica: la stessa attività non può essere corrente per due istanze', async () => {
    const s = await creaScenario('unica');
    const istanzaUno = await creaIstanza(s, 'unica-1');
    const istanzaDue = await creaIstanza(s, 'unica-2');
    const stepId = await creaStep(s.faseUnoId, s.servizioId, 1);
    const attivita = await client.query<{ id: number }>(
      `INSERT INTO workflows (istanza_id, step_id, data_variazione) VALUES ($1, $2, now()) RETURNING id`,
      [istanzaUno, stepId]);

    await expect(
      client.query(`UPDATE istanze SET attivita_corrente_id = $1 WHERE id = $2`,
        [attivita.rows[0].id, istanzaDue]),
    ).rejects.toMatchObject({ code: '23505' }); // unique_violation
  });
});

describe('assegnatario_id', () => {
  it('resta invariato quando cambia qualcosa che non è la fase corrente', async () => {
    const s = await creaScenario('invariato');
    const istanzaId = await creaIstanza(s, 'invariato');
    await client.query(`UPDATE istanze SET assegnatario_id = $1 WHERE id = $2`, [s.operatoreId, istanzaId]);

    await client.query(`UPDATE istanze SET proto_numero = 'ALTRO' WHERE id = $1`, [istanzaId]);

    const { rows } = await client.query<{ assegnatario_id: number | null }>(
      `SELECT assegnatario_id FROM istanze WHERE id = $1`, [istanzaId]);
    expect(rows[0].assegnatario_id).toBe(s.operatoreId);
  });

  it('viene azzerato dal trigger quando cambia la fase corrente', async () => {
    const s = await creaScenario('cambio-fase');
    const istanzaId = await creaIstanza(s, 'cambio-fase');
    await client.query(`UPDATE istanze SET assegnatario_id = $1 WHERE id = $2`, [s.operatoreId, istanzaId]);

    await client.query(`UPDATE istanze SET fase_corrente_id = $1 WHERE id = $2`, [s.faseDueId, istanzaId]);

    const { rows } = await client.query<{ assegnatario_id: number | null }>(
      `SELECT assegnatario_id FROM istanze WHERE id = $1`, [istanzaId]);
    expect(rows[0].assegnatario_id).toBeNull();
  });

  it('NON viene azzerato quando la fase corrente passa da NULL a una fase', async () => {
    // `takeCharge` valorizza la fase corrente delle istanze migrate che ce
    // l'hanno a NULL, nello stesso statement in cui assegna l'operatore:
    // senza la guardia OLD.fase_corrente_id IS NOT NULL quella prima
    // assegnazione verrebbe azzerata nell'atto stesso di crearla.
    const s = await creaScenario('da-null');
    const res = await client.query<{ id: number }>(
      `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id)
       VALUES ('PROTO-DA-NULL', now(), $1, $2) RETURNING id`, [s.utenteId, s.servizioId]);
    const istanzaId = res.rows[0].id;

    await client.query(
      `UPDATE istanze SET assegnatario_id = $1, fase_corrente_id = $2 WHERE id = $3`,
      [s.operatoreId, s.faseUnoId, istanzaId]);

    const { rows } = await client.query<{ assegnatario_id: number | null }>(
      `SELECT assegnatario_id FROM istanze WHERE id = $1`, [istanzaId]);
    expect(rows[0].assegnatario_id).toBe(s.operatoreId);
  });
});
```

- [ ] **Step 5: Verificare che i test falliscano senza la migrazione**

Qui l'implementazione *è* la migrazione, già scritta allo Step 1: il fallimento va provocato togliendola.

```bash
mv packages/db/prisma/migrations/20260807100000_posizione_corrente_espansione /tmp/espansione
npm run test:integration -- posizione-corrente
```
Expected: FAIL — `column "attivita_corrente_id" does not exist`.

```bash
mv /tmp/espansione packages/db/prisma/migrations/20260807100000_posizione_corrente_espansione
```

Su PowerShell usa `Move-Item` e una cartella dello scratchpad al posto di `/tmp`. **Ripristina la cartella prima di proseguire.**

- [ ] **Step 6: Eseguire i test e verificare che passino**

Run: `npm run test:integration`
Expected: PASS, tutti i file inclusi i tre preesistenti.

- [ ] **Step 7: Verifica negativa sul trigger di azzeramento**

Commenta nel file di migrazione le due righe del corpo di `azzera_assegnatario_al_cambio_fase` che azzerano (`NEW."assegnatario_id" := NULL;`), quindi:

Run: `npm run test:integration -- posizione-corrente`
Expected: FAIL su "viene azzerato dal trigger quando cambia la fase corrente".

**Ripristina la riga e riesegui prima di committare.**

- [ ] **Step 8: Verificare che l'albero regga**

Run: `npm test`
Run: `cd citta-semplice-office && npx tsc --noEmit && cd ../citta-semplice-portal && npx tsc --noEmit && cd ..`
Run: `npm run build`
Expected: tutto verde. Nessun codice applicativo è stato toccato: le colonne nuove esistono e nessuno le legge ancora.

- [ ] **Step 9: Commit**

```bash
git add packages/db/prisma/migrations/20260807100000_posizione_corrente_espansione packages/db/prisma/schema.prisma packages/db/generated test/integration/posizione-corrente.test.ts
git commit -m "feat(db): posizione corrente e assegnazione dell'istanza, mantenute da trigger"
```

---

## Task 4: Le scritture passano alle colonne nuove

Chiude A1 e A2. Scrittura doppia: le colonne vecchie continuano a essere scritte come oggi, perché le letture non sono ancora convertite. La contrazione (Task 9) rieseguirà il backfill per le righe nate in questa finestra.

**Files:**
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts` — `advanceWorkflow` (~183-360), `takeCharge` (~705-797), `rollbackFase` (~1228-1283), e ogni altro punto che il `grep` sotto rivela
- Modify: `citta-semplice-portal/src/lib/actions/istanza.ts:433` — creazione della prima attività all'invio

**Interfaces:**
- Consumes: i campi Prisma prodotti dal Task 3.
- Produces: dopo questo task, `istanze.assegnatario_id` è la fonte di verità dell'assegnazione e `workflows.completata_at` del completamento. Li leggono i Task 5, 6, 7.

- [ ] **Step 1: Censire i punti di scrittura**

Run:
```bash
grep -rn "workflow\.create\|workflow\.update\|tx\.workflow\|STATO_COMPLETATA\|STATO_IN_LAVORAZIONE" \
  citta-semplice-office/src citta-semplice-portal/src --include=*.ts --include=*.tsx
```

Il risultato del `grep` prevale sull'elenco di questo task. Al momento della stesura sono 14 occorrenze in `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts` più una in `citta-semplice-portal/src/lib/actions/istanza.ts`. Annota l'elenco completo prima di procedere.

- [ ] **Step 2: Regola di conversione, da applicare a ogni punto censito**

Applica meccanicamente queste tre sostituzioni:

1. Ogni `data: { ..., stato: STATO_COMPLETATA }` su un'attività diventa
   `data: { ..., stato: STATO_COMPLETATA, completataAt: now, completataDaId: operatoreId }`.
   Se in quello scope non esiste già una costante `now`, dichiarala: `const now = new Date();`.
2. Ogni `stato: STATO_IN_LAVORAZIONE` resta invariato e **non** aggiunge `completataAt`
   (l'attività è aperta: `completataAt` deve restare `null`).
3. Ogni scrittura di `operatoreId` su un'attività **appena creata** va rimossa: l'assegnazione non vive più lì. Vedi gli Step 3-5 per i tre punti in cui questo cambia comportamento.

- [ ] **Step 3: `takeCharge` — l'assegnazione va sull'istanza**

Modify `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts`, nel corpo di `takeCharge`, sostituendo il blocco `if (lastWorkflow) { ... } else { ... }` e il fallback sulla fase corrente (righe ~760-787) con:

```ts
    // L'assegnazione vive su istanze.assegnatario_id, non sulla riga di
    // attività: una sola UPDATE, che imposta anche la fase corrente per le
    // istanze migrate che ce l'hanno a NULL. Il trigger di azzeramento non
    // scatta in quel caso (guardia su OLD.fase_corrente_id IS NOT NULL), ma
    // scatterebbe se le due scritture fossero separate e la seconda cambiasse
    // la fase dopo aver assegnato.
    await prisma.istanza.update({
      where: { id: istanzaId },
      data: {
        assegnatarioId: operatoreId,
        ...(istanza.faseCorrenteId === null && firstStep.faseId
          ? { faseCorrenteId: firstStep.faseId }
          : {}),
      },
    });

    if (!lastWorkflow) {
      // Edge case: nessuna attività esistente (legacy) — creala al primo step
      // del servizio. Senza operatoreId: chi la prende in carico è
      // sull'istanza.
      await prisma.workflow.create({
        data: {
          istanzaId,
          stepId: firstStep.id,
          stato: STATO_IN_LAVORAZIONE,
          dataVariazione: now,
          note: '',
        },
      });
    }
```

E sostituisci la guardia "già presa in carico" (righe ~756-758):

```ts
    if (istanza.assegnatarioId !== null) {
      return { success: false, message: 'Istanza già presa in carico' };
    }
```

Aggiungi `assegnatarioId: true` non serve: `findUnique` senza `select` restituisce già tutti gli scalari dell'istanza. Verifica invece che la `include` di `workflows` con `orderBy: { id: 'desc' }` (riga ~735) non serva più a nulla se non alla guardia `!lastWorkflow`: lasciala, ma **cambia `orderBy` in `{ dataVariazione: 'desc' }`** per non lasciare in giro la seconda definizione di "ultimo" (difetto A4).

- [ ] **Step 4: `advanceWorkflow` — niente assegnazione sulle attività create**

Modify lo stesso file, nella `$transaction` di `advanceWorkflow`:

- nella `tx.workflow.update` dell'attività che si chiude (righe ~246-253), sostituisci `operatoreId,` con `completataAt: now, completataDaId: operatoreId,` **mantenendo** `operatoreId,` finché la contrazione non lo rimuove;
- nella `tx.workflow.create` dello step successivo della stessa fase (righe ~257-265), **rimuovi** la riga `operatoreId,`;
- nella `tx.workflow.create` del primo step della fase successiva (righe ~327-335), **rimuovi** la riga `operatoreId,`.

Il commento accanto alla prima `create` ("Nessun update su istanza: lo step corrente è quello dell'ultimo workflow") non è più vero: sostituiscilo con

```ts
        // L'attività corrente la imposta il trigger sull'INSERT. L'assegnatario
        // resta quello che era: si cambia fase, non ufficio.
```

e accanto alla seconda:

```ts
          // Cambio di fase: il trigger su istanze ha già azzerato
          // l'assegnatario nell'UPDATE di fase_corrente_id qui sopra.
          // L'istanza si presenta come "Nuova" all'ufficio che la riceve.
```

- [ ] **Step 5: `rollbackFase` — nessuna modifica di assegnazione**

`rollbackFase` già crea l'attività senza `operatoreId`: è il comportamento corretto, e ora è il trigger a garantirlo anche se qualcuno lo cambiasse. Aggiungi solo, nella `tx.workflowFase.updateMany` che chiude la fase, la conversione della regola 1 se applicabile, e verifica con il `grep` dello Step 1 che non ci siano altre scritture di `operatoreId` su attività in questa funzione.

- [ ] **Step 6: Portale — la prima attività nasce non assegnata**

Modify `citta-semplice-portal/src/lib/actions/istanza.ts:433`: verifica che la `prisma.workflow.create` dell'invio **non** passi `operatoreId`. Se lo passa, rimuovilo. Non aggiunge `assegnatarioId` sull'istanza: l'invio non assegna nessuno, e `NULL` è già il default.

- [ ] **Step 7: Verificare che l'albero regga**

Run: `npm test`
Run: `cd citta-semplice-office && npx tsc --noEmit && cd ../citta-semplice-portal && npx tsc --noEmit && cd ..`
Run: `npm run build`
Expected: tutto verde. Le letture non sono ancora convertite e leggono le colonne vecchie, che continuano a essere scritte.

- [ ] **Step 8: Commit**

```bash
git add citta-semplice-office/src/app/\(dashboard\)/istanze/\[id\]/actions.ts citta-semplice-portal/src/lib/actions/istanza.ts
git commit -m "feat(office,portal): l'assegnazione dell'istanza si scrive su istanze.assegnatario_id"
```

---

## Task 5: La lista paginata perde le query raw

Chiude A3 e A4. È il task che porta il valore misurabile del piano.

**Files:**
- Create: `citta-semplice-office/src/lib/istanze/filtri-tab.ts`
- Create: `test/integration/tab-istanze.test.ts`
- Modify: `citta-semplice-office/src/app/api/istanze/paged/route.ts:40-84, 202-268, 325-352`
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/istanze-client.tsx:36`

**Interfaces:**
- Consumes: `Istanza.assegnatarioId`, `Istanza.attivitaCorrente` (Task 3).
- Produces: `whereTab(tab: string, operatoreId: number): Prisma.IstanzaWhereInput` — usata sia dalla lista sia dai contatori, così non possono divergere.

- [ ] **Step 1: Scrivere il modulo dei filtri**

Create `citta-semplice-office/src/lib/istanze/filtri-tab.ts`:

```ts
import { Prisma, whereStato, whereVisibileAgliOperatori } from '@citta/db';

/**
 * I `where` dei tab della lista istanze, in un solo posto.
 *
 * Prima erano `$queryRaw` con una subquery correlata che materializzava in
 * memoria Node TUTTI gli id corrispondenti, per rimandarli al database come
 * `WHERE id IN (...)`; e la stessa subquery era ripetuta sei volte fra lista e
 * contatori. Da quando l'assegnazione è una colonna indicizzata su `istanze`,
 * sono tre condizioni ordinarie — ed essendo condivise, lista e contatori non
 * possono più divergere.
 */
export function whereTab(tab: string, operatoreId: number): Prisma.IstanzaWhereInput {
  switch (tab) {
    case 'nuove':
      return { ...whereStato('IN_LAVORAZIONE'), assegnatarioId: null };
    case 'mie':
      return { ...whereStato('IN_LAVORAZIONE'), assegnatarioId: operatoreId };
    case 'altri':
      // `not: operatoreId` su colonna nullable non esclude i NULL in modo
      // ovvio: la condizione voluta è "assegnata E non a me", quindi le due
      // clausole si scrivono separate.
      return {
        ...whereStato('IN_LAVORAZIONE'),
        assegnatarioId: { not: null },
        NOT: { assegnatarioId: operatoreId },
      };
    case 'respinte':
      return whereStato('RESPINTA');
    case 'concluse':
      return whereStato('CONCLUSA');
    default:
      return whereVisibileAgliOperatori();
  }
}

export const TAB_CONTEGGIATI = ['nuove', 'mie', 'altri', 'respinte', 'concluse'] as const;
```

- [ ] **Step 2: Scrivere il test di equivalenza (fallirà)**

Create `test/integration/tab-istanze.test.ts`. Costruisce le sette configurazioni rilevanti e verifica insiemi e conteggi con SQL che riproduce **le condizioni della specifica**, non l'implementazione TypeScript:

```ts
import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { Client } from 'pg';

let client: Client;
let scenario: Awaited<ReturnType<typeof costruisciDataset>>;

beforeAll(async () => {
  client = new Client({ connectionString: inject('urlPostgres') });
  await client.connect();
  scenario = await costruisciDataset();
});

afterAll(async () => {
  await client?.end();
});

/**
 * Sette istanze, una per configurazione rilevante. I nomi delle chiavi sono
 * la specifica del caso: se un tab cambia comportamento, il test dice quale
 * caso si è rotto invece di "un id in meno".
 */
async function costruisciDataset() {
  const ufficioA = (await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ('Ufficio Tab A') RETURNING id`)).rows[0].id;
  const ufficioB = (await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ('Ufficio Tab B') RETURNING id`)).rows[0].id;
  const area = (await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ('Area Tab', 'area-tab') RETURNING id`)).rows[0].id;
  const servizio = (await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ('Servizio Tab', 'servizio-tab', $1) RETURNING id`,
    [area])).rows[0].id;
  const faseUno = (await client.query<{ id: number }>(
    `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ('Prima', 1, $1, $2) RETURNING id`,
    [servizio, ufficioA])).rows[0].id;
  const faseDue = (await client.query<{ id: number }>(
    `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ('Seconda', 2, $1, $2) RETURNING id`,
    [servizio, ufficioB])).rows[0].id;
  const utente = (await client.query<{ id: number }>(
    `INSERT INTO utenti (codice_fiscale, nome, cognome) VALUES ('CFTABXXXXXXXXXX', 'Mario', 'Rossi') RETURNING id`)).rows[0].id;
  const io = (await client.query<{ id: number }>(
    `INSERT INTO operatori (username, nome, cognome, password) VALUES ('io-tab', 'Anna', 'Bianchi', 'x') RETURNING id`)).rows[0].id;
  const altro = (await client.query<{ id: number }>(
    `INSERT INTO operatori (username, nome, cognome, password) VALUES ('altro-tab', 'Luca', 'Verdi', 'x') RETURNING id`)).rows[0].id;

  async function istanza(proto: string, stato: string, faseId: number | null, assegnatario: number | null) {
    const res = await client.query<{ id: number }>(
      `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, stato, fase_corrente_id, assegnatario_id)
       VALUES ($1, now(), $2, $3, $4::"StatoIstanza", $5, $6) RETURNING id`,
      [proto, utente, servizio, stato, faseId, assegnatario]);
    return res.rows[0].id;
  }

  return {
    io, altro, faseUno, faseDue,
    nonAssegnata:  await istanza('TAB-1', 'IN_LAVORAZIONE', faseUno, null),
    mia:           await istanza('TAB-2', 'IN_LAVORAZIONE', faseUno, io),
    diAltri:       await istanza('TAB-3', 'IN_LAVORAZIONE', faseUno, altro),
    conclusa:      await istanza('TAB-4', 'CONCLUSA',       faseDue, io),
    respinta:      await istanza('TAB-5', 'RESPINTA',       faseUno, io),
    bozza:         await istanza('TAB-6', 'BOZZA',          null,    null),
    daAvanzare:    await istanza('TAB-7', 'IN_LAVORAZIONE', faseUno, io),
  };
}

async function idsDelTab(tab: 'nuove' | 'mie' | 'altri', operatoreId: number): Promise<number[]> {
  const condizione = {
    nuove: `assegnatario_id IS NULL`,
    mie: `assegnatario_id = $1`,
    altri: `assegnatario_id IS NOT NULL AND assegnatario_id <> $1`,
  }[tab];
  const { rows } = await client.query<{ id: number }>(
    `SELECT id FROM istanze WHERE stato = 'IN_LAVORAZIONE' AND ${condizione} AND proto_numero LIKE 'TAB-%' ORDER BY id`,
    [operatoreId]);
  return rows.map((r) => r.id);
}

describe('tab della lista istanze', () => {
  it('"Nuove" contiene solo le istanze in lavorazione non assegnate', async () => {
    expect(await idsDelTab('nuove', scenario.io)).toEqual([scenario.nonAssegnata]);
  });

  it('"Mie" contiene solo le istanze in lavorazione assegnate a me', async () => {
    expect(await idsDelTab('mie', scenario.io)).toEqual([scenario.mia, scenario.daAvanzare]);
  });

  it('"Di altri" esclude sia le mie sia quelle non assegnate', async () => {
    expect(await idsDelTab('altri', scenario.io)).toEqual([scenario.diAltri]);
  });

  it('i tre tab sono una partizione: la loro somma è il totale delle istanze in lavorazione', async () => {
    // È il difetto che la subquery correlata era stata introdotta a
    // correggere: prima nuove + mie + altri superava il totale.
    const [nuove, mie, altri] = await Promise.all([
      idsDelTab('nuove', scenario.io), idsDelTab('mie', scenario.io), idsDelTab('altri', scenario.io),
    ]);
    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM istanze WHERE stato = 'IN_LAVORAZIONE' AND proto_numero LIKE 'TAB-%'`);
    expect(nuove.length + mie.length + altri.length).toBe(Number(rows[0].count));
    expect(new Set([...nuove, ...mie, ...altri]).size).toBe(nuove.length + mie.length + altri.length);
  });

  it('un avanzamento a una fase di un altro ufficio riporta l istanza fra le "Nuove"', async () => {
    // È il difetto A1: prima l'istanza arrivava all'ufficio successivo già
    // presa in carico da chi non ci avrebbe lavorato.
    await client.query(`UPDATE istanze SET fase_corrente_id = $1 WHERE id = $2`,
      [scenario.faseDue, scenario.daAvanzare]);

    expect(await idsDelTab('nuove', scenario.io)).toContain(scenario.daAvanzare);
    expect(await idsDelTab('mie', scenario.io)).not.toContain(scenario.daAvanzare);
  });

  it('le bozze non compaiono in nessun tab', async () => {
    const [nuove, mie, altri] = await Promise.all([
      idsDelTab('nuove', scenario.io), idsDelTab('mie', scenario.io), idsDelTab('altri', scenario.io),
    ]);
    expect([...nuove, ...mie, ...altri]).not.toContain(scenario.bozza);
  });
});
```

- [ ] **Step 3: Eseguire il test**

Run: `npm run test:integration -- tab-istanze`
Expected: PASS. Le condizioni sono già soddisfatte dallo schema del Task 3 e dal trigger: questo test fissa il comportamento **atteso dalla lista**, che lo Step 4 deve riprodurre in Prisma.

- [ ] **Step 4: Riscrivere i contatori**

Modify `citta-semplice-office/src/app/api/istanze/paged/route.ts`, sostituendo interamente `getIstanzeCounts` (righe 40-84):

```ts
async function getIstanzeCounts(visibilita: VisibilitaOperatore) {
  const operatoreId = visibilita.operatoreId;
  const visibilitaFilter = istanzaVisibilityWhere(visibilita);

  const [nuove, inLavorazionePropria, inLavorazioneAltri, respinte, concluse, totale] =
    await Promise.all(
      [
        whereTab('nuove', operatoreId),
        whereTab('mie', operatoreId),
        whereTab('altri', operatoreId),
        whereTab('respinte', operatoreId),
        whereTab('concluse', operatoreId),
        whereVisibileAgliOperatori(),
      ].map((where) =>
        prisma.istanza.count({ where: { ...where, AND: [visibilitaFilter] } }),
      ),
    );

  return { nuove, inLavorazionePropria, inLavorazioneAltri, respinte, concluse, totale };
}
```

Rimuovi dagli import di quel file `sqlStato` e `whereStato` se il `grep` conferma che non sono più usati altrove nel file; aggiungi `import { whereTab } from '@/lib/istanze/filtri-tab';`.

- [ ] **Step 5: Riscrivere i tab della lista**

Nello stesso file, sostituisci lo `switch (tab)` (righe 202-219) con:

```ts
  Object.assign(whereClause, whereTab(tab, operatoreId));
```

ed elimina interamente il blocco `idConstraints` per i tab (righe 221-255): le tre `$queryRaw` di `nuove`/`mie`/`altri` spariscono. Il vettore `idConstraints` resta, ma solo per i due filtri di colonna che seguono:

```ts
  // Restano due filtri che non dipendono dall'assegnazione e che Prisma non
  // esprime: il formato di data italiano e la ricerca sull'assegnatario per
  // nome. Il secondo diventa una condizione ordinaria; il primo resta raw.
  const idConstraints: number[][] = [];
```

- [ ] **Step 6: Convertire il filtro di colonna "operatore"**

Sostituisci il blocco `operatoreFilter` (righe 257-268) con:

```ts
  const operatoreFilter = columnFilters.find((f) => f.key === 'operatore');
  if (operatoreFilter?.value) {
    whereClause.assegnatario = {
      OR: [
        { cognome: { contains: operatoreFilter.value, mode: 'insensitive' } },
        { nome: { contains: operatoreFilter.value, mode: 'insensitive' } },
      ],
    };
  }
```

- [ ] **Step 7: Sostituire il sotto-select per riga con un join**

Nella `prisma.istanza.findMany` (righe 325-352), sostituisci il blocco `workflows: { orderBy: ..., take: 1, include: {...} }` con:

```ts
        attivitaCorrente: {
          include: {
            step: { select: { descrizione: true, ordine: true } },
          },
        },
        assegnatario: { select: { id: true, nome: true, cognome: true } },
```

- [ ] **Step 8: Aggiornare il tipo della riga di lista**

Modify `citta-semplice-office/src/app/(dashboard)/istanze/istanze-client.tsx:36`: il campo `workflows: [...]` diventa

```tsx
  attivitaCorrente: {
    step: { descrizione: string; ordine: number } | null;
  } | null;
  assegnatario: { id: number; nome: string; cognome: string } | null;
```

Riverifica con `npx tsc --noEmit` quali punti del componente leggevano `workflows[0]`: il risultato del compilatore prevale su questo elenco.

- [ ] **Step 9: Verificare che non resti alcuna query raw legata all'assegnazione**

Run:
```bash
grep -n "queryRaw" citta-semplice-office/src/app/api/istanze/paged/route.ts
```
Expected: **una sola** occorrenza, quella del filtro `TO_CHAR(data_invio, 'DD/MM/YYYY')` (esplicitamente fuori perimetro nella specifica).

Run:
```bash
grep -n "id: { in:" citta-semplice-office/src/app/api/istanze/paged/route.ts
```
Expected: una sola occorrenza, dentro il blocco `if (idConstraints.length > 0)` che ora serve solo al filtro di data.

- [ ] **Step 10: Verificare che l'albero regga**

Run: `npm test`
Run: `cd citta-semplice-office && npx tsc --noEmit && cd ..`
Run: `npm run build`

- [ ] **Step 11: Verifica negativa**

Cambia temporaneamente in `filtri-tab.ts` il caso `'altri'` rimuovendo la clausola `assegnatarioId: { not: null }`.

Run: `npm run test:integration -- tab-istanze`
Expected: FAIL su "i tre tab sono una partizione" — il tab "Di altri" tornerebbe a includere le non assegnate.

Se il test **non** fallisce, significa che riproduce la specifica in SQL invece di esercitare `whereTab`: aggiungi al file un test che importa `whereTab` e ne verifica il risultato contro il database via Prisma. **Ripristina la clausola prima di committare.**

- [ ] **Step 12: Commit**

```bash
git add citta-semplice-office/src/lib/istanze/filtri-tab.ts citta-semplice-office/src/app/api/istanze/paged/route.ts citta-semplice-office/src/app/\(dashboard\)/istanze/istanze-client.tsx test/integration/tab-istanze.test.ts
git commit -m "perf(office): i tab della lista istanze diventano filtri su indice, via le query raw"
```

---

## Task 6: Le letture dell'office passano dalla funzione pura

**Files:**
- Modify: `citta-semplice-office/src/lib/models/stato-istanza.ts`
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/workflow-timeline.tsx:265-305, 396`
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts:79-82, 931`
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx:137`

**Interfaces:**
- Consumes: `statoAttivita`, `ETICHETTE_STATO_ATTIVITA`, `ContestoIstanza` (Task 2); `attivitaCorrenteId`, `assegnatarioId`, `completataAt` (Task 3).

- [ ] **Step 1: Censire i punti di lettura**

Run:
```bash
grep -rn "\.stato === 1\|\.stato === 0\|operatoreId === null\|operatoreId !== null\|getStatoLabel\|STATO_INDEFINITO" \
  citta-semplice-office/src --include=*.ts --include=*.tsx
```
Il risultato prevale sull'elenco di questo task.

- [ ] **Step 2: Convertire il badge di stato dell'istanza**

Modify `citta-semplice-office/src/lib/models/stato-istanza.ts`, sostituendo `StatoIstanzaInput` e `getStatoIstanza`:

```ts
import type { StatoIstanzaValore, AttivitaPerStato } from '@citta/db';
import { statoAttivita } from '@citta/db';

export interface StatoIstanzaInput {
  stato: StatoIstanzaValore;
  /** attività corrente dell'istanza, se ne ha una */
  attivitaCorrente?: AttivitaPerStato | null;
  attivitaCorrenteId: number | null;
  assegnatarioId: number | null;
}

export function getStatoIstanza(istanza: StatoIstanzaInput): StatoIstanza {
  if (istanza.stato === 'CONCLUSA') return { label: 'Conclusa', variant: 'success' };
  if (istanza.stato === 'RESPINTA') return { label: 'Respinta', variant: 'danger' };
  if (istanza.stato === 'BOZZA') return { label: 'Bozza', variant: 'secondary' };

  if (!istanza.attivitaCorrente) return { label: 'In Attesa', variant: 'secondary' };

  switch (statoAttivita(istanza.attivitaCorrente, istanza)) {
    case 'COMPLETATA': return { label: 'Completata', variant: 'success' };
    case 'IN_LAVORAZIONE': return { label: 'In Lavorazione', variant: 'primary' };
    default: return { label: 'In Attesa', variant: 'secondary' };
  }
}
```

Aggiorna il blocco di commento in testa al file: la riga "Ordine di valutazione: stato terminale → ultimo workflow" diventa "stato terminale → attività corrente".

- [ ] **Step 3: Convertire la timeline**

Modify `citta-semplice-office/src/app/(dashboard)/istanze/[id]/workflow-timeline.tsx`, sostituendo `getStatusClass`, `getActiveWorkflowForStep` e `statoLabel`:

```tsx
  const contesto = { attivitaCorrenteId, assegnatarioId };

  function stepStatus(stepId: number) {
    const events = eventsByStepId.get(stepId);
    if (!events || events.length === 0) return '';
    const last = events[events.length - 1];
    return statoAttivita(last, contesto) === 'COMPLETATA' ? 'completed' : 'pending';
  }

  function getActiveWorkflowForStep(stepId: number) {
    return eventsByStepId.get(stepId)?.find((wf) => statoAttivita(wf, contesto) === 'IN_LAVORAZIONE') ?? null;
  }

  function statoLabel(wf: Workflow) {
    return ETICHETTE_STATO_ATTIVITA[statoAttivita(wf, contesto)];
  }
```

Aggiungi `attivitaCorrenteId: number | null` e `assegnatarioId: number | null` alle props del componente, aggiorna il tipo `Workflow` locale (riga ~15) sostituendo `operatoreId: number | null` con `completataAt: Date | string | null`, e importa `statoAttivita, ETICHETTE_STATO_ATTIVITA` da `@citta/db`.

Alla riga ~396, la condizione del pulsante di pagamento diventa:

```tsx
              {!pagamento && reached && last && statoAttivita(last, contesto) === 'IN_LAVORAZIONE' && step.pagamento && (
```

**Nota sul tipo di `completataAt`:** se la prop arriva serializzata da un server component, `statoAttivita` va chiamata con `completataAt` già convertita a `Date | null`. Normalizza dove costruisci le props, non dentro la funzione pura.

- [ ] **Step 4: Rimuovere `getStatoLabel`**

Modify `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts`: elimina `getStatoLabel` (righe 79-83) e le tre costanti `STATO_INDEFINITO`/`STATO_IN_LAVORAZIONE`/`STATO_COMPLETATA` **se e solo se** il `grep` dello Step 1 conferma che non hanno più consumatori (le prime due sono ancora scritte nel Task 4: `STATO_INDEFINITO` no). Alla riga ~931 sostituisci

```ts
      status: getStatoLabel(i.workflows[0]?.operatoreId ?? null, i.workflows[0]?.stato ?? 0),
```

con

```ts
      status: i.attivitaCorrente
        ? ETICHETTE_STATO_ATTIVITA[statoAttivita(i.attivitaCorrente, i)]
        : ETICHETTE_STATO_ATTIVITA.IN_ATTESA,
```

e aggiorna la `include` di quella query (righe ~910-915) sostituendo `workflows: {...}` con `attivitaCorrente: true`.

- [ ] **Step 5: Convertire il dettaglio istanza**

Modify `citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx`. Alla riga ~137, la catena che risolve "di chi è questa istanza" passando per `lastWorkflow.operatore.id` diventa:

```tsx
    : istanza.assegnatarioId === operatoreId
```

Nella query della pagina (riga ~47), accanto a `workflows` — che resta, perché la timeline riceve l'elenco completo delle attività — aggiungi:

```tsx
      attivitaCorrente: true,
      assegnatario: { select: { id: true, nome: true, cognome: true } },
```

e passa alla timeline le due nuove props introdotte allo Step 3:

```tsx
        attivitaCorrenteId={istanza.attivitaCorrenteId}
        assegnatarioId={istanza.assegnatarioId}
```

Il `grep` dello Step 1 e `tsc` allo Step 6 dicono se restano altri punti: prevalgono su questo elenco.

- [ ] **Step 6: Verificare che l'albero regga**

Run: `npm test`
Run: `cd citta-semplice-office && npx tsc --noEmit && cd ..`
Run: `npm run build`
Expected: verde. Se `tsc` segnala punti non elencati qui, convertili: il compilatore è il censimento vero.

- [ ] **Step 7: Test del chiamante**

La funzione pura è testata dal Task 2, ma nessun test esercita ancora un chiamante: reintrodurre la derivazione inline nella UI lascerebbe tutto verde. Aggiungi a `citta-semplice-office/test/stato-istanza-badge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getStatoIstanza } from '../src/lib/models/stato-istanza';

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
```

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add citta-semplice-office/src citta-semplice-office/test
git commit -m "refactor(office): stato dell'attivita letto dalla funzione pura, via la coppia (operatore, stato)"
```

---

## Task 7: Le letture del portale passano dalla funzione pura

Chiude il valore sentinella `-1`, che nasce qui.

**Files:**
- Modify: `citta-semplice-portal/src/lib/actions/le-mie-istanze.ts:50-58, 83`
- Modify: `citta-semplice-portal/src/app/(portal)/le-mie-istanze/[id]/page.tsx:131-137, 155-168, 462`

**Interfaces:**
- Consumes: `statoAttivita`, `ETICHETTE_STATO_ATTIVITA`, `StatoAttivita` (Task 2).
- **Attenzione:** il campo `stato: number` esposto da `getIstanzePaginate` è consumato dalla UI del portale. Diventa `stato: StatoAttivita`. Riverifica i consumatori con `tsc`.

- [ ] **Step 1: Censire i punti di lettura**

Run:
```bash
grep -rn "operatoreId\|wf\.stato\|\.stato === 1\|=== -1" citta-semplice-portal/src --include=*.ts --include=*.tsx
```

- [ ] **Step 2: Convertire l'action di lista**

Modify `citta-semplice-portal/src/lib/actions/le-mie-istanze.ts`: nella `include` (righe ~50-58) sostituisci il blocco `workflows: {...}` con

```ts
        attivitaCorrente: { include: { step: { select: { descrizione: true } } } },
```

e alla riga ~82-83 sostituisci le due righe `faseAttuale` / `stato` con

```ts
      faseAttuale: i.attivitaCorrente?.step?.descrizione ?? null,
      stato: i.attivitaCorrente
        ? statoAttivita(i.attivitaCorrente, i)
        : ('IN_ATTESA' satisfies StatoAttivita),
```

Importa `statoAttivita` e il tipo `StatoAttivita` da `@citta/db`, e aggiorna il tipo del campo `stato` nell'interfaccia del risultato da `number` a `StatoAttivita`.

- [ ] **Step 3: Convertire il badge del dettaglio**

Modify `citta-semplice-portal/src/app/(portal)/le-mie-istanze/[id]/page.tsx`, sostituendo `getStatoBadge` (righe 131-137):

```tsx
function getStatoBadge(istanza: { stato: StatoIstanzaValore; assegnatarioId: number | null }) {
  if (istanza.stato === 'CONCLUSA') return { label: 'Conclusa', cls: 'bg-success' };
  if (istanza.stato === 'RESPINTA') return { label: 'Respinta', cls: 'bg-danger' };
  // "Presa in carico" era `workflows.some(operatoreId !== null)`: contava anche
  // gli step chiusi da un operatore che non ci lavora più. Ora è una domanda
  // sola, con una sola risposta.
  if (istanza.assegnatarioId !== null) return { label: 'In lavorazione', cls: 'bg-primary' };
  return { label: 'In attesa', cls: 'bg-secondary' };
}
```

Alla riga ~462, sostituisci l'espressione ternaria annidata con

```tsx
                                  {ETICHETTE_STATO_ATTIVITA[statoAttivita(wf, istanza)]}
```

`istanza` soddisfa già `ContestoIstanza` avendo `attivitaCorrenteId` e `assegnatarioId` fra i suoi scalari.

- [ ] **Step 4: Verificare che l'albero regga**

Run: `npm test`
Run: `cd citta-semplice-portal && npx tsc --noEmit && cd ..`
Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add citta-semplice-portal/src
git commit -m "refactor(portal): stato dell'attivita dalla funzione pura, via il valore sentinella -1"
```

---

## Task 8: Verifica su volume — 100.000 istanze e `EXPLAIN`

Copre il criterio P2 della specifica di dominio senza rendere `npm test` ineseguibile a ogni commit.

**Files:**
- Create: `test/integration/tab-istanze-volume.test.ts`

- [ ] **Step 1: Scrivere il test opt-in**

Create `test/integration/tab-istanze-volume.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import { Client } from 'pg';

/**
 * Test di volume: escluso dalla suite ordinaria.
 *
 * Si esegue con `TEST_VOLUME=1 npm run test:integration -- tab-istanze-volume`.
 * Genera 100.000 istanze e verifica che i tre tab usino l'indice
 * (stato, assegnatario_id) invece di un sequential scan — il criterio P2
 * della specifica di dominio. Senza la variabile d'ambiente il file esce
 * subito, così `npm test` resta eseguibile a ogni commit.
 */
const ATTIVO = process.env.TEST_VOLUME === '1';
const ISTANZE = 100_000;

let client: Client;

beforeAll(async () => {
  if (!ATTIVO) return;
  client = new Client({ connectionString: inject('urlPostgres') });
  await client.connect();
  await seed();
}, 600_000);

afterAll(async () => {
  await client?.end();
});

async function seed() {
  const area = (await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ('Area Volume', 'area-volume') RETURNING id`)).rows[0].id;
  const servizio = (await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ('Servizio Volume', 'servizio-volume', $1) RETURNING id`,
    [area])).rows[0].id;
  const utente = (await client.query<{ id: number }>(
    `INSERT INTO utenti (codice_fiscale, nome, cognome) VALUES ('CFVOLXXXXXXXXXX', 'Mario', 'Rossi') RETURNING id`)).rows[0].id;
  const operatori = await client.query<{ id: number }>(
    `INSERT INTO operatori (username, nome, cognome, password)
     SELECT 'vol-' || g, 'Op', 'Volume', 'x' FROM generate_series(1, 20) g RETURNING id`);
  const ids = operatori.rows.map((r) => r.id);

  // Distribuzione realistica: un terzo non assegnate, il resto sparse fra 20
  // operatori. Un indice su una colonna quasi tutta NULL non direbbe nulla.
  await client.query(
    `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, stato, assegnatario_id)
     SELECT 'VOL-' || g, now(), $1, $2, 'IN_LAVORAZIONE',
            CASE WHEN g % 3 = 0 THEN NULL ELSE ($3::int[])[1 + (g % 20)] END
     FROM generate_series(1, $4) g`,
    [utente, servizio, ids, ISTANZE]);

  await client.query(`ANALYZE istanze`);
}

async function piano(condizione: string, parametri: unknown[]): Promise<string> {
  const { rows } = await client.query<{ 'QUERY PLAN': string }>(
    `EXPLAIN SELECT id FROM istanze WHERE stato = 'IN_LAVORAZIONE' AND ${condizione} LIMIT 10`,
    parametri);
  return rows.map((r) => r['QUERY PLAN']).join('\n');
}

describe.skipIf(!ATTIVO)(`tab su ${ISTANZE} istanze`, () => {
  it('"Nuove" usa l indice (stato, assegnatario_id)', async () => {
    const p = await piano(`assegnatario_id IS NULL`, []);
    expect(p).toContain('istanze_stato_assegnatario_id_idx');
    expect(p).not.toContain('Seq Scan');
  });

  it('"Mie" usa l indice (stato, assegnatario_id)', async () => {
    const p = await piano(`assegnatario_id = $1`, [1]);
    expect(p).toContain('istanze_stato_assegnatario_id_idx');
    expect(p).not.toContain('Seq Scan');
  });

  it('"Di altri" usa l indice (stato, assegnatario_id)', async () => {
    const p = await piano(`assegnatario_id IS NOT NULL AND assegnatario_id <> $1`, [1]);
    expect(p).toContain('istanze_stato_assegnatario_id_idx');
    expect(p).not.toContain('Seq Scan');
  });
});
```

- [ ] **Step 2: Verificare che sia inerte per default**

Run: `npm run test:integration`
Expected: PASS, e il file di volume risulta **skipped**. Il tempo totale della suite non cambia in modo apprezzabile.

- [ ] **Step 3: Eseguirlo davvero**

Run: `TEST_VOLUME=1 npm run test:integration -- tab-istanze-volume`
(su PowerShell: `$env:TEST_VOLUME='1'; npm run test:integration -- tab-istanze-volume`)
Expected: PASS. Annota il tempo di seeding nel messaggio di commit.

Se un piano mostra `Seq Scan`: con `LIMIT 10` e un terzo delle righe non assegnate, per il tab "Nuove" Postgres potrebbe legittimamente preferire una scansione. In quel caso rendi il test più severo sostituendo `LIMIT 10` con un `COUNT(*)`, che non ha quella scorciatoia — **non** allentare l'asserzione.

- [ ] **Step 4: Commit**

```bash
git add test/integration/tab-istanze-volume.test.ts
git commit -m "test: verifica su 100k istanze che i tab usino l'indice, opt-in via TEST_VOLUME"
```

---

## Task 9: Migrazione di contrazione

**Files:**
- Create: `packages/db/prisma/migrations/20260807110000_posizione_corrente_contrazione/migration.sql`
- Modify: `packages/db/prisma/schema.prisma` — rimozione di `Workflow.stato` e `Workflow.operatoreId`/`operatore`, e dell'indice `@@index([stato])` su `Istanza`
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts` — rimozione delle scritture su `stato` e `operatoreId`
- Modify: `test/integration/posizione-corrente.test.ts` — test del riallineamento

- [ ] **Step 1: Scrivere la migrazione**

Create `packages/db/prisma/migrations/20260807110000_posizione_corrente_contrazione/migration.sql`:

```sql
-- Contrazione: via le colonne rese ridondanti dall'espansione.
--
-- Il riallineamento qui sotto riesegue il backfill PRIMA dei DROP, per le
-- righe nate nella finestra fra l'espansione e la conversione delle scritture.
-- In un `migrate deploy` le due migrazioni girano consecutive e nessuna
-- applicazione scrive fra l'una e l'altra: il riallineamento è di fatto un
-- no-op in produzione, e serve a proteggere gli alberi di sviluppo su cui le
-- due migrazioni sono state applicate a distanza di task.

UPDATE "workflows"
SET "completata_at"    = COALESCE("completata_at", "data_variazione"),
    "completata_da_id" = COALESCE("completata_da_id", "operatore_id")
WHERE "stato" = 1 AND "completata_at" IS NULL;

WITH ultima AS (
  SELECT DISTINCT ON ("istanza_id") "istanza_id", "id", "operatore_id"
  FROM "workflows"
  ORDER BY "istanza_id", "data_variazione" DESC, "id" DESC
)
UPDATE "istanze" i
SET "attivita_corrente_id" = COALESCE(i."attivita_corrente_id", u."id"),
    "assegnatario_id"      = COALESCE(i."assegnatario_id", u."operatore_id")
FROM ultima u
WHERE u."istanza_id" = i."id" AND i."attivita_corrente_id" IS NULL;

-- DropColumn: la doppia semantica di operatore_id e il binario `stato`
ALTER TABLE "workflows"
  DROP COLUMN "stato",
  DROP COLUMN "operatore_id";

-- DropIndex: prefisso di istanze_stato_assegnatario_id_idx, mantenuto a ogni
-- scrittura senza che nulla lo usi.
DROP INDEX "istanze_stato_idx";
```

- [ ] **Step 2: Ripulire lo schema Prisma**

Modify `packages/db/prisma/schema.prisma`:
- nel modello `Workflow`, elimina il blocco di commento "Binario voluto..." e le righe `stato`, `operatoreId`, `operatore`;
- nel modello `Operatore`, elimina la relazione inversa verso `Workflow.operatore` (il nome esatto lo dà `npm run db:generate`, che fallisce finché resta orfana);
- nel modello `Istanza`, elimina `@@index([stato])`.

Run: `npm run db:generate`
Expected: nessun errore.

- [ ] **Step 3: Ripulire il codice dalle scritture rimaste**

Run:
```bash
grep -rn "STATO_COMPLETATA\|STATO_IN_LAVORAZIONE\|operatoreId:" citta-semplice-office/src citta-semplice-portal/src --include=*.ts --include=*.tsx
```

Rimuovi ogni scrittura di `stato:` e `operatoreId:` su un'attività, e le costanti ormai senza consumatori. `operatoreId` come **variabile locale** (l'id dell'operatore in sessione) resta: leggi ogni occorrenza prima di toccarla.

- [ ] **Step 4: Aggiungere il test del riallineamento**

Aggiungi in coda a `test/integration/posizione-corrente.test.ts` (e aggiungi gli import `readFileSync` da `node:fs` e `resolve` da `node:path`):

```ts
describe('riallineamento della migrazione di contrazione', () => {
  it('valorizza completata_at per le righe nate fra espansione e conversione', async () => {
    // La contrazione riesegue il backfill PRIMA dei DROP, per le righe nate
    // nella finestra fra le due migrazioni. Il database di test ha già
    // applicato tutta la storia, quindi non c'è nulla da osservare a
    // posteriori: si ricostruisce lo stato PRECEDENTE alla contrazione e si
    // esegue il FILE REALE. Ridigitare qui l'UPDATE renderebbe il test
    // verde anche se qualcuno lo rimuovesse dalla migrazione.
    const percorso = resolve(
      process.cwd(),
      'packages/db/prisma/migrations/20260807110000_posizione_corrente_contrazione/migration.sql',
    );
    const sqlMigrazione = readFileSync(percorso, 'utf-8');

    const s = await creaScenario('riallineamento');
    const istanzaId = await creaIstanza(s, 'riallineamento');
    const stepId = await creaStep(s.faseUnoId, s.servizioId, 1);

    // Un solo ALTER TABLE con due ADD COLUMN è atomico: non resta uno stato
    // parziale se una clausola fallisce.
    await client.query(`
      ALTER TABLE istanza_attivita
        ADD COLUMN stato integer NOT NULL DEFAULT 0,
        ADD COLUMN operatore_id integer
    `);
    await client.query(`CREATE INDEX istanze_stato_idx ON istanze(stato)`);

    try {
      const attivita = await client.query<{ id: number }>(
        `INSERT INTO istanza_attivita (istanza_id, step_id, data_variazione, stato, operatore_id)
         VALUES ($1, $2, now(), 1, $3) RETURNING id`,
        [istanzaId, stepId, s.operatoreId],
      );

      await client.query(sqlMigrazione);

      const { rows } = await client.query<{ completata_at: Date | null; completata_da_id: number | null }>(
        `SELECT completata_at, completata_da_id FROM istanza_attivita WHERE id = $1`,
        [attivita.rows[0].id],
      );
      expect(rows[0].completata_at).not.toBeNull();
      expect(rows[0].completata_da_id).toBe(s.operatoreId);
    } finally {
      // Rete di sicurezza per il solo percorso di fallimento: nel percorso di
      // successo il file di migrazione ha già eseguito i suoi DROP.
      await client.query(`
        ALTER TABLE istanza_attivita
          DROP COLUMN IF EXISTS stato,
          DROP COLUMN IF EXISTS operatore_id
      `);
      await client.query(`DROP INDEX IF EXISTS istanze_stato_idx`);
    }
  });
});
```

**Attenzione all'ordine dei task:** questo test nomina la tabella `istanza_attivita`, che esiste solo dopo il Task 10. Se lo scrivi durante il Task 9, usa `workflows` e rinominalo insieme a tutto il resto nel Task 10 — il `grep` dello Step 5 di quel task lo troverà.

- [ ] **Step 5: Verificare**

Run: `npm test`
Run: `cd citta-semplice-office && npx tsc --noEmit && cd ../citta-semplice-portal && npx tsc --noEmit && cd ..`
Run: `npm run build`

- [ ] **Step 6: Verifica negativa**

Commenta nel file di contrazione il primo `UPDATE` (il riallineamento di `completata_at`).

Run: `npm run test:integration -- posizione-corrente`
Expected: FAIL sul test del riallineamento.

**Ripristina e riesegui prima di committare.**

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/migrations/20260807110000_posizione_corrente_contrazione packages/db/prisma/schema.prisma packages/db/generated citta-semplice-office/src citta-semplice-portal/src test/integration/posizione-corrente.test.ts
git commit -m "feat(db): via workflows.stato e workflows.operatore_id, resi ridondanti dalla posizione corrente"
```

---

## Task 10: Rename `Workflow` → `IstanzaAttivita` (commit meccanico)

Ultimo task, isolato di proposito: è l'unico intervento di cui nessun test può dimostrare la correttezza se non "compila e i test restano verdi". Tenerlo separato evita che il suo rumore attraversi il diff da revisionare per la logica.

**Files:**
- Create: `packages/db/prisma/migrations/20260807120000_rinomina_istanza_attivita/migration.sql`
- Modify: `packages/db/prisma/schema.prisma`
- Modify: ogni file che il `grep` dello Step 1 rivela
- Rename: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/workflow-timeline.tsx` → `attivita-timeline.tsx`

- [ ] **Step 1: Censire**

Run:
```bash
grep -rln "Workflow\|workflow" --include=*.ts --include=*.tsx --include=*.prisma \
  packages/db/src packages/db/prisma citta-semplice-office/src citta-semplice-portal/src test
```
Al momento della stesura sono ~20 file. Il risultato del `grep` prevale.

- [ ] **Step 2: Scrivere la migrazione di rename**

Create `packages/db/prisma/migrations/20260807120000_rinomina_istanza_attivita/migration.sql`:

```sql
-- Rename: `Workflow` designava una riga per attivazione di step, non "il
-- workflow", ed è la ragione per cui la posizione corrente ha finito per
-- avere definizioni divergenti. `Fase`/`Step` restano la definizione,
-- `IstanzaAttivita` è l'esecuzione.
--
-- ALTER TABLE ... RENAME porta con sé indici, vincoli e trigger: non serve
-- ricrearli. I NOMI di indici e vincoli restano quelli vecchi, il che è
-- rumoroso ma innocuo — rinominarli è un secondo giro di ALTER che non
-- cambia il comportamento di nulla.

ALTER TABLE "workflows"     RENAME TO "istanza_attivita";
ALTER TABLE "workflow_fasi" RENAME TO "istanza_fasi";
```

- [ ] **Step 3: Rinominare nello schema Prisma**

Modify `packages/db/prisma/schema.prisma`:
- `model Workflow` → `model IstanzaAttivita`, con `@@map("istanza_attivita")`;
- `model WorkflowFase` → `model IstanzaFase`, con `@@map("istanza_fasi")`;
- `dataVariazione` → `iniziataAt`, **mantenendo** `@map("data_variazione")`: il nome della colonna non cambia, cambia solo quello del campo;
- ogni riferimento di tipo e ogni nome di campo relazione (`workflows` → `attivita`, `workflowFasi` → `fasi`, `istanzaCorrentePer` invariato);
- aggiorna il commento di sezione `// WORKFLOW` in `// ATTIVITÀ DELL'ISTANZA`.

Run: `npm run db:generate`

- [ ] **Step 4: Propagare al codice**

Applica il rename a tutti i file censiti allo Step 1. Rinomina il file della timeline e il suo import. Nomi di variabile locale (`lastWorkflow`, `wf`) vanno rinominati anch'essi (`ultimaAttivita`, `att`): lasciarli è metà lavoro.

Run: `cd citta-semplice-office && npx tsc --noEmit && cd ../citta-semplice-portal && npx tsc --noEmit && cd ..`
Expected: nessun errore. Il compilatore è il censimento vero.

- [ ] **Step 5: Verificare che non resti nulla**

Run:
```bash
grep -rn "Workflow\|workflow" --include=*.ts --include=*.tsx --include=*.prisma \
  packages/db/src packages/db/prisma/schema.prisma citta-semplice-office/src citta-semplice-portal/src test
```
Expected: **nessun risultato**. Le migrazioni storiche in `packages/db/prisma/migrations/` e i documenti in `docs/` restano come sono: sono il racconto di com'era.

- [ ] **Step 6: Verificare**

Run: `npm test`
Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: Workflow diventa IstanzaAttivita, WorkflowFase diventa IstanzaFase"
```

---

## Verifica finale del piano

Prima di considerare il lavoro concluso, esegui e riporta l'output:

- [ ] `npm test` — tutte le suite verdi
- [ ] `TEST_VOLUME=1 npm run test:integration -- tab-istanze-volume` — i tre tab usano l'indice
- [ ] `npx tsc --noEmit` in entrambe le app
- [ ] `npm run build`
- [ ] `grep -rn "queryRaw" citta-semplice-office/src/app/api/istanze/paged/route.ts` — una sola occorrenza, il filtro di data
- [ ] `grep -rn "Workflow" packages/db/src citta-semplice-office/src citta-semplice-portal/src` — nessun risultato
- [ ] `npm run db:migrate` contro il database di sviluppo, poi avvio manuale delle due app: presa in carico, avanzamento nella stessa fase (l'assegnatario resta), avanzamento a fase di altro ufficio (l'istanza compare fra le "Nuove"), rollback di fase.

Criteri di accettazione della specifica: B1 → Task 3+4 e i test di `tab-istanze.test.ts`; B2 → Task 2, 6, 7; B3 → Task 3; B4 → Task 5; B5 → Task 10; volume → Task 8.
