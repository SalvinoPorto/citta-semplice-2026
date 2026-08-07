# Rifacimento del nucleo di dominio: istanze, moduli versionati, workflow, documenti

Data: 2026-08-04

## Contesto

`citta-semplice-2026` è la riscrittura Next.js di un sistema legacy Angular/SpringBoot
attualmente in produzione. Il nuovo sistema è in **pre-produzione**: non esistono ancora
istanze reali di cittadini, quindi le modifiche di schema non richiedono migrazioni a
doppia scrittura.

Al go-live va migrato l'archivio legacy: **100.000–1.000.000 di istanze storiche**. I
moduli legacy erano già definiti dinamicamente con uno schema simile a quello attuale,
quindi convertibili campo per campo.

Due applicazioni condividono lo stesso database PostgreSQL:

- `citta-semplice-portal` — il cittadino compila e invia istanze, ne segue lo stato,
  risponde alle comunicazioni degli uffici.
- `citta-semplice-office` — gli operatori dell'ente lavorano le istanze: avanzamento di
  fase, richiesta integrazioni, protocollazione, pagamenti.

Lo schema Prisma canonico sta in `prisma/schema.prisma` ed è copiato nelle due app da
`sync-schema.sh`, con `check-schema-drift.sh` a sorvegliare la divergenza.

### Vincoli di dominio accertati

- **L'iter di una pratica è sempre lineare**, con possibilità di passi indietro. Non
  esistono diramazioni condizionali sui dati dell'istanza. Questo esclude un motore a
  grafo o event sourcing: la struttura `Fase` ordinata → `Step` ordinati è adeguata.
- **Fasi diverse possono competere a uffici diversi** (`Fase.ufficioId`), ed è ciò che
  determina la visibilità delle istanze agli operatori.
- **Istanze legacy chiuse**: è accettabile una rappresentazione "fotografica piatta",
  autosufficiente e di sola lettura.
- **Istanze legacy aperte**: il loro iter va rimappato sul nuovo modello di fasi e step.

## Problemi che questo lavoro risolve

Rilevati per ispezione del codice, con riferimenti puntuali.

### P1 — La navigazione dell'iter è aritmetica sugli ordini

`advanceWorkflow` cerca il passo successivo con
`s.ordine === currentStepOrder + 1`
(`citta-semplice-office/src/app/(dashboard)/istanze/[id]/actions.ts:183-185`), e la fase
successiva con `f.ordine === (currentFase?.ordine ?? 1) + 1` (stesso file, riga 267). Il
vincolo `@@unique([servizioId, ordine])` su `Step` è **commentato**
(`prisma/schema.prisma:283`).

Conseguenza: un buco negli ordini — step disattivato, riordino dal backoffice — fa cadere
l'avanzamento nel ramo "cambio fase" **senza errore**. L'istanza salta a un altro ufficio
e il fallimento è silenzioso.

### P2 — "Dove sta l'istanza adesso" ha risposte divergenti

`Workflow.operatoreId` significa due cose diverse a seconda della riga: sulle righe chiuse
è "chi ha completato lo step", sulla riga aperta è "a chi è assegnata l'istanza".

Poiché l'assegnazione corrente non è una colonna interrogabile, i tab della lista istanze
(Nuove / Mie / Di altri) sono implementati in raw SQL con subquery correlata che
materializza **tutti** gli ID corrispondenti in memoria Node, per rimandarli al database
come `WHERE id IN (...)`
(`citta-semplice-office/src/app/api/istanze/paged/route.ts:229-289`). La stessa subquery è
ripetuta tre volte per i contatori (righe 50-76).

Inoltre l'ultimo workflow è risolto con `orderBy: { id: 'desc' }` in `advanceWorkflow` ma
con `data_variazione DESC` nella lista paginata: due definizioni diverse di "corrente".

### P3 — I dati del modulo non sono interrogabili

`Istanza.dati` è un array JSON serializzato `[{name, label, value}]` in una colonna `Text`.
La ricerca usa `dati: { contains: ... }`, cioè `ILIKE` non indicizzabile su tutta la
tabella. A 100k+ righe non regge.

