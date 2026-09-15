# citta-semplice-office

Backoffice Next.js per la gestione dei servizi comunali. Gli operatori dell'ente lavorano le istanze presentate dai cittadini tramite il portale `citta-semplice-portal`.

## Architettura del dominio

### Servizi

Ogni servizio appartiene a un'**Area** e può essere assegnato a un **Ufficio**. Ha:
- Flag `attivo` e date `dataInizio` / `dataFine` di validità
- Un modulo (form builder JSON) per la raccolta dati del richiedente
- Un **iter** (sequenza di `Step`) che definisce il processo dall'invio alla conclusione
- Se un servizio in produzione deve essere modificato: si disattiva, si clona, si modifica il clone e si attiva al suo posto

### Steps

Ogni step può prevedere una o più di queste funzionalità (flag booleani):
- **`protocollo`** — registra un protocollo tramite Urbismart (entrata `E`, uscita `U`, interno `P`); l'unità organizzativa è selezionabile
- **`pagamento`** — genera un bollettino PagoPA tramite PmPay; importo e causale possono essere fissi o variabili (inseriti dall'operatore al momento dell'avanzamento)
- **`allegati`** — richiede upload di documenti (da operatore o cittadino); i documenti restano visibili per tutta la durata del processo e oltre
- **`documentiOperatore`** — l'operatore carica documenti destinati al cittadino

### Istanze

Lo stato di un'istanza è l'enum `StatoIstanza`:
- `BOZZA` — bozza salvata dal cittadino, **invisibile agli operatori**
- `IN_LAVORAZIONE` — iter in corso
- `CONCLUSA` — iter completato normalmente
- `RESPINTA` — iter chiuso forzatamente con motivazione

L'iter viene tracciato in `IstanzaAttivita` (una per step attivato). La posizione corrente (`attivitaCorrenteId`, `faseCorrenteId`, `assegnatarioId`) è mantenuta da trigger: vedi i commenti in `packages/db/prisma/schema.prisma`.

### Comunicazioni

Durante tutto l'iter è possibile inviare `Comunicazione` al cittadino (con eventuale richiesta di risposta e allegati). Visibili nella timeline sia all'operatore che al cittadino.

---

## Integrazioni esterne

### Urbismart (Protocollo)
- File: `src/lib/external/urbismart.ts`, `src/lib/services/protocollazione/UrbiProtocolloService.ts`
- Registra documenti in entrata (`E`), uscita (`U`) o interni (`P`)
- Fallback: `ProtocolloEmergenza` — counter progressivo per anno quando Urbismart non è disponibile

### PmPay (PagoPA)
- File: `src/lib/external/pmpay.ts`
- Genera bollettini di pagamento, recupera URL e PDF
- I tributi disponibili si sincronizzano tramite `/api/pmpay/servizi`

### Email
- File: `src/lib/services/email.ts`
- Supporta SMTP e Microsoft Graph (Office365)
- Configurazione salvata nel modello `EmailConfig`

---

## Pattern e convenzioni

### Filtri istanze persistiti in URL
I filtri della lista istanze (`tab`, `page`, sort, filtri form) vengono serializzati nei query params dell'URL. Quando l'operatore apre un'istanza e torna indietro (`router.back()`), trova la lista nello stesso stato.

Parametri URL usati: `tab`, `page`, `sf` (sort field), `sd` (sort direction), `protocollo`, `modulo`, `anno`, `cerca`.

### Schema dei moduli condiviso
Tipi, condizioni di visibilità, suddivisione in pagine e costruzione del riepilogo stanno nel package
`@citta/form-schema` (`packages/form-schema`), usato sia da office che dal portale: non vanno
duplicati qui. In `form-builder/types.ts` restano solo i metadati UI della palette
(`FIELD_TYPES`, `createDefaultField`).

### Bozze non visibili agli operatori
Tutte le query lato office escludono le istanze in stato `BOZZA`. Le bozze sono visibili solo al cittadino nel portale.

### Autenticazione
NextAuth v5-beta con sessione JWT. I ruoli sono in `session.user.ruoli[]`. Usare `requireAuth()` (redirect automatico) o `getCurrentUser()` (nullable) da `src/lib/auth/session.ts`.

### Upload allegati
Lo storage vive nel package condiviso `@citta/storage`, dietro `getStorage()`:
`STORAGE_DRIVER=local` salva sul filesystem del processo (utilizzabile solo con una
istanza in esecuzione), `STORAGE_DRIVER=s3` su object storage S3-compatibile
(Garage on-premise) — obbligatorio con più replica. In entrambi i casi
`Allegato.nomeHash` contiene lo stesso percorso relativo `YYYY/MM/DD/<uuid>`,
quindi cambiare driver non richiede di riscrivere i valori in database. Il modello
`Allegato` tiene nome originale e hash. Download tramite `/api/download/[id]`.

---

## Lavori in corso / decisioni aperte

- La lista delle unità organizzative per il protocollo è da definire: database locale vs. chiamata API a Urbismart
- Il portale cittadino (`citta-semplice-portal`) è in sviluppo parallelo; la timeline e le comunicazioni saranno visibili al cittadino nella sua area personale

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.