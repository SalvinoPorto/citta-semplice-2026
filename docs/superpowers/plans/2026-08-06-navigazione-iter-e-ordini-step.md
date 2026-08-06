# Navigazione dell'iter e numerazione degli step — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminare l'aritmetica sugli `ordine` dalla navigazione dell'iter di una pratica, e rendere la numerazione degli step un invariante imposto dal database invece che sperato.

**Architecture:** Il lavoro procede dal codice verso il database, non viceversa. Prima si corregge la navigazione con funzioni pure (nessuna modifica di schema), poi la UI che ne duplica la logica, poi il percorso che *scrive* gli ordini — oggi non transazionale e incompatibile con qualunque vincolo di unicità — e solo alla fine si aggiunge il vincolo, che senza i passi precedenti romperebbe il backoffice.

**Tech Stack:** npm workspaces, TypeScript ~5.7, Vitest 3, Testcontainers (`@testcontainers/postgresql`), Prisma 7.7.0 con `@prisma/adapter-pg`, PostgreSQL, Next.js 16.2.9 / React 19.2.4.

## Global Constraints

- **Gli `ordine` degli `Step` sono GLOBALI per servizio, non per fase.** `buildStepData` (`citta-semplice-office/src/app/(dashboard)/amministrazione/servizi/actions.ts:8-11`) assegna `ordine: idx + 1` sull'array **piatto** dei passi, che attraversa tutte le fasi. `isLastStep` (`citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx:191-192`) deriva l'ultimo passo dal massimo su **tutto il servizio**. Qualunque vincolo o rinumerazione deve rispettare questo schema: la coppia univoca è `(servizioId, ordine)`, **non** `(faseId, ordine)`.
- **Le migrazioni sono la fonte di verità dello schema, non il DSL.** L'harness di integrazione esegue `prisma migrate deploy`. `prisma migrate dev --create-only` **fallisce in questo ambiente con P3014** (l'utente del database non può creare lo shadow database): le migrazioni si scrivono a mano, e nessuno strumento verifica la corrispondenza con lo schema Prisma.
- **Schema e client Prisma vivono in `packages/db`** (`@citta/db`). Il client si importa sempre da `@citta/db`, mai da percorsi `generated/prisma`.
- Prisma 7.7.0 esatta. Client generato in `packages/db/generated/prisma`, rigenerato dal `postinstall` di `@citta/db`.
- Monorepo npm workspaces: un solo `node_modules` e un solo `package-lock.json` alla radice. La root non è un workspace nominato: `npm install -D <pkg>` senza `-w`.
- **Naming di dominio in italiano** (entità, colonne, funzioni, commenti).
- **Ogni task lascia l'albero che compila e i test verdi.** `npm test`, `npx tsc --noEmit` su entrambe le app e `npm run build` devono passare alla fine di ogni task.
- **Un test vale solo se fallisce quando la cosa che protegge si rompe.** Un test su una migrazione deve leggere il file da disco ed eseguirlo, mai riprodurne il contenuto. Ogni test non banale va accompagnato da una **verifica negativa** — rompere deliberatamente ciò che protegge e osservarlo fallire — eseguita come **ultimo passo prima del commit**, perché un'interruzione a metà lascerebbe nel working tree la versione sabotata.
- **Gli elenchi di file in questo piano sono punti di partenza, non censimenti.** Riverificali con `grep`: il risultato del grep prevale.
- Prerequisito Docker per i test di integrazione.

## Contesto: da dove veniamo

Questo piano rifà la parte D5 della specifica (`docs/superpowers/specs/2026-08-04-nucleo-dominio-design.md`), dopo che un primo tentativo è stato bocciato dalla review finale del branch `refactor/stato-istanza-enum`. **Quel tentativo è preservato sul branch `refactor/navigazione-iter` (commit `a95e52a`)** e va usato come sorgente: buona parte del lavoro è corretta e si porta avanti così com'è.

Cosa era giusto e si riusa:
- `packages/db/src/navigazione-iter.ts` — quattro funzioni pure di risoluzione, con i loro 14 test unitari;
- le quattro chiamate in `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts` che le usano;
- i messaggi d'errore migliorati in `regressWorkflow`.

Cosa era sbagliato e va rifatto da capo:
- il vincolo `@@unique([faseId, ordine])` — la coppia giusta è `(servizioId, ordine)`;
- la migrazione con rinumerazione densa `PARTITION BY fase_id` — cambia lo schema di numerazione e sfasa `isLastStep`.

Cosa mancava del tutto:
- il percorso che **scrive** gli ordini (`updateServizio`) è incompatibile con qualunque vincolo di unicità;
- la UI del dettaglio istanza duplica l'aritmetica ed è divergente dalle azioni.

