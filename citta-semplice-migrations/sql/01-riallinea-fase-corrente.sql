-- ============================================================================
-- Riallinea istanze.fase_corrente_id alla fase reale dell'istanza.
--
-- PERCHÉ
--   migrate-dati.js popola fase_corrente_id con la prima fase del servizio
--   perché gira PRIMA della migrazione delle attività. Se il servizio ha più
--   fasi, ogni istanza già lavorata in fase 2+ resta puntata alla fase 1 →
--   la vede l'ufficio sbagliato, perché la visibilità operatore si basa proprio
--   su fase_corrente.ufficio_id.
--
-- COSA FA
--   Per ogni istanza IN_LAVORAZIONE con almeno un'attività, imposta
--   fase_corrente_id = fase dello step dell'ultima attività (ultima per
--   data_variazione, id come tie-break).
--   Le istanze chiuse restano con fase_corrente_id NULL (per design).
--
-- ATTENZIONE — il trigger `assegnatario_al_cambio_fase`
--   Un UPDATE di fase_corrente_id AZZERA istanze.assegnatario_id (trigger
--   BEFORE UPDATE introdotto da 20260807100000_posizione_corrente_espansione:
--   l'assegnazione decade quando l'istanza passa a un altro ufficio). Qui la
--   fase non sta davvero cambiando — la stiamo solo correggendo — quindi le
--   assegnazioni vanno salvate prima e ripristinate dopo, altrimenti questo
--   script le cancella tutte in silenzio.
--
-- QUANDO
--   Dopo migrate-dati.js (lo script lo esegue già da sé: vedi
--   riallineaFaseCorrente()). Va lanciato a mano solo su DB migrati prima
--   dell'introduzione di quel passo.
--
-- Allineato allo schema post 20260805110000 (enum StatoIstanza al posto dei
-- booleani) e post 20260807120000 (workflows → istanza_attivita).
--
-- Idempotente: rilanciarlo non cambia nulla se i dati sono già allineati.
-- ============================================================================

BEGIN;

-- Prima: quante istanze sono disallineate
SELECT COUNT(*) AS da_riallineare
FROM istanze i
JOIN LATERAL (
  SELECT s.fase_id
  FROM istanza_attivita a
  JOIN steps s ON s.id = a.step_id
  WHERE a.istanza_id = i.id
  ORDER BY a.data_variazione DESC, a.id DESC
  LIMIT 1
) ua ON true
WHERE i.stato = 'IN_LAVORAZIONE'
  AND i.fase_corrente_id IS DISTINCT FROM ua.fase_id;

-- Salva le assegnazioni: gli UPDATE qui sotto le farebbero azzerare dal trigger.
CREATE TEMP TABLE assegnazioni_salvate ON COMMIT DROP AS
SELECT id, assegnatario_id FROM istanze WHERE assegnatario_id IS NOT NULL;

UPDATE istanze i
SET fase_corrente_id = ua.fase_id
FROM (
  SELECT DISTINCT ON (a.istanza_id)
         a.istanza_id,
         s.fase_id
  FROM istanza_attivita a
  JOIN steps s ON s.id = a.step_id
  ORDER BY a.istanza_id, a.data_variazione DESC, a.id DESC
) ua
WHERE ua.istanza_id = i.id
  AND i.stato = 'IN_LAVORAZIONE'
  AND i.fase_corrente_id IS DISTINCT FROM ua.fase_id;

-- Istanze aperte senza alcuna attività: nessuna fase deducibile dallo storico,
-- si parte dalla prima fase del servizio (per ordine, non a caso).
UPDATE istanze i
SET fase_corrente_id = (
  SELECT f.id FROM fasi f WHERE f.servizio_id = i.servizio_id ORDER BY f.ordine LIMIT 1
)
WHERE i.stato = 'IN_LAVORAZIONE'
  AND i.fase_corrente_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM istanza_attivita a WHERE a.istanza_id = i.id);

-- Le istanze chiuse non hanno fase corrente
UPDATE istanze SET fase_corrente_id = NULL
WHERE stato IN ('CONCLUSA', 'RESPINTA') AND fase_corrente_id IS NOT NULL;

-- Ripristina le assegnazioni azzerate dal trigger.
UPDATE istanze i
SET assegnatario_id = s.assegnatario_id
FROM assegnazioni_salvate s
WHERE s.id = i.id AND i.assegnatario_id IS DISTINCT FROM s.assegnatario_id;

-- Dopo: deve restituire 0
SELECT COUNT(*) AS ancora_disallineate
FROM istanze i
JOIN LATERAL (
  SELECT s.fase_id
  FROM istanza_attivita a
  JOIN steps s ON s.id = a.step_id
  WHERE a.istanza_id = i.id
  ORDER BY a.data_variazione DESC, a.id DESC
  LIMIT 1
) ua ON true
WHERE i.stato = 'IN_LAVORAZIONE'
  AND i.fase_corrente_id IS DISTINCT FROM ua.fase_id;

COMMIT;
