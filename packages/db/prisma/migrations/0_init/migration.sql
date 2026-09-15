-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "tipo_protocollo" AS ENUM ('E', 'U');

-- CreateEnum
CREATE TYPE "soggetto" AS ENUM ('OP', 'UT');

-- CreateEnum
CREATE TYPE "direzione" AS ENUM ('AVANZAMENTO', 'ROLLBACK');

-- CreateEnum
CREATE TYPE "stato_istanza" AS ENUM ('BOZZA', 'IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA');

-- CreateTable
CREATE TABLE "operatori" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "cognome" VARCHAR(100) NOT NULL,
    "user_name" VARCHAR(64) NOT NULL,
    "telefono" VARCHAR(255),
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ufficio_id" INTEGER,

    CONSTRAINT "operatori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruoli" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "permessi" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ruoli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operatori_ruoli" (
    "operatore_id" INTEGER NOT NULL,
    "ruolo_id" INTEGER NOT NULL,

    CONSTRAINT "operatori_ruoli_pkey" PRIMARY KEY ("operatore_id","ruolo_id")
);

-- CreateTable
CREATE TABLE "operatori_servizi" (
    "operatore_id" INTEGER NOT NULL,
    "servizio_id" INTEGER NOT NULL,

    CONSTRAINT "operatori_servizi_pkey" PRIMARY KEY ("operatore_id","servizio_id")
);

-- CreateTable
CREATE TABLE "ruoli_user" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" VARCHAR(100),

    CONSTRAINT "ruoli_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enti" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descrizione" VARCHAR(255),
    "sede" VARCHAR(255),
    "codice" VARCHAR(255),
    "indirizzo" VARCHAR(255),
    "telefono" VARCHAR(255),
    "email" VARCHAR(255),
    "pec" VARCHAR(255),
    "logo" VARCHAR(255),
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aree" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descrizione" VARCHAR(512),
    "icona" VARCHAR(255),
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "slug" VARCHAR(255) NOT NULL DEFAULT '/',

    CONSTRAINT "aree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servizi" (
    "id" SERIAL NOT NULL,
    "titolo" TEXT NOT NULL,
    "sotto_titolo" TEXT,
    "descrizione" TEXT,
    "come_fare" TEXT,
    "cosa_serve" TEXT,
    "altre_info" TEXT,
    "contatti" TEXT,
    "slug" VARCHAR(255) NOT NULL DEFAULT '/',
    "icona" VARCHAR(255),
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "area_id" INTEGER NOT NULL,
    "attributi" TEXT,
    "modulo_corpo" TEXT,
    "post_form_validation" BOOLEAN NOT NULL DEFAULT false,
    "post_form_validation_api" VARCHAR(255),
    "post_form_validation_fields" VARCHAR(255),
    "ufficio_id" INTEGER,
    "data_inizio" TIMESTAMP(3),
    "data_fine" TIMESTAMP(3),
    "unico_invio" BOOLEAN NOT NULL DEFAULT false,
    "unico_invio_per_utente" BOOLEAN NOT NULL DEFAULT false,
    "campi_unico_invio" TEXT,
    "numero_max_istanze" INTEGER DEFAULT 0,
    "msg_sopra_soglia" VARCHAR(300),
    "msg_extra_servizio" VARCHAR(500),
    "protocollazione_asincrona" BOOLEAN NOT NULL DEFAULT false,
    "campi_in_evidenza" TEXT,
    "campi_da_esportare" TEXT,
    "evidenza" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "servizi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uffici" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descrizione" VARCHAR(255),
    "email" VARCHAR(255),
    "telefono" VARCHAR(255),
    "indirizzo" VARCHAR(255),
    "attivo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "uffici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servizi_ruoli_user" (
    "servizio_id" INTEGER NOT NULL,
    "ruolo_user_id" INTEGER NOT NULL,

    CONSTRAINT "servizi_ruoli_user_pkey" PRIMARY KEY ("servizio_id","ruolo_user_id")
);