`datiInEvidenza` è una denormalizzazione stringa introdotta per rimediare, ma è calcolata
una sola volta all'invio e non viene ricalcolata se cambia `Servizio.campiInEvidenza`:
deriva silenziosamente.

### P4 — Lo schema del modulo non è versionato

`submitIstanza` valida i dati contro `servizio.attributi` **corrente**
(`citta-semplice-portal/src/lib/actions/istanza.ts:379`), e il riepilogo di un'istanza
storica viene renderizzato con le label attuali del servizio.

L'unico modo documentato di modificare un modulo in produzione è "disattiva, clona,
modifica il clone, attiva al suo posto". Con questi volumi il workaround frammenta
storico, statistiche e ricerche su N cloni dello stesso servizio.

### P5 — Gli allegati esistono solo se esiste uno step

`Allegato.workflowId` è obbligatorio. In
`citta-semplice-portal/src/lib/actions/istanza.ts:444-446`, se il servizio non ha step
configurati, gli allegati caricati dal cittadino e il PDF del modulo vengono **scartati in
silenzio**: nessun errore, l'istanza risulta inviata senza i suoi documenti.

`Allegato` e `AllegatoRisposta` hanno campi pressoché identici e differiscono solo per la
chiave esterna.

### P6 — Le chiamate esterne non sono idempotenti né tracciate

`submitIstanza` protocolla **prima** di creare l'istanza, passando `istanzaId: null`
(`citta-semplice-portal/src/lib/actions/istanza.ts:477-492`).

- Se Urbi risponde e la `create` successiva fallisce, resta un numero di protocollo
  assegnato senza referente nel sistema.
- Se Urbi va in timeout *dopo* aver registrato, il cittadino riprova e ottiene **due
  protocolli** per la stessa istanza.

Non esiste alcun registro delle chiamate esterne (richiesta, risposta, esito): è un buco
di tracciabilità oltre che di correttezza.

### P7 — Lo stato dell'istanza è tre booleani

`inBozza` / `conclusa` / `respinta`, mutuamente esclusivi per vincolo CHECK
(`prisma/schema.prisma:337-344`). Ogni query ripete `inBozza: false, conclusa: false,
respinta: false`. Aggiungere uno stato richiede una colonna, un CHECK nuovo e la revisione
di ogni clausola `where` del progetto.

### P8 — Storage incoerente e non scalabile

Il portale scrive su filesystem direttamente con `writeFile`
(`citta-semplice-portal/src/lib/actions/istanza.ts:72`); l'office passa dall'astrazione
`getStorage()`. Il filesystem locale impedisce di scalare orizzontalmente: due istanze
Next.js non condividono il disco.

## Obiettivi

1. Rendere l'istanza **autosufficiente**: rileggibile senza dipendere dalla configurazione
   corrente del servizio. È il prerequisito sia dell'archivio legacy sia della modifica di
   un modulo in produzione.
2. Rendere **interrogabile** la posizione corrente e i dati del modulo, con indici, ai
   volumi previsti.
3. Rendere l'avanzamento dell'iter **esplicito e verificabile**, senza aritmetica sugli
   ordini.
4. Rendere le integrazioni esterne **idempotenti e tracciate**.
5. Non rappresentare stati impossibili.

## Non-obiettivi

- **Nessun motore di workflow generico**, nessun grafo di transizioni, nessun event
  sourcing: l'iter è lineare per vincolo di dominio.
- **Scomposizione del god-table `Servizio`** (~40 colonne che mescolano contenuto
  editoriale, configurazione del modulo, regole di invio e presentazione, con liste in
  colonne CSV): debito reale, non blocca il go-live, non vincola lo schema di partenza.
  Rinviata.
- **Outbox completo con worker asincrono** per le integrazioni: per il go-live basta il
  registro idempotente descritto sotto. Rinviato.
- Nessuna modifica al form-builder e a `@citta/form-schema` oltre a ciò che serve per
  versionare lo schema.

## Decisioni prese

### D1 — Stato dell'istanza come enum

```prisma
enum StatoIstanza {
  BOZZA           // solo portale, invisibile agli operatori
  IN_LAVORAZIONE
  CONCLUSA
  RESPINTA
}
```