### I difetti da chiudere, con riferimenti

| # | File:riga | Difetto |
|---|---|---|
| C1 | `amministrazione/servizi/actions.ts:265-290` | `updateServizio` riscrive gli `ordine` una `UPDATE` per volta, **senza transazione**. Un indice unico non è differibile: riordino, inserimento o rimozione di uno step su un servizio esistente collide. E poiché `prisma.servizio.update` e `upsertFasi` sono già andati a buon fine, il servizio resta **salvato a metà**. |
| C1-bis | stesso file, `:238-242` | Il soft delete lascia allo step disattivato **il suo `ordine` e la sua `faseId`**: uno step fantasma occupa uno slot per sempre e collide con quelli vivi. |
| I1 | `istanze/[id]/actions.ts:415` | `if (currentStepOrder <= 1)` presume ordini a partire da 1, e rende irraggiungibile il messaggio "Usa Rimanda a fase precedente" introdotto poco sotto. |
| I2a | `istanze/[id]/actions.ts:289, 318` | `nextFase.steps[0]` usato senza null-check e senza filtro su `attivo`: `TypeError` dentro la transazione se la fase successiva non ha step attivi. |
| I2b | `istanze/[id]/actions.ts:1221` | `fasePrecedente.steps[length - 1]` senza filtro su `attivo`: `rollbackFase` può riportare l'istanza su uno step soft-deleted. |
| I3 | `istanze/[id]/page.tsx:141-142, 147-148` | La UI usa ancora `ordine ± 1` sulle fasi. Governa il pulsante "Rimanda a fase precedente" mentre l'azione usa `fasePrecedente()`: con un buco negli ordini il pulsante non compare pur essendo l'azione eseguibile. |

---

## File Structure

**Creati:**
- `packages/db/src/navigazione-iter.ts` — quattro funzioni pure di risoluzione (portate da `refactor/navigazione-iter`)
- `packages/db/test/navigazione-iter.test.ts` — test unitari delle funzioni pure
- `citta-semplice-office/test/servizi-ordini.test.ts` — test del percorso di scrittura degli ordini
- `packages/db/prisma/migrations/<timestamp>_step_unique_servizio_ordine/migration.sql` — deduplica + indice univoco parziale
- `test/integration/ordini-step.test.ts` — test di integrazione su deduplica e vincolo

**Modificati:**
- `packages/db/src/index.ts` — export del nuovo modulo
- `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts` — quattro risoluzioni + I1 + I2
- `citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx` — I3 e `isLastStep`
- `citta-semplice-office/src/app/(dashboard)/amministrazione/servizi/actions.ts` — C1 e C1-bis

**Non modificato:** `packages/db/prisma/schema.prisma` non riceve `@@unique` — vedi Task 4, il vincolo è un indice **parziale** che il DSL Prisma non sa esprimere.

---

## Task 1: Le funzioni pure di risoluzione e i loro chiamanti

**Files:**
- Create: `packages/db/src/navigazione-iter.ts`
- Create: `packages/db/test/navigazione-iter.test.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts`

**Interfaces:**
- Produces — **i Task 2, 3 e 4 vi si appoggiano**:

```ts
export interface StepPerNavigazione { ordine: number; faseId: number | null; attivo?: boolean }
export interface FasePerNavigazione { ordine: number }

export function prossimoStepStessaFase<T extends StepPerNavigazione>(steps: T[], faseId: number | null | undefined, ordineCorrente: number): T | undefined;
export function prossimaFase<T extends FasePerNavigazione>(fasi: T[], ordineCorrente: number): T | undefined;
export function stepPrecedenteStessaFase<T extends StepPerNavigazione>(steps: T[], faseId: number | null | undefined, ordineCorrente: number): T | undefined;
export function fasePrecedente<T extends FasePerNavigazione>(fasi: T[], ordineCorrente: number): T | undefined;
```

Nessuna modifica di schema in questo task.

- [ ] **Step 1: Portare il modulo e i suoi test dal branch preservato**

Il lavoro esiste già, corretto e revisionato. Recuperalo invece di riscriverlo:

```bash
git show refactor/navigazione-iter:packages/db/src/navigazione-iter.ts > packages/db/src/navigazione-iter.ts
git show refactor/navigazione-iter:packages/db/test/navigazione-iter.test.ts > packages/db/test/navigazione-iter.test.ts
```

Leggi entrambi i file dopo averli copiati: devi conoscerne il contenuto per gli step successivi. `fasePrecedente` è esportata anche con l'alias `trovaFasePrecedente` dal punto d'uso, per non fare shadowing con la variabile locale omonima in `rollbackFase`.