-- CreateTable
CREATE TABLE "steps" (
    "id" SERIAL NOT NULL,
    "descrizione" TEXT NOT NULL,
    "ordine" INTEGER NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "pagamento" BOOLEAN NOT NULL DEFAULT false,
    "allegati" BOOLEAN NOT NULL DEFAULT false,
    "allegati_op" BOOLEAN NOT NULL DEFAULT false,
    "allegati_required" BOOLEAN NOT NULL DEFAULT false,
    "allegati_op_required" BOOLEAN NOT NULL DEFAULT false,
    "protocollo" BOOLEAN NOT NULL DEFAULT false,
    "tipo_protocollo" "tipo_protocollo",
    "unita_organizzativa" VARCHAR(512),
    "numerazione_interna" BOOLEAN NOT NULL DEFAULT false,
    "assegnabile_a_specifico_ufficio" BOOLEAN NOT NULL DEFAULT false,
    "setta_attributo" BOOLEAN NOT NULL DEFAULT false,
    "servizio_id" INTEGER NOT NULL,
    "fase_id" INTEGER,

    CONSTRAINT "steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allegati_richiesti" (
    "id" SERIAL NOT NULL,
    "nome_allegato_richiesto" VARCHAR(512) NOT NULL,
    "obbligatorio" BOOLEAN NOT NULL DEFAULT false,
    "interno" BOOLEAN NOT NULL DEFAULT false,
    "soggetto" "soggetto",
    "step_id" INTEGER,

    CONSTRAINT "allegati_richiesti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utenti" (
    "id" SERIAL NOT NULL,
    "codice_fiscale" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "data_nascita" TIMESTAMP(3),
    "luogo_nascita" TEXT,
    "indirizzo" TEXT,
    "cap" TEXT,
    "citta" TEXT,
    "provincia" TEXT,
    "pec" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "istanze" (
    "id" SERIAL NOT NULL,
    "dati" TEXT,
    "dati_in_evidenza" TEXT,
    "dati_responso" TEXT,
    "municipalita" VARCHAR(60),
    "ricerca" TEXT,
    "stato" "stato_istanza" NOT NULL DEFAULT 'IN_LAVORAZIONE',
    "active_step" INTEGER,
    "bozza_pagina" INTEGER,
    "proto_numero" VARCHAR(50) NOT NULL,
    "proto_data" TIMESTAMP(3),
    "proto_finale_numero" VARCHAR(50),
    "proto_finale_data" TIMESTAMP(3),
    "protocollo_provvisorio" BOOLEAN NOT NULL DEFAULT false,
    "email_notifica" VARCHAR(255),
    "data_invio" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utente_id" INTEGER NOT NULL,
    "servizio_id" INTEGER NOT NULL,
    "fase_corrente_id" INTEGER,
    "attivita_corrente_id" INTEGER,
    "assegnatario_id" INTEGER,

    CONSTRAINT "istanze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "istanza_attivita" (
    "id" SERIAL NOT NULL,
    "note" TEXT,
    "data_variazione" TIMESTAMP(3) NOT NULL,
    "istanza_id" INTEGER NOT NULL,
    "step_id" INTEGER NOT NULL,
    "completata_at" TIMESTAMP(3),
    "completata_da_id" INTEGER,

    CONSTRAINT "istanza_attivita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fasi" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "ordine" INTEGER NOT NULL,
    "servizio_id" INTEGER NOT NULL,
    "ufficio_id" INTEGER NOT NULL,

    CONSTRAINT "fasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "istanza_fasi" (
    "id" SERIAL NOT NULL,
    "data_inizio" TIMESTAMP(3) NOT NULL,
    "data_completamento" TIMESTAMP(3),
    "direzione" "direzione" NOT NULL DEFAULT 'AVANZAMENTO',
    "istanza_id" INTEGER NOT NULL,
    "fase_id" INTEGER NOT NULL,
    "operatore_completamento_id" INTEGER,

    CONSTRAINT "istanza_fasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicazioni" (
    "id" SERIAL NOT NULL,
    "testo" TEXT NOT NULL,
    "richiede_risposta" BOOLEAN NOT NULL DEFAULT false,
    "allegati_richiesti" TEXT,
    "data_creazione" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "letta_da_cittadino" BOOLEAN NOT NULL DEFAULT false,
    "istanza_id" INTEGER NOT NULL,
    "operatore_id" INTEGER,

    CONSTRAINT "comunicazioni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risposte_comunicazioni" (
    "id" SERIAL NOT NULL,
    "testo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "letta_da_operatore" BOOLEAN NOT NULL DEFAULT false,
    "comunicazione_id" INTEGER NOT NULL,

    CONSTRAINT "risposte_comunicazioni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allegati_risposta" (
    "id" SERIAL NOT NULL,
    "nome_file" VARCHAR(512) NOT NULL,
    "nome_hash" VARCHAR(512) NOT NULL,
    "nome_file_richiesto" VARCHAR(512),
    "mime_type" VARCHAR(100),
    "risposta_id" INTEGER NOT NULL,

    CONSTRAINT "allegati_risposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allegati" (
    "id" SERIAL NOT NULL,
    "nome_file" VARCHAR(512) NOT NULL,
    "nome_hash" VARCHAR(512) NOT NULL,
    "nome_file_richiesto" VARCHAR(512),
    "mime_type" VARCHAR(100),
    "inv_utente" BOOLEAN NOT NULL DEFAULT false,
    "visto" BOOLEAN NOT NULL DEFAULT false,
    "data_inserimento" TIMESTAMP(3),
    "attivita_id" INTEGER NOT NULL,

    CONSTRAINT "allegati_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamenti" (
    "id" SERIAL NOT NULL,
    "importo" DOUBLE PRECISION,
    "importo_variabile" BOOLEAN NOT NULL DEFAULT false,
    "obbligatorio" BOOLEAN NOT NULL DEFAULT false,
    "tipologia_pagamento" TEXT,
    "causale" TEXT,
    "causale_variabile" BOOLEAN NOT NULL DEFAULT false,
    "codice_tributo" VARCHAR(30),
    "descrizione_tributo" VARCHAR(512),
    "step_id" INTEGER NOT NULL,

    CONSTRAINT "pagamenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamenti_attesi" (
    "id" SERIAL NOT NULL,
    "iuv" VARCHAR(100),
    "numero_documento" VARCHAR(30),
    "importo_totale" DOUBLE PRECISION NOT NULL,
    "stato" VARCHAR(3),
    "data_emissione" TIMESTAMP(3),
    "data_scadenza" TIMESTAMP(3),
    "data_operazione" TIMESTAMP(3),
    "data_ricevuta" TIMESTAMP(3),
    "pagante_codice_fiscale" VARCHAR(16),
    "pagante" VARCHAR(50),
    "pagante_email" VARCHAR(50),
    "causale" VARCHAR(100),
    "attivita_id" INTEGER NOT NULL,

    CONSTRAINT "pagamenti_attesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_satisfaction" (
    "id" SERIAL NOT NULL,
    "green" INTEGER NOT NULL DEFAULT 0,
    "yellow" INTEGER NOT NULL DEFAULT 0,
    "red" INTEGER NOT NULL DEFAULT 0,
    "gray" INTEGER NOT NULL DEFAULT 0,
    "servizio_id" INTEGER NOT NULL,

    CONSTRAINT "customer_satisfaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ricevute" (
    "id" SERIAL NOT NULL,
    "richiesta_art18" BOOLEAN NOT NULL DEFAULT false,
    "unita_organizzativa_competente" TEXT,
    "ufficio_competente" TEXT,
    "responsabile_procedimento" TEXT,
    "durata_massima_procedimento" INTEGER,
    "responsabile_provvedimento_finale" TEXT,
    "persona_potere_sostitutivo" TEXT,
    "url_servizio_web" TEXT,
    "ufficio_ricevimento" TEXT,
    "servizio_id" INTEGER NOT NULL,

    CONSTRAINT "ricevute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocollo_emergenza_counters" (
    "anno" INTEGER NOT NULL,
    "progressivo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "protocollo_emergenza_counters_pkey" PRIMARY KEY ("anno")
);

-- CreateTable
CREATE TABLE "protocollo_emergenza" (
    "id" SERIAL NOT NULL,
    "anno" INTEGER NOT NULL DEFAULT 0,
    "progressivo" INTEGER NOT NULL DEFAULT 0,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "rettificato" BOOLEAN NOT NULL DEFAULT false,
    "istanza_id" INTEGER,

    CONSTRAINT "protocollo_emergenza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistiche_giornaliere" (
    "id" SERIAL NOT NULL,
    "data" DATE NOT NULL,
    "istanze_inviate" INTEGER NOT NULL DEFAULT 0,
    "istanze_concluse" INTEGER NOT NULL DEFAULT 0,
    "istanze_respinte" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "statistiche_giornaliere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistiche_pagamenti" (
    "id" SERIAL NOT NULL,
    "data" DATE NOT NULL,
    "numero_transazioni" INTEGER NOT NULL DEFAULT 0,
    "importo_totale" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "statistiche_pagamenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_config" (
    "id" SERIAL NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'smtp',
    "smtp_host" VARCHAR(100),
    "smtp_port" INTEGER,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT false,
    "smtp_user" VARCHAR(50),
    "smtp_password" VARCHAR(64),
    "smtp_from_email" VARCHAR(100),
    "smtp_from_name" VARCHAR(100),
    "o365_tenant_id" VARCHAR(64),
    "o365_client_id" VARCHAR(64),
    "o365_client_secret" VARCHAR(64),
    "o365_sender_email" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operatori_user_name_key" ON "operatori"("user_name");

-- CreateIndex
CREATE INDEX "operatori_user_name_idx" ON "operatori"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "ruoli_nome_key" ON "ruoli"("nome");

-- CreateIndex
CREATE INDEX "operatori_servizi_servizio_id_idx" ON "operatori_servizi"("servizio_id");

-- CreateIndex
CREATE UNIQUE INDEX "ruoli_user_nome_key" ON "ruoli_user"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "aree_slug_key" ON "aree"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "servizi_slug_key" ON "servizi"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "utenti_codice_fiscale_key" ON "utenti"("codice_fiscale");

-- CreateIndex
CREATE UNIQUE INDEX "istanze_attivita_corrente_id_key" ON "istanze"("attivita_corrente_id");

-- CreateIndex
CREATE INDEX "istanze_utente_id_idx" ON "istanze"("utente_id");

-- CreateIndex
CREATE INDEX "istanze_servizio_id_idx" ON "istanze"("servizio_id");

-- CreateIndex
CREATE INDEX "istanze_data_invio_idx" ON "istanze"("data_invio");

-- CreateIndex
CREATE INDEX "istanze_proto_numero_idx" ON "istanze"("proto_numero");

-- CreateIndex
CREATE INDEX "istanze_stato_assegnatario_id_idx" ON "istanze"("stato", "assegnatario_id");

-- CreateIndex
CREATE INDEX "istanze_fase_corrente_id_idx" ON "istanze"("fase_corrente_id");

-- CreateIndex
CREATE INDEX "istanza_attivita_istanza_id_idx" ON "istanza_attivita"("istanza_id");

-- CreateIndex
CREATE INDEX "istanza_attivita_data_variazione_idx" ON "istanza_attivita"("data_variazione");

-- CreateIndex
CREATE INDEX "istanza_fasi_istanza_id_idx" ON "istanza_fasi"("istanza_id");

-- CreateIndex
CREATE INDEX "comunicazioni_istanza_id_idx" ON "comunicazioni"("istanza_id");

-- CreateIndex
CREATE UNIQUE INDEX "risposte_comunicazioni_comunicazione_id_key" ON "risposte_comunicazioni"("comunicazione_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamenti_step_id_key" ON "pagamenti"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamenti_attesi_attivita_id_key" ON "pagamenti_attesi"("attivita_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_satisfaction_servizio_id_key" ON "customer_satisfaction"("servizio_id");

-- CreateIndex
CREATE UNIQUE INDEX "ricevute_servizio_id_key" ON "ricevute"("servizio_id");

-- CreateIndex
CREATE UNIQUE INDEX "statistiche_giornaliere_data_key" ON "statistiche_giornaliere"("data");

-- CreateIndex
CREATE UNIQUE INDEX "statistiche_pagamenti_data_key" ON "statistiche_pagamenti"("data");

-- AddForeignKey
ALTER TABLE "operatori" ADD CONSTRAINT "operatori_ufficio_id_fkey" FOREIGN KEY ("ufficio_id") REFERENCES "uffici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operatori_ruoli" ADD CONSTRAINT "operatori_ruoli_operatore_id_fkey" FOREIGN KEY ("operatore_id") REFERENCES "operatori"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operatori_ruoli" ADD CONSTRAINT "operatori_ruoli_ruolo_id_fkey" FOREIGN KEY ("ruolo_id") REFERENCES "ruoli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operatori_servizi" ADD CONSTRAINT "operatori_servizi_operatore_id_fkey" FOREIGN KEY ("operatore_id") REFERENCES "operatori"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operatori_servizi" ADD CONSTRAINT "operatori_servizi_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servizi" ADD CONSTRAINT "servizi_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "aree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servizi" ADD CONSTRAINT "servizi_ufficio_id_fkey" FOREIGN KEY ("ufficio_id") REFERENCES "uffici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servizi_ruoli_user" ADD CONSTRAINT "servizi_ruoli_user_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servizi_ruoli_user" ADD CONSTRAINT "servizi_ruoli_user_ruolo_user_id_fkey" FOREIGN KEY ("ruolo_user_id") REFERENCES "ruoli_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_fase_id_fkey" FOREIGN KEY ("fase_id") REFERENCES "fasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allegati_richiesti" ADD CONSTRAINT "allegati_richiesti_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_utente_id_fkey" FOREIGN KEY ("utente_id") REFERENCES "utenti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_fase_corrente_id_fkey" FOREIGN KEY ("fase_corrente_id") REFERENCES "fasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_attivita_corrente_id_fkey" FOREIGN KEY ("attivita_corrente_id") REFERENCES "istanza_attivita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_assegnatario_id_fkey" FOREIGN KEY ("assegnatario_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanza_attivita" ADD CONSTRAINT "istanza_attivita_istanza_id_fkey" FOREIGN KEY ("istanza_id") REFERENCES "istanze"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanza_attivita" ADD CONSTRAINT "istanza_attivita_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanza_attivita" ADD CONSTRAINT "istanza_attivita_completata_da_id_fkey" FOREIGN KEY ("completata_da_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fasi" ADD CONSTRAINT "fasi_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fasi" ADD CONSTRAINT "fasi_ufficio_id_fkey" FOREIGN KEY ("ufficio_id") REFERENCES "uffici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanza_fasi" ADD CONSTRAINT "istanza_fasi_istanza_id_fkey" FOREIGN KEY ("istanza_id") REFERENCES "istanze"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanza_fasi" ADD CONSTRAINT "istanza_fasi_fase_id_fkey" FOREIGN KEY ("fase_id") REFERENCES "fasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanza_fasi" ADD CONSTRAINT "istanza_fasi_operatore_completamento_id_fkey" FOREIGN KEY ("operatore_completamento_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicazioni" ADD CONSTRAINT "comunicazioni_istanza_id_fkey" FOREIGN KEY ("istanza_id") REFERENCES "istanze"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicazioni" ADD CONSTRAINT "comunicazioni_operatore_id_fkey" FOREIGN KEY ("operatore_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risposte_comunicazioni" ADD CONSTRAINT "risposte_comunicazioni_comunicazione_id_fkey" FOREIGN KEY ("comunicazione_id") REFERENCES "comunicazioni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allegati_risposta" ADD CONSTRAINT "allegati_risposta_risposta_id_fkey" FOREIGN KEY ("risposta_id") REFERENCES "risposte_comunicazioni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allegati" ADD CONSTRAINT "allegati_attivita_id_fkey" FOREIGN KEY ("attivita_id") REFERENCES "istanza_attivita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti_attesi" ADD CONSTRAINT "pagamenti_attesi_attivita_id_fkey" FOREIGN KEY ("attivita_id") REFERENCES "istanza_attivita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_satisfaction" ADD CONSTRAINT "customer_satisfaction_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ricevute" ADD CONSTRAINT "ricevute_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Oggetti del database che il DSL di Prisma non esprime: estensioni, funzioni,
-- trigger, indici GIN.
--
-- `prisma db push` e un dump fatto con quel database li perdono in silenzio,
-- e l'effetto non è un errore ma dati sbagliati: senza
-- `attivita_corrente_su_insert` un'istanza appena inviata ha
-- attivita_corrente_id NULL, la sua unica attività risulta "non corrente" e
-- l'office la mostra come "Retrocesso" invece che "In attesa".
--
-- Le definizioni sono quelle delle migrazioni 20260807100000 (posizione
-- corrente) e 20260813100000 (ricerca istanze), con i nomi tabella successivi
-- al rename in istanza_attivita.
--
-- Idempotente: si può rieseguire su qualunque database con lo schema
-- applicato. I backfill toccano solo le righe rimaste NULL.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/sql/oggetti-database.sql
-- ============================================================================


CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── posizione corrente ──────────────────────────────────────────────────────

-- L'attività corrente è per definizione l'ultima inserita. Nessuna
-- applicazione scrive questa colonna, quindi non può divergere.
CREATE OR REPLACE FUNCTION "imposta_attivita_corrente"() RETURNS trigger AS $$
BEGIN
  UPDATE "istanze" SET "attivita_corrente_id" = NEW."id" WHERE "id" = NEW."istanza_id";
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "attivita_corrente_su_insert" ON "istanza_attivita";
CREATE TRIGGER "attivita_corrente_su_insert"
AFTER INSERT ON "istanza_attivita"
FOR EACH ROW EXECUTE FUNCTION "imposta_attivita_corrente"();

-- L'assegnazione decade a ogni cambio di fase (specifica B1): la visibilità
-- dipende dall'ufficio della fase corrente. La guardia su OLD IS NOT NULL
-- evita di azzerare la prima assegnazione di `takeCharge` sulle istanze
-- migrate con fase corrente NULL.
CREATE OR REPLACE FUNCTION "azzera_assegnatario_al_cambio_fase"() RETURNS trigger AS $$
BEGIN
  IF OLD."fase_corrente_id" IS NOT NULL
     AND NEW."fase_corrente_id" IS DISTINCT FROM OLD."fase_corrente_id" THEN
    NEW."assegnatario_id" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "assegnatario_al_cambio_fase" ON "istanze";
CREATE TRIGGER "assegnatario_al_cambio_fase"
BEFORE UPDATE ON "istanze"
FOR EACH ROW EXECUTE FUNCTION "azzera_assegnatario_al_cambio_fase"();

-- Istanze create mentre il trigger mancava. Non tocca assegnatario_id:
-- il trigger qui sopra reagisce solo a fase_corrente_id.
UPDATE "istanze" i
   SET "attivita_corrente_id" = u."id"
  FROM (
    SELECT DISTINCT ON ("istanza_id") "istanza_id", "id"
      FROM "istanza_attivita"
     ORDER BY "istanza_id", "id" DESC
  ) u
 WHERE u."istanza_id" = i."id"
   AND i."attivita_corrente_id" IS NULL;

-- ── ricerca istanze ─────────────────────────────────────────────────────────

-- Usata sia dal backfill sia dai trigger. Il blocco EXCEPTION ripiega sul
-- testo grezzo se `dati` non è JSON valido: un trigger più severo del codice
-- che lo alimenta farebbe fallire l'invio dell'istanza.
CREATE OR REPLACE FUNCTION "costruisci_ricerca_istanza"(
  p_dati      TEXT,
  p_utente_id INTEGER
) RETURNS TEXT AS $$
DECLARE
  v_valori TEXT;
  v_utente TEXT;
BEGIN
  BEGIN
    SELECT string_agg(e->>'value', ' ')
      INTO v_valori
      FROM jsonb_array_elements(p_dati::jsonb) e;
  EXCEPTION WHEN others THEN
    v_valori := p_dati;
  END;

  SELECT concat_ws(' ', u."codice_fiscale", u."nome", u."cognome")
    INTO v_utente
    FROM "utenti" u
   WHERE u."id" = p_utente_id;

  RETURN lower(concat_ws(' ', v_utente, v_valori));
END;
$$ LANGUAGE plpgsql;

-- Prima degli indici: costruire il GIN su una colonna già piena è più veloce.
UPDATE "istanze"
   SET "ricerca" = "costruisci_ricerca_istanza"("dati", "utente_id")
 WHERE "ricerca" IS NULL;

CREATE INDEX IF NOT EXISTS "istanze_ricerca_trgm"
  ON "istanze" USING GIN ("ricerca" gin_trgm_ops);

-- Filtro di colonna su datiInEvidenza (paged/route.ts), distinto dalla
-- ricerca libera.
CREATE INDEX IF NOT EXISTS "istanze_dati_in_evidenza_trgm"
  ON "istanze" USING GIN ("dati_in_evidenza" gin_trgm_ops);

CREATE OR REPLACE FUNCTION "aggiorna_ricerca_istanza"() RETURNS trigger AS $$
BEGIN
  NEW."ricerca" := "costruisci_ricerca_istanza"(NEW."dati", NEW."utente_id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ricerca_su_istanza" ON "istanze";
CREATE TRIGGER "ricerca_su_istanza"
BEFORE INSERT OR UPDATE OF "dati", "utente_id" ON "istanze"
FOR EACH ROW EXECUTE FUNCTION "aggiorna_ricerca_istanza"();

-- Un cittadino che corregge il cognome deve restare cercabile con quello nuovo.
CREATE OR REPLACE FUNCTION "aggiorna_ricerca_da_utente"() RETURNS trigger AS $$
BEGIN
  UPDATE "istanze"
     SET "ricerca" = "costruisci_ricerca_istanza"("dati", "utente_id")
   WHERE "utente_id" = NEW."id";
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ricerca_su_utente" ON "utenti";
CREATE TRIGGER "ricerca_su_utente"
AFTER UPDATE OF "nome", "cognome", "codice_fiscale" ON "utenti"
FOR EACH ROW
WHEN (OLD."nome"           IS DISTINCT FROM NEW."nome"
   OR OLD."cognome"        IS DISTINCT FROM NEW."cognome"
   OR OLD."codice_fiscale" IS DISTINCT FROM NEW."codice_fiscale")
EXECUTE FUNCTION "aggiorna_ricerca_da_utente"();

