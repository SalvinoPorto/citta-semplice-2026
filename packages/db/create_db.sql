-- FUNCTION: public.azzera_assegnatario_al_cambio_fase()

-- DROP FUNCTION IF EXISTS public.azzera_assegnatario_al_cambio_fase();

CREATE OR REPLACE FUNCTION public.azzera_assegnatario_al_cambio_fase()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE NOT LEAKPROOF
AS $BODY$
BEGIN
  IF OLD."fase_corrente_id" IS NOT NULL
     AND NEW."fase_corrente_id" IS DISTINCT FROM OLD."fase_corrente_id" THEN
    NEW."assegnatario_id" := NULL;
  END IF;
  RETURN NEW;
END;
$BODY$;

ALTER FUNCTION public.azzera_assegnatario_al_cambio_fase()
    OWNER TO io_user;

-- FUNCTION: public.imposta_attivita_corrente()

-- DROP FUNCTION IF EXISTS public.imposta_attivita_corrente();

CREATE OR REPLACE FUNCTION public.imposta_attivita_corrente()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE NOT LEAKPROOF
AS $BODY$
BEGIN
  UPDATE "istanze" SET "attivita_corrente_id" = NEW."id" WHERE "id" = NEW."istanza_id";
  RETURN NULL;
END;
$BODY$;

ALTER FUNCTION public.imposta_attivita_corrente()
    OWNER TO io_user;


-- Type: direzione

DROP TYPE IF EXISTS public.direzione;

CREATE TYPE public.direzione AS ENUM
    ('AVANZAMENTO', 'ROLLBACK');

ALTER TYPE public.direzione
    OWNER TO io_user;
    
-- Type: soggetto

DROP TYPE IF EXISTS public.soggetto;

CREATE TYPE public.soggetto AS ENUM
    ('OP', 'UT');

ALTER TYPE public.soggetto
    OWNER TO io_user;


-- Type: stato_istanza

DROP TYPE IF EXISTS public.stato_istanza;

CREATE TYPE public.stato_istanza AS ENUM
    ('BOZZA', 'IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA');

ALTER TYPE public.stato_istanza
    OWNER TO io_user;


-- Type: tipo_protocollo

DROP TYPE IF EXISTS public.tipo_protocollo;

CREATE TYPE public.tipo_protocollo AS ENUM
    ('E', 'U');

ALTER TYPE public.tipo_protocollo
    OWNER TO io_user;

-- SEQUENCE: public.aree_id_seq

DROP SEQUENCE IF EXISTS public.aree_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.aree_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.aree_id_seq
    OWNER TO io_user;
    
-- Table: public.aree

DROP TABLE IF EXISTS public.aree CASCADE;

