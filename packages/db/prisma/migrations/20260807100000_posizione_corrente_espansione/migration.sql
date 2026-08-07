-- Espansione: posizione corrente e assegnazione dell'istanza (specifica B1-B4).
-- Non rimuove nulla. `workflows.stato` e `workflows.operatore_id` restano al
-- loro posto finché il codice non è convertito: la contrazione è una
-- migrazione separata.

-- AddColumn: posizione corrente e assegnazione sull'istanza
ALTER TABLE "istanze"
  ADD COLUMN "attivita_corrente_id" INTEGER,
  ADD COLUMN "assegnatario_id"      INTEGER;

-- AddColumn: completamento sull'attività
ALTER TABLE "workflows"
  ADD COLUMN "completata_at"     TIMESTAMP(3),
  ADD COLUMN "completata_da_id"  INTEGER;

-- Backfill 1: attività corrente e assegnatario.
-- "Ultima attività" = la più recente per data_variazione, con l'id a
-- dirimere la parità. È la definizione oggi usata dai tab della lista
-- (paged/route.ts), NON "una qualsiasi attività con operatore": quella
-- contava anche le istanze già prese in carico da altri.
WITH ultima AS (
  SELECT DISTINCT ON ("istanza_id")
         "istanza_id", "id", "operatore_id"
  FROM "workflows"
  ORDER BY "istanza_id", "data_variazione" DESC, "id" DESC
)
UPDATE "istanze" i
SET "attivita_corrente_id" = u."id",
    "assegnatario_id"      = u."operatore_id"
FROM ultima u
WHERE u."istanza_id" = i."id";

-- Backfill 2: chi ha chiuso l'attività, SOLO per le righe già completate.
-- Sulle righe aperte `operatore_id` significava assegnazione, che ora vive
-- su istanze.assegnatario_id: copiarlo qui trasformerebbe un'attività aperta
-- in una chiusa.
UPDATE "workflows" SET "completata_da_id" = "operatore_id" WHERE "stato" = 1;

-- Backfill 3: quando l'attività è stata chiusa. Il dato non esiste da
-- nessuna parte. Il proxy è la data_variazione dell'attività SUCCESSIVA
-- della stessa istanza — quando è partita la successiva, la precedente era
-- chiusa — con fallback sulla propria data_variazione per una riga chiusa
-- senza successiva. È un'approssimazione, e riguarda solo dati di sviluppo:
-- il sistema è in pre-produzione, non esistono istanze reali di cittadini.
UPDATE "workflows" w
SET "completata_at" = COALESCE(s."successiva", w."data_variazione")
FROM (
  SELECT "id",
         LEAD("data_variazione") OVER (PARTITION BY "istanza_id" ORDER BY "data_variazione", "id") AS "successiva"
  FROM "workflows"
) s
WHERE s."id" = w."id" AND w."stato" = 1;

-- Trigger 1: l'attività corrente è per definizione l'ultima inserita.
-- Nessuna applicazione scrive mai questa colonna, quindi non può divergere.
-- Chiude anche la divergenza fra "ORDER BY id DESC" e "data_variazione DESC":
-- sparisce la nozione di "ultimo per ordinamento".
CREATE OR REPLACE FUNCTION "imposta_attivita_corrente"() RETURNS trigger AS $$
BEGIN
  UPDATE "istanze" SET "attivita_corrente_id" = NEW."id" WHERE "id" = NEW."istanza_id";
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "attivita_corrente_su_insert"
AFTER INSERT ON "workflows"
FOR EACH ROW EXECUTE FUNCTION "imposta_attivita_corrente"();

-- Trigger 2: l'assegnazione decade a ogni cambio di fase (specifica B1).
-- La visibilità delle istanze è determinata dall'ufficio della fase
-- corrente: un'istanza che entra in una fase di un altro ufficio portandosi
-- dietro l'assegnatario precedente risulta, per quell'ufficio, già presa in
-- carico da chi non ci lavorerà. La regola sta qui e non nel codice perché
-- i percorsi di scrittura sono quattro, distribuiti su due applicazioni che
-- condividono questo database.
--
-- La guardia su OLD.fase_corrente_id IS NOT NULL è necessaria: `takeCharge`
-- valorizza la fase corrente delle istanze migrate che ce l'hanno a NULL, e
-- senza guardia quella prima assegnazione verrebbe azzerata nello stesso
-- statement che la crea.
CREATE OR REPLACE FUNCTION "azzera_assegnatario_al_cambio_fase"() RETURNS trigger AS $$
BEGIN
  IF OLD."fase_corrente_id" IS NOT NULL
     AND NEW."fase_corrente_id" IS DISTINCT FROM OLD."fase_corrente_id" THEN
    NEW."assegnatario_id" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assegnatario_al_cambio_fase"
BEFORE UPDATE ON "istanze"
FOR EACH ROW EXECUTE FUNCTION "azzera_assegnatario_al_cambio_fase"();

-- CreateIndex
CREATE UNIQUE INDEX "istanze_attivita_corrente_id_key" ON "istanze"("attivita_corrente_id");
CREATE INDEX "istanze_stato_assegnatario_id_idx" ON "istanze"("stato", "assegnatario_id");
CREATE INDEX "istanze_fase_corrente_id_idx" ON "istanze"("fase_corrente_id");

-- AddForeignKey
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_assegnatario_id_fkey"
  FOREIGN KEY ("assegnatario_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_attivita_corrente_id_fkey"
  FOREIGN KEY ("attivita_corrente_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_completata_da_id_fkey"
  FOREIGN KEY ("completata_da_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;
