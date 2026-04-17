# citta-semplice-office

Backoffice Next.js per la gestione dei servizi comunali. Gli operatori dell'ente lavorano le istanze presentate dai cittadini tramite il portale `citta-semplice-portal`.

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Prisma 7** su **PostgreSQL**
- **NextAuth v5-beta** per l'autenticazione degli operatori
- **Bootstrap Italia** per la UI
- **TipTap** per gli editor rich text
- **Zod** + **React Hook Form** per form e validazioni

---

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

Lo stato di un'istanza è determinato da tre campi booleani:
- `inBozza: true` — bozza salvata dal cittadino, **invisibile agli operatori**
- `respinta: true` — iter chiuso forzatamente con motivazione
- `conclusa: true` — iter completato normalmente
- nessuno dei tre → in lavorazione

L'iter viene tracciato nella tabella `Workflow` (uno per step attivato). Il workflow corrente è quello con `dataVariazione` più recente.

### Comunicazioni

Durante tutto l'iter è possibile inviare `Comunicazione` al cittadino (con eventuale richiesta di risposta e allegati). Visibili nella timeline sia all'operatore che al cittadino.

---

## Struttura route principali

```
app/
├── (auth)/login                          # Login operatori
└── (dashboard)/
    ├── page.tsx                          # Dashboard con statistiche
    ├── istanze/
    │   ├── page.tsx + istanze-client.tsx # Lista istanze con filtri persistiti in URL
    │   └── [id]/page.tsx                 # Dettaglio e gestione istanza
    ├── amministrazione/
    │   ├── aree/                         # CRUD aree
    │   ├── servizi/                      # CRUD servizi + step builder
    │   ├── operatori/                    # CRUD operatori
    │   ├── uffici/                       # CRUD uffici
    │   ├── enti/                         # CRUD ente
    │   ├── ruoli/                        # CRUD ruoli
    │   ├── utenti/                       # Vista utenti registrati
    │   └── email/                        # Configurazione SMTP/Office365
    ├── ricerche/                         # Ricerca istanze, pagamenti, utenti
    ├── statistiche/                      # Statistiche e grafici
    └── profilo/                          # Profilo operatore
```

---

## API Route principali

| Route | Descrizione |
|-------|-------------|
| `POST /api/istanze/paged` | Lista istanze paginata (tab, filtri, sort) |
| `GET /api/search/istanze` | Ricerca istanze (usata anche dall'export) |
| `GET /api/export/istanze` | Export CSV |
| `GET /api/search/pagamenti` | Ricerca pagamenti |
| `GET /api/export/pagamenti` | Export CSV pagamenti |
| `GET /api/pagamenti/info` | Info pagamento da PmPay |
| `GET /api/pagamenti/bollettino` | Download PDF bollettino |
| `GET /api/pmpay/servizi` | Sync tributi da PmPay |
| `GET /api/urbi/uffici` | Sync uffici da Urbismart |
| `POST /api/upload` | Upload allegati |
| `GET /api/download/[id]` | Download allegato |
| `GET /api/cron/payments` | Cron: aggiorna stato pagamenti |
| `GET /api/cron/statistics` | Cron: aggiorna statistiche giornaliere |

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

### Bozze non visibili agli operatori
Tutte le query lato office filtrano `inBozza: false`. Le bozze sono visibili solo al cittadino nel portale.

### Stato istanza (derivato)
```
inBozza=true              → Bozza (solo portale)
respinta=true             → Respinta
conclusa=true             → Conclusa
altrimenti                → In Lavorazione / In Attesa
```

### Autenticazione
NextAuth v5-beta con sessione JWT. I ruoli sono in `session.user.ruoli[]`. Usare `requireAuth()` (redirect automatico) o `getCurrentUser()` (nullable) da `src/lib/auth/session.ts`.

### Upload allegati
Tutti i file vengono salvati su filesystem locale con nome hashato. Il modello `Allegato` tiene nome originale e hash. Download tramite `/api/download/[id]`.

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