Sostituisce i tre booleani e il vincolo CHECK. Risolve P7.

### D2 — `ModuloVersione`: lo schema del modulo diventa un'entità

```prisma
model ModuloVersione {
  id           Int       @id @default(autoincrement())
  servizioId   Int
  versione     Int
  schema       Json      // FormSchema di @citta/form-schema
  pubblicataAt DateTime?

  servizio     Servizio  @relation(...)
  istanze      Istanza[]

  @@unique([servizioId, versione])
}
```

`Servizio.attributi` (stringa JSON) viene rimosso; `Servizio` punta alla versione
pubblicata corrente. **Ogni istanza referenzia la versione con cui è stata compilata.**

Risolve P4. È inoltre il contenitore in cui atterrano gli schemi legacy convertiti, e
rende non necessaria una struttura separata per l'archivio (vedi D6).

### D3 — `dati` in `jsonb`, con ricerca indicizzata

`Istanza.dati` diventa un oggetto piatto `{ nomeCampo: valore }` in `jsonb`. Le `label`
spariscono dai dati: appartengono allo schema, si leggono da `ModuloVersione`.

L'indice GIN su `jsonb` copre il **contenimento** (`dati @> '{"cf":"..."}'`), cioè il
match esatto. La casella "cerca" del backoffice fa ricerca **parziale**, che richiede una
colonna testuale derivata con indice trigram:

```sql
ALTER TABLE istanze ADD COLUMN dati_ricerca text;
CREATE INDEX istanze_dati_ricerca_trgm ON istanze USING gin (dati_ricerca gin_trgm_ops);
CREATE INDEX istanze_dati_gin          ON istanze USING gin (dati jsonb_path_ops);
```

`dati_ricerca` si deriva da `dati` tramite **trigger** `BEFORE INSERT OR UPDATE`, non da
codice applicativo: per la stessa ragione di D4, due applicazioni scrivono su questo
database e la coerenza non deve dipendere dal fatto che entrambe si ricordino di
aggiornarlo. Sostituisce `datiInEvidenza`. Richiede l'estensione `pg_trgm`. Risolve P3.

### D4 — Separare assegnazione corrente e storico di completamento

```prisma
model Istanza {
  stato               StatoIstanza @default(BOZZA)
  moduloVersioneId    Int
  legacyId            String?      @unique   // tracciabilità import, vedi "Migrazione dal legacy"

  // posizione corrente — scritte nella stessa transazione dell'avanzamento
  faseCorrenteId      Int?
  attivitaCorrenteId  Int?  @unique
  assegnatarioId      Int?   // chi ha in carico ORA (null = non presa in carico)

  @@index([stato, assegnatarioId])
  @@index([faseCorrenteId])
}

model IstanzaAttivita {          // ex-Workflow: una riga per step attivato
  completataDaId      Int?       // chi l'ha chiusa — storico, non assegnazione
  completataAt        DateTime?

  @@index([istanzaId, iniziataAt])
}
```

I tre tab diventano `WHERE assegnatario_id IS NULL` / `= :me` / `IS NOT NULL AND <> :me`
su indice. Spariscono le query raw, la materializzazione degli ID e la clausola `IN`. I
contatori diventano un solo `GROUP BY`. Risolve P2.

**Precedente noto:** `last_step_id` era già stato introdotto e poi rimosso perché andava
fuori sincrono (`prisma/schema.prisma:346-348`). La differenza è che qui la scrittura
avviene dentro la `$transaction` già presente in `advanceWorkflow`, insieme alla creazione
dell'attività — non come update separato. Poiché due applicazioni scrivono sullo stesso
database, si aggiunge un **trigger** su `istanza_attivita` che mantiene
`istanze.attivita_corrente_id`, così la coerenza non dipende dal codice applicativo.

**Raffinato dal piano 2b:** le regole di dominio che questo blocco lascia implicite —
quando l'assegnazione decade, chi mantiene le colonne denormalizzate, come si derivano le
etichette di stato una volta che l'assegnazione non vive più sulla riga di attività — sono
decise in `2026-08-07-posizione-corrente-e-assegnazione-design.md`.

