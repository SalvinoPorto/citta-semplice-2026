-- Evidenziazione eventi non letti:
-- - il cittadino vede in evidenza le comunicazioni dell'ufficio non ancora aperte
-- - l'operatore vede in evidenza le risposte del cittadino non ancora aperte
ALTER TABLE "comunicazioni" ADD COLUMN "letta_da_cittadino" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "risposte_comunicazioni" ADD COLUMN "letta_da_operatore" BOOLEAN NOT NULL DEFAULT false;
