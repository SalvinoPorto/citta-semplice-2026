-- ============================================================================
-- DOPO l'import massivo: ricostruisce la ricerca e verifica che sia servibile.
--
-- Da lanciare dopo `npm run migrate-dati`. Idempotente: rilanciarlo su un
-- database già a posto non cambia nulla.
--
-- ATTENZIONE: VACUUM non può stare in una transazione, quindi questo file NON
-- va eseguito con `psql -1`. Usare: psql -v ON_ERROR_STOP=1 -f questo_file.sql
-- ============================================================================

\timing on
\echo '>>> 1/5 Riattivazione trigger'
ALTER TABLE "istanze" ENABLE TRIGGER "ricerca_su_istanza";
ALTER TABLE "utenti"  ENABLE TRIGGER "ricerca_su_utente";

\echo '>>> 2/5 Backfill della colonna ricerca (atteso: ~2 min su 300k istanze)'
-- Stessa funzione usata dai trigger: una sola definizione della regola.
UPDATE "istanze"
SET "ricerca" = "costruisci_ricerca_istanza"("dati", "utente_id")
WHERE "ricerca" IS NULL;

\echo '>>> 3/5 Ricostruzione indici trigram (atteso: ~30 s)'
CREATE INDEX IF NOT EXISTS "istanze_ricerca_trgm"
  ON "istanze" USING GIN ("ricerca" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "istanze_dati_in_evidenza_trgm"
  ON "istanze" USING GIN ("dati_in_evidenza" gin_trgm_ops);

\echo '>>> 4/5 VACUUM ANALYZE (il backfill lascia una riga morta per riga aggiornata)'
VACUUM (ANALYZE) "istanze";

\echo '>>> 5/5 Verifica'
-- `ricerca_mancanti` DEVE essere 0. Se non lo è, il backfill non ha coperto
-- tutte le righe e la ricerca della lista istanze sarà parziale: NON andare in
-- produzione così.
SELECT
  count(*)                                        AS istanze_totali,
  count(*) FILTER (WHERE "ricerca" IS NULL)       AS ricerca_mancanti,
  count(*) FILTER (WHERE "ricerca" = '')          AS ricerca_vuote,
  avg(length("ricerca"))::int                     AS lunghezza_media
FROM "istanze";

-- I trigger devono risultare abilitati: 'O' = origin (attivo).
-- 'D' = disabilitato → lo script 02 non è stato annullato correttamente.
SELECT tgname AS trigger, tgenabled AS stato
FROM pg_trigger
WHERE tgname IN ('ricerca_su_istanza', 'ricerca_su_utente')
ORDER BY tgname;

-- Gli indici devono esistere entrambi.
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) AS dimensione
FROM pg_indexes
WHERE tablename = 'istanze' AND indexname LIKE '%trgm'
ORDER BY indexname;

-- Prova d'uso: il piano deve contenere "Bitmap Index Scan on istanze_ricerca_trgm".
-- Se dice "Seq Scan", l'indice esiste ma il planner non lo ritiene conveniente:
-- quasi sempre significa che manca l'ANALYZE del passo 4.
EXPLAIN (ANALYZE)
SELECT count(*) FROM "istanze"
WHERE "stato" <> 'BOZZA' AND "ricerca" LIKE '%rossi%';