**Rinominazione:** `Workflow` → `IstanzaAttivita`. Il nome attuale designa una riga per
attivazione di step, non "il workflow", ed è la ragione per cui la posizione corrente ha
finito per avere definizioni divergenti. `Fase`/`Step` restano la definizione,
`IstanzaAttivita` è l'esecuzione.

### D5 — Navigazione dell'iter senza aritmetica

```prisma
model Step {
  @@unique([faseId, ordine])   // oggi commentato, e sul paio sbagliato
}
```

```ts
// prima:  steps.find(s => s.faseId === current.faseId && s.ordine === current.ordine + 1)
// dopo:
tx.step.findFirst({
  where: { faseId: current.faseId, ordine: { gt: current.ordine }, attivo: true },
  orderBy: { ordine: 'asc' },
})
```

Stessa correzione per la risoluzione della fase successiva. Risolve P1.

### D6 — Documento unico ancorato all'istanza

```prisma
enum OrigineDocumento { CITTADINO OPERATORE SISTEMA }

model Documento {
  id              Int      @id @default(autoincrement())
  nomeFile        String
  chiaveStorage   String   // ex nomeHash: percorso relativo
  mimeType        String?
  origine         OrigineDocumento
  caricatoAt      DateTime @default(now())

  istanzaId       Int      // ← sempre valorizzato
  attivitaId      Int?     // contesto: durante quale step
  comunicazioneId Int?     // oppure: allegato a quale comunicazione
  rispostaId      Int?

  @@index([istanzaId])
}
```

Sostituisce `Allegato` e `AllegatoRisposta`. `AllegatoRichiesto` resta invariato: è
configurazione del servizio, non un documento. Risolve P5.

Lo storage passa a un adapter unico in `packages/`, con target S3-compatible (MinIO
on-prem è sufficiente), usato da entrambe le applicazioni. Risolve P8.

### D7 — Archivio: partizionamento, non tabella separata

La "rappresentazione fotografica piatta" delle istanze chiuse **è già soddisfatta da D2 e
D3**: con lo schema congelato in `ModuloVersione` e i dati in `jsonb`, un'istanza chiusa è
autosufficiente. Non serve una struttura dati separata.

Resta la sola questione fisica. Si adotta il **partizionamento dichiarativo** di Postgres
su `data_invio`, per anno:

