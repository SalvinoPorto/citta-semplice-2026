-- CreateEnum
CREATE TYPE "StatoIstanza" AS ENUM ('BOZZA', 'IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA');

-- AddColumn
ALTER TABLE "istanze" ADD COLUMN "stato" "StatoIstanza" NOT NULL DEFAULT 'IN_LAVORAZIONE';

-- Backfill dai tre booleani. L'ordine dei rami replica quello usato dal
-- codice applicativo (bozza, poi conclusa, poi respinta, poi lavorazione).
UPDATE "istanze" SET "stato" = CASE
  WHEN "in_bozza"  THEN 'BOZZA'::"StatoIstanza"
  WHEN "conclusa"  THEN 'CONCLUSA'::"StatoIstanza"
  WHEN "respinta"  THEN 'RESPINTA'::"StatoIstanza"
  ELSE 'IN_LAVORAZIONE'::"StatoIstanza"
END;

-- CreateIndex
CREATE INDEX "istanze_stato_idx" ON "istanze"("stato");
