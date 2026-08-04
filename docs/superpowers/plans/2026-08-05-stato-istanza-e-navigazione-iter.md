# Stato dell'istanza come enum e navigazione dell'iter senza aritmetica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire i tre booleani mutuamente esclusivi che rappresentano lo stato di un'istanza con un enum `StatoIstanza`, ed eliminare l'aritmetica sugli `ordine` dalla navigazione dell'iter, che oggi fa fallire l'avanzamento in silenzio.

**Architecture:** Il passaggio segue il ciclo espansione → migrazione → contrazione, perché ogni task deve lasciare un albero che compila con i test verdi. Prima si aggiunge la colonna `stato` accanto ai booleani (Task 1), poi si concentra in un unico modulo condiviso la lettura e la scrittura dello stato con doppia scrittura verso entrambe le rappresentazioni (Task 2), poi si convertono office e portal (Task 3 e 4), infine si eliminano booleani e doppia scrittura (Task 5). Il Task 6 è indipendente e corregge la navigazione dell'iter.

**Tech Stack:** npm workspaces, TypeScript ~5.7, Vitest 3, Testcontainers (`@testcontainers/postgresql`), Prisma 7.7.0 con `@prisma/adapter-pg`, PostgreSQL, Next.js 16.2.9 / React 19.2.4.

## Global Constraints

- **Schema e client Prisma vivono in `packages/db`** (`@citta/db`). Non esistono più copie per app: `packages/db/prisma/schema.prisma` è l'unica fonte, `packages/db/prisma/migrations/` l'unica storia. Il client si importa sempre da `@citta/db`, mai da percorsi `generated/prisma`.
- **Le migrazioni sono la fonte di verità dello schema**, non il DSL. L'harness di integrazione esegue `prisma migrate deploy`, quindi ogni oggetto che il DSL non esprime (CHECK, trigger, indici GIN) deve stare in una migrazione SQL scritta a mano, altrimenti non esiste nel database di test.
- **Prisma 7.7.0** esatta; `@prisma/client` e `@prisma/adapter-pg` `^7.7.0`. Client generato in `packages/db/generated/prisma`, rigenerato dal `postinstall` di `@citta/db`.
- **Monorepo npm workspaces**: un solo `node_modules` e un solo `package-lock.json` alla radice. La root non è un workspace nominato: installare con `npm install -D <pkg>`, senza `-w`.
- **I package condivisi sono ESM sorgente senza build step**: `"type": "module"`, `"exports": { ".": "./src/index.ts" }`.
- **Naming di dominio in italiano** (entità, colonne, funzioni, commenti). Nomi di tabella in snake_case plurale via `@@map`.
- **Ogni task lascia l'albero che compila e i test verdi.** `npm test`, `npx tsc --noEmit` su entrambe le app e `npm run build` devono passare alla fine di ogni task, non solo alla fine del piano.
- **Prerequisito Docker** per i test di integrazione.

## Contesto: da dove veniamo

Oggi lo stato è rappresentato da `Istanza.inBozza` / `conclusa` / `respinta`, mutuamente esclusivi per un vincolo CHECK (`istanze_stato_esclusivo_chk`, in `packages/db/prisma/migrations/0_init/migration.sql:611`) che il DSL Prisma non sa esprimere. Ogni query ripete `inBozza: false, conclusa: false, respinta: false` per dire "in lavorazione". I tre identificatori compaiono in **24 file** fra le due app.

La navigazione dell'iter usa aritmetica sugli `ordine` in tre punti, e il vincolo di unicità che la renderebbe affidabile è commentato nello schema:

| File:riga | Espressione | Effetto di un buco negli ordini |
|---|---|---|
| `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts:183-185` | `s.ordine === currentStepOrder + 1` | L'avanzamento cade nel ramo "cambio fase": l'istanza salta a un altro ufficio, senza errore |
| stesso file, `:267` | `f.ordine === (currentFase?.ordine ?? 1) + 1` | La fase successiva non viene trovata: l'istanza viene conclusa invece che trasferita |
| stesso file, `:402` | `s.ordine === currentStepOrder - 1` | La retrocessione fallisce con "Step precedente non trovato" |

---

## File Structure

**Creati:**
- `packages/db/prisma/migrations/<timestamp>_stato_istanza_enum/migration.sql` — espansione: enum + colonna + backfill
- `packages/db/prisma/migrations/<timestamp>_stato_istanza_contrazione/migration.sql` — contrazione: via booleani e CHECK
- `packages/db/prisma/migrations/<timestamp>_step_unique_fase_ordine/migration.sql` — vincolo di unicità sugli step
- `packages/db/src/stato-istanza.ts` — unica fonte di verità per leggere e scrivere lo stato
- `packages/db/test/stato-istanza.test.ts` — test unitari del modulo sopra
- `test/integration/stato-istanza.test.ts` — test di integrazione su migrazione, backfill e vincoli
- `test/integration/navigazione-iter.test.ts` — test di integrazione sulla navigazione dell'iter

**Modificati:**
- `packages/db/prisma/schema.prisma` — enum, colonna `stato`, `@@unique([faseId, ordine])` su `Step`
- `packages/db/src/index.ts` — export del modulo `stato-istanza`
- ~14 file di `citta-semplice-office/src` (Task 3, elenco nel task)
- ~6 file di `citta-semplice-portal/src` (Task 4, elenco nel task)
- `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts` — navigazione dell'iter (Task 6)
- `vitest.config.ts:31-32` — commento smentito, vedi Task 6

---

