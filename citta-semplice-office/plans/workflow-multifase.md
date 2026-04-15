# Piano: Workflow Multi-Fase (Multi-Ufficio)

**Feature:** Suddivisione dell'iter di un servizio in Fasi, ognuna assegnata a un ufficio diverso.  
**Creato:** 2026-04-15  
**Stato:** Da implementare

---

## Decisioni di progetto

| # | Decisione |
|---|-----------|
| 1 | Quando una fase diventa attiva, nessuna assegnazione automatica di operatore |
| 2 | Al passaggio di fase (avanzamento E rollback) → email all'ufficio entrante, con toggle per non inviarla |
| 3 | Tutti gli uffici vedono tutti gli step in read-only (visibilità cross-fase) |
| 4 | Il rollback di fase è previsto, con email condizionata |

---

## Schema dati finale

### Nuovi modelli (da aggiungere a entrambi i `prisma/schema.prisma`)

```prisma
model Fase {
  id          Int      @id @default(autoincrement())
  nome        String   @db.VarChar(255)
  ordine      Int

  servizioId  Int      @map("servizio_id")
  servizio    Servizio @relation(fields: [servizioId], references: [id], onDelete: Cascade)

  ufficioId   Int?     @map("ufficio_id")
  ufficio     Ufficio? @relation(fields: [ufficioId], references: [id], onDelete: SetNull)

  steps                Step[]
  workflowFasi         WorkflowFase[]
  istanzeFaseCorrente  Istanza[]      @relation("FaseCorrente")

  @@map("fasi")
}

model WorkflowFase {
  id                       Int       @id @default(autoincrement())
  dataInizio               DateTime  @map("data_inizio")
  dataCompletamento        DateTime? @map("data_completamento")
  direzione                String    @default("AVANZAMENTO") @db.VarChar(20)
  // direzione: "AVANZAMENTO" | "ROLLBACK"

  istanzaId                Int       @map("istanza_id")
  istanza                  Istanza   @relation(fields: [istanzaId], references: [id], onDelete: Cascade)

  faseId                   Int       @map("fase_id")
  fase                     Fase      @relation(fields: [faseId], references: [id])

  operatoreCompletamentoId Int?      @map("operatore_completamento_id")
  operatoreCompletamento   Operatore? @relation(fields: [operatoreCompletamentoId], references: [id])

  @@index([istanzaId])
  @@map("workflow_fasi")
}
```

### Modifiche a modelli esistenti

**`Step`** — aggiungere:
```prisma
  faseId   Int?  @map("fase_id")
  fase     Fase? @relation(fields: [faseId], references: [id], onDelete: SetNull)
```

**`Istanza`** — aggiungere:
```prisma
  faseCorrenteId  Int?   @map("fase_corrente_id")
  faseCorrente    Fase?  @relation("FaseCorrente", fields: [faseCorrenteId], references: [id], onDelete: SetNull)
  workflowFasi    WorkflowFase[]
```

**`Ufficio`** — aggiungere:
```prisma
  fasi  Fase[]
```

**`Operatore`** — aggiungere:
```prisma
  workflowFasiCompletati  WorkflowFase[]
```

**`Servizio`** — aggiungere:
```prisma
  fasi  Fase[]
```

---

## Fase 0 — Contesto tecnico (già acquisito)

### File chiave

| File | Ruolo |
|------|-------|
| `prisma/schema.prisma` (office) | Schema DB del backoffice — VA MODIFICATO |
| `citta-semplice-portal/prisma/schema.prisma` | Schema DB del portale — VA MODIFICATO (stesso DB) |
| `src/lib/validations/servizio.ts` | Zod schema per form servizi — VA MODIFICATO |
| `src/app/(dashboard)/istanze/[id]/actions.ts` | Server actions workflow — VA MODIFICATO |
| `src/app/(dashboard)/amministrazione/servizi/servizio-form.tsx` | Form builder servizi — VA MODIFICATO |
| `src/app/(dashboard)/istanze/istanze-client.tsx` | Lista istanze — VA MODIFICATO |
| `src/app/api/istanze/paged/route.ts` | API lista istanze paginata — VA MODIFICATO |
| `src/lib/services/email.ts` | Servizio email — DA USARE (non modificare) |

### Patterns da seguire (già nel codice)