```sql
CREATE TABLE istanze (...) PARTITION BY RANGE (data_invio);
CREATE TABLE istanze_2024 PARTITION OF istanze FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

**Scartata** una tabella `IstanzaArchivio` separata: costringerebbe ogni ricerca, export e
statistica a una `UNION` o a un ramo condizionale, permanentemente. Col partizionamento le
query restano invariate, Postgres esclude da solo le partizioni irrilevanti, e le annate
chiuse possono andare in tablespace separati o in sola lettura.

*Nota di implementazione:* Prisma non gestisce il partizionamento dichiarativo; le
partizioni si creano in migrazioni SQL manuali, con una routine di creazione della
partizione dell'anno entrante.

### D8 — Registro idempotente delle chiamate esterne

```prisma
model ChiamataEsterna {
  id                Int      @id @default(autoincrement())
  chiaveIdempotenza String   @unique   // es. "protocollo:istanza:123:step:4"
  servizio          String   // URBI | PMPAY
  stato             String   // IN_CORSO | OK | ERRORE
  richiesta         Json
  risposta          Json?
  createdAt         DateTime @default(now())
}
```

La riga si scrive con stato `IN_CORSO` **prima** della chiamata; al retry si trova la riga
e non si richiama. Chiude il doppio protocollo e il buco di tracciabilità — quest'ultimo
anche requisito di conformità per una PA.

Si riordina inoltre `submitIstanza`: creare l'istanza (già in `BOZZA`) → protocollare →
confermare. Un protocollo orfano diventa così recuperabile invece che perso. Risolve P6.

### D9 — `packages/db`

Un solo schema Prisma e un solo client generato, al posto delle tre copie tenute allineate
da `sync-schema.sh` e sorvegliate da `check-schema-drift.sh`. Il monorepo ha già
`packages/`: `form-schema` e `integrations` sono la stessa estrazione, già avviata.

## Migrazione dal legacy

Due percorsi distinti, come da vincolo di dominio.

**Istanze chiuse** — import massivo:
- gli schemi legacy dinamici si convertono in `ModuloVersione`, una per versione distinta
  rilevata;
- `dati` si converte in `jsonb` piatto, popolando `dati_ricerca`;
- la cronologia si converte in righe `IstanzaAttivita`. Dove non mappa sui nuovi step, si
  degrada a storico testuale: sono istanze chiuse, nessuno ci avanzerà sopra.

**Istanze aperte** — richiedono una tabella di corrispondenza
`step legacy → (servizio, fase, step)` nuovo. **Non è automatizzabile**: è curatela per
servizio, da svolgere con gli utenti che conoscono gli iter. Il codice deve renderla
applicabile e verificabile, non indovinarla.

**L'importer è idempotente e rieseguibile**, con `Istanza.legacyId` sotto vincolo di
unicità (vedi D4). Ai volumi previsti l'import non riuscirà al primo tentativo, e dover
ripartire da un database vuoto a ogni giro è ciò che fa fallire le migrazioni.

## Sequenza rispetto al go-live

**Bloccante** — senza questo il sistema non regge i volumi o perde dati:
D1, D2, D3, D4, D5, D6, D8, più gli indici e la riscrittura della lista paginata, più
l'importer legacy.

**Bloccante, e da fare prima dell'import** — D7. In Postgres non si converte una tabella
già popolata in tabella partizionata: occorre creare la tabella partizionata e trasferire
i dati, cioè una riscrittura completa. Partizionare *dopo* aver caricato 100k–1M righe
significa rifare l'import o subire un rewrite lungo con la tabella bloccata. Il
partizionamento va quindi predisposto **prima** della migrazione legacy, anche se il suo
beneficio si manifesta solo dopo.

*(Questa classificazione corregge una prima valutazione che collocava D7 fra le voci
rinviabili: vale per lo schema, non per la sequenza rispetto all'import.)*

**Non bloccante** — dopo il go-live:
D9, scomposizione di `Servizio`, outbox asincrono completo.

## Criteri di verifica

1. **P1**: un test che disattiva uno step intermedio e verifica che l'avanzamento passi
   allo step successivo della stessa fase, senza cambio di fase né di ufficio.
2. **P2**: i tre tab e i contatori restituiscono gli stessi insiemi di prima, con zero
   query raw e nessuna clausola `IN` costruita in applicazione. Verificato su un dataset
   di almeno 100k istanze.
3. **P3**: ricerca parziale su un campo del modulo su 100k+ istanze, con `EXPLAIN` che
   mostra uso dell'indice trigram e non un sequential scan.
4. **P4**: modificare il modulo di un servizio con istanze già inviate; le istanze
   preesistenti continuano a mostrare le label originali.
5. **P5**: inviare un'istanza per un servizio senza step configurati; allegati e PDF del
   modulo risultano persistiti e scaricabili.
6. **P6**: simulare un timeout di Urbi dopo la registrazione; il retry non produce un
   secondo protocollo.
7. **Migrazione**: l'importer eseguito due volte di seguito sullo stesso input produce lo
   stesso stato finale del database.

## Fuori perimetro, già chiuso

Il provider di autenticazione `credentials` del portale dichiarava un campo `password` e
non lo verificava mai: bastava un codice fiscale per impersonare qualunque cittadino.
Rimosso nel commit `716bd47`. L'identità del cittadino si stabilisce solo via SPID/CIE
(provider `cig-sso`).

---

# Appendice — quanto appreso eseguendo il piano 2a

Aggiunta il 2026-08-06, dopo l'esecuzione del primo sotto-piano (D1 e D5). Vincola i
piani successivi: sono errori già pagati una volta.

## A1 — Gli `ordine` degli `Step` sono globali per servizio, non per fase

`buildStepData` (`citta-semplice-office/src/app/(dashboard)/amministrazione/servizi/actions.ts:11`)
assegna `ordine: idx + 1` sull'array **piatto** dei passi, che attraversa tutte le fasi.
`isLastStep` (`citta-semplice-office/src/app/(dashboard)/istanze/[id]/page.tsx:191-192`)
deriva l'ultimo passo dell'iter dal massimo su **tutto il servizio**.

Quindi la coppia univoca corretta è `(servizioId, ordine)` — proprio quella lasciata
commentata nello schema — **non** `(faseId, ordine)`. Il piano 2a ha letto quel commento
come una dimenticanza da correggere e ha introdotto la coppia sbagliata: ne sono seguiti
due difetti gravi, che il vincolo rompesse ogni riordino di step dal backoffice
(`updateServizio` riscrive gli ordini una `UPDATE` per volta, e un indice unico non è
differibile), e che una rinumerazione per fase sfasasse `isLastStep`, facendo comparire
"Concludi" all'operatore di una fase intermedia.

**Conseguenza per chi tocca `Step.ordine`:** i consumatori non sono solo quelli che
*leggono* per navigare, ma anche chi *scrive* (il form di amministrazione) e chi ne
*deduce proprietà* (la pagina di dettaglio). Censirli tutti prima di cambiare
numerazione o vincoli.

## A2 — Un elenco di punti da correggere è un punto di partenza, non un censimento

Il piano 2a elencava 12 file da convertire: ne servivano 16. Elencava tre punti di
aritmetica sugli ordini: ne sono emersi sette, di cui uno solo dopo la review finale.
Ogni task che dichiara "i punti sono questi" va aperto con un `grep` che li riverifichi,
e il risultato del grep prevale sull'elenco.

## A3 — Un test vale solo se fallisce quando la cosa che protegge si rompe

Il piano 2a ha prodotto due volte lo stesso difetto, entrambe sfuggite alla prima
revisione: un test che ridigitava l'SQL di una migrazione invece di eseguirla (sarebbe
rimasto verde togliendo l'istruzione che verificava), e tre test che replicavano in SQL
una logica scritta in TypeScript (sarebbero rimasti verdi reintroducendo il bug).

Regole per i piani successivi:

- Un test su una migrazione deve **leggere il file da disco** ed eseguirlo, mai
  riprodurne il contenuto.
- Una logica va **estratta in funzione pura** e testata direttamente, invece di essere
  riprodotta nel test in un altro linguaggio.
- Ogni test non banale va accompagnato da una **verifica negativa**: rompere
  deliberatamente ciò che protegge e osservarlo fallire. Va eseguita come **ultimo passo
  prima del commit**, o su una copia: durante il piano 2a un'interruzione a metà
  verifica ha lasciato nel working tree la versione sabotata, scambiabile per quella
  buona.
- Estrarre in funzione pura non basta se nessun test esercita il **chiamante**:
  reintrodurre l'aritmetica direttamente in `advanceWorkflow` lascerebbe verdi tutti i
  test, perché le funzioni pure resterebbero corrette e semplicemente non chiamate.

## A4 — Il ciclo espansione → contrazione protegge l'albero di sviluppo, non il rilascio

Le tre migrazioni girano consecutive nello stesso `migrate deploy`, senza che alcuna
applicazione scriva fra l'una e l'altra: il riallineamento è di fatto un no-op in
produzione. Serve invece a far sì che ogni task lasci l'albero compilante e i test verdi.

**Non rende il rilascio zero-downtime:** fra l'applicazione della contrazione e il
rilascio del codice nuovo, il codice vecchio che seleziona le colonne eliminate va in
errore. Se il deploy non è atomico, serve una finestra di manutenzione.

## A5 — Vincoli d'ambiente

- `prisma migrate dev --create-only` fallisce con **P3014**: l'utente del database di
  sviluppo non può creare lo shadow database. Le migrazioni vanno scritte a mano, e
  nessuno strumento verifica la corrispondenza fra SQL e schema Prisma — la revisione
  deve controllarla esplicitamente.
- Il database di sviluppo non riceve le migrazioni automaticamente: va allineato con
  `migrate deploy` prima di avviare le applicazioni in locale.