## Task 1: Espansione — enum e colonna `stato` accanto ai booleani

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_stato_istanza_enum/migration.sql`
- Create: `test/integration/stato-istanza.test.ts`

**Interfaces:**
- Consumes: `avviaPostgres`, `fermaPostgres`, `applicaSchema` da `test/integration/postgres.ts` (firme già esistenti e contrattuali).
- Produces: l'enum Prisma `StatoIstanza` con i valori `BOZZA | IN_LAVORAZIONE | CONCLUSA | RESPINTA`, e il campo `Istanza.stato: StatoIstanza @default(IN_LAVORAZIONE)`. I task successivi vi si appoggiano.

In questo task i booleani **restano**: sono ancora la rappresentazione autoritativa. La colonna `stato` viene aggiunta e riempita, ma nessuno la legge ancora.

- [ ] **Step 1: Scrivere il test di integrazione (fallirà: la colonna non esiste)**

Create `test/integration/stato-istanza.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { resolve } from 'node:path';
import { avviaPostgres, fermaPostgres, applicaSchema, type UrlDatabase } from './postgres';

let url: UrlDatabase;
let client: Client;

beforeAll(async () => {
  url = await avviaPostgres();
  await applicaSchema(url, resolve(process.cwd(), 'packages/db/prisma/schema.prisma'));
  client = new Client({ connectionString: url });
  await client.connect();
}, 180_000);

afterAll(async () => {
  await client?.end();
  await fermaPostgres();
});

/** Crea le righe di appoggio necessarie a inserire un'istanza. Restituisce gli id. */
async function creaDipendenze(suffisso: string) {
  const area = await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ($1, $2) RETURNING id`,
    [`Area ${suffisso}`, `area-${suffisso}`],
  );
  const servizio = await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ($1, $2, $3) RETURNING id`,
    [`Servizio ${suffisso}`, `servizio-${suffisso}`, area.rows[0].id],
  );
  const utente = await client.query<{ id: number }>(
    `INSERT INTO utenti (codice_fiscale, nome, cognome) VALUES ($1, $2, $3) RETURNING id`,
    [`CF${suffisso}`.padEnd(16, 'X'), 'Mario', 'Rossi'],
  );
  return { servizioId: servizio.rows[0].id, utenteId: utente.rows[0].id };
}

async function inserisciIstanza(
  suffisso: string,
  flag: { in_bozza?: boolean; conclusa?: boolean; respinta?: boolean },
): Promise<number> {
  const { servizioId, utenteId } = await creaDipendenze(suffisso);
  const res = await client.query<{ id: number }>(
    `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, in_bozza, conclusa, respinta)
     VALUES ($1, now(), $2, $3, $4, $5, $6) RETURNING id`,
    [
      `PROTO-${suffisso}`,
      utenteId,
      servizioId,
      flag.in_bozza ?? false,
      flag.conclusa ?? false,
      flag.respinta ?? false,
    ],
  );
  return res.rows[0].id;
}

