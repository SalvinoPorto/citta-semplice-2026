# Posizione corrente e assegnazione dell'istanza (piano 2b)

Data: 2026-08-07

Raffina **D4** di `2026-08-04-nucleo-dominio-design.md`. Quel documento decide *cosa*
denormalizzare; questo decide le regole di dominio che D4 lasciava implicite, e che sono
emerse leggendo il codice: quando l'assegnazione decade, chi garantisce la coerenza delle
colonne denormalizzate, e cosa succede alle etichette di stato dell'attività quando
l'assegnazione smette di vivere sulla riga di attività.

Perimetro del piano 2b: **tutto D4**, rename `Workflow` → `IstanzaAttivita` compreso, più
la condivisione del container Postgres fra i file di test di integrazione.

## Il problema, verificato sul codice

D4 descrive P2 come "`Workflow.operatoreId` significa due cose diverse a seconda della
riga". Il censimento ne ha trovate tre conseguenze, non una.

### Le due strade di scrittura sono in disaccordo

- `advanceWorkflow` (`citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts:257-263`)
  crea l'attività successiva con `operatoreId` = chi ha avanzato, **anche quando la nuova
  fase compete a un altro ufficio**: l'istanza arriva all'ufficio successivo già "presa in
  carico" da un operatore che non ci lavorerà, e non compare fra le "Nuove" di nessuno.
- `rollbackFase` (stesso file, `:1249`) crea l'attività **senza** `operatoreId`: l'istanza
  torna disponibile nel tab "Nuove".

Nessuna delle due è documentata come scelta. Sono lo stesso campo scritto da due autori
diversi. Finché "assegnatario" è un effetto collaterale di come si popola
`Workflow.operatoreId`, la divergenza resta invisibile.

### `Workflow.stato` non è binario

Lo schema lo dichiara "binario voluto: 0 = in lavorazione, 1 = completata"
(`packages/db/prisma/schema.prisma:425-427`). In lettura circola un terzo valore, `-1`,
mai memorizzato, sintetizzato dal codice applicativo:

- `citta-semplice-portal/src/lib/actions/le-mie-istanze.ts:83` — `operatoreId === null ? -1 : stato`
- `citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts:80-82` — `getStatoLabel`
  traduce `-1` in "Retrocesso" o "In attesa" a seconda di `operatoreId`

### "In attesa" è un'informazione che vive sull'assegnazione, non sull'attività

L'etichetta mostrata nella timeline nasce dalla **coppia** `(operatoreId, stato)`:
`operatoreId === null` → "In attesa", `stato === 1` → "Completata", altrimenti "In
lavorazione". Spostare l'assegnazione su `Istanza` toglie alla riga di attività
l'informazione con cui oggi distingue le prime due etichette: se `operatoreId` diventa
"chi ha chiuso", ogni attività aperta ha quel campo a `NULL` e "In attesa" e "In
lavorazione" collassano.

Punti di consumo censiti (`grep`, non elenco a memoria):

| File | Riga | Cosa fa |
|---|---|---|
| `citta-semplice-office/.../istanze/[id]/actions.ts` | 79-82 | `getStatoLabel(operatoreId, stato)` |
| `citta-semplice-office/.../istanze/[id]/workflow-timeline.tsx` | 265-266, 294, 298, 302, 396 | classe CSS, etichetta, ricerca dell'attività aperta, visibilità del blocco pagamento |
| `citta-semplice-office/src/lib/models/stato-istanza.ts` | 21, 31 | badge di stato in lista |
| `citta-semplice-portal/.../le-mie-istanze/[id]/page.tsx` | 131-134, 462 | badge "presa in carico" e etichetta per riga |
| `citta-semplice-portal/src/lib/actions/le-mie-istanze.ts` | 83 | sintesi del valore `-1` |

## Decisioni

### B1 — L'assegnazione decade a ogni cambio di fase

