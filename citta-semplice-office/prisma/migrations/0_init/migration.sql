-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoProtocollo" AS ENUM ('E', 'U');

-- CreateEnum
CREATE TYPE "Soggetto" AS ENUM ('OP', 'UT');

-- CreateEnum
CREATE TYPE "Direzione" AS ENUM ('AVANZAMENTO', 'ROLLBACK');

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
    "privata" BOOLEAN NOT NULL DEFAULT false,

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
    "tipo_protocollo" "TipoProtocollo",
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
    "soggetto" "Soggetto",
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
    "conclusa" BOOLEAN NOT NULL DEFAULT false,
    "respinta" BOOLEAN NOT NULL DEFAULT false,
    "in_bozza" BOOLEAN NOT NULL DEFAULT false,
    "active_step" INTEGER,
    "bozza_pagina" INTEGER,
    "proto_numero" VARCHAR(50) NOT NULL,
    "proto_data" TIMESTAMP(3),
    "proto_finale_numero" VARCHAR(50),
    "proto_finale_data" TIMESTAMP(3),
    "data_invio" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utente_id" INTEGER NOT NULL,
    "servizio_id" INTEGER NOT NULL,
    "last_step_id" INTEGER,
    "fase_corrente_id" INTEGER,
    "ufficio_corrente_id" INTEGER,

    CONSTRAINT "istanze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" SERIAL NOT NULL,
    "note" TEXT,
    "data_variazione" TIMESTAMP(3) NOT NULL,
    "istanza_id" INTEGER NOT NULL,
    "step_id" INTEGER NOT NULL,
    "stato" INTEGER NOT NULL DEFAULT 0,
    "operatore_id" INTEGER,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "workflow_fasi" (
    "id" SERIAL NOT NULL,
    "data_inizio" TIMESTAMP(3) NOT NULL,
    "data_completamento" TIMESTAMP(3),
    "direzione" "Direzione" NOT NULL DEFAULT 'AVANZAMENTO',
    "istanza_id" INTEGER NOT NULL,
    "fase_id" INTEGER NOT NULL,
    "operatore_completamento_id" INTEGER,

    CONSTRAINT "workflow_fasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicazioni" (
    "id" SERIAL NOT NULL,
    "testo" TEXT NOT NULL,
    "richiede_risposta" BOOLEAN NOT NULL DEFAULT false,
    "allegati_richiesti" TEXT,
    "data_creazione" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "istanza_id" INTEGER NOT NULL,
    "operatore_id" INTEGER,

    CONSTRAINT "comunicazioni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risposte_comunicazioni" (
    "id" SERIAL NOT NULL,
    "testo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comunicazione_id" INTEGER NOT NULL,

    CONSTRAINT "risposte_comunicazioni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allegati_risposta" (
    "id" SERIAL NOT NULL,
    "nome_file" VARCHAR(512) NOT NULL,
    "nome_hash" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(50),
    "risposta_id" INTEGER NOT NULL,

    CONSTRAINT "allegati_risposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allegati" (
    "id" SERIAL NOT NULL,
    "nome_file" VARCHAR(512) NOT NULL,
    "nome_hash" VARCHAR(512) NOT NULL,
    "nome_file_richiesto" VARCHAR(512),
    "mime_type" VARCHAR(50),
    "inv_utente" BOOLEAN NOT NULL DEFAULT false,
    "visto" BOOLEAN NOT NULL DEFAULT false,
    "data_inserimento" TIMESTAMP(3),
    "workflow_id" INTEGER NOT NULL,

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
    "workflow_id" INTEGER NOT NULL,

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
CREATE UNIQUE INDEX "ruoli_user_nome_key" ON "ruoli_user"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "aree_slug_key" ON "aree"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "servizi_slug_key" ON "servizi"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "utenti_codice_fiscale_key" ON "utenti"("codice_fiscale");

-- CreateIndex
CREATE INDEX "istanze_utente_id_idx" ON "istanze"("utente_id");

-- CreateIndex
CREATE INDEX "istanze_servizio_id_idx" ON "istanze"("servizio_id");

-- CreateIndex
CREATE INDEX "istanze_data_invio_idx" ON "istanze"("data_invio");

-- CreateIndex
CREATE INDEX "istanze_proto_numero_idx" ON "istanze"("proto_numero");

-- CreateIndex
CREATE INDEX "workflows_istanza_id_idx" ON "workflows"("istanza_id");

-- CreateIndex
CREATE INDEX "workflows_data_variazione_idx" ON "workflows"("data_variazione");

-- CreateIndex
CREATE INDEX "workflow_fasi_istanza_id_idx" ON "workflow_fasi"("istanza_id");

-- CreateIndex
CREATE INDEX "comunicazioni_istanza_id_idx" ON "comunicazioni"("istanza_id");

-- CreateIndex
CREATE UNIQUE INDEX "risposte_comunicazioni_comunicazione_id_key" ON "risposte_comunicazioni"("comunicazione_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamenti_step_id_key" ON "pagamenti"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamenti_attesi_workflow_id_key" ON "pagamenti_attesi"("workflow_id");

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
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_last_step_id_fkey" FOREIGN KEY ("last_step_id") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_fase_corrente_id_fkey" FOREIGN KEY ("fase_corrente_id") REFERENCES "fasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_ufficio_corrente_id_fkey" FOREIGN KEY ("ufficio_corrente_id") REFERENCES "uffici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_istanza_id_fkey" FOREIGN KEY ("istanza_id") REFERENCES "istanze"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_operatore_id_fkey" FOREIGN KEY ("operatore_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fasi" ADD CONSTRAINT "fasi_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fasi" ADD CONSTRAINT "fasi_ufficio_id_fkey" FOREIGN KEY ("ufficio_id") REFERENCES "uffici"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_fasi" ADD CONSTRAINT "workflow_fasi_istanza_id_fkey" FOREIGN KEY ("istanza_id") REFERENCES "istanze"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_fasi" ADD CONSTRAINT "workflow_fasi_fase_id_fkey" FOREIGN KEY ("fase_id") REFERENCES "fasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_fasi" ADD CONSTRAINT "workflow_fasi_operatore_completamento_id_fkey" FOREIGN KEY ("operatore_completamento_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicazioni" ADD CONSTRAINT "comunicazioni_istanza_id_fkey" FOREIGN KEY ("istanza_id") REFERENCES "istanze"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicazioni" ADD CONSTRAINT "comunicazioni_operatore_id_fkey" FOREIGN KEY ("operatore_id") REFERENCES "operatori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risposte_comunicazioni" ADD CONSTRAINT "risposte_comunicazioni_comunicazione_id_fkey" FOREIGN KEY ("comunicazione_id") REFERENCES "comunicazioni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allegati_risposta" ADD CONSTRAINT "allegati_risposta_risposta_id_fkey" FOREIGN KEY ("risposta_id") REFERENCES "risposte_comunicazioni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allegati" ADD CONSTRAINT "allegati_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamenti_attesi" ADD CONSTRAINT "pagamenti_attesi_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_satisfaction" ADD CONSTRAINT "customer_satisfaction_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ricevute" ADD CONSTRAINT "ricevute_servizio_id_fkey" FOREIGN KEY ("servizio_id") REFERENCES "servizi"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Vincolo non modellabile in Prisma: gli stati di un'istanza sono mutuamente
-- esclusivi (al più uno tra conclusa/respinta/in_bozza può essere true).
-- Tutti false = "in lavorazione".
ALTER TABLE "istanze" ADD CONSTRAINT "istanze_stato_esclusivo_chk"
  CHECK (("conclusa"::int + "respinta"::int + "in_bozza"::int) <= 1);