- **`advanceWorkflow`**: avanza step cercando `ordine = current + 1`. Modificare per intercettare fine-fase.
- **`regressWorkflow`**: retrocede a `ordine - 1`. Il rollback di fase è distinto e agisce sul livello superiore.
- **`sendEmail({to, subject, html})`**: unica firma da usare per le notifiche.
- **`useFieldArray`** + `insert/move/remove`: pattern form step builder da estendere per fasi.
- **`STATO_IN_LAVORAZIONE = 0` / `STATO_COMPLETATA = 1`**: costanti già in uso.

---

## Fase 1 — Schema Prisma + Migrazione

### Obiettivo
Aggiungere i modelli `Fase` e `WorkflowFase`, modificare `Step` e `Istanza`.

### Task

1. **Aggiungere i modelli** a entrambi gli `schema.prisma` (office e portal) — usare lo schema finale sopra.

2. **Scrivere la migration SQL** (`prisma/migrations/YYYYMMDDHHMMSS_workflow_multifase/migration.sql`):
   ```sql
   -- Crea tabella fasi
   CREATE TABLE "fasi" (
     "id" SERIAL NOT NULL,
     "nome" VARCHAR(255) NOT NULL,
     "ordine" INTEGER NOT NULL,
     "servizio_id" INTEGER NOT NULL,
     "ufficio_id" INTEGER,
     CONSTRAINT "fasi_pkey" PRIMARY KEY ("id")
   );
   
   -- Crea tabella workflow_fasi
   CREATE TABLE "workflow_fasi" (
     "id" SERIAL NOT NULL,
     "data_inizio" TIMESTAMP(3) NOT NULL,
     "data_completamento" TIMESTAMP(3),
     "direzione" VARCHAR(20) NOT NULL DEFAULT 'AVANZAMENTO',
     "istanza_id" INTEGER NOT NULL,
     "fase_id" INTEGER NOT NULL,
     "operatore_completamento_id" INTEGER,
     CONSTRAINT "workflow_fasi_pkey" PRIMARY KEY ("id")
   );
   
   -- Aggiungi colonne agli step
   ALTER TABLE "steps" ADD COLUMN "fase_id" INTEGER;
   
   -- Aggiungi colonne alle istanze
   ALTER TABLE "istanze" ADD COLUMN "fase_corrente_id" INTEGER;
   
   -- Foreign keys
   ALTER TABLE "fasi" ADD CONSTRAINT "fasi_servizio_id_fkey"
     FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   ALTER TABLE "fasi" ADD CONSTRAINT "fasi_ufficio_id_fkey"
     FOREIGN KEY ("ufficio_id") REFERENCES "uffici"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   ALTER TABLE "workflow_fasi" ADD CONSTRAINT "workflow_fasi_istanza_id_fkey"
     FOREIGN KEY ("istanza_id") REFERENCES "istanze"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   ALTER TABLE "workflow_fasi" ADD CONSTRAINT "workflow_fasi_fase_id_fkey"
     FOREIGN KEY ("fase_id") REFERENCES "fasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
   ALTER TABLE "workflow_fasi" ADD CONSTRAINT "workflow_fasi_operatore_completamento_id_fkey"
     FOREIGN KEY ("operatore_completamento_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   ALTER TABLE "steps" ADD CONSTRAINT "steps_fase_id_fkey"
     FOREIGN KEY ("fase_id") REFERENCES "fasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   ALTER TABLE "istanze" ADD CONSTRAINT "istanze_fase_corrente_id_fkey"
     FOREIGN KEY ("fase_corrente_id") REFERENCES "fasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   
   -- Indici
   CREATE INDEX "workflow_fasi_istanza_id_idx" ON "workflow_fasi"("istanza_id");
   
   -- BACKFILL: per ogni servizio con step, crea Fase 1 "Fase unica"
   -- e assegna tutti i suoi step a quella fase
   INSERT INTO "fasi" ("nome", "ordine", "servizio_id", "ufficio_id")
   SELECT 'Fase unica', 1, s."id", s."ufficio_id"
   FROM "servizi" s
   WHERE EXISTS (SELECT 1 FROM "steps" st WHERE st."servizio_id" = s."id");
   
   UPDATE "steps" st
   SET "fase_id" = f."id"
   FROM "fasi" f
   WHERE f."servizio_id" = st."servizio_id"
     AND f."ordine" = 1;
   
   -- BACKFILL: per le istanze attive, imposta fase_corrente_id alla fase 1 del loro servizio
   UPDATE "istanze" i
   SET "fase_corrente_id" = f."id"
   FROM "fasi" f
   WHERE f."servizio_id" = i."servizio_id"
     AND f."ordine" = 1
     AND i."in_bozza" = false
     AND i."conclusa" = false
     AND i."respinta" = false;
   
   -- BACKFILL: crea WorkflowFase per istanze già in lavorazione
   INSERT INTO "workflow_fasi" ("data_inizio", "istanza_id", "fase_id", "direzione")
   SELECT i."data_invio", i."id", i."fase_corrente_id", 'AVANZAMENTO'
   FROM "istanze" i
   WHERE i."fase_corrente_id" IS NOT NULL;
   ```

