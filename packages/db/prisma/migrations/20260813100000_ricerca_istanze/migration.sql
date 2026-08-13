-- ============================================================================
-- Colonna di ricerca denormalizzata + indice GIN trigram.
--
-- PERCHÉ
--   Il filtro "cerca" della lista istanze era un OR a cinque rami, due dei
--   quali su `utenti`. Postgres può combinare più rami di un OR in BitmapOr
--   solo se sono TUTTI index scan sulla stessa tabella: un ramo che è un
--   semi-join diventa un `hashed SubPlan`, cioè un filtro, e l'intero piano
--   collassa in Seq Scan. Misurato su 308.776 istanze (EXPLAIN ANALYZE):
--
--     COUNT(*) con il filtro cerca ............................ 3081 ms
--     stessa query senza il ramo su `dati` .................... 182 ms
--     stessa query con predicato singolo indicizzato ........... 10 ms
--
--   I due salti sono indipendenti: il primo è la CPU dell'ILIKE su 1302
--   caratteri per riga (l'heap viene letto comunque — `dati` è inline, non
--   TOASTed: 6 MB di TOAST contro 1298 MB di heap), il secondo è l'indice.
--
-- COSA FA
--   Aggiunge `istanze.ricerca`: codice fiscale + nome + cognome dell'utente e
--   i VALORI del modulo estratti da `dati`, tutto in minuscolo. Sul campione
--   misurato sono 209 caratteri medi contro i 1302 di `dati` — il 17% — e
--   coprono PIÙ di prima, perché i dati dell'utente entrano nello stesso
--   predicato indicizzato invece di stare in tre subquery.
--
--   Le chiavi e le label del modulo NON entrano: sono le stesse su tutte le
--   righe dello stesso servizio, gonfierebbero l'indice e produrrebbero falsi
--   positivi (cercando "nome" tornerebbero tutte le istanze).
--
-- MANTENUTA DAL DATABASE, non dal codice: due applicazioni scrivono su questo
-- schema e i percorsi di scrittura delle istanze sono più d'uno. È la stessa
-- ragione documentata in 20260807100000 per attivita_corrente_id.
--
-- L'indice e i trigger stanno qui e non nello schema Prisma perché il DSL non
-- esprime né gli operator class GIN né i trigger — come già per l'indice
-- parziale di `steps` (20260806130000).
--
-- Tutto è IF NOT EXISTS / OR REPLACE: la migrazione è sicura anche su un
-- database dove pg_trgm o l'indice su dati_in_evidenza siano già stati creati
-- a mano durante l'analisi.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── la colonna ──────────────────────────────────────────────────────────────
ALTER TABLE "istanze" ADD COLUMN IF NOT EXISTS "ricerca" TEXT;

-- ── la definizione, in un posto solo ────────────────────────────────────────
-- Usata sia dal backfill sia dai trigger: due implementazioni della stessa
-- regola divergerebbero, e la divergenza si vedrebbe solo come "questa istanza
-- non esce dalla ricerca".
--
-- Il blocco EXCEPTION non è difensivo per abitudine: oggi tutte e 308.776 le
-- righe sono JSON array validi (verificato), ma il codice applicativo tratta
-- `dati` come potenzialmente malformato (try/catch in campi-esportabili.ts,
-- servizio-regole.ts, form-validate.ts). Un trigger più severo del codice che
-- lo alimenta trasformerebbe un dato sporco in un invio di istanza fallito:
-- qui si ripiega sul testo grezzo, che resta cercabile.
CREATE OR REPLACE FUNCTION "costruisci_ricerca_istanza"(
  p_dati      TEXT,
  p_utente_id INTEGER
) RETURNS TEXT AS $$
DECLARE
  v_valori TEXT;
  v_utente TEXT;