- [ ] **Step 2: Esportare il modulo**

Modify `packages/db/src/index.ts`, aggiungendo dopo gli export esistenti:

```ts
export * from './navigazione-iter';
```

- [ ] **Step 3: Eseguire i test unitari**

Run: `npm run test:unit`
Expected: PASS — i 14 test del nuovo file più tutti i preesistenti.

- [ ] **Step 4: Portare le quattro chiamate in `actions.ts`**

Recupera il file dal branch preservato come **riferimento**, non copiandolo:

```bash
git show refactor/navigazione-iter:"citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts" > /tmp/actions-riferimento.ts
```

Il file su `main` è diverso (contiene la conversione all'enum `StatoIstanza` mergiata nel frattempo). Applica **solo** le quattro sostituzioni della navigazione, prendendole dal riferimento:

1. in `advanceWorkflow`, il prossimo step della stessa fase → `prossimoStepStessaFase(steps, currentStep?.faseId, currentStepOrder)`;
2. in `advanceWorkflow`, la fase successiva → `prossimaFase(allFasi, currentFase?.ordine ?? 0)`. **Nota il default `?? 0`**: con `?? 1` un'istanza priva di fase corrente cercava la fase di ordine 2, saltando la prima;
3. in `regressWorkflow`, lo step precedente → `stepPrecedenteStessaFase(steps, currentStep?.faseId, currentStepOrder)`;
4. in `rollbackFase`, la fase precedente → `trovaFasePrecedente(istanza.servizio.fasi, istanza.faseCorrente.ordine)`, sostituendo anche la guardia `faseCorrente.ordine <= 1` con `!fasePrecedente`.

- [ ] **Step 5: Correggere I1 — la guardia che presume ordini a partire da 1**

Modify `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts`, in `regressWorkflow`. Rimuovi:

```ts
    if (currentStepOrder <= 1) {
      return { success: false, message: 'Impossibile retrocedere: siamo già al primo step' };
    }
```

La condizione vera non è "l'ordine corrente è 1" ma "non esiste uno step precedente nella fase", che il ramo `!prevStep` già valuta. Lasciando la guardia, il messaggio "Usa Rimanda a fase precedente" — introdotto proprio per distinguere i due casi — non verrebbe mai emesso per il primo step di una fase con ordine 1, cioè per ogni fase se gli ordini ripartono.

Il ramo `!prevStep` deve distinguere i due casi:

```ts
    if (!prevStep) {
      const esisteFasePrecedente =
        currentStep?.fase != null &&
        trovaFasePrecedente(istanza.servizio.fasi, currentStep.fase.ordine) !== undefined;
      return {
        success: false,
        message: esisteFasePrecedente
          ? 'Impossibile retrocedere oltre il primo step della fase corrente. Usa "Rimanda a fase precedente".'
          : 'Impossibile retrocedere: siamo già al primo step dell\'iter.',
      };
    }
```

Se `istanza.servizio.fasi` non è incluso nella query di `regressWorkflow`, aggiungilo all'`include`.

- [ ] **Step 6: Correggere I2 — le due risoluzioni rimaste indice-di-array**

Modify lo stesso file, due punti.

Primo, in `advanceWorkflow`, dove si prende il primo step della fase successiva. Sostituisci `nextFase.steps[0]` con una risoluzione che filtri gli step disattivati e gestisca l'assenza:

```ts
          const firstStepNextFase = nextFase.steps
            .filter((s) => s.attivo)
            .sort((a, b) => a.ordine - b.ordine)[0];

          // Una fase può esistere senza step attivi (creata dal backoffice e non
          // ancora configurata). Prima della correzione della navigazione questo
          // ramo era irraggiungibile perché `ordine + 1` non trovava la fase;
          // ora la trova, e senza guardia si otterrebbe un TypeError dentro la
          // transazione, lasciando l'istanza in uno stato incoerente.
          if (!firstStepNextFase) {
            throw new Error(
              `La fase "${nextFase.nome}" non ha step attivi: configurala prima di trasferirvi l'istanza.`,
            );
          }
```

Il `throw` dentro la `$transaction` la fa rollbackare; il `catch` esterno di `advanceWorkflow` restituisce già un esito di errore all'operatore.

Secondo, in `rollbackFase`, l'ultimo step della fase precedente:

```ts
  const lastStepFasePrecedente = fasePrecedente.steps
    .filter((s) => s.attivo)
    .sort((a, b) => b.ordine - a.ordine)[0];
