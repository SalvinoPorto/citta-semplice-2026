-- ============================================================================
-- Oggetti del database che il DSL di Prisma non esprime: estensioni, funzioni,
-- trigger, indici GIN.
--
-- `prisma db push` e un dump fatto con quel database li perdono in silenzio,
-- e l'effetto non è un errore ma dati sbagliati: senza
-- `attivita_corrente_su_insert` un'istanza appena inviata ha
-- attivita_corrente_id NULL, la sua unica attività risulta "non corrente" e
-- l'office la mostra come "Retrocesso" invece che "In attesa".
--
-- Le definizioni sono quelle delle migrazioni 20260807100000 (posizione
-- corrente) e 20260813100000 (ricerca istanze), con i nomi tabella successivi
-- al rename in istanza_attivita.
--
-- Idempotente: si può rieseguire su qualunque database con lo schema
-- applicato. I backfill toccano solo le righe rimaste NULL.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/sql/oggetti-database.sql
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── posizione corrente ──────────────────────────────────────────────────────

-- L'attività corrente è per definizione l'ultima inserita. Nessuna
-- applicazione scrive questa colonna, quindi non può divergere.
CREATE OR REPLACE FUNCTION "imposta_attivita_corrente"() RETURNS trigger AS $$
BEGIN
  UPDATE "istanze" SET "attivita_corrente_id" = NEW."id" WHERE "id" = NEW."istanza_id";
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "attivita_corrente_su_insert" ON "istanza_attivita";
CREATE TRIGGER "attivita_corrente_su_insert"
AFTER INSERT ON "istanza_attivita"
FOR EACH ROW EXECUTE FUNCTION "imposta_attivita_corrente"();

-- L'assegnazione decade a ogni cambio di fase (specifica B1): la visibilità
-- dipende dall'ufficio della fase corrente. La guardia su OLD IS NOT NULL
-- evita di azzerare la prima assegnazione di `takeCharge` sulle istanze
-- migrate con fase corrente NULL.
CREATE OR REPLACE FUNCTION "azzera_assegnatario_al_cambio_fase"() RETURNS trigger AS $$
BEGIN
  IF OLD."fase_corrente_id" IS NOT NULL
     AND NEW."fase_corrente_id" IS DISTINCT FROM OLD."fase_corrente_id" THEN
    NEW."assegnatario_id" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "assegnatario_al_cambio_fase" ON "istanze";
CREATE TRIGGER "assegnatario_al_cambio_fase"
BEFORE UPDATE ON "istanze"
FOR EACH ROW EXECUTE FUNCTION "azzera_assegnatario_al_cambio_fase"();

-- Istanze create mentre il trigger mancava. Non tocca assegnatario_id:
-- il trigger qui sopra reagisce solo a fase_corrente_id.
UPDATE "istanze" i
   SET "attivita_corrente_id" = u."id"
  FROM (
    SELECT DISTINCT ON ("istanza_id") "istanza_id", "id"
      FROM "istanza_attivita"
     ORDER BY "istanza_id", "id" DESC
  ) u
 WHERE u."istanza_id" = i."id"
   AND i."attivita_corrente_id" IS NULL;

-- ── ricerca istanze ─────────────────────────────────────────────────────────

-- Usata sia dal backfill sia dai trigger. Il blocco EXCEPTION ripiega sul
-- testo grezzo se `dati` non è JSON valido: un trigger più severo del codice
-- che lo alimenta farebbe fallire l'invio dell'istanza.
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

-- Prima degli indici: costruire il GIN su una colonna già piena è più veloce.
UPDATE "istanze"
   SET "ricerca" = "costruisci_ricerca_istanza"("dati", "utente_id")
 WHERE "ricerca" IS NULL;

CREATE INDEX IF NOT EXISTS "istanze_ricerca_trgm"
  ON "istanze" USING GIN ("ricerca" gin_trgm_ops);

-- Filtro di colonna su datiInEvidenza (paged/route.ts), distinto dalla
-- ricerca libera.
CREATE INDEX IF NOT EXISTS "istanze_dati_in_evidenza_trgm"
  ON "istanze" USING GIN ("dati_in_evidenza" gin_trgm_ops);

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

-- Un cittadino che corregge il cognome deve restare cercabile con quello nuovo.
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

COMMIT;
