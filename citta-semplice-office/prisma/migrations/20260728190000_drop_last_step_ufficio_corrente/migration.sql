-- Rimozione di due colonne denormalizzate su `istanze`.
--
-- last_step_id: scritta da office e portal, MAI letta (lo step corrente si ricava
--   sempre dallo step dell'ultimo workflow). Colonna scritta-e-mai-letta = si
--   disallinea in silenzio, ed era già successo.
--
-- ufficio_corrente_id: valeva sempre `faseCorrente.ufficioId`; l'override
--   per-istanza (assegnazione manuale a un ufficio diverso) non è mai stato
--   implementato — il parametro esisteva ma non veniva usato e la UI proponeva
--   una lista vuota. Poteva però divergere dalla fase e rendere le istanze
--   invisibili all'ufficio competente. L'ufficio corrente ora si deriva sempre
--   da fasi.ufficio_id via istanze.fase_corrente_id.
--
-- PREREQUISITO: fase_corrente_id dev'essere allineata alla fase dello step
-- dell'ultimo workflow — vedi citta-semplice-migrations/sql/01-riallinea-fase-corrente.sql
-- (per i DB migrati prima di questo cambiamento).

ALTER TABLE "istanze" DROP COLUMN IF EXISTS "last_step_id";
ALTER TABLE "istanze" DROP COLUMN IF EXISTS "ufficio_corrente_id";