```

Senza il filtro, la retrocessione può riportare l'istanza su uno step soft-deleted, che non compare più nella configurazione del servizio.

- [ ] **Step 7: Verificare**

```bash
npx tsc --noEmit -p citta-semplice-office/tsconfig.json
npm test
npm run build
```

Expected: typecheck pulito, tutti i test verdi, build completate.

- [ ] **Step 8: Verifica negativa, come ultimo passo prima del commit**

Reintroduci temporaneamente `s.ordine === ordineCorrente + 1` in `prossimoStepStessaFase`, esegui `npm run test:unit`, conferma che i test falliscano, **poi ripristina** e riesegui per conferma. Non committare finché `git diff` non mostra il file ripristinato.

- [ ] **Step 9: Commit**

```bash
git add packages/db/src packages/db/test "citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts"
git commit -m "fix(office): risoluzione dell'iter per ordinamento, con guardie sugli step attivi"
```

---

## Task 2: La UI del dettaglio istanza

**Files:**
- Modify: `citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx:141-148, 191-192`

**Interfaces:**
- Consumes: `prossimaFase`, `fasePrecedente` da `@citta/db` (Task 1).
- Produces: nessuna nuova interfaccia.

Oggi la pagina calcola con aritmetica ciò che le azioni risolvono per ordinamento: il pulsante "Rimanda a fase precedente" compare in base a `faseCorrente.ordine > 1`, mentre l'azione che esegue usa `fasePrecedente()`. Con un buco negli ordini delle fasi il pulsante non compare pur essendo l'azione perfettamente eseguibile.

- [ ] **Step 1: Sostituire l'aritmetica sulle fasi**

Modify `citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx`. Sostituisci:

```tsx
  const fasePrecedente = faseCorrente && faseCorrente.ordine > 1
    ? istanza.servizio.fasi.find(f => f.ordine === faseCorrente.ordine - 1) ?? null
    : null;
```

con:

```tsx
  // Stessa risoluzione che usa `rollbackFase`: se le due divergono, il pulsante
  // e l'azione che innesca smettono di essere d'accordo.
  const fasePrecedente = faseCorrente
    ? trovaFasePrecedente(istanza.servizio.fasi, faseCorrente.ordine) ?? null
    : null;
```

e sostituisci:

```tsx
  const nextFase = faseCorrente
    ? istanza.servizio.fasi.find(f => f.ordine === faseCorrente.ordine + 1) ?? null
    : null;
```

con:

```tsx
  const nextFase = faseCorrente
    ? prossimaFase(istanza.servizio.fasi, faseCorrente.ordine) ?? null
    : null;
```

Aggiungi l'import: `import { prossimaFase, fasePrecedente as trovaFasePrecedente } from '@citta/db';`

- [ ] **Step 2: Rendere robusto `isLastStep`**

Sempre nello stesso file:

```tsx
  const lastStepOrdine = steps.length > 0 ? steps[steps.length - 1].ordine : 0;
  const isLastStep = currentStep ? currentStep.ordine === lastStepOrdine : false;
```

`steps[steps.length - 1]` presume che l'array sia ordinato per `ordine` crescente e che l'ultimo elemento sia l'ultimo passo dell'iter. Rendilo esplicito e insensibile all'ordine di caricamento:

```tsx
  // Gli `ordine` degli step sono globali sul servizio, non per fase: l'ultimo
  // passo dell'iter è quello con ordine massimo fra gli step attivi, non
  // l'ultimo elemento dell'array come caricato.
  const stepAttivi = steps.filter((s) => s.attivo);
  const lastStepOrdine = stepAttivi.reduce((max, s) => (s.ordine > max ? s.ordine : max), 0);
  const isLastStep = currentStep ? currentStep.ordine === lastStepOrdine : false;
