-- Rename: `Workflow` designava una riga per attivazione di step, non "il
-- workflow", ed è la ragione per cui la posizione corrente ha finito per
-- avere definizioni divergenti. `Fase`/`Step` restano la definizione,
-- `IstanzaAttivita` è l'esecuzione.
--
-- ALTER TABLE ... RENAME porta con sé indici, vincoli e trigger: non serve
-- ricrearli. I NOMI di indici e vincoli restano quelli vecchi, il che è
-- rumoroso ma innocuo — rinominarli è un secondo giro di ALTER che non
-- cambia il comportamento di nulla.

ALTER TABLE "workflows"     RENAME TO "istanza_attivita";
ALTER TABLE "workflow_fasi" RENAME TO "istanza_fasi";

-- Anche le due colonne che puntano all'attività: lasciarle `workflow_id`
-- avrebbe tenuto in vita il nome vecchio nel punto più visibile, la scrittura
-- delle query, dietro un `@map` nello schema.
ALTER TABLE "allegati"          RENAME COLUMN "workflow_id" TO "attivita_id";
ALTER TABLE "pagamenti_attesi"  RENAME COLUMN "workflow_id" TO "attivita_id";