BEGIN
  BEGIN
    SELECT string_agg(e->>'value', ' ')
      INTO v_valori
      FROM jsonb_array_elements(p_dati::jsonb) e;
  EXCEPTION WHEN others THEN
    v_valori := p_dati;
  END;

  SELECT concat_ws(' ', u."codice_fiscale", u."nome", u."cognome")
    INTO v_utente
    FROM "utenti" u
   WHERE u."id" = p_utente_id;

  RETURN lower(concat_ws(' ', v_utente, v_valori));
END;
$$ LANGUAGE plpgsql;

-- ── backfill ────────────────────────────────────────────────────────────────
-- Prima dell'indice: costruire il GIN su una colonna già piena è molto più
-- veloce che mantenerlo riga per riga durante l'UPDATE.
UPDATE "istanze"
SET "ricerca" = "costruisci_ricerca_istanza"("dati", "utente_id")
WHERE "ricerca" IS NULL;

-- ── indici ──────────────────────────────────────────────────────────────────
-- NB: non CONCURRENTLY, perché le migrazioni Prisma girano in transazione e
-- CREATE INDEX CONCURRENTLY non è ammesso in un blocco transazionale. In un
-- deploy a caldo su tabella grande vedi le note nel runbook di go-live.
CREATE INDEX IF NOT EXISTS "istanze_ricerca_trgm"
  ON "istanze" USING GIN ("ricerca" gin_trgm_ops);

-- Serve al filtro di colonna su datiInEvidenza (paged/route.ts), che è una
-- funzione distinta dalla ricerca libera e resta su quella colonna.
CREATE INDEX IF NOT EXISTS "istanze_dati_in_evidenza_trgm"
  ON "istanze" USING GIN ("dati_in_evidenza" gin_trgm_ops);

-- ── trigger 1: l'istanza cambia ─────────────────────────────────────────────
-- `UPDATE OF` limita gli scatti alle sole scritture che toccano gli ingressi
-- della funzione: un avanzamento di fase non ricalcola nulla.
CREATE OR REPLACE FUNCTION "aggiorna_ricerca_istanza"() RETURNS trigger AS $$
BEGIN
  NEW."ricerca" := "costruisci_ricerca_istanza"(NEW."dati", NEW."utente_id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ricerca_su_istanza" ON "istanze";
CREATE TRIGGER "ricerca_su_istanza"
BEFORE INSERT OR UPDATE OF "dati", "utente_id" ON "istanze"
FOR EACH ROW EXECUTE FUNCTION "aggiorna_ricerca_istanza"();

-- ── trigger 2: l'anagrafica dell'utente cambia ──────────────────────────────
-- Senza questo, un cittadino che corregge il cognome resterebbe cercabile solo
-- con quello vecchio. Raro, ma è esattamente il modo in cui una colonna
-- denormalizzata va fuori sincrono in silenzio.
--
-- L'UPDATE su `istanze` che ne consegue NON rientra nel trigger 1 (non tocca
-- `dati` né `utente_id`) e non azzera l'assegnatario, perché
-- `assegnatario_al_cambio_fase` reagisce solo a `fase_corrente_id`.
CREATE OR REPLACE FUNCTION "aggiorna_ricerca_da_utente"() RETURNS trigger AS $$
BEGIN
  UPDATE "istanze"
     SET "ricerca" = "costruisci_ricerca_istanza"("dati", "utente_id")
   WHERE "utente_id" = NEW."id";
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ricerca_su_utente" ON "utenti";
CREATE TRIGGER "ricerca_su_utente"
AFTER UPDATE OF "nome", "cognome", "codice_fiscale" ON "utenti"
FOR EACH ROW
WHEN (OLD."nome"           IS DISTINCT FROM NEW."nome"
   OR OLD."cognome"        IS DISTINCT FROM NEW."cognome"
   OR OLD."codice_fiscale" IS DISTINCT FROM NEW."codice_fiscale")
EXECUTE FUNCTION "aggiorna_ricerca_da_utente"();