```

- [ ] **Step 3: Verificare**

```bash
npx tsc --noEmit -p citta-semplice-office/tsconfig.json
npm test
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add "citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx"
git commit -m "fix(office): la UI del dettaglio istanza risolve fasi e ultimo step come le azioni"
```

---

## Task 3: `updateServizio` atomico e privo di collisioni transitorie

**Files:**
- Modify: `citta-semplice-office/src/app/(dashboard)/amministrazione/servizi/actions.ts`
- Create: `citta-semplice-office/test/servizi-ordini.test.ts`

**Interfaces:**
- Consumes: nulla dai task precedenti.
- Produces: la garanzia su cui poggia il Task 4 — dopo un salvataggio, gli step attivi di un servizio hanno ordini `1..n` distinti, e il salvataggio è atomico.

Questo task **non aggiunge il vincolo**: lo rende possibile. Senza di esso, il Task 4 romperebbe ogni riordino di step dal backoffice.

Tre difetti da chiudere insieme:

1. **Nessuna transazione.** `prisma.servizio.update` e `upsertFasi` vanno a buon fine, poi il ciclo sugli step può fallire a metà: il servizio resta salvato con le fasi nuove e gli step vecchi.
2. **Collisioni transitorie.** Il ciclo assegna `ordine: i + 1` una `UPDATE` per volta. Riordinando due step A(1), B(2) in B, A, la prima `UPDATE` porta B a 1 mentre A è ancora a 1.
3. **Step fantasma.** Il soft delete (`:238-242`) lascia allo step disattivato il suo `ordine`, che continua a occupare uno slot.

- [ ] **Step 1: Scrivere il test che li dimostra**

Create `citta-semplice-office/test/servizi-ordini.test.ts`. Il glob dei test unitari copre `citta-semplice-*/test/**/*.test.ts` (vedi `vitest.config.ts`), quindi questo file viene raccolto.

Il test esercita la **funzione pura di rinumerazione** che estrarrai allo Step 2, non `updateServizio` per intero (che richiede sessione, `revalidatePath` e database):

```ts
import { describe, it, expect } from 'vitest';
import { pianoRinumerazione } from '../src/app/(dashboard)/amministrazione/servizi/ordini';

describe('pianoRinumerazione', () => {
  it('assegna ordini densi 1..n nell ordine del form', () => {
    const piano = pianoRinumerazione([{ id: 10 }, { id: 11 }, { id: 12 }]);
    expect(piano.finali).toEqual([
      { id: 10, ordine: 1 },
      { id: 11, ordine: 2 },
      { id: 12, ordine: 3 },
    ]);
  });

  it('passa da ordini temporanei negativi, che non possono collidere con quelli finali', () => {
    const piano = pianoRinumerazione([{ id: 10 }, { id: 11 }]);
    expect(piano.temporanei.every((t) => t.ordine < 0)).toBe(true);
    // Nessun ordine temporaneo coincide con un ordine finale: è ciò che rende
    // impossibile la collisione durante la riscrittura sequenziale.
    const finali = new Set(piano.finali.map((f) => f.ordine));
    expect(piano.temporanei.some((t) => finali.has(t.ordine))).toBe(false);
  });

  it('assegna un temporaneo distinto a ogni step', () => {
    const piano = pianoRinumerazione([{ id: 10 }, { id: 11 }, { id: 12 }]);
    const ordini = piano.temporanei.map((t) => t.ordine);
    expect(new Set(ordini).size).toBe(ordini.length);
  });

  it('gestisce l elenco vuoto senza produrre istruzioni', () => {
    const piano = pianoRinumerazione([]);
    expect(piano.temporanei).toEqual([]);
    expect(piano.finali).toEqual([]);
  });
});
```

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm run test:unit`
Expected: FAIL — il modulo `ordini` non esiste.

- [ ] **Step 3: Estrarre la funzione pura**

Create `citta-semplice-office/src/app/(dashboard)/amministrazione/servizi/ordini.ts`:

```ts
/**
 * Piano di rinumerazione degli step di un servizio.
 *
 * Gli ordini sono globali sul servizio e devono risultare densi (1..n)
 * nell'ordine in cui il form li presenta. Riscriverli in sequenza produce
 * però collisioni transitorie: riordinando A(1), B(2) in B, A, la prima
 * UPDATE porterebbe B a 1 mentre A è ancora a 1. Con un indice univoco
 * questo fallisce, perché un indice unico non è differibile.
 *
 * Il piano passa quindi da ordini temporanei negativi, che non possono
 * coincidere con nessun ordine finale (sempre positivo): prima si spostano
 * tutti gli step fuori dallo spazio dei valori finali, poi li si porta a
 * destinazione. Entrambe le fasi vanno eseguite nella STESSA transazione.
 */
export interface StepDaRinumerare {
  id: number;
}

export interface PianoRinumerazione {
  temporanei: { id: number; ordine: number }[];
  finali: { id: number; ordine: number }[];
}

export function pianoRinumerazione(steps: StepDaRinumerare[]): PianoRinumerazione {
  return {
    temporanei: steps.map((s, i) => ({ id: s.id, ordine: -(i + 1) })),
    finali: steps.map((s, i) => ({ id: s.id, ordine: i + 1 })),
  };
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npm run test:unit`
Expected: PASS — quattro test nuovi più tutti i preesistenti.

- [ ] **Step 5: Rendere `updateServizio` transazionale e usare il piano**

Modify `citta-semplice-office/src/app/(dashboard)/amministrazione/servizi/actions.ts`.

