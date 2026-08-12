-- Contrazione: via le colonne rese ridondanti dall'espansione.
--
-- Il riallineamento qui sotto riesegue il backfill PRIMA dei DROP, per le
-- righe nate nella finestra fra l'espansione e la conversione delle scritture.
-- In un `migrate deploy` le due migrazioni girano consecutive e nessuna
-- applicazione scrive fra l'una e l'altra: il riallineamento è di fatto un
-- no-op in produzione, e serve a proteggere gli alberi di sviluppo su cui le
-- due migrazioni sono state applicate a distanza di task.

UPDATE "workflows"
SET "completata_at"    = COALESCE("completata_at", "data_variazione"),
    "completata_da_id" = COALESCE("completata_da_id", "operatore_id")
WHERE "stato" = 1 AND "completata_at" IS NULL;

WITH ultima AS (
  SELECT DISTINCT ON ("istanza_id") "istanza_id", "id", "operatore_id"
  FROM "workflows"
  ORDER BY "istanza_id", "data_variazione" DESC, "id" DESC
)
UPDATE "istanze" i
SET "attivita_corrente_id" = COALESCE(i."attivita_corrente_id", u."id"),
    "assegnatario_id"      = COALESCE(i."assegnatario_id", u."operatore_id")
FROM ultima u
WHERE u."istanza_id" = i."id" AND i."attivita_corrente_id" IS NULL;

-- DropColumn: la doppia semantica di operatore_id e il binario `stato`
ALTER TABLE "workflows"
  DROP COLUMN "stato",
  DROP COLUMN "operatore_id";

-- DropIndex: prefisso di istanze_stato_assegnatario_id_idx, mantenuto a ogni
-- scrittura senza che nulla lo usi.
DROP INDEX "istanze_stato_idx";