3. **Rigenerare i client Prisma** in entrambi i progetti:
   ```bash
   cd citta-semplice-office && npx prisma generate
   cd citta-semplice-portal && npx prisma generate
   ```

### Verifica
- `npx prisma studio` mostra le tabelle `fasi` e `workflow_fasi`
- Tutti i servizi esistenti hanno una `Fase` con `ordine=1`
- Tutti gli step esistenti hanno `faseId` non-null
- Le istanze attive hanno `faseCorrenteId` impostato

---

## Fase 2 — Validation Schema + Servizio Form (Step Builder)

### Obiettivo
Aggiungere il concetto di Fasi al form di configurazione servizio.

### 2a — `src/lib/validations/servizio.ts`

Aggiungere `faseSchema` e modificare `stepSchema` e `servizioSchema`:

```typescript
export const faseSchema = z.object({
  id: z.number().optional(),
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  ordine: z.number().int().min(1),
  ufficioId: z.number().int().nullable().optional(),
});

// In stepSchema — aggiungere:
  faseOrdine: z.number().int().min(1), // ordine della fase di appartenenza

// In servizioSchema — aggiungere:
  fasi: z.array(faseSchema),
  // 'steps' rimane, ogni step ha faseOrdine
```

> **NOTA retrocompatibilità**: `faseOrdine` default=1 per servizi esistenti. Il `save` del form deve:
> - Creare/aggiornare le `Fase` nel DB
> - Per ogni step, trovare la `Fase` con quell'ordine e settare `step.faseId`

### 2b — `src/app/(dashboard)/amministrazione/servizi/servizio-form.tsx`

**Struttura UI nel tab Workflow:**

```
[+ Aggiungi Fase]

╔═══════════════════════════════════════════════════════╗
║ FASE 1: Ufficio Demografici          [Rinomina] [X]  ║
║ Ufficio: [Demografici ▼]                             ║
╠═══════════════════════════════════════════════════════╣
║ ■ Step 1 — Presentazione Istanza    [FISSO]          ║
║ ■ Step 2 — Sopralluogo              [↑][↓][X]        ║
║                          [+ Aggiungi step in Fase 1] ║
╚═══════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════╗
║ FASE 2: Ufficio Tributi              [Rinomina] [X]  ║
║ Ufficio: [Tributi ▼]                                ║
╠═══════════════════════════════════════════════════════╣
║ ■ Step 3 — Calcolo TARI             [↑][↓][X]        ║
║ ■ Step 4 — Chiusura Pratica         [FISSO]          ║
║                          [+ Aggiungi step in Fase 2] ║
╚═══════════════════════════════════════════════════════╝
```

**Regole UI:**
- Il primo step (ordine=1) appartiene sempre alla Fase 1, è fisso
- L'ultimo step (Chiusura Pratica) appartiene sempre all'ultima fase, è fisso
- Non si può eliminare l'unica fase rimasta
- Non si può spostare uno step oltre i confini della propria fase (usare "Sposta in fase successiva/precedente")
- L'ordine degli step è globale (Fase1.steps poi Fase2.steps...) — l'`ordine` numerico viene ricalcolato al salvataggio

**Modifiche al form state:**
```typescript
// In useForm defaultValues:
fasi: servizio?.fasi ?? [{ nome: 'Fase unica', ordine: 1, ufficioId: null }],

// Ogni step aggiunge:
faseOrdine: step.fase?.ordine ?? 1,
```

**Nuovo `useFieldArray` per fasi:**
```typescript
const { fields: fasiFields, append: appendFase, remove: removeFase } = useFieldArray({
  control,
  name: 'fasi',
});
```

**Salvataggio** — nella server action del form servizio (trovare e modificare):
- Prima salva/aggiorna le `Fase` per il servizio
- Poi salva gli step con il corretto `faseId`

### Verifica
- Si può creare un servizio con 2 fasi e uffici diversi
- Gli step si muovono solo all'interno della propria fase
- Il primo e l'ultimo step restano fissi
- I servizi esistenti (fase unica) funzionano invariati