Avvolgi in `prisma.$transaction(async (tx) => { ... })` tutto il blocco che va dalla ricerca degli step esistenti fino alla fine degli upsert di pagamenti e allegati, sostituendo ogni `prisma.` con `tx.` al suo interno. È l'unico modo perché un fallimento a metà non lasci il servizio in uno stato incoerente.

Dentro la transazione, sostituisci il ciclo che crea/aggiorna gli step con questa sequenza:

1. crea gli step nuovi (quelli senza `id`) con un ordine temporaneo negativo, e aggiorna i campi non-ordine di quelli esistenti;
2. costruisci l'elenco completo nell'ordine del form e chiama `pianoRinumerazione`;
3. applica `piano.temporanei` (tutti gli step escono dallo spazio degli ordini finali);
4. applica `piano.finali`.

- [ ] **Step 6: Liberare lo slot degli step soft-deleted**

Sempre dentro la transazione, dove il soft delete imposta `attivo: false` (`:238-242`), azzera anche l'ordine:

```ts
      await tx.step.updateMany({
        where: { id: { in: toSoftDelete } },
        data: { attivo: false, ordine: 0 },
      });
```

Uno step disattivato non appartiene più all'iter: tenerne l'ordine gli fa occupare uno slot per sempre, e con il vincolo del Task 4 collidere con gli step vivi. `ordine: 0` lo mette fuori dallo spazio `1..n` senza perdere la riga, che serve ancora ai workflow storici che la referenziano.

- [ ] **Step 7: Verificare**

```bash
npx tsc --noEmit -p citta-semplice-office/tsconfig.json
npm test
npm run build
```

- [ ] **Step 8: Verifica manuale del percorso reale**

I test unitari coprono il piano, non la transazione. Verifica a mano, con l'applicazione avviata e il database di sviluppo allineato (`npm run db:migrate` — vedi le note d'ambiente): apri un servizio con almeno tre step su due fasi, **riordina** due step, salva, e riapri per controllare che l'ordine sia quello atteso e che nessuno step sia sparito. Riporta l'esito nel report.

- [ ] **Step 9: Commit**

```bash
git add "citta-semplice-office/src/app/(dashboard)/amministrazione/servizi" citta-semplice-office/test
git commit -m "fix(office): salvataggio del servizio atomico e senza collisioni sugli ordini"
```

---

## Task 4: Il vincolo di unicità sugli ordini

**Files:**
- Create: `packages/db/prisma/migrations/<timestamp>_step_unique_servizio_ordine/migration.sql`
- Create: `test/integration/ordini-step.test.ts`

**Interfaces:**
- Consumes: la garanzia prodotta dal Task 3 (salvataggio atomico, ordini densi, step disattivati fuori dallo spazio `1..n`).
- Produces: l'invariante `(servizioId, ordine)` univoco fra gli step attivi.

**Il vincolo è un indice PARZIALE e non va nello schema Prisma.** Gli step soft-deleted restano in tabella con `ordine = 0` (Task 3) e non devono partecipare al vincolo. Il DSL di Prisma non sa esprimere un indice univoco parziale: `@@unique([servizioId, ordine])` creerebbe un indice **totale**, che includerebbe le righe disattivate. La migrazione lo crea in SQL grezzo, e lo schema Prisma non lo dichiara — coerente con il fatto che in questo progetto le migrazioni sono la fonte di verità.

- [ ] **Step 1: Scrivere il test di integrazione**

Create `test/integration/ordini-step.test.ts`. Il pattern (container, `applicaSchema`, client `pg`, lettura della migrazione da disco) è quello di `test/integration/stato-istanza.test.ts`: leggilo come riferimento.

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { avviaPostgres, fermaPostgres, applicaSchema, type UrlDatabase } from './postgres';

let url: UrlDatabase;
let client: Client;

/**
 * La migrazione gira su un database vuoto, quindi deduplica e rinumerazione
 * non toccano alcuna riga: per verificarle davvero bisogna costruire i dati
 * e poi rieseguire il file REALE, non una sua copia ridigitata qui.
 */
const PERCORSO_MIGRAZIONE = resolve(
  process.cwd(),
  'packages/db/prisma/migrations',
);

function sqlMigrazione(): string {
  const { readdirSync } = require('node:fs') as typeof import('node:fs');
  const cartella = readdirSync(PERCORSO_MIGRAZIONE)
    .filter((d) => d.endsWith('_step_unique_servizio_ordine'))
    .sort()
    .at(-1);
  if (!cartella) throw new Error('Migrazione step_unique_servizio_ordine non trovata');
  return readFileSync(resolve(PERCORSO_MIGRAZIONE, cartella, 'migration.sql'), 'utf-8');
}

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