describe('enum StatoIstanza', () => {
  it('esiste come tipo con i quattro valori attesi', async () => {
    const { rows } = await client.query<{ enumlabel: string }>(
      `SELECT enumlabel FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'StatoIstanza' ORDER BY e.enumsortorder`,
    );
    expect(rows.map((r) => r.enumlabel)).toEqual([
      'BOZZA',
      'IN_LAVORAZIONE',
      'CONCLUSA',
      'RESPINTA',
    ]);
  });

  it('l espressione di backfill deriva lo stato dai tre booleani', async () => {
    // La migrazione ha già girato su un database vuoto, quindi il backfill non
    // ha toccato alcuna riga: eseguirlo di nuovo su righe costruite ora è
    // l'unico modo di verificarne davvero la mappatura. L'espressione qui
    // sotto deve restare identica a quella della migrazione.
    const casi: Array<[string, { in_bozza?: boolean; conclusa?: boolean; respinta?: boolean }, string]> = [
      ['bozza', { in_bozza: true }, 'BOZZA'],
      ['conclusa', { conclusa: true }, 'CONCLUSA'],
      ['respinta', { respinta: true }, 'RESPINTA'],
      ['lavorazione', {}, 'IN_LAVORAZIONE'],
    ];

    const ids: Array<[number, string, string]> = [];
    for (const [suffisso, flag, atteso] of casi) {
      ids.push([await inserisciIstanza(suffisso, flag), suffisso, atteso]);
    }

    // Sporca deliberatamente `stato` su tutte le righe, così il DEFAULT non
    // può far passare il test per caso: se il backfill non funzionasse,
    // resterebbero tutte a 'RESPINTA' e tre casi su quattro fallirebbero.
    await client.query(`UPDATE istanze SET stato = 'RESPINTA'`);

    await client.query(`
      UPDATE istanze SET stato = CASE
        WHEN in_bozza THEN 'BOZZA'::"StatoIstanza"
        WHEN conclusa THEN 'CONCLUSA'::"StatoIstanza"
        WHEN respinta THEN 'RESPINTA'::"StatoIstanza"
        ELSE 'IN_LAVORAZIONE'::"StatoIstanza"
      END
    `);

    for (const [id, suffisso, atteso] of ids) {
      const { rows } = await client.query<{ stato: string }>(
        `SELECT stato FROM istanze WHERE id = $1`,
        [id],
      );
      expect(rows[0].stato, `caso ${suffisso}`).toBe(atteso);
    }
  });

  it('la colonna stato ha IN_LAVORAZIONE come default', async () => {
    const id = await inserisciIstanza('default', {});
    const { rows } = await client.query<{ stato: string }>(
      `SELECT stato FROM istanze WHERE id = $1`,
      [id],
    );
    expect(rows[0].stato).toBe('IN_LAVORAZIONE');
  });

  it('il vincolo di esclusività sui booleani è ancora attivo', async () => {
    const { servizioId, utenteId } = await creaDipendenze('esclusivo');
    await expect(
      client.query(
        `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, conclusa, respinta)
         VALUES ('PROTO-ESCL', now(), $1, $2, true, true)`,
        [utenteId, servizioId],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'istanze_stato_esclusivo_chk' });
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm run test:integration`
Expected: FAIL — la colonna `stato` non esiste (`column "stato" does not exist`) e il tipo `StatoIstanza` non è in `pg_enum`.

- [ ] **Step 3: Aggiungere enum e campo allo schema Prisma**

Modify `packages/db/prisma/schema.prisma`. Aggiungere accanto agli altri enum (dopo `enum Direzione`):

```prisma
/// Stato di lavorazione di un'istanza. Sostituisce i tre booleani
/// mutuamente esclusivi `inBozza`/`conclusa`/`respinta`, che il vincolo
/// CHECK `istanze_stato_esclusivo_chk` teneva coerenti a posteriori.
enum StatoIstanza {
  BOZZA           // solo portale, invisibile agli operatori
  IN_LAVORAZIONE
  CONCLUSA
  RESPINTA
}
```

e dentro `model Istanza`, subito sopra i tre booleani:

```prisma
  // Fase di transizione: `stato` convive con i tre booleani finché tutto il
  // codice non è convertito. La doppia scrittura è centralizzata in
  // `@citta/db` (packages/db/src/stato-istanza.ts); i booleani spariscono
  // nella migrazione di contrazione.
  stato               StatoIstanza @default(IN_LAVORAZIONE)
```

Aggiungere anche l'indice, che servirà al piano successivo e non costa nulla ora:

```prisma
  @@index([stato])
```

- [ ] **Step 4: Creare la migrazione**

```bash
npm run db:migrate -w @citta/db -- --name stato_istanza_enum --create-only
```

Se il comando non produce l'SQL desiderato, creare a mano la cartella `packages/db/prisma/migrations/<timestamp>_stato_istanza_enum/` con `migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "StatoIstanza" AS ENUM ('BOZZA', 'IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA');

-- AddColumn
ALTER TABLE "istanze" ADD COLUMN "stato" "StatoIstanza" NOT NULL DEFAULT 'IN_LAVORAZIONE';

-- Backfill dai tre booleani. L'ordine dei rami replica quello usato dal
-- codice applicativo (bozza, poi conclusa, poi respinta, poi lavorazione).
UPDATE "istanze" SET "stato" = CASE
  WHEN "in_bozza"  THEN 'BOZZA'::"StatoIstanza"
  WHEN "conclusa"  THEN 'CONCLUSA'::"StatoIstanza"
  WHEN "respinta"  THEN 'RESPINTA'::"StatoIstanza"
  ELSE 'IN_LAVORAZIONE'::"StatoIstanza"
END;

-- CreateIndex
CREATE INDEX "istanze_stato_idx" ON "istanze"("stato");
```

- [ ] **Step 5: Rigenerare il client ed eseguire i test**

```bash
npm run db:generate
npm run test:integration
```

Expected: PASS — quattro test.

Se un test passa anche commentando la propria asserzione, è rotto: correggilo invece di tenerlo. In particolare l'espressione `CASE` nel test deve restare identica a quella della migrazione; se le due divergono il test smette di verificare la migrazione e verifica sé stesso.

- [ ] **Step 6: Verificare che nulla si sia rotto e committare**

```bash
npx tsc --noEmit -p citta-semplice-office/tsconfig.json
npx tsc --noEmit -p citta-semplice-portal/tsconfig.json
npm test
git add packages/db/prisma packages/db/generated test/integration/stato-istanza.test.ts
git commit -m "feat(db): enum StatoIstanza accanto ai booleani, con backfill"
```

---

## Task 2: Il modulo unico per leggere e scrivere lo stato

**Files:**
- Create: `packages/db/src/stato-istanza.ts`
- Create: `packages/db/test/stato-istanza.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: l'enum `StatoIstanza` da Task 1.
- Produces — **i Task 3, 4 e 5 dipendono da queste firme esatte**:

```ts
export type StatoIstanzaValore = 'BOZZA' | 'IN_LAVORAZIONE' | 'CONCLUSA' | 'RESPINTA';

/** Frammento `where` Prisma per filtrare su uno o più stati. */
export function whereStato(stati: StatoIstanzaValore | StatoIstanzaValore[]): { stato: { in: StatoIstanzaValore[] } };

/** Frammento `where` per "tutto tranne le bozze": ciò che l'office deve vedere. */
export function whereVisibileAgliOperatori(): { stato: { not: 'BOZZA' } };

/** Dati da passare a `create`/`update` per portare un'istanza in uno stato. */
export function datiStato(stato: StatoIstanzaValore): {
  stato: StatoIstanzaValore;
  inBozza: boolean;
  conclusa: boolean;
  respinta: boolean;
};

/** Condizione SQL grezza equivalente, per le query raw. `alias` è l'alias di `istanze`. */
export function sqlStato(stati: StatoIstanzaValore | StatoIstanzaValore[], alias: string): string;
```

`datiStato` è ciò che rende sicura la transizione: scrive **entrambe** le rappresentazioni, così finché i booleani esistono restano coerenti con `stato` e il vincolo CHECK non viene mai violato. Il Task 5 lo semplifica togliendo i booleani.

- [ ] **Step 1: Scrivere i test unitari**

Create `packages/db/test/stato-istanza.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  whereStato,
  whereVisibileAgliOperatori,
  datiStato,
  sqlStato,
} from '../src/stato-istanza';

describe('whereStato', () => {
  it('accetta un singolo stato e lo normalizza a lista', () => {
    expect(whereStato('CONCLUSA')).toEqual({ stato: { in: ['CONCLUSA'] } });
  });

  it('accetta una lista di stati', () => {
    expect(whereStato(['CONCLUSA', 'RESPINTA'])).toEqual({
      stato: { in: ['CONCLUSA', 'RESPINTA'] },
    });
  });
});

describe('whereVisibileAgliOperatori', () => {
  it('esclude solo le bozze', () => {
    expect(whereVisibileAgliOperatori()).toEqual({ stato: { not: 'BOZZA' } });
  });
});

describe('datiStato', () => {
  it('scrive enum e booleani coerenti per ogni stato', () => {
    expect(datiStato('BOZZA')).toEqual({
      stato: 'BOZZA', inBozza: true, conclusa: false, respinta: false,
    });
    expect(datiStato('IN_LAVORAZIONE')).toEqual({
      stato: 'IN_LAVORAZIONE', inBozza: false, conclusa: false, respinta: false,
    });
    expect(datiStato('CONCLUSA')).toEqual({
      stato: 'CONCLUSA', inBozza: false, conclusa: true, respinta: false,
    });
    expect(datiStato('RESPINTA')).toEqual({
      stato: 'RESPINTA', inBozza: false, conclusa: false, respinta: true,
    });
  });

  it('non produce mai due booleani veri insieme (vincolo istanze_stato_esclusivo_chk)', () => {
    const stati = ['BOZZA', 'IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA'] as const;
    for (const s of stati) {
      const d = datiStato(s);
      const veri = [d.inBozza, d.conclusa, d.respinta].filter(Boolean).length;
      expect(veri, `stato ${s}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('sqlStato', () => {
  it('produce una condizione IN con gli stati fra apici', () => {
    expect(sqlStato(['CONCLUSA', 'RESPINTA'], 'i')).toBe(
      `i.stato IN ('CONCLUSA','RESPINTA')`,
    );
  });

  it('accetta un singolo stato', () => {
    expect(sqlStato('BOZZA', 'x')).toBe(`x.stato IN ('BOZZA')`);
  });
});
```

- [ ] **Step 2: Eseguire i test per vederli fallire**

Run: `npm run test:unit`
Expected: FAIL — il modulo `../src/stato-istanza` non esiste.

- [ ] **Step 3: Implementare il modulo**

Create `packages/db/src/stato-istanza.ts`:

```ts
/**
 * Unica fonte di verità per leggere e scrivere lo stato di un'istanza.
 *
 * Durante la transizione dai tre booleani all'enum, `datiStato` scrive
 * ENTRAMBE le rappresentazioni: finché `in_bozza`/`conclusa`/`respinta`
 * esistono nel database, devono restare coerenti con `stato`, altrimenti
 * il vincolo `istanze_stato_esclusivo_chk` salta o le due rappresentazioni
 * divergono. La migrazione di contrazione elimina i booleani e a quel punto
 * questa funzione si riduce al solo `stato`.
 */

export type StatoIstanzaValore = 'BOZZA' | 'IN_LAVORAZIONE' | 'CONCLUSA' | 'RESPINTA';

function normalizza(stati: StatoIstanzaValore | StatoIstanzaValore[]): StatoIstanzaValore[] {
  return Array.isArray(stati) ? stati : [stati];
}

export function whereStato(stati: StatoIstanzaValore | StatoIstanzaValore[]) {
  return { stato: { in: normalizza(stati) } };
}

/**
 * Tutto tranne le bozze. Le bozze sono del cittadino e non devono comparire
 * in nessun elenco, conteggio, ricerca o export dell'office.
 */
export function whereVisibileAgliOperatori() {
  return { stato: { not: 'BOZZA' as const } };
}

export function datiStato(stato: StatoIstanzaValore) {
  return {
    stato,
    inBozza: stato === 'BOZZA',
    conclusa: stato === 'CONCLUSA',
    respinta: stato === 'RESPINTA',
  };
}

/**
 * Equivalente di `whereStato` per le query raw. Gli stati sono un enum
 * chiuso definito qui sopra, non input utente: l'interpolazione è sicura.
 */
export function sqlStato(stati: StatoIstanzaValore | StatoIstanzaValore[], alias: string): string {
  const lista = normalizza(stati).map((s) => `'${s}'`).join(',');
  return `${alias}.stato IN (${lista})`;
}
```

- [ ] **Step 4: Esportare il modulo dal package**

Modify `packages/db/src/index.ts`, aggiungendo dopo gli export esistenti:

```ts
export * from './stato-istanza';
```

- [ ] **Step 5: Eseguire i test**

Run: `npm run test:unit`
Expected: PASS — i test di questo file più tutti i preesistenti.

- [ ] **Step 6: Verificare e committare**

```bash
npx tsc --noEmit -p packages/db/tsconfig.json
npm test
git add packages/db/src packages/db/test
git commit -m "feat(db): modulo unico per lettura e scrittura dello stato istanza"
```

---

## Task 3: Convertire `citta-semplice-office`

**Files:**
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts` (28 occorrenze)
- Modify: `citta-semplice-office/src/app/api/istanze/paged/route.ts` (13)
- Modify: `citta-semplice-office/src/app/api/search/istanze/route.ts` (8)
- Modify: `citta-semplice-office/src/app/api/export/istanze/route.ts` (8)
- Modify: `citta-semplice-office/src/app/(dashboard)/statistiche/page.tsx` (8, include SQL grezzo)
- Modify: `citta-semplice-office/src/app/(dashboard)/page.tsx` (7)
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/istanza-actions.tsx` (7)
- Modify: `citta-semplice-office/src/lib/models/stato-istanza.ts` (6)
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/istanze-client.tsx` (6)
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx` (5)
- Modify: `citta-semplice-office/src/app/api/cron/statistics/route.ts` (2)
- Modify: `citta-semplice-office/src/app/(dashboard)/ricerche/ricerche-client.tsx` (2)
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/altre-istanze-modal.tsx` (2)

**Interfaces:**
- Consumes: `whereStato`, `whereVisibileAgliOperatori`, `datiStato`, `sqlStato`, `StatoIstanzaValore` da `@citta/db` (Task 2).
- Produces: nessuna nuova interfaccia. `citta-semplice-office/src/lib/models/stato-istanza.ts` conserva il proprio ruolo di calcolo del **badge visualizzato**, ma il suo input passa dai booleani all'enum (vedi Step 3).

Regola di conversione, da applicare ovunque:

| Prima | Dopo |
|---|---|
| `{ inBozza: false, conclusa: false, respinta: false }` | `whereStato('IN_LAVORAZIONE')` |
| `{ inBozza: false }` (solo per escludere le bozze) | `whereVisibileAgliOperatori()` |
| `{ inBozza: false, conclusa: true }` | `whereStato('CONCLUSA')` |
| `{ inBozza: false, respinta: true }` | `whereStato('RESPINTA')` |
| `data: { conclusa: true }` | `data: datiStato('CONCLUSA')` |
| `data: { respinta: true }` | `data: datiStato('RESPINTA')` |
| SQL `i.in_bozza = false AND i.conclusa = false AND i.respinta = false` | `${sqlStato('IN_LAVORAZIONE', 'i')}` |

- [ ] **Step 1: Convertire il calcolo del badge**

Modify `citta-semplice-office/src/lib/models/stato-istanza.ts` — sostituire l'input basato sui booleani con l'enum. Il file diventa:

```ts
import type { StatoIstanzaValore } from '@citta/db';

/**
 * Stato visualizzato di un'istanza — unica fonte di verità per il badge.
 * Prima ogni vista lo calcolava per conto suo: la dashboard guardava solo
 * conclusa/respinta e mostrava "In Lavorazione" anche per istanze non ancora
 * prese in carico, mentre lista e dettaglio le marcavano "In Attesa".
 *
 * Ordine di valutazione: stato terminale → ultimo workflow.
 */
export type StatoIstanzaVariant = 'success' | 'danger' | 'secondary' | 'primary';

export interface StatoIstanza {
  label: string;
  variant: StatoIstanzaVariant;
}

export interface StatoIstanzaInput {
  stato: StatoIstanzaValore;
  /** ultimo workflow (per dataVariazione desc), se presente */
  ultimoWorkflow?: { operatoreId: number | null; stato: number } | null;
}

export function getStatoIstanza(istanza: StatoIstanzaInput): StatoIstanza {
  if (istanza.stato === 'CONCLUSA') return { label: 'Conclusa', variant: 'success' };
  if (istanza.stato === 'RESPINTA') return { label: 'Respinta', variant: 'danger' };
  if (istanza.stato === 'BOZZA') return { label: 'Bozza', variant: 'secondary' };

  const wf = istanza.ultimoWorkflow;
  // Nessun workflow o ultimo step non assegnato → in attesa di presa in carico
  if (!wf || wf.operatoreId === null) return { label: 'In Attesa', variant: 'secondary' };
  if (wf.stato === 1) return { label: 'Completata', variant: 'success' };
  return { label: 'In Lavorazione', variant: 'primary' };
}
```

Nota: il ramo `BOZZA` è nuovo. Le bozze non compaiono nell'office, ma lasciare l'enum senza un ramo esplicito renderebbe il codice fragile se un giorno ci arrivassero.

- [ ] **Step 2: Convertire tutti gli altri file**

Applicare la tabella di conversione. Per trovarli tutti:

```bash
grep -rn "inBozza\|conclusa\|respinta\|in_bozza" --include=*.ts --include=*.tsx citta-semplice-office/src
```

Attenzione a due punti particolari:

- `citta-semplice-office/src/app/(dashboard)/statistiche/page.tsx:57-60` contiene SQL grezzo con `COUNT(*) FILTER (WHERE i.conclusa)` e `WHERE i.in_bozza = false`: vanno riscritti su `i.stato`, per esempio `COUNT(*) FILTER (WHERE i.stato = 'CONCLUSA')::int AS concluse`.
- `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts` è il file con più occorrenze (28) e contiene sia letture sia scritture: le scritture (`data: { conclusa: true }` in `advanceWorkflow`, `data: { respinta: true }` in `rejectIstanza`, e il ripristino in `reopenIstanza`) devono passare per `datiStato`, non impostare l'enum a mano.

- [ ] **Step 3: Verificare**

```bash
npx tsc --noEmit -p citta-semplice-office/tsconfig.json
npm test
npm run build
```

Expected: typecheck pulito, test verdi, build completata. Il typecheck è la rete principale qui: cambiando `StatoIstanzaInput` ogni chiamante di `getStatoIstanza` non convertito diventa un errore di compilazione.

- [ ] **Step 4: Verificare che non restino letture sui booleani**

```bash
grep -rn "inBozza\|conclusa\|respinta" --include=*.ts --include=*.tsx citta-semplice-office/src
```

Expected: le uniche occorrenze residue sono dentro chiamate a `datiStato(...)` o commenti. Nessun `where` e nessun `data` deve più nominare i booleani direttamente.

- [ ] **Step 5: Commit**

```bash
git add citta-semplice-office/src
git commit -m "refactor(office): stato istanza letto e scritto tramite l'enum"
```

---

## Task 4: Convertire `citta-semplice-portal`

**Files:**
- Modify: `citta-semplice-portal/src/lib/actions/istanza.ts` (10 occorrenze)
- Modify: `citta-semplice-portal/src/lib/actions/le-mie-istanze.ts` (6)
- Modify: `citta-semplice-portal/src/app/(portal)/le-mie-istanze/[id]/page.tsx` (4)
- Modify: `citta-semplice-portal/src/app/(portal)/le-mie-istanze/IstanzeTable.tsx` (4)
- Modify: `citta-semplice-portal/src/lib/servizio-regole.ts` (3)
- Modify: `citta-semplice-portal/src/app/(portal)/le-mie-istanze/page.tsx` (1)
- Modify: `citta-semplice-portal/src/app/(portal)/[areaSlug]/[servizioSlug]/istanza/page.tsx` (1)

**Interfaces:**
- Consumes: `whereStato`, `whereVisibileAgliOperatori`, `datiStato`, `StatoIstanzaValore` da `@citta/db` (Task 2).
- Produces: nessuna nuova interfaccia.

Stessa tabella di conversione del Task 3. Le specificità del portale:

- Le bozze qui sono **visibili e centrali**: `whereStato('BOZZA')` sostituisce `{ inBozza: true }`.
- `salvaBozza` crea e aggiorna istanze in stato bozza: usare `datiStato('BOZZA')`.
- `submitIstanza` porta la bozza in lavorazione: dove oggi scrive `inBozza: false`, usare `datiStato('IN_LAVORAZIONE')`.
- `servizio-regole.ts` conta le istanze inviate per le regole di unicità e soglia: `{ inBozza: false }` diventa `whereStato(['IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA'])`, che è più esplicito di "non bozza" e dice esattamente cosa si sta contando.

- [ ] **Step 1: Convertire i file**

Trovarli tutti:

```bash
grep -rn "inBozza\|conclusa\|respinta\|in_bozza" --include=*.ts --include=*.tsx citta-semplice-portal/src
```

Applicare la conversione. In `citta-semplice-portal/src/lib/actions/istanza.ts` le scritture sono tre: la creazione della bozza (`inBozza: true`), l'aggiornamento della bozza esistente, e la conferma all'invio (`inBozza: false`). Tutte passano per `datiStato`.

- [ ] **Step 2: Verificare**

```bash
npx tsc --noEmit -p citta-semplice-portal/tsconfig.json
npm test
npm run build
```

Expected: typecheck pulito, test verdi, build completata.

- [ ] **Step 3: Verificare che non restino letture sui booleani**

```bash
grep -rn "inBozza\|conclusa\|respinta" --include=*.ts --include=*.tsx citta-semplice-portal/src
```

Expected: solo occorrenze dentro `datiStato(...)` o commenti.

- [ ] **Step 4: Commit**

```bash
git add citta-semplice-portal/src
git commit -m "refactor(portal): stato istanza letto e scritto tramite l'enum"
```

---

## Task 5: Contrazione — eliminare i booleani e la doppia scrittura

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_stato_istanza_contrazione/migration.sql`
- Modify: `packages/db/src/stato-istanza.ts`
- Modify: `packages/db/test/stato-istanza.test.ts`
- Modify: `test/integration/stato-istanza.test.ts`

**Interfaces:**
- Consumes: tutto quanto prodotto dai Task 1–4.
- Produces: `datiStato(stato)` restituisce ora `{ stato }` soltanto. La firma resta identica per i chiamanti — restituisce un oggetto da passare a `data:` — ma non contiene più i booleani. Nessuna modifica necessaria in office e portal.

- [ ] **Step 1: Aggiornare i test unitari alla nuova forma**

Modify `packages/db/test/stato-istanza.test.ts` — sostituire il blocco `describe('datiStato', ...)` con:

```ts
describe('datiStato', () => {
  it('restituisce il solo stato, senza più i booleani', () => {
    expect(datiStato('BOZZA')).toEqual({ stato: 'BOZZA' });
    expect(datiStato('IN_LAVORAZIONE')).toEqual({ stato: 'IN_LAVORAZIONE' });
    expect(datiStato('CONCLUSA')).toEqual({ stato: 'CONCLUSA' });
    expect(datiStato('RESPINTA')).toEqual({ stato: 'RESPINTA' });
  });
});
```

- [ ] **Step 2: Eseguire i test per vederli fallire**

Run: `npm run test:unit`
Expected: FAIL — `datiStato` restituisce ancora i booleani.

- [ ] **Step 3: Semplificare il modulo**

Modify `packages/db/src/stato-istanza.ts` — sostituire `datiStato` e il commento di intestazione:

```ts
/**
 * Unica fonte di verità per leggere e scrivere lo stato di un'istanza.
 *
 * I tre booleani `in_bozza`/`conclusa`/`respinta` e il vincolo CHECK che li
 * teneva mutuamente esclusivi non esistono più: lo stato è l'enum, e gli
 * stati impossibili non sono rappresentabili invece che vietati a posteriori.
 */
```

```ts
export function datiStato(stato: StatoIstanzaValore) {
  return { stato };
}
```

- [ ] **Step 4: Rimuovere i booleani dallo schema**

Modify `packages/db/prisma/schema.prisma` — dentro `model Istanza`, eliminare i tre campi `conclusa`, `respinta`, `inBozza` e il blocco di commento che ne descriveva la mutua esclusività (righe 337-344 dello schema originario). Aggiornare il commento sopra `stato` togliendo il riferimento alla fase di transizione:

```prisma
  /// Stato di lavorazione. Gli stati sono mutuamente esclusivi per costruzione.
  stato               StatoIstanza @default(IN_LAVORAZIONE)
```

- [ ] **Step 5: Creare la migrazione di contrazione**

Create `packages/db/prisma/migrations/<timestamp>_stato_istanza_contrazione/migration.sql`:

```sql
-- Il vincolo CHECK serviva a rendere mutuamente esclusivi i tre booleani.
-- Con l'enum l'esclusività è garantita dal tipo: il vincolo non ha più oggetto.
ALTER TABLE "istanze" DROP CONSTRAINT IF EXISTS "istanze_stato_esclusivo_chk";

ALTER TABLE "istanze" DROP COLUMN "in_bozza";
ALTER TABLE "istanze" DROP COLUMN "conclusa";
ALTER TABLE "istanze" DROP COLUMN "respinta";
```

- [ ] **Step 6: Aggiornare il test di integrazione**

Modify `test/integration/stato-istanza.test.ts`:

- eliminare il test `'il vincolo di esclusività sui booleani è ancora attivo'`, che ora deve fallire per costruzione;
- sostituire le funzioni `creaDipendenze`/`inserisciIstanza` perché non passino più i booleani, e aggiungere al loro posto questo test, che verifica ciò che l'enum garantisce davvero:

```ts
  it('rifiuta un valore di stato non previsto dall enum', async () => {
    const { servizioId, utenteId } = await creaDipendenze('invalido');
    await expect(
      client.query(
        `INSERT INTO istanze (proto_numero, data_invio, utente_id, servizio_id, stato)
         VALUES ('PROTO-INV', now(), $1, $2, 'SOSPESA')`,
        [utenteId, servizioId],
      ),
    ).rejects.toMatchObject({ code: '22P02' }); // invalid_text_representation
  });

  it('le colonne booleane non esistono più', async () => {
    const { rows } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'istanze'`,
    );
    const colonne = rows.map((r) => r.column_name);
    expect(colonne).not.toContain('in_bozza');
    expect(colonne).not.toContain('conclusa');
    expect(colonne).not.toContain('respinta');
    expect(colonne).toContain('stato');
  });
```

- [ ] **Step 7: Rigenerare, verificare, committare**

```bash
npm run db:generate
npx tsc --noEmit -p citta-semplice-office/tsconfig.json
npx tsc --noEmit -p citta-semplice-portal/tsconfig.json
npm test
npm run build
git add packages/db citta-semplice-office citta-semplice-portal test/integration
git commit -m "feat(db): via i booleani di stato, resta il solo enum StatoIstanza"
```

Se il typecheck segnala usi residui dei booleani, sono punti sfuggiti ai Task 3 e 4: convertirli qui.

---

## Task 6: Navigazione dell'iter senza aritmetica

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (vincolo su `Step`)
- Create: `packages/db/prisma/migrations/<timestamp>_step_unique_fase_ordine/migration.sql`
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts:183-185`, `:267`, `:402`
- Create: `test/integration/navigazione-iter.test.ts`
- Modify: `vitest.config.ts:31-32`

**Interfaces:**
- Consumes: `avviaPostgres`, `fermaPostgres`, `applicaSchema` da `test/integration/postgres.ts`.
- Produces: nessuna nuova interfaccia esportata.

Questo task è indipendente dai Task 1–5 e potrebbe essere eseguito prima; è in fondo solo perché tocca lo stesso file del Task 3.

- [ ] **Step 1: Scrivere il test di integrazione sulla risoluzione del passo successivo**

Create `test/integration/navigazione-iter.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { resolve } from 'node:path';
import { avviaPostgres, fermaPostgres, applicaSchema, type UrlDatabase } from './postgres';

let url: UrlDatabase;
let client: Client;

beforeAll(async () => {
  url = await avviaPostgres();
  await applicaSchema(url, resolve(process.cwd(), 'packages/db/prisma/schema.prisma'));
  client = new Client({ connectionString: url });
  await client.connect();
}, 180_000);

afterAll(async () => {
  await client?.end();
  await fermaPostgres();
});

/** Crea area, servizio, ufficio e una fase; restituisce gli id. */
async function creaFase(suffisso: string) {
  const area = await client.query<{ id: number }>(
    `INSERT INTO aree (nome, slug) VALUES ($1, $2) RETURNING id`,
    [`Area ${suffisso}`, `area-${suffisso}`],
  );
  const servizio = await client.query<{ id: number }>(
    `INSERT INTO servizi (titolo, slug, area_id) VALUES ($1, $2, $3) RETURNING id`,
    [`Servizio ${suffisso}`, `servizio-${suffisso}`, area.rows[0].id],
  );
  const ufficio = await client.query<{ id: number }>(
    `INSERT INTO uffici (nome) VALUES ($1) RETURNING id`,
    [`Ufficio ${suffisso}`],
  );
  const fase = await client.query<{ id: number }>(
    `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ($1, 1, $2, $3) RETURNING id`,
    [`Fase ${suffisso}`, servizio.rows[0].id, ufficio.rows[0].id],
  );
  return { servizioId: servizio.rows[0].id, faseId: fase.rows[0].id };
}

async function creaStep(servizioId: number, faseId: number, ordine: number, attivo = true) {
  const res = await client.query<{ id: number }>(
    `INSERT INTO steps (descrizione, ordine, attivo, servizio_id, fase_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [`Step ${ordine}`, ordine, attivo, servizioId, faseId],
  );
  return res.rows[0].id;
}

/**
 * Replica la query che `advanceWorkflow` usa per risolvere il passo
 * successivo: "il primo step attivo della stessa fase con ordine maggiore",
 * non "quello con ordine esattamente +1".
 */
async function prossimoStep(faseId: number, ordineCorrente: number) {
  const { rows } = await client.query<{ ordine: number }>(
    `SELECT ordine FROM steps
     WHERE fase_id = $1 AND ordine > $2 AND attivo = true
     ORDER BY ordine ASC LIMIT 1`,
    [faseId, ordineCorrente],
  );
  return rows[0]?.ordine ?? null;
}

describe('navigazione dell iter', () => {
  it('salta i buchi negli ordini invece di fermarsi', async () => {
    const { servizioId, faseId } = await creaFase('buchi');
    await creaStep(servizioId, faseId, 1);
    await creaStep(servizioId, faseId, 5); // buco fra 1 e 5
    // Con l'aritmetica `ordine + 1` qui non si troverebbe nulla e
    // l'avanzamento cadrebbe nel ramo "cambio fase", in silenzio.
    expect(await prossimoStep(faseId, 1)).toBe(5);
  });

  it('ignora gli step disattivati', async () => {
    const { servizioId, faseId } = await creaFase('disattivi');
    await creaStep(servizioId, faseId, 1);
    await creaStep(servizioId, faseId, 2, false); // disattivato
    await creaStep(servizioId, faseId, 3);
    expect(await prossimoStep(faseId, 1)).toBe(3);
  });

  it('restituisce null sull ultimo step della fase', async () => {
    const { servizioId, faseId } = await creaFase('ultimo');
    await creaStep(servizioId, faseId, 1);
    expect(await prossimoStep(faseId, 1)).toBeNull();
  });

  it('impedisce due step con lo stesso ordine nella stessa fase', async () => {
    const { servizioId, faseId } = await creaFase('duplicati');
    await creaStep(servizioId, faseId, 1);
    await expect(creaStep(servizioId, faseId, 1)).rejects.toMatchObject({ code: '23505' });
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm run test:integration`
Expected: FAIL sull'ultimo test — il vincolo di unicità non esiste, quindi il secondo inserimento riesce. I primi tre passano già: descrivono ciò che la query corretta fa, e servono da specifica per lo Step 4.

- [ ] **Step 3: Aggiungere il vincolo di unicità**

Modify `packages/db/prisma/schema.prisma`, dentro `model Step` — sostituire la riga commentata `//@@unique([servizioId, ordine])` con:

```prisma
  // L'ordine deve essere univoco DENTRO la fase, non dentro il servizio:
  // fasi diverse hanno sequenze indipendenti. Senza questo vincolo due step
  // con lo stesso ordine rendono non deterministica la risoluzione del
  // passo successivo.
  @@unique([faseId, ordine])
```

Create `packages/db/prisma/migrations/<timestamp>_step_unique_fase_ordine/migration.sql`:

```sql
-- Deduplica preventiva: se esistono già step con lo stesso (fase, ordine),
-- l'indice univoco non può essere creato. Si spostano i duplicati in coda
-- mantenendo l'ordine relativo per id.
WITH duplicati AS (
  SELECT id,
         fase_id,
         ROW_NUMBER() OVER (PARTITION BY fase_id, ordine ORDER BY id) AS rn,
         ordine
  FROM steps
  WHERE fase_id IS NOT NULL
)
UPDATE steps s
SET ordine = s.ordine + d.rn - 1
FROM duplicati d
WHERE s.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX "steps_fase_id_ordine_key" ON "steps"("fase_id", "ordine");
```

- [ ] **Step 4: Sostituire l'aritmetica nelle tre risoluzioni**

Modify `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts`.

Riga 183-185, passo successivo nella stessa fase — sostituire:

```ts
    const nextStepSameFase = steps.find(
      (s) => s.faseId === currentStep?.faseId && s.ordine === currentStepOrder + 1
    );
```

con:

```ts
    // Il primo step attivo della stessa fase con ordine maggiore, non quello
    // con ordine esattamente +1: un buco nella sequenza (step disattivato,
    // riordino dal backoffice) faceva cadere l'avanzamento nel ramo "cambio
    // fase" senza errore, spostando l'istanza a un altro ufficio.
    const nextStepSameFase = steps
      .filter((s) => s.faseId === currentStep?.faseId && s.ordine > currentStepOrder)
      .sort((a, b) => a.ordine - b.ordine)[0];
```

`steps` è già filtrato su `attivo: true` dalla query che lo carica, quindi non serve rifiltrare.

Riga 267, fase successiva — sostituire:

```ts
        const nextFase = allFasi.find((f) => f.ordine === (currentFase?.ordine ?? 1) + 1);
```

con:

```ts
        // Stessa correzione applicata alle fasi: la prima con ordine maggiore.
        const ordineCorrente = currentFase?.ordine ?? 0;
        const nextFase = allFasi
          .filter((f) => f.ordine > ordineCorrente)
          .sort((a, b) => a.ordine - b.ordine)[0];
```

Nota il cambio di default da `1` a `0`: con `?? 1` un'istanza senza fase corrente cercava la fase di ordine 2, saltando la prima.

Riga 402, passo precedente in `regressWorkflow` — sostituire:

```ts
    const prevStep = steps.find((s) => s.ordine === currentStepOrder - 1);
```

con:

```ts
    // L'ultimo step attivo con ordine minore, nella stessa fase.
    const prevStep = steps
      .filter((s) => s.faseId === currentStep?.faseId && s.ordine < currentStepOrder)
      .sort((a, b) => b.ordine - a.ordine)[0];
```

Il filtro sulla fase rende ridondante il controllo `prevStep.faseId !== currentStep?.faseId` alle righe 409-411, ma **lasciarlo**: il messaggio d'errore che produce ("Usa Rimanda a fase precedente") resta l'informazione utile per l'operatore quando si è al primo step della fase.

- [ ] **Step 5: Correggere il commento smentito in `vitest.config.ts`**

Modify `vitest.config.ts:31-32` — il commento dice "Un solo container condiviso: i test di integrazione non girano in parallelo", ma la condivisione è solo intra-file, come documentato in `test/integration/postgres.ts:12-21`. Con questo task i file di integrazione diventano tre, quindi l'imprecisione smette di essere teorica. Sostituire con:

```ts
          // Ogni file di integrazione avvia il proprio container (vedi il
          // commento in test/integration/postgres.ts): questo flag serve solo
          // a non farne girare più di uno per volta.
          fileParallelism: false,
```

- [ ] **Step 6: Rigenerare, verificare, committare**

```bash
npm run db:generate
npx tsc --noEmit -p citta-semplice-office/tsconfig.json
npm test
npm run build
```

Expected: tutti i test verdi, compresi i quattro nuovi di `navigazione-iter.test.ts`.

```bash
git add packages/db citta-semplice-office/src test/integration vitest.config.ts
git commit -m "fix(office): risoluzione del passo di iter per ordine, non per aritmetica"
```

---

## Self-Review

**Copertura rispetto alla specifica** (`docs/superpowers/specs/2026-08-04-nucleo-dominio-design.md`):

| Decisione | Task |
|---|---|
| D1 — Stato dell'istanza come enum | Task 1 (espansione), 2 (modulo), 3 (office), 4 (portal), 5 (contrazione) |
| D5 — Navigazione dell'iter senza aritmetica | Task 6 |

**Fuori da questo piano, per progetto:** D4 (posizione corrente, assegnatario, rename `Workflow`→`IstanzaAttivita`, riscrittura delle query di lista) nel piano 2b; D2 e D3 (`ModuloVersione`, `jsonb`, ricerca indicizzata) nel piano 2c; D6 (`Documento` unico, adapter storage) nel piano 2d.

**Debito ereditato dal piano 1, ancora aperto:**
- La condivisione reale del container Postgres fra file di test richiede `globalSetup` + `provide`/`inject`. Questo piano porta i file di integrazione da uno a tre, quindi il costo diventa misurabile (~10 s per file). Non è incluso perché non blocca nulla, ma è il primo candidato del piano 2b.
- `citta-semplice-migrations/migrate-dati.js:26,34` contiene credenziali di database in chiaro, tracciate in git. Le password vanno **ruotate**, non solo rimosse dal file: restano nella storia del repository. Indipendente da questo piano e da qualunque altro.