---

## Fase 3 — Logica Avanzamento con Cambio Fase

### Obiettivo
Modificare `advanceWorkflow` in `src/app/(dashboard)/istanze/[id]/actions.ts` per gestire il passaggio di fase.

### Interfaccia aggiornata

```typescript
export interface AdvanceWorkflowParams {
  istanzaId: number;
  note: string;
  inviaEmailPassaggioFase?: boolean; // default: true — usato solo se c'è cambio fase
}
```

### Logica da aggiungere in `advanceWorkflow` (dopo riga ~186 dove si cerca il next step)

```typescript
// Dopo aver completato lo step corrente...

const currentFase = istanza.faseCorrente; // Include: id, ordine, servizioId
const currentStep = lastWorkflow.step; // Include: faseId, ordine

// Cerca il prossimo step nella stessa fase
const nextStepSameFase = istanza.servizio.steps.find(
  s => s.faseId === currentStep.faseId && s.ordine === currentStep.ordine + 1
);

if (nextStepSameFase) {
  // Avanzamento intra-fase: il nuovo workflow eredita l'operatore corrente
  await prisma.workflow.create({
    data: {
      istanzaId: istanza.id,
      stepId: nextStepSameFase.id,
      dataVariazione: new Date(),
      stato: STATO_IN_LAVORAZIONE,
      operatoreId: operatore.id, // ← stesso operatore, rimane in carico
    },
  });
  await prisma.istanza.update({ data: { lastStepId: nextStepSameFase.id, activeStep: nextStepSameFase.ordine } });
} else {
  // Fine della fase corrente — cerca la fase successiva
  const allFasi = await prisma.fase.findMany({
    where: { servizioId: istanza.servizioId },
    orderBy: { ordine: 'asc' },
    include: { steps: { orderBy: { ordine: 'asc' } } },
  });
  
  const nextFase = allFasi.find(f => f.ordine === (currentFase?.ordine ?? 1) + 1);
  
  if (!nextFase) {
    // Non c'è una fase successiva → istanza conclusa (logica esistente)
    await prisma.istanza.update({ data: { conclusa: true } });
  } else {
    // Passaggio alla fase successiva
    const firstStepNextFase = nextFase.steps[0];
    
    // Chiudi WorkflowFase corrente
    await prisma.workflowFase.updateMany({
      where: { istanzaId: istanza.id, faseId: currentFase!.id, dataCompletamento: null },
      data: {
        dataCompletamento: new Date(),
        operatoreCompletamentoId: operatore.id,
      },
    });
    
    // Apri nuovo WorkflowFase
    await prisma.workflowFase.create({
      data: {
        istanzaId: istanza.id,
        faseId: nextFase.id,
        dataInizio: new Date(),
        direzione: 'AVANZAMENTO',
      },
    });
    
    // Aggiorna istanza: nuova fase corrente, primo step della nuova fase
    await prisma.istanza.update({
      where: { id: istanza.id },
      data: {
        faseCorrenteId: nextFase.id,
        lastStepId: firstStepNextFase.id,
        activeStep: firstStepNextFase.ordine,
      },
    });
    
    // Crea workflow per il primo step della nuova fase
    await prisma.workflow.create({
      data: {
        istanzaId: istanza.id,
        stepId: firstStepNextFase.id,
        dataVariazione: new Date(),
        stato: STATO_IN_LAVORAZIONE,
      },
    });
    
    // Email notifica (condizionale)
    if (params.inviaEmailPassaggioFase !== false && nextFase.ufficio?.email) {
      await sendFaseTransitionEmail({
        istanza,
        nuovaFase: nextFase,
        direzione: 'AVANZAMENTO',
      });
    }
  }
}
```

### Nuova action: `rollbackFase`

```typescript
export async function rollbackFase(params: {
  istanzaId: number;
  note: string;
  inviaEmail?: boolean; // default: true
}): Promise<{ success: boolean; message: string }>
```

**Logica:**
1. Carica istanza con `faseCorrente`, `workflowFasi`, service con fasi
2. Valida: non conclusa, non respinta, faseCorrente.ordine > 1
3. Trova fase precedente: `allFasi.find(f => f.ordine === faseCorrente.ordine - 1)`
4. Chiudi WorkflowFase corrente con `direzione: 'ROLLBACK'` e `dataCompletamento`
5. Segna i workflow dell'istanza nel step corrente come `[Rollback di fase]` in nota
6. Apri nuovo WorkflowFase per la fase precedente
7. Trova l'**ultimo step** della fase precedente (il punto di rientro)
8. Crea nuovo `Workflow` per quel step con `operatoreId: null`
   — il rollback azzera l'assegnazione: l'ufficio destinatario prende in carico liberamente
