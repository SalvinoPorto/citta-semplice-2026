# Città Semplice - Portale Cittadino

Portale dei servizi online a istanza di parte del Comune di Catania.
Consente ai cittadini di compilare e inviare istanze digitali, monitorarne lo stato e comunicare con gli uffici.

---

## Stack Tecnologico

| Dipendenza | Versione |
|---|---|
| Next.js | ^16.2.3 (Turbopack in dev) |
| React | 19 |
| TypeScript | ^5.7 |
| Prisma | ^7.7 (client generato in `generated/prisma`) |
| PostgreSQL | via `@prisma/adapter-pg` |
| next-auth | v5 beta (JWT strategy) |
| react-hook-form | ^7 + `@hookform/resolvers` |
| zod | ^4 |
| bootstrap-italia | ^2.12 (tema comuni) |
| sonner | toast notifications |
| date-fns | formatting date (locale `it`) |
| puppeteer | generazione PDF moduli |

---

## Struttura delle Route

```
src/app/
├── (auth)/login/               # Login con codice fiscale (no password)
├── (portal)/                   # Layout con Header/Footer Bootstrap Italia
│   ├── page.tsx                # Home - lista aree e servizi in evidenza
│   ├── servizi/page.tsx        # Catalogo servizi con ricerca
│   ├── [areaSlug]/page.tsx     # Scheda area
│   ├── [areaSlug]/[servizioSlug]/page.tsx      # Scheda servizio
│   ├── [areaSlug]/[servizioSlug]/istanza/page.tsx  # Compilazione istanza (stepper)
│   └── le-mie-istanze/
│       ├── page.tsx            # Dashboard cittadino (bozze + istanze inviate)
│       └── [id]/page.tsx       # Dettaglio istanza (workflow, comunicazioni, pagamenti)
└── api/
    ├── auth/[...nextauth]/     # NextAuth handler
    ├── allegati/[id]/          # Download allegato
    ├── risposta-allegati/[id]/ # Download allegato risposta comunicazione
    ├── servizi/                # API pubblica lista servizi
    └── pagamenti/
        ├── bollettino/[iuv]/   # Download bollettino PMPay
        ├── ricevuta/[iuv]/     # Download ricevuta PMPay
        └── url/[iuv]/          # Redirect URL pagamento PMPay
```

---

## Struttura dei Componenti

```
src/components/
├── istanza/
│   ├── IstanzaStepper.tsx      # Stepper client (Privacy → Modulo → Allegati → Riepilogo)
│   ├── PrivacyStep.tsx
│   ├── ModuloStep.tsx          # Form dinamico da JSON `attributi`
│   ├── AllegatiStep.tsx
│   ├── RiepilogoStep.tsx
│   └── RispostaComunicazioneForm.tsx
├── layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── nav-bar.tsx
├── servizi/
│   ├── ServiziSearch.tsx       # Client component con ricerca/paginazione
│   └── ServizioIndice.tsx
├── shared/
│   ├── Paginatore.tsx
│   ├── TFilterHead.tsx / TFilterHeadGroup.tsx / THeadGroup.tsx
│   └── index.ts
└── ui/
    ├── Breadcrumb.tsx
    └── ScrollToTop.tsx
```

---

## Server Actions (`src/lib/actions/`)

| File | Azioni |
|---|---|
| `istanza.ts` | `salvaBozza`, `eliminaBozza`, `submitIstanza`, `generaDocumentoPdf` |
| `le-mie-istanze.ts` | `getIstanzePage` (paginazione istanze inviate) |
| `comunicazioni.ts` | risposta alle comunicazioni dell'operatore |

---

## Autenticazione

- **next-auth v5** con `CredentialsProvider`
- Login con **codice fiscale** (nessuna password per il cittadino)
- JWT strategy; `session.user.id` contiene l'id numerico di `Utente`
- Configurazione in `src/lib/auth/config.ts`
- Route protette: redirect a `/login?callbackUrl=...` se `session?.user` è null

---

## Database - Entità Principali (Prisma / PostgreSQL)