`Istanza.assegnatarioId` è `NULL` quando l'istanza non è presa in carico. Passa a un
operatore con la presa in carico, e **torna a `NULL` ogni volta che cambia
`faseCorrenteId`**, in avanzamento come in rollback.

Motivo: la visibilità delle istanze agli operatori è determinata dall'ufficio della fase
corrente (`Fase.ufficioId`). Un'istanza che entra in una fase di competenza di un altro
ufficio portandosi dietro l'assegnatario precedente risulta, per quell'ufficio, già presa
in carico da qualcuno che non ci lavorerà — che è il difetto oggi presente
nell'avanzamento. Dentro la stessa fase l'assegnatario resta: gli step successivi della
stessa fase li lavora la stessa persona.

Formalizza il comportamento oggi corretto (`rollbackFase`) e corregge quello sbagliato
(`advanceWorkflow`).

### B2 — Tre stati derivati, nessun valore sentinella

```prisma
model IstanzaAttivita {
  iniziataAt      DateTime   @map("data_variazione")
  completataAt    DateTime?  @map("completata_at")     // NULL = aperta
  completataDaId  Int?       @map("completata_da_id")  // chi l'ha CHIUSA
}
```

`stato Int` viene rimosso. L'etichetta si deriva da una funzione pura in `packages/db`,
con questa tavola:

| Condizione | Etichetta |
|---|---|
| `completataAt != null` | Completata |
| è l'attività corrente **e** `istanza.assegnatarioId != null` | In lavorazione |
| è l'attività corrente **e** `istanza.assegnatarioId == null` | In attesa |
| non è l'attività corrente e non è completata | Retrocesso |

L'ultima riga è il caso che oggi il codice fabbrica con `-1`: un'attività scavalcata da un
rollback senza essere mai stata chiusa. Diventa una condizione osservabile sui dati invece
di un valore che non esiste nel database.

