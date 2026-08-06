-- Gli `ordine` degli step sono GLOBALI sul servizio, non per fase:
-- `buildStepData` li assegna come indice+1 sull'array piatto che attraversa
-- tutte le fasi, e `isLastStep` deriva l'ultimo passo dell'iter dal massimo
-- su tutto il servizio. La coppia univoca è quindi (servizio_id, ordine).

-- Deduplica preventiva: rinumera densamente gli step ATTIVI di ogni servizio
-- preservandone l'ordine relativo. ROW_NUMBER() assegna interi distinti 1..n
-- per partizione, quindi non può a sua volta produrre collisioni.
WITH rinumerati AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY servizio_id ORDER BY ordine, id) AS nuovo_ordine
  FROM steps
  WHERE attivo = true
)
UPDATE steps s
SET ordine = r.nuovo_ordine
FROM rinumerati r
WHERE s.id = r.id AND s.ordine <> r.nuovo_ordine;

-- Indice PARZIALE: solo gli step attivi partecipano al vincolo. Non è
-- dichiarato nello schema Prisma perché il DSL non esprime indici parziali,
-- e un `@@unique` totale includerebbe le righe disattivate. Proprio perché
-- l'indice è parziale, gli step disattivati non hanno bisogno di uscire
-- dallo spazio degli ordini 1..n: conservano il loro ordine storico, anche
-- se duplicato con altri step (attivi o disattivati).
CREATE UNIQUE INDEX "steps_servizio_id_ordine_attivi_key"
  ON "steps" ("servizio_id", "ordine")
  WHERE "attivo" = true;