9. Aggiorna `istanza.faseCorrenteId` e `lastStepId`
10. Invia email se richiesto

### Verifica
- Avanzando oltre l'ultimo step di Fase 1, la Fase 2 diventa attiva
- `istanza.faseCorrenteId` cambia correttamente
- `WorkflowFase` registra i passaggi con timestamp
- Il rollback riporta alla fase precedente

---

## Fase 4 — Dettaglio Istanza UI

### Obiettivo
Aggiornare `src/app/(dashboard)/istanze/[id]/page.tsx` per mostrare la fase corrente e permettere il rollback.

### Dati da caricare (in `getIstanza`)

Aggiungere nelle include Prisma:
```typescript
faseCorrente: {
  include: { ufficio: true }
},
workflowFasi: {
  include: { fase: { include: { ufficio: true } } },
  orderBy: { dataInizio: 'desc' }
},
servizio: {
  include: {
    // esistenti...
    fasi: {
      include: { ufficio: true, steps: { orderBy: { ordine: 'asc' } } },
      orderBy: { ordine: 'asc' }
    }
  }
}
```

### Nuovi elementi UI

**Badge fase corrente** (vicino al badge stato istanza):
```jsx
{istanza.faseCorrente && (
  <div className="d-flex align-items-center gap-2">
    <Badge color="primary" className="me-2">
      {istanza.faseCorrente.nome}
    </Badge>
    {istanza.faseCorrente.ufficio && (
      <span className="text-muted small">
        Ufficio: {istanza.faseCorrente.ufficio.nome}
      </span>
    )}
  </div>
)}
```

**Pulsante Rollback Fase** (solo se: non conclusa, non respinta, fase.ordine > 1):
```jsx
{canRollbackFase && (
  <button 
    className="btn btn-outline-warning btn-sm"
    onClick={() => setShowRollbackFaseModal(true)}
  >
    ↩ Rimanda a fase precedente
  </button>
)}
```

**Modale Rollback Fase:**
```jsx
<Modal title="Rimanda alla fase precedente">
  <p>
    La pratica verrà rimandata a <strong>{fasePrecedente.nome}</strong>
    {fasePrecedente.ufficio && ` (Ufficio: ${fasePrecedente.ufficio.nome})`}.
  </p>
  <Textarea label="Motivazione" required />
  <Checkbox 
    label={`Invia notifica email all'ufficio ${fasePrecedente.ufficio?.nome}`}
    defaultChecked={true}
  />
  <Button onClick={handleRollback}>Conferma</Button>
</Modal>
```

**Modale Avanzamento Fase** (appare solo quando l'avanzamento causa cambio fase):
- Si mostra quando `nextStep` è in una fase diversa
- Toggle: "Invia notifica all'ufficio {nextFase.ufficio.nome}"
- Il flag viene passato a `advanceWorkflow`

**WorkflowTimeline** — aggiornamento:
- Mostrare separatori visivi tra le fasi (linea con nome della fase)
- Le `WorkflowFase` con `dataCompletamento` mostrano il badge "Fase completata"
- Il rollback mostra un indicatore visivo distinto (freccia indietro)

### Visibilità cross-fase (punto 3 delle decisioni)
- Tutti gli step sono già visibili nella timeline (nessuna modifica necessaria)
- I pulsanti di azione (avanza, carica file, paga) appaiono solo per lo step della fase corrente
- Le sezioni di step di fasi precedenti sono visibili ma in read-only

### Verifica
- Il badge fase corrente è visibile nel dettaglio istanza
- Il pulsante rollback appare solo dalla Fase 2 in poi
- La modale rollback ha toggle email
- La modale avanzamento-fase appare al momento del passaggio di fase
- La timeline distingue le fasi visivamente

---

## Fase 5 — Lista Istanze: Filtro per Ufficio + Fase Corrente

### Obiettivo
Aggiornare la lista per permettere il filtraggio per ufficio corrente della fase.

### 5a — `src/app/api/istanze/paged/route.ts`

Aggiungere `ufficioId` nei `formFilters`:
```typescript
interface FormFilters {
  protocollo?: string;
  modulo?: string;
  anno?: string;
  cerca?: string;
  ufficioId?: string; // NUOVO
}
```

Nel `whereClause`:
```typescript
if (formFilters.ufficioId) {
  whereClause.faseCorrente = {
    ufficioId: parseInt(formFilters.ufficioId),
  };
}
```

Nel `SELECT` per i count delle tab, includere `faseCorrente`:
```typescript
include: {
  // esistenti...
  faseCorrente: { include: { ufficio: true } },
}
```

### 5b — `src/app/(dashboard)/istanze/istanze-client.tsx`

Aggiungere filtro ufficio al form:
```jsx
<Select 
  label="Ufficio corrente"
  {...register('ufficioId')}