| Entità | Scopo |
|---|---|
| `Utente` | Cittadino, chiave `codiceFiscale` univoca |
| `Operatore` | Utente backoffice con ruoli |
| `Ente` | Anagrafica ente (comune) |
| `Area` | Raggruppamento tematico di servizi |
| `Servizio` | Servizio online; contiene `attributi` (JSON form schema) |
| `Ufficio` | Ufficio responsabile del servizio |
| `Step` | Fase del workflow del servizio |
| `Istanza` | Richiesta inviata dal cittadino; `inBozza=true` per bozze |
| `Workflow` | Transizione di stato dell'istanza |
| `Comunicazione` / `RispostaComunicazione` | Scambio messaggi operatore ↔ cittadino |
| `Allegato` / `AllegatoRichiesto` / `AllegatoRisposta` | Documenti allegati |
| `Pagamento` / `PagamentoAtteso` | Configurazione e stato pagamento PMPay |
| `Ricevuta` | Dati ricevuta Art. 18-bis L. 241/1990 |
| `CustomerSatisfaction` | Contatori feedback per servizio |

Il client Prisma è generato in `generated/prisma/` (non in `node_modules`).
Singleton in `src/lib/db/prisma.ts`.

---

## Servizi Esterni

### Protocollazione — Urbi SMART
- File: `src/lib/services/protocollazione/UrbiProtocolloService.ts`
- Flusso: lookup/creazione corrispondente → registrazione protocollo
- Variabili: `URBI_BASE_URL`, `URBI_USERNAME`, `URBI_PASSWORD`, `URBI_ID_AOO`, `URBI_TIPO_MEZZO`, `URBI_CLASSIFICAZIONE`, `URBI_REGISTRATORE`, `URBI_TIMEOUT_MS`
- Fallback: `generaProtocolloEmergenza` con contatore su `ProtocolloEmergenzaCounter`

### Pagamenti — PMPay
- File: `src/lib/external/pmpay.ts`
- Token con cache in-memory, refresh automatico
- Variabili: `PMPAY_URL`, `PMPAY_USERNAME`, `PMPAY_PASSWORD`, `PMPAY_ENTE_ID`, `PMPAY_URL_OK`, `PMPAY_URL_KO`, `PMPAY_URL_CANCEL`

### Generazione PDF
- File: `src/lib/services/documenti/DocumentiService.ts`
- Usa Puppeteer per generare il PDF del modulo compilato
- Upload su filesystem; path configurato da `UPLOAD_DIR` (default `/tmp/allegati`)

---

## Logiche di Business Rilevanti

### Stepper istanza (`IstanzaStepper`)
- 4 step fissi: Privacy (0) → Modulo (1) → Allegati (2) → Riepilogo (3)
- Il form del modulo è generato dinamicamente da `servizio.attributi` (JSON schema)
- "Salva in bozza" disponibile dallo step 1 al 2; aggiorna `Istanza.inBozza=true`
- Al cambio step viene eseguito `scrollIntoView` sul container dello stepper

### Bozze
- Limite: **max 10 bozze per utente**; alla creazione dell'undicesima, la più vecchia (per `dataInvio`) viene eliminata automaticamente
- Il cittadino può eliminare manualmente una bozza dalla dashboard (`BozzaDeleteButton`)
- Riprendi bozza: URL `/{areaSlug}/{servizioSlug}/istanza?bozzaId={id}`

### Regole di invio servizio
- `unicoInvio`: un solo invio totale per il servizio
- `unicoInvioPerUtente`: un solo invio per utente
- `numeroMaxIstanze`: quota massima istanze; messaggio custom in `msgSopraSoglia`
- `dataInizio` / `dataFine`: finestra di disponibilità; fuori finestra → redirect scheda servizio

---

## Convenzioni di Codice

- **Componenti server** per pagine e lettura dati; **componenti client** (`'use client'`) per form, tabelle paginate, interazioni
- Le **server action** (`'use server'`) sono tutte in `src/lib/actions/`
- Validazione form con **zod** + react-hook-form; schema definito vicino al componente
- Tabelle paginate: pattern `TFilterHeadGroup` + `Paginatore` + fetch paginata via action
- Slug/id intercambiabili nelle route: `OR: [{ slug }, { id: Number }]`
- `export const dynamic = 'force-dynamic'` sulle pagine che leggono sessione o dati real-time
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