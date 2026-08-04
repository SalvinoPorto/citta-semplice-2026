-- Visibilità granulare: assegnazione operatore → servizi specifici.
-- Lista vuota per un operatore = tutti i servizi del suo ufficio (retrocompatibile).
CREATE TABLE "operatori_servizi" (
    "operatore_id" INTEGER NOT NULL,
    "servizio_id" INTEGER NOT NULL,

    CONSTRAINT "operatori_servizi_pkey" PRIMARY KEY ("operatore_id","servizio_id")
);

CREATE INDEX "operatori_servizi_servizio_id_idx" ON "operatori_servizi"("servizio_id");

ALTER TABLE "operatori_servizi" ADD CONSTRAINT "operatori_servizi_operatore_id_fkey"
    FOREIGN KEY ("operatore_id") REFERENCES "operatori"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operatori_servizi" ADD CONSTRAINT "operatori_servizi_servizio_id_fkey"
    FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