/** Crea area, servizio, ufficio e due fasi. Restituisce gli id. */
async function creaServizioConDueFasi(suffisso: string) {
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
  const servizioId = servizio.rows[0].id;
  const fasi: number[] = [];
  for (const ordine of [1, 2]) {
    const f = await client.query<{ id: number }>(
      `INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [`Fase ${ordine} ${suffisso}`, ordine, servizioId, ufficio.rows[0].id],
    );
    fasi.push(f.rows[0].id);
  }
  return { servizioId, faseA: fasi[0], faseB: fasi[1] };
}

async function creaStep(servizioId: number, faseId: number, ordine: number, attivo = true) {
  const res = await client.query<{ id: number }>(
    `INSERT INTO steps (descrizione, ordine, attivo, servizio_id, fase_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [`Step ${ordine}`, ordine, attivo, servizioId, faseId],
  );
  return res.rows[0].id;
}

describe('deduplica e vincolo sugli ordini degli step', () => {
  it('rimuove i duplicati riproducendo il caso difficile', async () => {
    const { servizioId, faseA } = await creaServizioConDueFasi('duplicati');
    // Tre step allo stesso ordine, più un quarto già a 2: è il controesempio
    // per cui una deduplica che sposta i soli duplicati fallisce.
    await creaStep(servizioId, faseA, 1);
    await creaStep(servizioId, faseA, 1);
    await creaStep(servizioId, faseA, 1);
    await creaStep(servizioId, faseA, 2);

    await client.query(sqlMigrazione());

    const { rows } = await client.query<{ ordine: number; conta: string }>(
      `SELECT ordine, COUNT(*) AS conta FROM steps
       WHERE servizio_id = $1 AND attivo = true
       GROUP BY ordine HAVING COUNT(*) > 1`,
      [servizioId],
    );
    expect(rows).toEqual([]);
  });

  it('mantiene la numerazione GLOBALE sul servizio, non per fase', async () => {
    const { servizioId, faseA, faseB } = await creaServizioConDueFasi('globale');
    await creaStep(servizioId, faseA, 1);
    await creaStep(servizioId, faseA, 2);
    await creaStep(servizioId, faseB, 3);

    await client.query(sqlMigrazione());

    // Il punto che il tentativo precedente aveva sbagliato: rinumerando per
    // fase, faseB ripartirebbe da 1 e collidrebbe con faseA. Gli ordini devono
    // restare distinti fra TUTTE le fasi dello stesso servizio.
    const { rows } = await client.query<{ ordine: number; fase_id: number }>(
      `SELECT ordine, fase_id FROM steps
       WHERE servizio_id = $1 AND attivo = true ORDER BY ordine`,
      [servizioId],
    );
    const ordini = rows.map((r) => r.ordine);
    expect(new Set(ordini).size).toBe(ordini.length);
    expect(new Set(rows.map((r) => r.fase_id)).size).toBe(2);
  });

  it('rifiuta due step ATTIVI con la stessa coppia (servizio, ordine)', async () => {
    const { servizioId, faseA } = await creaServizioConDueFasi('vincolo');
    await creaStep(servizioId, faseA, 1);
    await client.query(sqlMigrazione());
    await expect(creaStep(servizioId, faseA, 1)).rejects.toMatchObject({ code: '23505' });
  });

  it('consente due step DISATTIVATI con la stessa coppia: l indice è parziale', async () => {
    const { servizioId, faseA } = await creaServizioConDueFasi('parziale');
    await client.query(sqlMigrazione());
    await creaStep(servizioId, faseA, 0, false);
    await expect(creaStep(servizioId, faseA, 0, false)).resolves.toBeTypeOf('number');
  });
});
```

Il secondo test è quello che il tentativo precedente avrebbe fallito: una deduplica `PARTITION BY fase_id` supera il primo e cade sul secondo.

- [ ] **Step 2: Eseguire il test per vederlo fallire**

Run: `npm run test:integration`
Expected: FAIL — la migrazione non esiste.

- [ ] **Step 3: Scrivere la migrazione**

Create `packages/db/prisma/migrations/<timestamp>_step_unique_servizio_ordine/migration.sql`, con timestamp `YYYYMMDDHHMMSS` successivo all'ultima migrazione esistente:

```sql
-- Gli `ordine` degli step sono GLOBALI sul servizio, non per fase:
-- `buildStepData` li assegna come indice+1 sull'array piatto che attraversa
-- tutte le fasi, e `isLastStep` deriva l'ultimo passo dell'iter dal massimo
-- su tutto il servizio. La coppia univoca è quindi (servizio_id, ordine).

-- Deduplica preventiva: rinumera densamente gli step ATTIVI di ogni servizio
-- preservandone l'ordine relativo. ROW_NUMBER() assegna interi distinti 1..n
-- per partizione, quindi non può a sua volta produrre collisioni.
WITH rinumerati AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY servizio_id ORDER BY ordine, id) AS nuovo_ordine
  FROM steps
  WHERE attivo = true
)
UPDATE steps s
SET ordine = r.nuovo_ordine
FROM rinumerati r
WHERE s.id = r.id AND s.ordine <> r.nuovo_ordine;