La funzione è pura e testata direttamente, non riprodotta nei test in altra forma
(regola A3 dell'appendice della specifica di dominio). Riceve l'attività, l'id
dell'attività corrente dell'istanza e l'assegnatario; non interroga il database.

### B3 — Le colonne denormalizzate le mantiene il database

```prisma
model Istanza {
  faseCorrenteId      Int?                            // già esistente
  attivitaCorrenteId  Int?  @unique @map("attivita_corrente_id")
  assegnatarioId      Int?  @map("assegnatario_id")

  @@index([stato, assegnatarioId])
  @@index([faseCorrenteId])                           // nuovo
}
```

`@@index([stato])` esiste già (`packages/db/prisma/schema.prisma:404`) e diventa
ridondante: è un prefisso di `(stato, assegnatarioId)`. Va rimosso nella contrazione,
altrimenti resta un indice da mantenere a ogni scrittura senza che nulla lo usi.
`faseCorrenteId` non è oggi indicizzata pur essendo il campo su cui poggia la visibilità
per ufficio.

Due colonne, due trigger, per due ragioni distinte:

- **`attivita_corrente_id`** — trigger `AFTER INSERT ON istanza_attivita`. La corrente è
  per definizione l'ultima inserita: nessuna applicazione la scrive mai, quindi non può
  divergere. Chiude anche la seconda metà di P2, la divergenza fra `ORDER BY id DESC`
  (in `advanceWorkflow`) e `data_variazione DESC` (nella lista paginata): sparisce del
  tutto la nozione di "ultimo per ordinamento".
- **`assegnatario_id`** — scritto dall'applicazione (`takeCharge`), ma con un trigger
  `BEFORE UPDATE ON istanze` che lo azzera quando `fase_corrente_id` cambia. La regola B1
  vive così in **un solo posto** e vale per entrambi i percorsi senza che debbano
  ricordarsene. `advanceWorkflow` e `rollbackFase` non toccano più l'assegnazione: cambiano
  la fase, e l'azzeramento segue.

**Alternativa scartata:** scrivere entrambe le colonne in applicazione, dentro le
`$transaction` già presenti. I percorsi di scrittura sono quattro (`advanceWorkflow`,
`rollbackFase`, `takeCharge`, submit del portale) distribuiti su due applicazioni che
condividono il database; il precedente di `last_step_id` — introdotta, andata fuori
sincrono, rimossa (`packages/db/prisma/schema.prisma:354-364`) — dice come finisce.

### B4 — La lista paginata perde le query raw

| Tab | Oggi | Dopo |
|---|---|---|
| Nuove | `$queryRaw` + subquery correlata, ID materializzati in Node, `WHERE id IN (...)` | `{ stato: 'IN_LAVORAZIONE', assegnatarioId: null }` |
| Mie | idem | `{ stato: 'IN_LAVORAZIONE', assegnatarioId: me }` |
| Di altri | idem | `stato: 'IN_LAVORAZIONE'` e `assegnatario_id IS NOT NULL AND <> me` |

La forma esatta del terzo filtro va verificata in fase di implementazione: su una colonna
nullable, `not: <valore>` di Prisma non ha una traduzione SQL ovvia rispetto ai `NULL`, e
il tab "Di altri" deve escluderli. La condizione da soddisfare è quella scritta in tabella,
non una particolare sintassi.

I sei contatori di `getIstanzeCounts` (`citta-semplice-office/src/app/api/istanze/paged/route.ts:40-84`),
di cui tre in raw con la stessa subquery ripetuta, diventano un `groupBy`. Il filtro di
colonna "operatore" (`:257-268`) perde la sua `$queryRaw` e diventa una condizione sulla
relazione `assegnatario`.

`include: { workflows: { orderBy: { dataVariazione: 'desc' }, take: 1 } }` diventa
`include: { attivitaCorrente: { ... } }`: un join invece di un lateral per riga.

**Fuori perimetro:** restano due `$queryRaw` che non dipendono da D4 — il filtro
`TO_CHAR(data_invio, 'DD/MM/YYYY')` (`:270-278`) e i frammenti di visibilità per ufficio
(`istanzaVisibilitySql`). Non vengono toccate.

### B5 — Rename

`Workflow` → `IstanzaAttivita`, tabella `workflows` → `istanza_attivita`.

Insieme: `WorkflowFase` → `IstanzaFase`, tabella `workflow_fasi` → `istanza_fasi`. È
un'estensione rispetto alla lettera di D4, che nomina solo `Workflow`: rimuovere il nome
`Workflow` lasciando in circolo `WorkflowFase` produce una coppia peggiore della
situazione di partenza.

Il rename è **l'ultimo task del piano**, in un commit meccanico isolato. È l'unico
intervento di cui nessun test può dimostrare la correttezza se non "compila e i test
restano verdi": tenerlo separato evita che il suo rumore attraversi il diff da revisionare
per la logica.

## Migrazione dei dati

Ciclo espansione → contrazione, come in 2a. Protegge l'albero di sviluppo — ogni task
lascia codice compilante e test verdi — non il rilascio (regola A4).

**Espansione.** Aggiunge `assegnatario_id`, `attivita_corrente_id`, `completata_at`,
`completata_da_id`, i due trigger e l'indice `(stato, assegnatario_id)`. Non rimuove
nulla: il codice esistente continua a girare sulle colonne vecchie.

Backfill:

- `istanze.assegnatario_id` = `operatore_id` dell'**ultima** attività dell'istanza
  (`data_variazione DESC`, `id DESC` a parità). È la definizione oggi in uso nei tab, non
  "una qualsiasi attività con operatore".
- `istanze.attivita_corrente_id` = `id` della stessa attività.
- `istanza_attivita.completata_da_id` = `operatore_id`, **solo per le righe con
  `stato = 1`**. Sulle righe aperte quel campo significava assegnazione, che ora vive
  altrove: copiarlo trasformerebbe un'attività aperta in una chiusa.
- `istanza_attivita.completata_at` non esiste da nessuna parte. Si deriva dalla
  `data_variazione` dell'attività **successiva** della stessa istanza — quando è partita
  la successiva, la precedente era chiusa — con fallback sulla propria `data_variazione`
  per una riga chiusa senza successiva. È un'approssimazione, e riguarda solo dati di
  sviluppo: il sistema è in pre-produzione, non esistono istanze reali di cittadini.

**Contrazione.** Rimuove `workflows.stato` e `workflows.operatore_id`; esegue i rename di
tabella e di modello.

Vincolo d'ambiente noto (regola A5): `prisma migrate dev --create-only` fallisce con P3014
in questo ambiente. Le migrazioni si scrivono a mano e nessuno strumento verifica la
corrispondenza fra SQL e schema Prisma: la revisione deve controllarla esplicitamente.

## Verifica

**Container Postgres condiviso, per primo.** Oggi ogni file di integrazione avvia il
proprio container (~10 s): la condivisione reale richiede `globalSetup` + `provide` /
`inject` (vedi la nota in `test/integration/postgres.ts:10-21`). 2b aggiunge almeno due
file; farlo come primo task evita di pagare il costo per tutta la durata del piano.

**Equivalenza dei tab.** Un test di integrazione costruisce ~20 istanze in tutte le
configurazioni rilevanti — non assegnata, assegnata a me, assegnata ad altri, dopo
avanzamento con cambio di fase, dopo rollback, conclusa, respinta — e verifica insiemi dei
tre tab e valore dei sei contatori. Con **verifica negativa**: rimuovere il trigger di
azzeramento deve far fallire il caso "cambio di fase", eseguita come ultimo passo prima
del commit.

**Trigger.** I test eseguono il **file di migrazione letto da disco**, mai SQL ridigitato
nel test (regola A3).

**Volume.** Un test dietro variabile d'ambiente (escluso dalla suite ordinaria) genera
100.000 istanze e asserisce che `EXPLAIN` sui tre tab usi l'indice
`(stato, assegnatario_id)` e non un sequential scan. Copre il criterio P2 della specifica
di dominio senza rendere `npm test` ineseguibile a ogni commit.

**Funzione pura di derivazione dello stato.** Test unitari diretti sulle quattro righe
della tavola in B2. Non basta: serve almeno un test che eserciti un **chiamante** reale,
altrimenti reintrodurre la derivazione inline nella UI lascerebbe tutto verde (regola A3,
ultimo punto).

## Criteri di accettazione

1. Un'istanza avanzata in una fase di un altro ufficio compare fra le "Nuove" di
   quell'ufficio, con `assegnatario_id` a `NULL`.
2. Un'istanza avanzata allo step successivo della **stessa** fase conserva l'assegnatario.
3. `citta-semplice-office/src/app/api/istanze/paged/route.ts` non contiene più alcuna
   `$queryRaw` legata all'assegnazione, né alcuna clausola `id: { in: [...] }` costruita
   in applicazione per i tab.
4. La somma dei contatori Nuove + Mie + Di altri è uguale al numero di istanze in
   `IN_LAVORAZIONE` visibili all'operatore.
5. Su 100.000 istanze, `EXPLAIN` dei tre tab mostra l'uso di `istanze_stato_assegnatario_idx`.
6. Nessuna occorrenza di `Workflow` / `workflows` resta nel codice applicativo, nello
   schema o nei nomi di file sorgente, `WorkflowFase` inclusa. Documentazione e piani
   storici in `docs/` restano come sono: sono il racconto di com'era.
7. `npm test`, `npx tsc --noEmit` su entrambe le app e `npm run build` passano.

## Fuori perimetro

- D2 e D3 (`ModuloVersione`, `dati` in `jsonb`, ricerca indicizzata) — piano 2c.
- D6 (`Documento` unico, adapter storage) — piano 2d.
- Le due `$queryRaw` non legate all'assegnazione nella lista paginata (vedi B4).
- La scomposizione di `Servizio`, già rinviata dalla specifica di dominio.
