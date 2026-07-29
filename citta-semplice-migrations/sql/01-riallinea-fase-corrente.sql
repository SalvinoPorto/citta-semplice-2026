-- ============================================================================
-- Riallinea istanze.fase_corrente_id alla fase reale dell'istanza.
--
-- PERCHÉ
--   migrate-dati.js popolava fase_corrente_id con la PRIMA fase del servizio
--   (`SELECT id FROM fasi WHERE servizio_id = … LIMIT 1`, per giunta senza
--   ORDER BY) perché gira PRIMA della migrazione dei workflow. Se il servizio ha
--   più fasi, ogni istanza già lavorata in fase 2+ resta puntata alla fase 1 →
--   la vede l'ufficio sbagliato, perché la visibilità operatore si basa proprio
--   su fase_corrente.ufficio_id.
--
-- COSA FA
--   Per ogni istanza APERTA (non conclusa/respinta/bozza) con almeno un
--   workflow, imposta fase_corrente_id = fase dello step dell'ultimo workflow
--   (ultimo per data_variazione, id come tie-break).
--   Le istanze chiuse restano con fase_corrente_id NULL (per design).
--
-- QUANDO
--   Dopo migrate-dati.js (lo script lo esegue già da sé: vedi
--   riallineaFaseCorrente()). Va lanciato a mano solo su DB migrati prima
--   dell'introduzione di quel passo.
--
-- Idempotente: rilanciarlo non cambia nulla se i dati sono già allineati.
-- ============================================================================

BEGIN;

-- Prima: quante istanze sono disallineate
SELECT COUNT(*) AS da_riallineare
FROM istanze i
JOIN LATERAL (
  SELECT s.fase_id
  FROM workflows w
  JOIN steps s ON s.id = w.step_id
  WHERE w.istanza_id = i.id
  ORDER BY w.data_variazione DESC, w.id DESC
  LIMIT 1
) lw ON true
WHERE NOT i.conclusa AND NOT i.respinta AND NOT i.in_bozza
  AND i.fase_corrente_id IS DISTINCT FROM lw.fase_id;

UPDATE istanze i
SET fase_corrente_id = lw.fase_id
FROM (
  SELECT DISTINCT ON (w.istanza_id)
         w.istanza_id,
         s.fase_id
  FROM workflows w
  JOIN steps s ON s.id = w.step_id
  ORDER BY w.istanza_id, w.data_variazione DESC, w.id DESC
) lw
WHERE lw.istanza_id = i.id
  AND NOT i.conclusa AND NOT i.respinta AND NOT i.in_bozza
  AND i.fase_corrente_id IS DISTINCT FROM lw.fase_id;

-- Istanze aperte senza alcun workflow: nessuna fase deducibile dallo storico,
-- si parte dalla prima fase del servizio (per ordine, non a caso).
UPDATE istanze i
SET fase_corrente_id = (
  SELECT f.id FROM fasi f WHERE f.servizio_id = i.servizio_id ORDER BY f.ordine LIMIT 1
)
WHERE NOT i.conclusa AND NOT i.respinta AND NOT i.in_bozza
  AND i.fase_corrente_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM workflows w WHERE w.istanza_id = i.id);

-- Le istanze chiuse non hanno fase corrente
UPDATE istanze SET fase_corrente_id = NULL
WHERE (conclusa OR respinta) AND fase_corrente_id IS NOT NULL;

-- Dopo: deve restituire 0
SELECT COUNT(*) AS ancora_disallineate
FROM istanze i
JOIN LATERAL (
  SELECT s.fase_id
  FROM workflows w
  JOIN steps s ON s.id = w.step_id
  WHERE w.istanza_id = i.id
  ORDER BY w.data_variazione DESC, w.id DESC
  LIMIT 1
) lw ON true
WHERE NOT i.conclusa AND NOT i.respinta AND NOT i.in_bozza
  AND i.fase_corrente_id IS DISTINCT FROM lw.fase_id;

COMMIT;