-- Gli step disattivati escono dallo spazio degli ordini validi: restano in
-- tabella perché i workflow storici li referenziano, ma non occupano slot.
UPDATE steps SET ordine = 0 WHERE attivo = false AND ordine <> 0;

-- Indice PARZIALE: solo gli step attivi partecipano al vincolo. Non è
-- dichiarato nello schema Prisma perché il DSL non esprime indici parziali,
-- e un `@@unique` totale includerebbe le righe disattivate.
CREATE UNIQUE INDEX "steps_servizio_id_ordine_attivi_key"
  ON "steps" ("servizio_id", "ordine")
  WHERE "attivo" = true;
```

- [ ] **Step 4: Eseguire i test**

```bash
npm run db:generate
npm run test:integration
```

Expected: PASS.

- [ ] **Step 5: Verificare che il DSL Prisma non dichiari il vincolo**

Run: `grep -n "unique" packages/db/prisma/schema.prisma | grep -i "ordine"`
Expected: nessun risultato. Se qualcuno avesse aggiunto `@@unique([servizioId, ordine])` al modello `Step`, va rimosso: creerebbe un indice totale in conflitto con quello parziale.

- [ ] **Step 6: Verifica negativa, come ultimo passo prima del commit**

Sostituisci temporaneamente nella migrazione `PARTITION BY servizio_id` con `PARTITION BY fase_id` — l'errore del tentativo precedente — ed esegui `npm run test:integration`. Il test del punto 2 (numerazione globale) **deve** fallire. Poi ripristina e riesegui. Non committare finché `git diff` non mostra la migrazione ripristinata.

- [ ] **Step 7: Verificare tutto e committare**

```bash
npx tsc --noEmit -p citta-semplice-office/tsconfig.json
npm test
npm run build
git add packages/db test/integration
git commit -m "feat(db): ordini degli step univoci per servizio fra gli step attivi"
```

---

## Self-Review

**Copertura rispetto alla specifica** (`docs/superpowers/specs/2026-08-04-nucleo-dominio-design.md`, decisione D5 e appendice A1):

| Difetto | Task |
|---|---|
| Aritmetica sugli ordini nelle tre risoluzioni originarie | Task 1 |
| I1 — guardia che presume ordini a partire da 1 | Task 1 |
| I2a/I2b — risoluzioni indice-di-array senza guardia né filtro `attivo` | Task 1 |
| I3 — la UI duplica l'aritmetica e diverge dalle azioni | Task 2 |
| C1 — `updateServizio` non transazionale e con collisioni transitorie | Task 3 |
| C1-bis — step soft-deleted che occupano uno slot | Task 3, Task 4 |
| C2 — vincolo e numerazione coerenti con lo schema globale | Task 4 |

**Ordine dei task, e perché non è invertibile:** il Task 4 aggiunge il vincolo che il Task 3 rende sostenibile. Eseguirli in ordine inverso riprodurrebbe esattamente il difetto per cui il tentativo precedente è stato bocciato. Il Task 3 ha valore anche da solo: oggi un fallimento a metà salvataggio lascia il servizio incoerente, indipendentemente da qualunque vincolo.

**Fermarsi prima è legittimo.** Dopo il Task 3 il sistema è già migliore di oggi in ogni aspetto. Il Task 4 aggiunge una garanzia strutturale; se il costo di verificarlo dovesse crescere, rimandarlo non lascia nulla a metà.

**Fuori da questo piano:** D4 (posizione corrente e assegnazione) nel piano 2b; D2 e D3 (`ModuloVersione`, `jsonb`) nel 2c; D6 (`Documento`) nel 2d.

**Debito d'ambiente, invariato:**
- Il database di sviluppo non riceve le migrazioni automaticamente: allinealo con `npm run db:migrate` prima di avviare le applicazioni, altrimenti il codice cercherà colonne che lì non esistono.
- `citta-semplice-migrations/migrate-dati.js:26,34` contiene credenziali in chiaro, tracciate in git: vanno **ruotate**, non solo rimosse.
- `.claude/settings.json` su `main` include `Bash(node -e ' *)` nell'allowlist di progetto — esecuzione di codice arbitrario preapprovata per chiunque lavori sul repository. Andrebbe spostata in `settings.local.json`.
