-- Riallineamento finale prima di perdere i booleani.
-- Fra l'espansione e la conversione del portale sono potute nascere righe con
-- `stato` al DEFAULT ma booleani diversi (tipicamente bozze con stato
-- 'IN_LAVORAZIONE'). Eliminare le colonne senza riallineare renderebbe quella
-- divergenza irreversibile: i booleani sono l'unica fonte affidabile fino a qui.
UPDATE "istanze" SET "stato" = CASE
  WHEN "in_bozza"  THEN 'BOZZA'::"StatoIstanza"
  WHEN "conclusa"  THEN 'CONCLUSA'::"StatoIstanza"
  WHEN "respinta"  THEN 'RESPINTA'::"StatoIstanza"
  ELSE 'IN_LAVORAZIONE'::"StatoIstanza"
END;

-- Il vincolo CHECK serviva a rendere mutuamente esclusivi i tre booleani.
-- Con l'enum l'esclusività è garantita dal tipo: il vincolo non ha più oggetto.
ALTER TABLE "istanze" DROP CONSTRAINT IF EXISTS "istanze_stato_esclusivo_chk";

ALTER TABLE "istanze" DROP COLUMN "in_bozza";
ALTER TABLE "istanze" DROP COLUMN "conclusa";
ALTER TABLE "istanze" DROP COLUMN "respinta";