CREATE TABLE IF NOT EXISTS public.aree
(
    id integer NOT NULL DEFAULT nextval('aree_id_seq'::regclass),
    nome character varying(255) COLLATE pg_catalog."default" NOT NULL,
    descrizione character varying(512) COLLATE pg_catalog."default",
    icona character varying(255) COLLATE pg_catalog."default",
    ordine integer NOT NULL DEFAULT 0,
    attiva boolean NOT NULL DEFAULT true,
    slug character varying(255) COLLATE pg_catalog."default" NOT NULL DEFAULT '/'::character varying,
    CONSTRAINT aree_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.aree
    OWNER to io_user;
-- Index: aree_slug_key

-- DROP INDEX IF EXISTS public.aree_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS aree_slug_key
    ON public.aree USING btree
    (slug COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
  

-- SEQUENCE: public.utenti_id_seq

DROP SEQUENCE IF EXISTS public.utenti_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.utenti_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.utenti_id_seq
    OWNER TO io_user;

-- Table: public.utenti

DROP TABLE IF EXISTS public.utenti CASCADE;

CREATE TABLE IF NOT EXISTS public.utenti
(
    id integer NOT NULL DEFAULT nextval('utenti_id_seq'::regclass),
    codice_fiscale text COLLATE pg_catalog."default" NOT NULL,
    nome text COLLATE pg_catalog."default" NOT NULL,
    cognome text COLLATE pg_catalog."default" NOT NULL,
    email text COLLATE pg_catalog."default",
    telefono text COLLATE pg_catalog."default",
    data_nascita timestamp(3) without time zone,
    luogo_nascita text COLLATE pg_catalog."default",
    indirizzo text COLLATE pg_catalog."default",
    cap text COLLATE pg_catalog."default",
    citta text COLLATE pg_catalog."default",
    provincia text COLLATE pg_catalog."default",
    pec text COLLATE pg_catalog."default",
    created_at timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT utenti_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.utenti
    OWNER to io_user;
-- Index: utenti_codice_fiscale_key

DROP INDEX IF EXISTS public.utenti_codice_fiscale_key;

CREATE UNIQUE INDEX IF NOT EXISTS utenti_codice_fiscale_key
    ON public.utenti USING btree
    (codice_fiscale COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;


-- SEQUENCE: public.uffici_id_seq

DROP SEQUENCE IF EXISTS public.uffici_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.uffici_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.uffici_id_seq
    OWNER TO io_user;

-- Table: public.uffici

DROP TABLE IF EXISTS public.uffici CASCADE;

CREATE TABLE IF NOT EXISTS public.uffici
(
    id integer NOT NULL DEFAULT nextval('uffici_id_seq'::regclass),
    nome character varying(255) COLLATE pg_catalog."default" NOT NULL,
    descrizione character varying(255) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    telefono character varying(255) COLLATE pg_catalog."default",
    indirizzo character varying(255) COLLATE pg_catalog."default",
    attivo boolean NOT NULL DEFAULT true,
    CONSTRAINT uffici_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.uffici
    OWNER to io_user;    


-- SEQUENCE: public.operatori_id_seq

DROP SEQUENCE IF EXISTS public.operatori_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.operatori_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.operatori_id_seq
    OWNER TO io_user;

-- Table: public.operatori

DROP TABLE IF EXISTS public.operatori CASCADE;

CREATE TABLE IF NOT EXISTS public.operatori
(
    id integer NOT NULL DEFAULT nextval('operatori_id_seq'::regclass),
    email character varying(100) COLLATE pg_catalog."default" NOT NULL,
    password character varying(255) COLLATE pg_catalog."default" NOT NULL,
    nome character varying(100) COLLATE pg_catalog."default" NOT NULL,
    cognome character varying(100) COLLATE pg_catalog."default" NOT NULL,
    user_name character varying(64) COLLATE pg_catalog."default" NOT NULL,
    telefono character varying(255) COLLATE pg_catalog."default",
    attivo boolean NOT NULL DEFAULT true,
    created_at timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(3) without time zone NOT NULL,
    ufficio_id integer,
    CONSTRAINT operatori_pkey PRIMARY KEY (id),
    CONSTRAINT operatori_ufficio_id_fkey FOREIGN KEY (ufficio_id)
        REFERENCES public.uffici (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE SET NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.operatori
    OWNER to io_user;
-- Index: operatori_user_name_idx

DROP INDEX IF EXISTS public.operatori_user_name_idx;

CREATE INDEX IF NOT EXISTS operatori_user_name_idx
    ON public.operatori USING btree
    (user_name COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: operatori_user_name_key

DROP INDEX IF EXISTS public.operatori_user_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS operatori_user_name_key
    ON public.operatori USING btree
    (user_name COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

ALTER SEQUENCE public.operatori_id_seq
    OWNED BY public.operatori.id;


-- SEQUENCE: public.istanza_attivita_id_seq

DROP SEQUENCE IF EXISTS public.istanza_attivita_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.istanza_attivita_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.istanza_attivita_id_seq
    OWNER TO io_user;

-- Table: public.istanza_attivita

DROP TABLE IF EXISTS public.istanza_attivita CASCADE;

CREATE TABLE IF NOT EXISTS public.istanza_attivita
(
    id integer NOT NULL DEFAULT nextval('istanza_attivita_id_seq'::regclass),
    note text COLLATE pg_catalog."default",
    data_variazione timestamp(3) without time zone NOT NULL,
    istanza_id integer NOT NULL,
    step_id integer NOT NULL,
    completata_at timestamp(3) without time zone,
    completata_da_id integer,
    CONSTRAINT istanza_attivita_pkey PRIMARY KEY (id),
    CONSTRAINT istanza_attivita_completata_da_id_fkey FOREIGN KEY (completata_da_id)
        REFERENCES public.operatori (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE SET NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.istanza_attivita
    OWNER to io_user;
-- Index: istanza_attivita_data_variazione_idx

DROP INDEX IF EXISTS public.istanza_attivita_data_variazione_idx;

CREATE INDEX IF NOT EXISTS istanza_attivita_data_variazione_idx
    ON public.istanza_attivita USING btree
    (data_variazione ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: istanza_attivita_istanza_id_idx

DROP INDEX IF EXISTS public.istanza_attivita_istanza_id_idx;

CREATE INDEX IF NOT EXISTS istanza_attivita_istanza_id_idx
    ON public.istanza_attivita USING btree
    (istanza_id ASC NULLS LAST)
    TABLESPACE pg_default;

-- Trigger: attivita_corrente_su_insert

DROP TRIGGER IF EXISTS attivita_corrente_su_insert ON public.istanza_attivita;

CREATE TRIGGER attivita_corrente_su_insert
    AFTER INSERT
    ON public.istanza_attivita
    FOR EACH ROW
    EXECUTE FUNCTION public.imposta_attivita_corrente();


-- SEQUENCE: public.istanze_id_seq

DROP SEQUENCE IF EXISTS public.istanze_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.istanze_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.istanze_id_seq
    OWNER TO io_user;

-- Table: public.istanze

DROP TABLE IF EXISTS public.istanze CASCADE;

CREATE TABLE IF NOT EXISTS public.istanze
(
    id integer NOT NULL DEFAULT nextval('istanze_id_seq'::regclass),
    dati text COLLATE pg_catalog."default",
    dati_in_evidenza text COLLATE pg_catalog."default",
    dati_responso text COLLATE pg_catalog."default",
    municipalita character varying(60) COLLATE pg_catalog."default",
    active_step integer,
    proto_numero character varying(50) COLLATE pg_catalog."default" NOT NULL,
    proto_data timestamp(3) without time zone,
    proto_finale_numero character varying(50) COLLATE pg_catalog."default",
    proto_finale_data timestamp(3) without time zone,
    data_invio timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    utente_id integer NOT NULL,
    servizio_id integer NOT NULL,
    fase_corrente_id integer,
    bozza_pagina integer,
    stato stato_istanza NOT NULL DEFAULT 'IN_LAVORAZIONE'::stato_istanza,
    attivita_corrente_id integer,
    assegnatario_id integer,
    CONSTRAINT istanze_pkey PRIMARY KEY (id),
    CONSTRAINT istanze_assegnatario_id_fkey FOREIGN KEY (assegnatario_id)
        REFERENCES public.operatori (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT istanze_attivita_corrente_id_fkey FOREIGN KEY (attivita_corrente_id)
        REFERENCES public.istanza_attivita (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT istanze_utente_id_fkey FOREIGN KEY (utente_id)
        REFERENCES public.utenti (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE RESTRICT
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.istanze
    OWNER to io_user;
-- Index: istanze_attivita_corrente_id_key

DROP INDEX IF EXISTS public.istanze_attivita_corrente_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS istanze_attivita_corrente_id_key
    ON public.istanze USING btree
    (attivita_corrente_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: istanze_data_invio_idx

DROP INDEX IF EXISTS public.istanze_data_invio_idx;

CREATE INDEX IF NOT EXISTS istanze_data_invio_idx
    ON public.istanze USING btree
    (data_invio ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: istanze_fase_corrente_id_idx

DROP INDEX IF EXISTS public.istanze_fase_corrente_id_idx;

CREATE INDEX IF NOT EXISTS istanze_fase_corrente_id_idx
    ON public.istanze USING btree
    (fase_corrente_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: istanze_proto_numero_idx

DROP INDEX IF EXISTS public.istanze_proto_numero_idx;

CREATE INDEX IF NOT EXISTS istanze_proto_numero_idx
    ON public.istanze USING btree
    (proto_numero COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: istanze_servizio_id_idx

DROP INDEX IF EXISTS public.istanze_servizio_id_idx;

CREATE INDEX IF NOT EXISTS istanze_servizio_id_idx
    ON public.istanze USING btree
    (servizio_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: istanze_stato_assegnatario_id_idx

DROP INDEX IF EXISTS public.istanze_stato_assegnatario_id_idx;

CREATE INDEX IF NOT EXISTS istanze_stato_assegnatario_id_idx
    ON public.istanze USING btree
    (stato ASC NULLS LAST, assegnatario_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: istanze_utente_id_idx

DROP INDEX IF EXISTS public.istanze_utente_id_idx;

CREATE INDEX IF NOT EXISTS istanze_utente_id_idx
    ON public.istanze USING btree
    (utente_id ASC NULLS LAST)
    TABLESPACE pg_default;

ALTER SEQUENCE public.istanze_id_seq
    OWNED BY public.istanze.id;

-- Trigger: assegnatario_al_cambio_fase

DROP TRIGGER IF EXISTS assegnatario_al_cambio_fase ON public.istanze;

CREATE TRIGGER assegnatario_al_cambio_fase
    BEFORE UPDATE 
    ON public.istanze
    FOR EACH ROW
    EXECUTE FUNCTION public.azzera_assegnatario_al_cambio_fase();

ALTER TABLE ONLY public.istanza_attivita
    ADD CONSTRAINT istanza_attivita_istanza_id_fkey FOREIGN KEY (istanza_id)
        REFERENCES public.istanze (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE;
    

-- SEQUENCE: public.servizi_id_seq

DROP SEQUENCE IF EXISTS public.servizi_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.servizi_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.servizi_id_seq
    OWNER TO io_user;
    
-- Table: public.servizi

DROP TABLE IF EXISTS public.servizi CASCADE;

CREATE TABLE IF NOT EXISTS public.servizi
(
    id integer NOT NULL DEFAULT nextval('servizi_id_seq'::regclass),
    area_id integer NOT NULL,
    ufficio_id integer,
    titolo text COLLATE pg_catalog."default" NOT NULL,
    sotto_titolo text COLLATE pg_catalog."default",
    descrizione text COLLATE pg_catalog."default",
    come_fare text COLLATE pg_catalog."default",
    cosa_serve text COLLATE pg_catalog."default",
    altre_info text COLLATE pg_catalog."default",
    contatti text COLLATE pg_catalog."default",
    slug character varying(255) COLLATE pg_catalog."default" NOT NULL DEFAULT '/'::character varying,
    icona character varying(255) COLLATE pg_catalog."default",
    ordine integer NOT NULL DEFAULT 0,
    attributi text COLLATE pg_catalog."default",
    campi_in_evidenza text COLLATE pg_catalog."default",
    campi_da_esportare text COLLATE pg_catalog."default",
    post_form_validation boolean NOT NULL DEFAULT false,
    post_form_validation_api character varying(255) COLLATE pg_catalog."default",
    post_form_validation_fields character varying(255) COLLATE pg_catalog."default",
    data_inizio timestamp(3) without time zone,
    data_fine timestamp(3) without time zone,
    unico_invio boolean NOT NULL DEFAULT false,
    unico_invio_per_utente boolean NOT NULL DEFAULT false,
    campi_unico_invio text COLLATE pg_catalog."default",
    numero_max_istanze integer DEFAULT 0,
    msg_sopra_soglia character varying(300) COLLATE pg_catalog."default",
    msg_extra_servizio character varying(500) COLLATE pg_catalog."default",
    evidenza boolean NOT NULL DEFAULT false,
    attivo boolean NOT NULL DEFAULT true,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(3) without time zone,
    CONSTRAINT servizi_pkey PRIMARY KEY (id),
    CONSTRAINT servizi_area_id_fkey FOREIGN KEY (area_id)
        REFERENCES public.aree (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT servizi_ufficio_id_fkey FOREIGN KEY (ufficio_id)
        REFERENCES public.uffici (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE SET NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.servizi
    OWNER to io_user;
-- Index: servizi_slug_key

DROP INDEX IF EXISTS public.servizi_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS servizi_slug_key
    ON public.servizi USING btree
    (slug COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

ALTER TABLE ONLY istanze
    ADD CONSTRAINT istanze_servizio_id_fkey FOREIGN KEY (servizio_id)
        REFERENCES public.servizi (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
    

-- SEQUENCE: public.steps_id_seq

DROP SEQUENCE IF EXISTS public.steps_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.steps_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.steps_id_seq
    OWNER TO io_user;

-- Table: public.steps

DROP TABLE IF EXISTS public.steps CASCADE;

CREATE TABLE IF NOT EXISTS public.steps
(
    id integer NOT NULL DEFAULT nextval('steps_id_seq'::regclass),
    descrizione text COLLATE pg_catalog."default" NOT NULL,
    ordine integer NOT NULL,
    attivo boolean NOT NULL DEFAULT true,
    pagamento boolean NOT NULL DEFAULT false,
    allegati boolean NOT NULL DEFAULT false,
    allegati_op boolean NOT NULL DEFAULT false,
    allegati_required boolean NOT NULL DEFAULT false,
    allegati_op_required boolean NOT NULL DEFAULT false,
    protocollo boolean NOT NULL DEFAULT false,
    tipo_protocollo tipo_protocollo,
    unita_organizzativa character varying(512) COLLATE pg_catalog."default",
    numerazione_interna boolean NOT NULL DEFAULT false,
    assegnabile_a_specifico_ufficio boolean NOT NULL DEFAULT false,
    setta_attributo boolean NOT NULL DEFAULT false,
    servizio_id integer NOT NULL,
    fase_id integer,
    CONSTRAINT steps_pkey PRIMARY KEY (id),
    CONSTRAINT steps_servizio_id_fkey FOREIGN KEY (servizio_id)
        REFERENCES public.servizi (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.steps
    OWNER to io_user;
-- Index: steps_servizio_id_ordine_attivi_key

DROP INDEX IF EXISTS public.steps_servizio_id_ordine_attivi_key;

CREATE UNIQUE INDEX IF NOT EXISTS steps_servizio_id_ordine_attivi_key
    ON public.steps USING btree
    (servizio_id ASC NULLS LAST, ordine ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE attivo = true;

ALTER TABLE ONLY istanza_attivita
    ADD CONSTRAINT istanza_attivita_step_id_fkey FOREIGN KEY (step_id)
        REFERENCES public.steps (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE RESTRICT;


-- SEQUENCE: public.ruoli_id_seq

DROP SEQUENCE IF EXISTS public.ruoli_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.ruoli_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.ruoli_id_seq
    OWNER TO io_user;
-- Table: public.ruoli

DROP TABLE IF EXISTS public.ruoli CASCADE;

CREATE TABLE IF NOT EXISTS public.ruoli
(
    id integer NOT NULL DEFAULT nextval('ruoli_id_seq'::regclass),
    nome text COLLATE pg_catalog."default" NOT NULL,
    descrizione text COLLATE pg_catalog."default",
    permessi text[] COLLATE pg_catalog."default" DEFAULT ARRAY[]::text[],
    CONSTRAINT ruoli_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.ruoli
    OWNER to io_user;
-- Index: ruoli_nome_key

DROP INDEX IF EXISTS public.ruoli_nome_key;

CREATE UNIQUE INDEX IF NOT EXISTS ruoli_nome_key
    ON public.ruoli USING btree
    (nome COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

-- Table: public.operatori_ruoli

DROP TABLE IF EXISTS public.operatori_ruoli;

CREATE TABLE IF NOT EXISTS public.operatori_ruoli
(
    operatore_id integer NOT NULL,
    ruolo_id integer NOT NULL,
    CONSTRAINT operatori_ruoli_pkey PRIMARY KEY (operatore_id, ruolo_id),
    CONSTRAINT operatori_ruoli_operatore_id_fkey FOREIGN KEY (operatore_id)
        REFERENCES public.operatori (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT operatori_ruoli_ruolo_id_fkey FOREIGN KEY (ruolo_id)
        REFERENCES public.ruoli (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.operatori_ruoli
    OWNER to io_user;

-- Table: public.operatori_servizi

DROP TABLE IF EXISTS public.operatori_servizi;

CREATE TABLE IF NOT EXISTS public.operatori_servizi
(
    operatore_id integer NOT NULL,
    servizio_id integer NOT NULL,
    CONSTRAINT operatori_servizi_pkey PRIMARY KEY (operatore_id, servizio_id),
    CONSTRAINT operatori_servizi_operatore_id_fkey FOREIGN KEY (operatore_id)
        REFERENCES public.operatori (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT operatori_servizi_servizio_id_fkey FOREIGN KEY (servizio_id)
        REFERENCES public.servizi (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.operatori_servizi
    OWNER to io_user;
-- Index: operatori_servizi_servizio_id_idx

DROP INDEX IF EXISTS public.operatori_servizi_servizio_id_idx;

CREATE INDEX IF NOT EXISTS operatori_servizi_servizio_id_idx
    ON public.operatori_servizi USING btree
    (servizio_id ASC NULLS LAST)
    TABLESPACE pg_default;

-- SEQUENCE: public.allegati_id_seq

DROP SEQUENCE IF EXISTS public.allegati_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.allegati_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.allegati_id_seq
    OWNER TO io_user;

-- Table: public.allegati

DROP TABLE IF EXISTS public.allegati;

CREATE TABLE IF NOT EXISTS public.allegati
(
    id integer NOT NULL DEFAULT nextval('allegati_id_seq'::regclass),
    nome_file character varying(512) COLLATE pg_catalog."default" NOT NULL,
    nome_hash character varying(512) COLLATE pg_catalog."default" NOT NULL,
    nome_file_richiesto character varying(512) COLLATE pg_catalog."default",
    mime_type character varying(100) COLLATE pg_catalog."default",
    inv_utente boolean NOT NULL DEFAULT false,
    visto boolean NOT NULL DEFAULT false,
    data_inserimento timestamp(3) without time zone,
    attivita_id integer NOT NULL,
    CONSTRAINT allegati_pkey PRIMARY KEY (id),
    CONSTRAINT allegati_attivita_id_fkey FOREIGN KEY (attivita_id)
        REFERENCES public.istanza_attivita (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.allegati
    OWNER to io_user;
    

-- SEQUENCE: public.allegati_richiesti_id_seq

DROP SEQUENCE IF EXISTS public.allegati_richiesti_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.allegati_richiesti_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.allegati_richiesti_id_seq
    OWNER TO io_user;

-- Table: public.allegati_richiesti

DROP TABLE IF EXISTS public.allegati_richiesti;

CREATE TABLE IF NOT EXISTS public.allegati_richiesti
(
    id integer NOT NULL DEFAULT nextval('allegati_richiesti_id_seq'::regclass),
    nome_allegato_richiesto character varying(512) COLLATE pg_catalog."default" NOT NULL,
    obbligatorio boolean NOT NULL DEFAULT false,
    interno boolean NOT NULL DEFAULT false,
    soggetto soggetto,
    step_id integer,
    CONSTRAINT allegati_richiesti_pkey PRIMARY KEY (id),
    CONSTRAINT allegati_richiesti_step_id_fkey FOREIGN KEY (step_id)
        REFERENCES public.steps (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.allegati_richiesti
    OWNER to io_user;

ALTER SEQUENCE public.allegati_richiesti_id_seq
    OWNED BY public.allegati_richiesti.id;


-- SEQUENCE: public.allegati_risposta_id_seq

DROP SEQUENCE IF EXISTS public.allegati_risposta_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.allegati_risposta_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;


ALTER SEQUENCE public.allegati_risposta_id_seq
    OWNER TO io_user;

          
-- SEQUENCE: public.comunicazioni_id_seq

DROP SEQUENCE IF EXISTS public.comunicazioni_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.comunicazioni_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.comunicazioni_id_seq
    OWNER TO io_user;

-- Table: public.comunicazioni

DROP TABLE IF EXISTS public.comunicazioni CASCADE;

CREATE TABLE IF NOT EXISTS public.comunicazioni
(
    id integer NOT NULL DEFAULT nextval('comunicazioni_id_seq'::regclass),
    testo text COLLATE pg_catalog."default" NOT NULL,
    richiede_risposta boolean NOT NULL DEFAULT false,
    allegati_richiesti text COLLATE pg_catalog."default",
    data_creazione timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    istanza_id integer NOT NULL,
    operatore_id integer,
    letta_da_cittadino boolean NOT NULL DEFAULT false,
    CONSTRAINT comunicazioni_pkey PRIMARY KEY (id),
    CONSTRAINT comunicazioni_istanza_id_fkey FOREIGN KEY (istanza_id)
        REFERENCES public.istanze (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT comunicazioni_operatore_id_fkey FOREIGN KEY (operatore_id)
        REFERENCES public.operatori (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE SET NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.comunicazioni
    OWNER to io_user;
-- Index: comunicazioni_istanza_id_idx

DROP INDEX IF EXISTS public.comunicazioni_istanza_id_idx;

CREATE INDEX IF NOT EXISTS comunicazioni_istanza_id_idx
    ON public.comunicazioni USING btree
    (istanza_id ASC NULLS LAST)
    TABLESPACE pg_default;
    
ALTER SEQUENCE public.comunicazioni_id_seq
    OWNED BY public.comunicazioni.id;

-- SEQUENCE: public.email_config_id_seq

DROP SEQUENCE IF EXISTS public.email_config_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.email_config_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.email_config_id_seq
    OWNER TO io_user;

-- Table: public.email_config

DROP TABLE IF EXISTS public.email_config;

CREATE TABLE IF NOT EXISTS public.email_config
(
    id integer NOT NULL DEFAULT nextval('email_config_id_seq'::regclass),
    attivo boolean NOT NULL DEFAULT false,
    provider text COLLATE pg_catalog."default" NOT NULL DEFAULT 'smtp'::text,
    smtp_host character varying(100) COLLATE pg_catalog."default",
    smtp_port integer,
    smtp_secure boolean NOT NULL DEFAULT false,
    smtp_user character varying(50) COLLATE pg_catalog."default",
    smtp_password character varying(64) COLLATE pg_catalog."default",
    smtp_from_email character varying(100) COLLATE pg_catalog."default",
    smtp_from_name character varying(100) COLLATE pg_catalog."default",
    o365_tenant_id character varying(64) COLLATE pg_catalog."default",
    o365_client_id character varying(64) COLLATE pg_catalog."default",
    o365_client_secret character varying(64) COLLATE pg_catalog."default",
    o365_sender_email character varying(100) COLLATE pg_catalog."default",
    created_at timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT email_config_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.email_config
    OWNER to io_user;
    
ALTER SEQUENCE public.email_config_id_seq
    OWNED BY public.email_config.id;


-- SEQUENCE: public.enti_id_seq

DROP SEQUENCE IF EXISTS public.enti_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.enti_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.enti_id_seq
    OWNER TO io_user;

-- Table: public.enti

DROP TABLE IF EXISTS public.enti;

CREATE TABLE IF NOT EXISTS public.enti
(
    id integer NOT NULL DEFAULT nextval('enti_id_seq'::regclass),
    nome character varying(255) COLLATE pg_catalog."default" NOT NULL,
    descrizione character varying(255) COLLATE pg_catalog."default",
    sede character varying(255) COLLATE pg_catalog."default",
    codice character varying(255) COLLATE pg_catalog."default",
    indirizzo character varying(255) COLLATE pg_catalog."default",
    telefono character varying(255) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    pec character varying(255) COLLATE pg_catalog."default",
    logo character varying(255) COLLATE pg_catalog."default",
    attivo boolean NOT NULL DEFAULT true,
    created_at timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT enti_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.enti
    OWNER to io_user;
    

-- SEQUENCE: public.fasi_id_seq

DROP SEQUENCE IF EXISTS public.fasi_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.fasi_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.fasi_id_seq
    OWNER TO io_user;

-- Table: public.fasi

DROP TABLE IF EXISTS public.fasi CASCADE;

CREATE TABLE IF NOT EXISTS public.fasi
(
    id integer NOT NULL DEFAULT nextval('fasi_id_seq'::regclass),
    nome character varying(255) COLLATE pg_catalog."default" NOT NULL,
    ordine integer NOT NULL,
    servizio_id integer NOT NULL,
    ufficio_id integer NOT NULL,
    CONSTRAINT fasi_pkey PRIMARY KEY (id),
    CONSTRAINT fasi_servizio_id_fkey FOREIGN KEY (servizio_id)
        REFERENCES public.servizi (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fasi_ufficio_id_fkey FOREIGN KEY (ufficio_id)
        REFERENCES public.uffici (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE RESTRICT
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.fasi
    OWNER to io_user;

ALTER TABLE ONLY public.istanze
    ADD CONSTRAINT istanze_fase_corrente_id_fkey FOREIGN KEY (fase_corrente_id)
        REFERENCES public.fasi (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE SET NULL;
ALTER TABLE ONLY public.steps
	ADD CONSTRAINT steps_fase_id_fkey FOREIGN KEY (fase_id)
        REFERENCES public.fasi (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    
-- SEQUENCE: public.istanza_fasi_id_seq

DROP SEQUENCE IF EXISTS public.istanza_fasi_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.istanza_fasi_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.istanza_fasi_id_seq
    OWNER TO io_user;
    
-- Table: public.istanza_fasi

DROP TABLE IF EXISTS public.istanza_fasi;

CREATE TABLE IF NOT EXISTS public.istanza_fasi
(
    id integer NOT NULL DEFAULT nextval('istanza_fasi_id_seq'::regclass),
    data_inizio timestamp(3) without time zone NOT NULL,
    data_completamento timestamp(3) without time zone,
    istanza_id integer NOT NULL,
    fase_id integer NOT NULL,
    operatore_completamento_id integer,
    direzione direzione NOT NULL DEFAULT 'AVANZAMENTO'::direzione,
    CONSTRAINT istanza_fasi_pkey PRIMARY KEY (id),
    CONSTRAINT istanza_fasi_fase_id_fkey FOREIGN KEY (fase_id)
        REFERENCES public.fasi (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT istanza_fasi_istanza_id_fkey FOREIGN KEY (istanza_id)
        REFERENCES public.istanze (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT istanza_fasi_operatore_completamento_id_fkey FOREIGN KEY (operatore_completamento_id)
        REFERENCES public.operatori (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE SET NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.istanza_fasi
    OWNER to io_user;
-- Index: istanza_fasi_istanza_id_idx

DROP INDEX IF EXISTS public.istanza_fasi_istanza_id_idx;

CREATE INDEX IF NOT EXISTS istanza_fasi_istanza_id_idx
    ON public.istanza_fasi USING btree
    (istanza_id ASC NULLS LAST)
    TABLESPACE pg_default;
    
    
-- SEQUENCE: public.pagamenti_id_seq

DROP SEQUENCE IF EXISTS public.pagamenti_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.pagamenti_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.pagamenti_id_seq
    OWNER TO io_user;

-- Table: public.pagamenti

DROP TABLE IF EXISTS public.pagamenti;

CREATE TABLE IF NOT EXISTS public.pagamenti
(
    id integer NOT NULL DEFAULT nextval('pagamenti_id_seq'::regclass),
    importo double precision,
    importo_variabile boolean NOT NULL DEFAULT false,
    obbligatorio boolean NOT NULL DEFAULT false,
    tipologia_pagamento text COLLATE pg_catalog."default",
    causale text COLLATE pg_catalog."default",
    causale_variabile boolean NOT NULL DEFAULT false,
    codice_tributo character varying(30) COLLATE pg_catalog."default",
    descrizione_tributo character varying(512) COLLATE pg_catalog."default",
    step_id integer NOT NULL,
    CONSTRAINT pagamenti_pkey PRIMARY KEY (id),
    CONSTRAINT pagamenti_step_id_fkey FOREIGN KEY (step_id)
        REFERENCES public.steps (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.pagamenti
    OWNER to io_user;
-- Index: pagamenti_step_id_key

DROP INDEX IF EXISTS public.pagamenti_step_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS pagamenti_step_id_key
    ON public.pagamenti USING btree
    (step_id ASC NULLS LAST)
    TABLESPACE pg_default;
    
ALTER SEQUENCE public.pagamenti_id_seq
    OWNED BY public.pagamenti.id;

    
-- SEQUENCE: public.pagamenti_attesi_id_seq

DROP SEQUENCE IF EXISTS public.pagamenti_attesi_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.pagamenti_attesi_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.pagamenti_attesi_id_seq
    OWNER TO io_user;    
    
    
-- Table: public.pagamenti_attesi

DROP TABLE IF EXISTS public.pagamenti_attesi;

CREATE TABLE IF NOT EXISTS public.pagamenti_attesi
(
    id integer NOT NULL DEFAULT nextval('pagamenti_attesi_id_seq'::regclass),
    iuv character varying(100) COLLATE pg_catalog."default",
    numero_documento character varying(30) COLLATE pg_catalog."default",
    importo_totale double precision NOT NULL,
    stato character varying(3) COLLATE pg_catalog."default",
    data_emissione timestamp(3) without time zone,
    data_scadenza timestamp(3) without time zone,
    data_operazione timestamp(3) without time zone,
    data_ricevuta timestamp(3) without time zone,
    pagante_codice_fiscale character varying(16) COLLATE pg_catalog."default",
    pagante character varying(50) COLLATE pg_catalog."default",
    pagante_email character varying(50) COLLATE pg_catalog."default",
    causale character varying(100) COLLATE pg_catalog."default",
    attivita_id integer NOT NULL,
    CONSTRAINT pagamenti_attesi_pkey PRIMARY KEY (id),
    CONSTRAINT pagamenti_attesi_attivita_id_fkey FOREIGN KEY (attivita_id)
        REFERENCES public.istanza_attivita (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.pagamenti_attesi
    OWNER to io_user;
-- Index: pagamenti_attesi_attivita_id_key

DROP INDEX IF EXISTS public.pagamenti_attesi_attivita_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS pagamenti_attesi_attivita_id_key
    ON public.pagamenti_attesi USING btree
    (attivita_id ASC NULLS LAST)
    TABLESPACE pg_default;
    

-- SEQUENCE: public.protocollo_emergenza_id_seq

DROP SEQUENCE IF EXISTS public.protocollo_emergenza_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.protocollo_emergenza_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.protocollo_emergenza_id_seq
    OWNER TO io_user;


-- Table: public.protocollo_emergenza

DROP TABLE IF EXISTS public.protocollo_emergenza;

CREATE TABLE IF NOT EXISTS public.protocollo_emergenza
(
    id integer NOT NULL DEFAULT nextval('protocollo_emergenza_id_seq'::regclass),
    anno integer NOT NULL DEFAULT 0,
    progressivo integer NOT NULL DEFAULT 0,
    data timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo text COLLATE pg_catalog."default" NOT NULL,
    rettificato boolean NOT NULL DEFAULT false,
    istanza_id integer,
    CONSTRAINT protocollo_emergenza_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.protocollo_emergenza
    OWNER to io_user;
    
-- Table: public.protocollo_emergenza_counters

DROP TABLE IF EXISTS public.protocollo_emergenza_counters;

CREATE TABLE IF NOT EXISTS public.protocollo_emergenza_counters
(
    anno integer NOT NULL,
    progressivo integer NOT NULL DEFAULT 0,
    CONSTRAINT protocollo_emergenza_counters_pkey PRIMARY KEY (anno)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.protocollo_emergenza_counters
    OWNER to io_user;
    
-- SEQUENCE: public.ricevute_id_seq

DROP SEQUENCE IF EXISTS public.ricevute_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.ricevute_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.ricevute_id_seq
    OWNER TO io_user;    

-- Table: public.ricevute

DROP TABLE IF EXISTS public.ricevute;

CREATE TABLE IF NOT EXISTS public.ricevute
(
    id integer NOT NULL DEFAULT nextval('ricevute_id_seq'::regclass),
    servizio_id integer NOT NULL,
    richiesta_art18 boolean NOT NULL DEFAULT false,
    unita_organizzativa_competente text COLLATE pg_catalog."default",
    ufficio_competente text COLLATE pg_catalog."default",
    responsabile_procedimento text COLLATE pg_catalog."default",
    durata_massima_procedimento integer,
    responsabile_provvedimento_finale text COLLATE pg_catalog."default",
    persona_potere_sostitutivo text COLLATE pg_catalog."default",
    url_servizio_web text COLLATE pg_catalog."default",
    ufficio_ricevimento text COLLATE pg_catalog."default",
    CONSTRAINT ricevute_pkey PRIMARY KEY (id),
    CONSTRAINT ricevute_servizio_id_fkey FOREIGN KEY (servizio_id)
        REFERENCES public.servizi (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.ricevute
    OWNER to io_user;
-- Index: ricevute_servizio_id_key

DROP INDEX IF EXISTS public.ricevute_servizio_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS ricevute_servizio_id_key
    ON public.ricevute USING btree
    (servizio_id ASC NULLS LAST)
    TABLESPACE pg_default;
    
-- SEQUENCE: public.risposte_comunicazioni_id_seq

DROP SEQUENCE IF EXISTS public.risposte_comunicazioni_id_seq  CASCADE;

CREATE SEQUENCE IF NOT EXISTS public.risposte_comunicazioni_id_seq
    INCREMENT 1
    START 1
    MINVALUE 1
    MAXVALUE 2147483647
    CACHE 1;

ALTER SEQUENCE public.risposte_comunicazioni_id_seq
    OWNER TO io_user;    
    
-- Table: public.risposte_comunicazioni

DROP TABLE IF EXISTS public.risposte_comunicazioni CASCADE;

CREATE TABLE IF NOT EXISTS public.risposte_comunicazioni
(
    id integer NOT NULL DEFAULT nextval('risposte_comunicazioni_id_seq'::regclass),
    testo text COLLATE pg_catalog."default",
    created_at timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comunicazione_id integer NOT NULL,
    letta_da_operatore boolean NOT NULL DEFAULT false,
    CONSTRAINT risposte_comunicazioni_pkey PRIMARY KEY (id),
    CONSTRAINT risposte_comunicazioni_comunicazione_id_fkey FOREIGN KEY (comunicazione_id)
        REFERENCES public.comunicazioni (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.risposte_comunicazioni
    OWNER to io_user;
-- Index: risposte_comunicazioni_comunicazione_id_key

DROP INDEX IF EXISTS public.risposte_comunicazioni_comunicazione_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS risposte_comunicazioni_comunicazione_id_key
    ON public.risposte_comunicazioni USING btree
    (comunicazione_id ASC NULLS LAST)
    TABLESPACE pg_default;

-- Table: public.allegati_risposta

DROP TABLE IF EXISTS public.allegati_risposta;

CREATE TABLE IF NOT EXISTS public.allegati_risposta
(
    id integer NOT NULL DEFAULT nextval('allegati_risposta_id_seq'::regclass),
    nome_file character varying(512) COLLATE pg_catalog."default" NOT NULL,
    nome_hash character varying(512) COLLATE pg_catalog."default" NOT NULL,
    mime_type character varying(50) COLLATE pg_catalog."default",
    risposta_id integer NOT NULL,
    nome_file_richiesto character varying(512) COLLATE pg_catalog."default",
    CONSTRAINT allegati_risposta_pkey PRIMARY KEY (id),
    CONSTRAINT allegati_risposta_risposta_id_fkey FOREIGN KEY (risposta_id)
        REFERENCES public.risposte_comunicazioni (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.allegati_risposta
    OWNER to io_user;