>
  <option value="">Tutti gli uffici</option>
  {uffici.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
</Select>
```

Aggiungere colonna "Fase / Ufficio" nella tabella:
```jsx
<td>
  {istanza.faseCorrente?.nome}
  {istanza.faseCorrente?.ufficio && (
    <small className="d-block text-muted">
      {istanza.faseCorrente.ufficio.nome}
    </small>
  )}
</td>
```

Il componente `IstanzeClient` deve ricevere `uffici` come prop (già disponibili nel layout).

### Verifica
- Il filtro ufficio compare nella form filtri
- Selezionando un ufficio si vedono solo le istanze dove quella è la fase attiva
- La colonna "Fase" mostra nome fase + nome ufficio

---

## Fase 6 — Email Notifica Passaggio Fase

### Obiettivo
Aggiungere la funzione helper `sendFaseTransitionEmail` in un file dedicato o in `actions.ts`.

### Firma e implementazione

```typescript
// src/lib/services/faseTransitionEmail.ts

import { sendEmail } from '@/lib/services/email';

export async function sendFaseTransitionEmail(params: {
  istanza: { id: number; protoNumero: string; utente: { nome: string; cognome: string }; servizio: { titolo: string } };
  nuovaFase: { nome: string; ufficio?: { email?: string | null; nome: string } | null };
  direzione: 'AVANZAMENTO' | 'ROLLBACK';
}): Promise<void> {
  const { istanza, nuovaFase, direzione } = params;
  const ufficioEmail = nuovaFase.ufficio?.email;
  if (!ufficioEmail) return; // nessuna email configurata per l'ufficio

  const isRollback = direzione === 'ROLLBACK';
  const subject = isRollback
    ? `[RIMANDO] Istanza ${istanza.protoNumero} — ${istanza.servizio.titolo}`
    : `[NUOVA FASE] Istanza ${istanza.protoNumero} — ${istanza.servizio.titolo}`;

  const html = `
    <p>L'istanza <strong>${istanza.protoNumero}</strong> relativa al servizio 
    <em>${istanza.servizio.titolo}</em> (${istanza.utente.cognome} ${istanza.utente.nome}) 
    è stata ${isRollback ? 'rimanda alla fase' : 'trasferita alla fase'} 
    <strong>${nuovaFase.nome}</strong> di competenza del vostro ufficio.</p>
    <p>Accedere al backoffice per prendere in carico la pratica.</p>
  `;

  await sendEmail({ to: ufficioEmail, subject, html });
}
```

### Verifica
- L'email viene inviata all'indirizzo dell'ufficio quando la fase cambia
- Se `Ufficio.email` è null, nessuna email (nessun errore)
- Il toggle nella UI sopprime l'invio

---

## Ordine di esecuzione consigliato

```
Fase 1 → Fase 2a → Fase 2b → Fase 3 → Fase 6 → Fase 4 → Fase 5
```

Rationale: schema prima, poi validation, poi form builder, poi logica actions,
poi email helper, poi UI dettaglio, poi UI lista.

---

## Anti-pattern da evitare

- NON usare `servizio.ufficioId` per determinare l'ufficio corrente — usare sempre `istanza.faseCorrente.ufficioId`
- NON modificare la logica di `regressWorkflow` (retrocessione di step) — è separata dal rollback di fase
- NON assumere che `faseId` su Step sia sempre non-null — gestire il caso legacy (fase unica implicita)
- NON inventare metodi Prisma non esistenti — usare `findMany`, `findFirst`, `update`, `updateMany`, `create`
- NON saltare il backfill della migration — i servizi esistenti devono funzionare invariati
- NON creare il workflow intra-fase con `operatoreId: null` — l'operatore che avanza uno step rimane assegnato ai successivi step della stessa fase
- NON creare il workflow del primo step di una nuova fase con un operatore — il cambio di fase azzera l'assegnazione (sia avanzamento che rollback)
