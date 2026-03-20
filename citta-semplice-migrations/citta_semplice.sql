--
-- PostgreSQL database dump
--

\restrict gGpTfm3XbiNPhl9g0Qf4MmanjZZkOhhnGKOlHnCcfoctAqOzek9yTpzEmZGf0Hl

-- Dumped from database version 13.3
-- Dumped by pg_dump version 18.1

-- Started on 2026-03-20 13:51:47

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 232 (class 1259 OID 1215581)
-- Name: allegati; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.allegati (
    id integer NOT NULL,
    nome_file text NOT NULL,
    nome_hash text NOT NULL,
    nome_file_richiesto text,
    mime_type text,
    inv_utente boolean DEFAULT false NOT NULL,
    visto boolean DEFAULT false NOT NULL,
    data_inserimento timestamp(3) without time zone,
    workflow_id integer NOT NULL
);


ALTER TABLE public.allegati OWNER TO io_user;

--
-- TOC entry 231 (class 1259 OID 1215579)
-- Name: allegati_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.allegati_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.allegati_id_seq OWNER TO io_user;

--
-- TOC entry 3432 (class 0 OID 0)
-- Dependencies: 231
-- Name: allegati_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.allegati_id_seq OWNED BY public.allegati.id;


--
-- TOC entry 222 (class 1259 OID 1215508)
-- Name: allegati_richiesti; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.allegati_richiesti (
    id integer NOT NULL,
    nome_allegato_richiesto text NOT NULL,
    obbligatorio boolean DEFAULT false NOT NULL,
    interno boolean DEFAULT false NOT NULL,
    soggetto text,
    step_id integer,
    notifica_id integer
);


ALTER TABLE public.allegati_richiesti OWNER TO io_user;

--
-- TOC entry 221 (class 1259 OID 1215506)
-- Name: allegati_richiesti_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.allegati_richiesti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.allegati_richiesti_id_seq OWNER TO io_user;

--
-- TOC entry 3433 (class 0 OID 0)
-- Dependencies: 221
-- Name: allegati_richiesti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.allegati_richiesti_id_seq OWNED BY public.allegati_richiesti.id;


--
-- TOC entry 256 (class 1259 OID 1215905)
-- Name: allegati_risposta; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.allegati_risposta (
    id integer NOT NULL,
    nome_file text NOT NULL,
    nome_hash text NOT NULL,
    mime_type text,
    risposta_id integer NOT NULL
);


ALTER TABLE public.allegati_risposta OWNER TO io_user;

--
-- TOC entry 255 (class 1259 OID 1215903)
-- Name: allegati_risposta_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.allegati_risposta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.allegati_risposta_id_seq OWNER TO io_user;

--
-- TOC entry 3434 (class 0 OID 0)
-- Dependencies: 255
-- Name: allegati_risposta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.allegati_risposta_id_seq OWNED BY public.allegati_risposta.id;


--
-- TOC entry 210 (class 1259 OID 1215421)
-- Name: aree; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.aree (
    id integer NOT NULL,
    titolo text NOT NULL,
    descrizione text,
    icona text,
    ordine integer DEFAULT 0 NOT NULL,
    attiva boolean DEFAULT true NOT NULL,
    slug character varying(255) DEFAULT '/'::character varying NOT NULL,
    privata boolean DEFAULT false NOT NULL
);


ALTER TABLE public.aree OWNER TO io_user;

--
-- TOC entry 209 (class 1259 OID 1215419)
-- Name: aree_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.aree_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.aree_id_seq OWNER TO io_user;

--
-- TOC entry 3435 (class 0 OID 0)
-- Dependencies: 209
-- Name: aree_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.aree_id_seq OWNED BY public.aree.id;


--
-- TOC entry 252 (class 1259 OID 1215881)
-- Name: comunicazioni; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.comunicazioni (
    id integer NOT NULL,
    testo text NOT NULL,
    richiede_risposta boolean DEFAULT false NOT NULL,
    allegati_richiesti text,
    workflow_id integer NOT NULL
);


ALTER TABLE public.comunicazioni OWNER TO io_user;

--
-- TOC entry 251 (class 1259 OID 1215879)
-- Name: comunicazioni_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.comunicazioni_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comunicazioni_id_seq OWNER TO io_user;

--
-- TOC entry 3436 (class 0 OID 0)
-- Dependencies: 251
-- Name: comunicazioni_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.comunicazioni_id_seq OWNED BY public.comunicazioni.id;


--
-- TOC entry 240 (class 1259 OID 1215631)
-- Name: customer_satisfaction; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.customer_satisfaction (
    id integer NOT NULL,
    green integer DEFAULT 0 NOT NULL,
    yellow integer DEFAULT 0 NOT NULL,
    red integer DEFAULT 0 NOT NULL,
    gray integer DEFAULT 0 NOT NULL,
    servizio_id integer NOT NULL
);


ALTER TABLE public.customer_satisfaction OWNER TO io_user;

--
-- TOC entry 239 (class 1259 OID 1215629)
-- Name: customer_satisfaction_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.customer_satisfaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_satisfaction_id_seq OWNER TO io_user;

--
-- TOC entry 3437 (class 0 OID 0)
-- Dependencies: 239
-- Name: customer_satisfaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.customer_satisfaction_id_seq OWNED BY public.customer_satisfaction.id;


--
-- TOC entry 250 (class 1259 OID 1215687)
-- Name: email_config; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.email_config (
    id integer NOT NULL,
    attivo boolean DEFAULT false NOT NULL,
    provider text DEFAULT 'smtp'::text NOT NULL,
    smtp_host text,
    smtp_port integer,
    smtp_secure boolean DEFAULT false NOT NULL,
    smtp_user text,
    smtp_password text,
    smtp_from_email text,
    smtp_from_name text,
    o365_tenant_id text,
    o365_client_id text,
    o365_client_secret text,
    o365_sender_email text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.email_config OWNER TO io_user;

--
-- TOC entry 249 (class 1259 OID 1215685)
-- Name: email_config_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.email_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_config_id_seq OWNER TO io_user;

--
-- TOC entry 3438 (class 0 OID 0)
-- Dependencies: 249
-- Name: email_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.email_config_id_seq OWNED BY public.email_config.id;


--
-- TOC entry 208 (class 1259 OID 1215408)
-- Name: enti; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.enti (
    id integer NOT NULL,
    nome text NOT NULL,
    descrizione text,
    codice text,
    indirizzo text,
    telefono text,
    email text,
    pec text,
    logo text,
    attivo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.enti OWNER TO io_user;

--
-- TOC entry 207 (class 1259 OID 1215406)
-- Name: enti_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.enti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.enti_id_seq OWNER TO io_user;

--
-- TOC entry 3439 (class 0 OID 0)
-- Dependencies: 207
-- Name: enti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.enti_id_seq OWNED BY public.enti.id;


--
-- TOC entry 226 (class 1259 OID 1215533)
-- Name: istanze; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.istanze (
    id integer NOT NULL,
    dati text,
    dati_in_evidenza text,
    dati_responso text,
    municipalita text,
    conclusa boolean DEFAULT false NOT NULL,
    respinta boolean DEFAULT false NOT NULL,
    proto_numero character varying(10),
    proto_data timestamp(3) without time zone,
    proto_finale_numero character varying(10),
    proto_finale_data timestamp(3) without time zone,
    data_invio timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    utente_id integer NOT NULL,
    servizio_id integer NOT NULL,
    last_step_id integer,
    active_step integer,
    in_bozza boolean DEFAULT false NOT NULL
);


ALTER TABLE public.istanze OWNER TO io_user;

--
-- TOC entry 225 (class 1259 OID 1215531)
-- Name: istanze_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.istanze_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.istanze_id_seq OWNER TO io_user;

--
-- TOC entry 3440 (class 0 OID 0)
-- Dependencies: 225
-- Name: istanze_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.istanze_id_seq OWNED BY public.istanze.id;


--
-- TOC entry 220 (class 1259 OID 1215496)
-- Name: notifiche; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.notifiche (
    id integer NOT NULL,
    descrizione text NOT NULL,
    allegati boolean DEFAULT false NOT NULL
);


ALTER TABLE public.notifiche OWNER TO io_user;

--
-- TOC entry 219 (class 1259 OID 1215494)
-- Name: notifiche_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.notifiche_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifiche_id_seq OWNER TO io_user;

--
-- TOC entry 3441 (class 0 OID 0)
-- Dependencies: 219
-- Name: notifiche_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.notifiche_id_seq OWNED BY public.notifiche.id;


--
-- TOC entry 215 (class 1259 OID 1215464)
-- Name: operatore_servizi; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.operatore_servizi (
    operatore_id integer NOT NULL,
    servizio_id integer NOT NULL
);


ALTER TABLE public.operatore_servizi OWNER TO io_user;

--
-- TOC entry 201 (class 1259 OID 1215367)
-- Name: operatori; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.operatori (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    nome text NOT NULL,
    cognome text NOT NULL,
    user_name text NOT NULL,
    telefono text,
    attivo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.operatori OWNER TO io_user;

--
-- TOC entry 200 (class 1259 OID 1215365)
-- Name: operatori_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.operatori_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.operatori_id_seq OWNER TO io_user;

--
-- TOC entry 3442 (class 0 OID 0)
-- Dependencies: 200
-- Name: operatori_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.operatori_id_seq OWNED BY public.operatori.id;


--
-- TOC entry 204 (class 1259 OID 1215390)
-- Name: operatori_ruoli; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.operatori_ruoli (
    operatore_id integer NOT NULL,
    ruolo_id integer NOT NULL
);


ALTER TABLE public.operatori_ruoli OWNER TO io_user;

--
-- TOC entry 236 (class 1259 OID 1215606)
-- Name: pagamenti; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.pagamenti (
    id integer NOT NULL,
    importo double precision,
    importo_variabile boolean DEFAULT false NOT NULL,
    obbligatorio boolean DEFAULT false NOT NULL,
    tipologia_pagamento text,
    causale text,
    causale_variabile boolean DEFAULT false NOT NULL,
    step_id integer NOT NULL,
    codice_tributo_id integer
);


ALTER TABLE public.pagamenti OWNER TO io_user;

--
-- TOC entry 238 (class 1259 OID 1215620)
-- Name: pagamenti_effettuati; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.pagamenti_effettuati (
    id integer NOT NULL,
    iuv text,
    importo_totale double precision NOT NULL,
    stato text,
    data_operazione timestamp(3) without time zone,
    data_ricevuta timestamp(3) without time zone,
    cf_utente text,
    nome_utente text,
    cognome_utente text,
    email_utente text,
    causale text,
    workflow_id integer NOT NULL
);


ALTER TABLE public.pagamenti_effettuati OWNER TO io_user;

--
-- TOC entry 237 (class 1259 OID 1215618)
-- Name: pagamenti_effettuati_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.pagamenti_effettuati_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagamenti_effettuati_id_seq OWNER TO io_user;

--
-- TOC entry 3443 (class 0 OID 0)
-- Dependencies: 237
-- Name: pagamenti_effettuati_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.pagamenti_effettuati_id_seq OWNED BY public.pagamenti_effettuati.id;


--
-- TOC entry 235 (class 1259 OID 1215604)
-- Name: pagamenti_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.pagamenti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagamenti_id_seq OWNER TO io_user;

--
-- TOC entry 3444 (class 0 OID 0)
-- Dependencies: 235
-- Name: pagamenti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.pagamenti_id_seq OWNED BY public.pagamenti.id;


--
-- TOC entry 244 (class 1259 OID 1215654)
-- Name: protocollo_emergenza; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.protocollo_emergenza (
    id integer NOT NULL,
    data timestamp(3) without time zone NOT NULL,
    tipo text NOT NULL,
    rettificato boolean DEFAULT false NOT NULL,
    istanza_id integer
);


ALTER TABLE public.protocollo_emergenza OWNER TO io_user;

--
-- TOC entry 243 (class 1259 OID 1215652)
-- Name: protocollo_emergenza_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.protocollo_emergenza_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.protocollo_emergenza_id_seq OWNER TO io_user;

--
-- TOC entry 3445 (class 0 OID 0)
-- Dependencies: 243
-- Name: protocollo_emergenza_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.protocollo_emergenza_id_seq OWNED BY public.protocollo_emergenza.id;


--
-- TOC entry 242 (class 1259 OID 1215643)
-- Name: ricevute; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.ricevute (
    id integer NOT NULL,
    intestazione text,
    corpo text,
    footer text,
    modulo_id integer NOT NULL
);


ALTER TABLE public.ricevute OWNER TO io_user;

--
-- TOC entry 241 (class 1259 OID 1215641)
-- Name: ricevute_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.ricevute_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ricevute_id_seq OWNER TO io_user;

--
-- TOC entry 3446 (class 0 OID 0)
-- Dependencies: 241
-- Name: ricevute_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.ricevute_id_seq OWNED BY public.ricevute.id;


--
-- TOC entry 254 (class 1259 OID 1215893)
-- Name: risposte_comunicazioni; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.risposte_comunicazioni (
    id integer NOT NULL,
    testo text,
    data_risposta timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    comunicazione_id integer NOT NULL
);


ALTER TABLE public.risposte_comunicazioni OWNER TO io_user;

--
-- TOC entry 253 (class 1259 OID 1215891)
-- Name: risposte_comunicazioni_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.risposte_comunicazioni_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.risposte_comunicazioni_id_seq OWNER TO io_user;

--
-- TOC entry 3447 (class 0 OID 0)
-- Dependencies: 253
-- Name: risposte_comunicazioni_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.risposte_comunicazioni_id_seq OWNED BY public.risposte_comunicazioni.id;


--
-- TOC entry 203 (class 1259 OID 1215380)
-- Name: ruoli; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.ruoli (
    id integer NOT NULL,
    nome text NOT NULL,
    descrizione text,
    permessi text[] DEFAULT ARRAY[]::text[]
);


ALTER TABLE public.ruoli OWNER TO io_user;

--
-- TOC entry 202 (class 1259 OID 1215378)
-- Name: ruoli_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.ruoli_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ruoli_id_seq OWNER TO io_user;

--
-- TOC entry 3448 (class 0 OID 0)
-- Dependencies: 202
-- Name: ruoli_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.ruoli_id_seq OWNED BY public.ruoli.id;


--
-- TOC entry 206 (class 1259 OID 1215397)
-- Name: ruoli_user; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.ruoli_user (
    id integer NOT NULL,
    nome text NOT NULL,
    descrizione text
);


ALTER TABLE public.ruoli_user OWNER TO io_user;

--
-- TOC entry 205 (class 1259 OID 1215395)
-- Name: ruoli_user_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.ruoli_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ruoli_user_id_seq OWNER TO io_user;

--
-- TOC entry 3449 (class 0 OID 0)
-- Dependencies: 205
-- Name: ruoli_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.ruoli_user_id_seq OWNED BY public.ruoli_user.id;


--
-- TOC entry 212 (class 1259 OID 1215435)
-- Name: servizi; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.servizi (
    id integer NOT NULL,
    titolo character varying(255) NOT NULL,
    sotto_titolo character varying(255),
    descrizione text,
    come_fare text,
    cosa_serve text,
    altre_info text,
    contatti text,
    slug character varying(255) DEFAULT '/'::character varying NOT NULL,
    icona character varying(255),
    ordine integer DEFAULT 0 NOT NULL,
    attivo boolean DEFAULT true NOT NULL,
    area_id integer NOT NULL,
    modulo_tipo character varying(4) DEFAULT 'HTML'::character varying NOT NULL,
    attributi text,
    modulo_corpo text,
    post_form_validation boolean DEFAULT false NOT NULL,
    post_form_validation_api character varying(255),
    post_form_validation_fields character varying(255),
    ufficio_id integer,
    data_inizio timestamp(3) without time zone,
    data_fine timestamp(3) without time zone,
    unico_invio boolean DEFAULT false NOT NULL,
    unico_invio_per_utente boolean DEFAULT false NOT NULL,
    campi_unico_invio text,
    numero_max_istanze integer DEFAULT 0,
    msg_sopra_soglia character varying(300),
    msg_extra_servizio character varying(500),
    campi_in_evidenza text,
    campi_da_esportare text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(3) without time zone,
    evidenza boolean DEFAULT false NOT NULL
);


ALTER TABLE public.servizi OWNER TO io_user;

--
-- TOC entry 211 (class 1259 OID 1215433)
-- Name: servizi_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.servizi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servizi_id_seq OWNER TO io_user;

--
-- TOC entry 3450 (class 0 OID 0)
-- Dependencies: 211
-- Name: servizi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.servizi_id_seq OWNED BY public.servizi.id;


--
-- TOC entry 216 (class 1259 OID 1215469)
-- Name: servizi_ruoli_user; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.servizi_ruoli_user (
    servizio_id integer NOT NULL,
    ruolo_user_id integer NOT NULL
);


ALTER TABLE public.servizi_ruoli_user OWNER TO io_user;

--
-- TOC entry 246 (class 1259 OID 1215666)
-- Name: statistiche_giornaliere; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.statistiche_giornaliere (
    id integer NOT NULL,
    data date NOT NULL,
    istanze_inviate integer DEFAULT 0 NOT NULL,
    istanze_concluse integer DEFAULT 0 NOT NULL,
    istanze_respinte integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.statistiche_giornaliere OWNER TO io_user;

--
-- TOC entry 245 (class 1259 OID 1215664)
-- Name: statistiche_giornaliere_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.statistiche_giornaliere_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.statistiche_giornaliere_id_seq OWNER TO io_user;

--
-- TOC entry 3451 (class 0 OID 0)
-- Dependencies: 245
-- Name: statistiche_giornaliere_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.statistiche_giornaliere_id_seq OWNED BY public.statistiche_giornaliere.id;


--
-- TOC entry 248 (class 1259 OID 1215677)
-- Name: statistiche_pagamenti; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.statistiche_pagamenti (
    id integer NOT NULL,
    data date NOT NULL,
    numero_transazioni integer DEFAULT 0 NOT NULL,
    importo_totale double precision DEFAULT 0 NOT NULL
);


ALTER TABLE public.statistiche_pagamenti OWNER TO io_user;

--
-- TOC entry 247 (class 1259 OID 1215675)
-- Name: statistiche_pagamenti_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.statistiche_pagamenti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.statistiche_pagamenti_id_seq OWNER TO io_user;

--
-- TOC entry 3452 (class 0 OID 0)
-- Dependencies: 247
-- Name: statistiche_pagamenti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.statistiche_pagamenti_id_seq OWNED BY public.statistiche_pagamenti.id;


--
-- TOC entry 228 (class 1259 OID 1215559)
-- Name: status; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.status (
    id integer NOT NULL,
    stato text NOT NULL,
    ordine integer NOT NULL,
    icon text
);


ALTER TABLE public.status OWNER TO io_user;

--
-- TOC entry 227 (class 1259 OID 1215557)
-- Name: status_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.status_id_seq OWNER TO io_user;

--
-- TOC entry 3453 (class 0 OID 0)
-- Dependencies: 227
-- Name: status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.status_id_seq OWNED BY public.status.id;


--
-- TOC entry 218 (class 1259 OID 1215476)
-- Name: steps; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.steps (
    id integer NOT NULL,
    descrizione text NOT NULL,
    ordine integer NOT NULL,
    attivo boolean DEFAULT true NOT NULL,
    pagamento boolean DEFAULT false NOT NULL,
    allegati boolean DEFAULT false NOT NULL,
    allegati_op boolean DEFAULT false NOT NULL,
    allegati_required boolean DEFAULT false NOT NULL,
    allegati_op_required boolean DEFAULT false NOT NULL,
    allegati_richiesti text,
    allegati_op_richiesti text,
    protocollo boolean DEFAULT false NOT NULL,
    tipo_protocollo text,
    unita_organizzativa text,
    assegnabile_a_specifico_ufficio boolean DEFAULT false NOT NULL,
    setta_attributo boolean DEFAULT false NOT NULL,
    servizio_id integer NOT NULL,
    numerazione_interna boolean DEFAULT false NOT NULL
);


ALTER TABLE public.steps OWNER TO io_user;

--
-- TOC entry 217 (class 1259 OID 1215474)
-- Name: steps_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.steps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.steps_id_seq OWNER TO io_user;

--
-- TOC entry 3454 (class 0 OID 0)
-- Dependencies: 217
-- Name: steps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.steps_id_seq OWNED BY public.steps.id;


--
-- TOC entry 234 (class 1259 OID 1215594)
-- Name: tributi; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.tributi (
    id integer NOT NULL,
    codice text NOT NULL,
    descrizione text,
    attivo boolean DEFAULT true NOT NULL
);


ALTER TABLE public.tributi OWNER TO io_user;

--
-- TOC entry 233 (class 1259 OID 1215592)
-- Name: tributi_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.tributi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tributi_id_seq OWNER TO io_user;

--
-- TOC entry 3455 (class 0 OID 0)
-- Dependencies: 233
-- Name: tributi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.tributi_id_seq OWNED BY public.tributi.id;


--
-- TOC entry 214 (class 1259 OID 1215454)
-- Name: uffici; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.uffici (
    id integer NOT NULL,
    nome text NOT NULL,
    descrizione text,
    email text,
    telefono text,
    indirizzo text,
    attivo boolean DEFAULT true NOT NULL
);


ALTER TABLE public.uffici OWNER TO io_user;

--
-- TOC entry 213 (class 1259 OID 1215452)
-- Name: uffici_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.uffici_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.uffici_id_seq OWNER TO io_user;

--
-- TOC entry 3456 (class 0 OID 0)
-- Dependencies: 213
-- Name: uffici_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.uffici_id_seq OWNED BY public.uffici.id;


--
-- TOC entry 224 (class 1259 OID 1215521)
-- Name: utenti; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.utenti (
    id integer NOT NULL,
    codice_fiscale text NOT NULL,
    nome text NOT NULL,
    cognome text NOT NULL,
    email text,
    telefono text,
    data_nascita timestamp(3) without time zone,
    luogo_nascita text,
    indirizzo text,
    cap text,
    citta text,
    provincia text,
    pec text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.utenti OWNER TO io_user;

--
-- TOC entry 223 (class 1259 OID 1215519)
-- Name: utenti_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.utenti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.utenti_id_seq OWNER TO io_user;

--
-- TOC entry 3457 (class 0 OID 0)
-- Dependencies: 223
-- Name: utenti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.utenti_id_seq OWNED BY public.utenti.id;


--
-- TOC entry 230 (class 1259 OID 1215570)
-- Name: workflows; Type: TABLE; Schema: public; Owner: io_user
--

CREATE TABLE public.workflows (
    id integer NOT NULL,
    note text,
    data_variazione timestamp(3) without time zone NOT NULL,
    istanza_id integer NOT NULL,
    step_id integer,
    notifica_id integer,
    status_id integer NOT NULL,
    operatore_id integer
);


ALTER TABLE public.workflows OWNER TO io_user;

--
-- TOC entry 229 (class 1259 OID 1215568)
-- Name: workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: io_user
--

CREATE SEQUENCE public.workflows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflows_id_seq OWNER TO io_user;

--
-- TOC entry 3458 (class 0 OID 0)
-- Dependencies: 229
-- Name: workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: io_user
--

ALTER SEQUENCE public.workflows_id_seq OWNED BY public.workflows.id;


--
-- TOC entry 3094 (class 2604 OID 1215584)
-- Name: allegati id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati ALTER COLUMN id SET DEFAULT nextval('public.allegati_id_seq'::regclass);


--
-- TOC entry 3082 (class 2604 OID 1215511)
-- Name: allegati_richiesti id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati_richiesti ALTER COLUMN id SET DEFAULT nextval('public.allegati_richiesti_id_seq'::regclass);


--
-- TOC entry 3128 (class 2604 OID 1215908)
-- Name: allegati_risposta id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati_risposta ALTER COLUMN id SET DEFAULT nextval('public.allegati_risposta_id_seq'::regclass);


--
-- TOC entry 3051 (class 2604 OID 1215424)
-- Name: aree id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.aree ALTER COLUMN id SET DEFAULT nextval('public.aree_id_seq'::regclass);


--
-- TOC entry 3124 (class 2604 OID 1215884)
-- Name: comunicazioni id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.comunicazioni ALTER COLUMN id SET DEFAULT nextval('public.comunicazioni_id_seq'::regclass);


--
-- TOC entry 3104 (class 2604 OID 1215634)
-- Name: customer_satisfaction id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.customer_satisfaction ALTER COLUMN id SET DEFAULT nextval('public.customer_satisfaction_id_seq'::regclass);


--
-- TOC entry 3119 (class 2604 OID 1215690)
-- Name: email_config id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.email_config ALTER COLUMN id SET DEFAULT nextval('public.email_config_id_seq'::regclass);


--
-- TOC entry 3048 (class 2604 OID 1215411)
-- Name: enti id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.enti ALTER COLUMN id SET DEFAULT nextval('public.enti_id_seq'::regclass);


--
-- TOC entry 3087 (class 2604 OID 1215536)
-- Name: istanze id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.istanze ALTER COLUMN id SET DEFAULT nextval('public.istanze_id_seq'::regclass);


--
-- TOC entry 3080 (class 2604 OID 1215499)
-- Name: notifiche id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.notifiche ALTER COLUMN id SET DEFAULT nextval('public.notifiche_id_seq'::regclass);


--
-- TOC entry 3042 (class 2604 OID 1215370)
-- Name: operatori id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.operatori ALTER COLUMN id SET DEFAULT nextval('public.operatori_id_seq'::regclass);


--
-- TOC entry 3099 (class 2604 OID 1215609)
-- Name: pagamenti id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.pagamenti ALTER COLUMN id SET DEFAULT nextval('public.pagamenti_id_seq'::regclass);


--
-- TOC entry 3103 (class 2604 OID 1215623)
-- Name: pagamenti_effettuati id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.pagamenti_effettuati ALTER COLUMN id SET DEFAULT nextval('public.pagamenti_effettuati_id_seq'::regclass);


--
-- TOC entry 3110 (class 2604 OID 1215657)
-- Name: protocollo_emergenza id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.protocollo_emergenza ALTER COLUMN id SET DEFAULT nextval('public.protocollo_emergenza_id_seq'::regclass);


--
-- TOC entry 3109 (class 2604 OID 1215646)
-- Name: ricevute id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.ricevute ALTER COLUMN id SET DEFAULT nextval('public.ricevute_id_seq'::regclass);


--
-- TOC entry 3126 (class 2604 OID 1215896)
-- Name: risposte_comunicazioni id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.risposte_comunicazioni ALTER COLUMN id SET DEFAULT nextval('public.risposte_comunicazioni_id_seq'::regclass);


--
-- TOC entry 3045 (class 2604 OID 1215383)
-- Name: ruoli id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.ruoli ALTER COLUMN id SET DEFAULT nextval('public.ruoli_id_seq'::regclass);


--
-- TOC entry 3047 (class 2604 OID 1215400)
-- Name: ruoli_user id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.ruoli_user ALTER COLUMN id SET DEFAULT nextval('public.ruoli_user_id_seq'::regclass);


--
-- TOC entry 3056 (class 2604 OID 1215438)
-- Name: servizi id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.servizi ALTER COLUMN id SET DEFAULT nextval('public.servizi_id_seq'::regclass);


--
-- TOC entry 3112 (class 2604 OID 1215669)
-- Name: statistiche_giornaliere id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.statistiche_giornaliere ALTER COLUMN id SET DEFAULT nextval('public.statistiche_giornaliere_id_seq'::regclass);


--
-- TOC entry 3116 (class 2604 OID 1215680)
-- Name: statistiche_pagamenti id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.statistiche_pagamenti ALTER COLUMN id SET DEFAULT nextval('public.statistiche_pagamenti_id_seq'::regclass);


--
-- TOC entry 3092 (class 2604 OID 1215562)
-- Name: status id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.status ALTER COLUMN id SET DEFAULT nextval('public.status_id_seq'::regclass);


--
-- TOC entry 3069 (class 2604 OID 1215479)
-- Name: steps id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.steps ALTER COLUMN id SET DEFAULT nextval('public.steps_id_seq'::regclass);


--
-- TOC entry 3097 (class 2604 OID 1215597)
-- Name: tributi id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.tributi ALTER COLUMN id SET DEFAULT nextval('public.tributi_id_seq'::regclass);


--
-- TOC entry 3067 (class 2604 OID 1215457)
-- Name: uffici id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.uffici ALTER COLUMN id SET DEFAULT nextval('public.uffici_id_seq'::regclass);


--
-- TOC entry 3085 (class 2604 OID 1215524)
-- Name: utenti id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.utenti ALTER COLUMN id SET DEFAULT nextval('public.utenti_id_seq'::regclass);


--
-- TOC entry 3093 (class 2604 OID 1215573)
-- Name: workflows id; Type: DEFAULT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.workflows ALTER COLUMN id SET DEFAULT nextval('public.workflows_id_seq'::regclass);


--
-- TOC entry 3401 (class 0 OID 1215581)
-- Dependencies: 232
-- Data for Name: allegati; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.allegati (id, nome_file, nome_hash, nome_file_richiesto, mime_type, inv_utente, visto, data_inserimento, workflow_id) FROM stdin;
1	1.pdf	2026\\03\\20\\174c03b5-972c-4834-a3e4-b9b313e596cb	Dichiarazione di residenza (firmata da tutti i componenti maggiorenni)	application/pdf	t	f	2026-03-20 08:29:30.558	2
2	2.pdf	2026\\03\\20\\b7dede61-38b5-42f0-a66e-cc73b97d82a3	Dichiarazione Tari	application/pdf	t	f	2026-03-20 08:29:30.558	2
3	3.pdf	2026\\03\\20\\7599ff7d-8fcd-4bb3-b339-b1b813f4d189	Titolo di proprietà	application/pdf	t	f	2026-03-20 08:29:30.558	2
4	4.pdf	2026\\03\\20\\7a059f65-c5bc-4c6e-a785-fa20235d3567	Documenti di identità (se più di uno inserire un unico file pdf)	application/pdf	t	f	2026-03-20 08:29:30.558	2
5	1.pdf	2026\\03\\20\\fb09a3ef-bf14-486f-b72d-76c12d008711	Dichiarazione di residenza (firmata da tutti i componenti maggiorenni)	application/pdf	t	f	2026-03-20 10:01:34.279	3
6	2.pdf	2026\\03\\20\\fbd6d779-cd76-40eb-8e91-976dc07cbe79	Dichiarazione Tari	application/pdf	t	f	2026-03-20 10:01:34.279	3
7	3.pdf	2026\\03\\20\\92ac07c9-e835-4d71-8b1c-94d7fac1bf25	Titolo di proprietà	application/pdf	t	f	2026-03-20 10:01:34.279	3
8	4.pdf	2026\\03\\20\\618844fa-735b-49ec-a76b-bd8c949d3e2d	Documenti di identità (se più di uno inserire un unico file pdf)	application/pdf	t	f	2026-03-20 10:01:34.279	3
\.


--
-- TOC entry 3391 (class 0 OID 1215508)
-- Dependencies: 222
-- Data for Name: allegati_richiesti; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.allegati_richiesti (id, nome_allegato_richiesto, obbligatorio, interno, soggetto, step_id, notifica_id) FROM stdin;
5	Dichiarazione di residenza (firmata da tutti i componenti maggiorenni)	t	f	UT	8	\N
6	Dichiarazione Tari	t	f	UT	8	\N
7	Titolo di proprietà	t	f	UT	8	\N
8	Documenti di identità (se più di uno inserire un unico file pdf)	t	f	UT	8	\N
13	Dichiarazione di residenza (firmata da tutti i componenti maggiorenni)	t	f	UT	11	\N
14	Dichiarazione Tari	t	f	UT	11	\N
15	Titolo di proprietà	t	f	UT	11	\N
16	Documenti di identità (se più di uno inserire un unico file pdf)	t	f	UT	11	\N
\.


--
-- TOC entry 3425 (class 0 OID 1215905)
-- Dependencies: 256
-- Data for Name: allegati_risposta; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.allegati_risposta (id, nome_file, nome_hash, mime_type, risposta_id) FROM stdin;
\.


--
-- TOC entry 3379 (class 0 OID 1215421)
-- Dependencies: 210
-- Data for Name: aree; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.aree (id, titolo, descrizione, icona, ordine, attiva, slug, privata) FROM stdin;
1	Servizi al Cittadino	Area servizi dedicati ai cittadini	\N	1	t	servizi-al-cittadino	f
2	Servizi Demografici e Decentramento	Anagrafe e Stato civile, Servizi Elettorali, Matrimoni, Assegni di Maternità, Assegni Nucleo Familiare, Tesserini Venatori, Servizi per non deambulanti	\N	1	t	servizi-demografici	f
\.


--
-- TOC entry 3421 (class 0 OID 1215881)
-- Dependencies: 252
-- Data for Name: comunicazioni; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.comunicazioni (id, testo, richiede_risposta, allegati_richiesti, workflow_id) FROM stdin;
\.


--
-- TOC entry 3409 (class 0 OID 1215631)
-- Dependencies: 240
-- Data for Name: customer_satisfaction; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.customer_satisfaction (id, green, yellow, red, gray, servizio_id) FROM stdin;
\.


--
-- TOC entry 3419 (class 0 OID 1215687)
-- Dependencies: 250
-- Data for Name: email_config; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.email_config (id, attivo, provider, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, smtp_from_email, smtp_from_name, o365_tenant_id, o365_client_id, o365_client_secret, o365_sender_email, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3377 (class 0 OID 1215408)
-- Dependencies: 208
-- Data for Name: enti; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.enti (id, nome, descrizione, codice, indirizzo, telefono, email, pec, logo, attivo, created_at) FROM stdin;
1	Comune di Catania	Comune di Catania - Città Metropolitana di Catania	COCAT	Piazza Duomo, 1 - 95100 Catania (CT)	095 7421111	urp@comune.catania.it	protocollo@pec.comune.catania.it	\N	t	2026-03-10 09:15:40.253
\.


--
-- TOC entry 3395 (class 0 OID 1215533)
-- Dependencies: 226
-- Data for Name: istanze; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.istanze (id, dati, dati_in_evidenza, dati_responso, municipalita, conclusa, respinta, proto_numero, proto_data, proto_finale_numero, proto_finale_data, data_invio, created_at, utente_id, servizio_id, last_step_id, active_step, in_bozza) FROM stdin;
1	{"tipoCertificato":"Nascita","motivazione":"Uso personale"}	Certificato di nascita - Uso personale	\N	I Municipalità	f	f	\N	\N	\N	\N	2026-01-15 00:00:00	2026-03-10 09:15:40.545	1	1	1	\N	f
2	{"richiedente":"Porto Salvatore","email":"salvino.porto@gmail.com","telefono":"0957424379","altri_maggiorenni":"si","circoscrizione":"prima"}	\N	\N	\N	f	f	\N	\N	\N	\N	2026-03-20 08:29:30.429	2026-03-20 08:29:30.439	1	3	11	\N	f
3	{"richiedente":"Porto Salvatore","email":"salvino.porto@gmail.com","telefono":"0957424379","altri_maggiorenni":"no","circoscrizione":"seconda"}	\N	\N	\N	f	f	\N	\N	\N	\N	2026-03-20 10:01:34.269	2026-03-20 10:01:34.271	1	3	11	\N	f
\.


--
-- TOC entry 3389 (class 0 OID 1215496)
-- Dependencies: 220
-- Data for Name: notifiche; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.notifiche (id, descrizione, allegati) FROM stdin;
\.


--
-- TOC entry 3384 (class 0 OID 1215464)
-- Dependencies: 215
-- Data for Name: operatore_servizi; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.operatore_servizi (operatore_id, servizio_id) FROM stdin;
1	1
2	1
\.


--
-- TOC entry 3370 (class 0 OID 1215367)
-- Dependencies: 201
-- Data for Name: operatori; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.operatori (id, email, password, nome, cognome, user_name, telefono, attivo, created_at, updated_at) FROM stdin;
1	admin@comune.catania.it	$2a$12$5gxY3BQbzfeSsw0O0yxfZu6WGHzdwqKMZFyxy/GT40nz1WRwKeDp6	Admin	Sistema	admin	\N	t	2026-03-10 09:15:40.518	2026-03-10 09:15:40.518
2	operatore@comune.catania.it	$2a$10$ATBR0vN76vqaOS/wcetdsuvMfj8bOy/jv/1hnmWKj56r5LaNReg56	operatore	operatore	operatore	\N	t	2026-03-10 09:35:01.487	2026-03-10 09:35:01.487
\.


--
-- TOC entry 3373 (class 0 OID 1215390)
-- Dependencies: 204
-- Data for Name: operatori_ruoli; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.operatori_ruoli (operatore_id, ruolo_id) FROM stdin;
1	1
2	2
\.


--
-- TOC entry 3405 (class 0 OID 1215606)
-- Dependencies: 236
-- Data for Name: pagamenti; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.pagamenti (id, importo, importo_variabile, obbligatorio, tipologia_pagamento, causale, causale_variabile, step_id, codice_tributo_id) FROM stdin;
\.


--
-- TOC entry 3407 (class 0 OID 1215620)
-- Dependencies: 238
-- Data for Name: pagamenti_effettuati; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.pagamenti_effettuati (id, iuv, importo_totale, stato, data_operazione, data_ricevuta, cf_utente, nome_utente, cognome_utente, email_utente, causale, workflow_id) FROM stdin;
\.


--
-- TOC entry 3413 (class 0 OID 1215654)
-- Dependencies: 244
-- Data for Name: protocollo_emergenza; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.protocollo_emergenza (id, data, tipo, rettificato, istanza_id) FROM stdin;
\.


--
-- TOC entry 3411 (class 0 OID 1215643)
-- Dependencies: 242
-- Data for Name: ricevute; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.ricevute (id, intestazione, corpo, footer, modulo_id) FROM stdin;
\.


--
-- TOC entry 3423 (class 0 OID 1215893)
-- Dependencies: 254
-- Data for Name: risposte_comunicazioni; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.risposte_comunicazioni (id, testo, data_risposta, comunicazione_id) FROM stdin;
\.


--
-- TOC entry 3372 (class 0 OID 1215380)
-- Dependencies: 203
-- Data for Name: ruoli; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.ruoli (id, nome, descrizione, permessi) FROM stdin;
2	OPERATORE	Operatore standard	{istanze:manage,istanze:view}
3	GESTORE_SERVIZI	Operatore avanzato	{istanze:manage,istanze:view,servizi:manage,servizi:view}
1	AMMINISTRATORE	Amministratore del sistema	{admin:access}
\.


--
-- TOC entry 3375 (class 0 OID 1215397)
-- Dependencies: 206
-- Data for Name: ruoli_user; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.ruoli_user (id, nome, descrizione) FROM stdin;
\.


--
-- TOC entry 3381 (class 0 OID 1215435)
-- Dependencies: 212
-- Data for Name: servizi; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.servizi (id, titolo, sotto_titolo, descrizione, come_fare, cosa_serve, altre_info, contatti, slug, icona, ordine, attivo, area_id, modulo_tipo, attributi, modulo_corpo, post_form_validation, post_form_validation_api, post_form_validation_fields, ufficio_id, data_inizio, data_fine, unico_invio, unico_invio_per_utente, campi_unico_invio, numero_max_istanze, msg_sopra_soglia, msg_extra_servizio, campi_in_evidenza, campi_da_esportare, created_at, updated_at, evidenza) FROM stdin;
1	Anagrafe	\N	Servizi anagrafici	\N	\N	\N	\N	fake	\N	1	t	1	HTML	{"fields":[{"name":"tipoCertificato","label":"Tipo Certificato","type":"select"},{"name":"motivazione","label":"Motivazione","type":"textarea"}]}	\N	f	\N	\N	1	2024-01-01 00:00:00	2030-12-31 00:00:00	f	f	\N	0	\N	\N	\N	\N	2026-03-10 09:15:40.529	\N	f
2	Richiesta cambio di residenza di cittadini italiani	\N	\N	\N	<p>Per procedere alla presentazione è necessario munirsi di:</p><ul><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://cataniasemplice.comune.catania.it/assets/documentazione/cambio_residenza.pdf">Dichiarazione di Residenza sottoscritta da tutti i componenti maggiorenni (clicca per scaricare) ;</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://cataniasemplice.comune.catania.it/assets/documentazione/dichiarazione_tari.pdf">Dichiarazione Tari (clicca per scaricare) ;</a></p></li><li><p>Copia del documento d’identità del richiedente e delle persone che trasferiscono la residenza unitamente al richiedente (creare un unico file) ;</p></li><li><p>Titolo di proprietà o contratto d'affitto regolarmente registrato dell’appartamento in cui si va ad abitare (Decreto legge 28 marzo 2014, n. 47, convertito nella legge 23 maggio 2014 n.80, all’ art. 5);</p></li></ul><p></p>	<p><strong>N.B.&nbsp;</strong></p><ul><li><p><strong>Inoltrare la richiesta solo DOPO essersi effettivamente trasferiti nell'abitazione , al fine di accertare , da parte del personale comunale , l'effettiva presenza nel nuovo domicilio di residenza .</strong></p></li><li><p><strong>In caso di genitori "single" con presenza di minori è necessaria la dichiarazione di assenzo dell'altro genitore.</strong></p></li><li><p><strong>In caso di alloggi popolari , necessita nullaosta dell'Ente proprietario.</strong></p></li></ul><p></p>	\N	cambio-residenza-it	\N	0	t	2	HTML	{"fields":[{"id":"field_1773140657889_6v07emcaq","type":"text","name":"richiedente","label":"Richiedente","validation":{"required":true,"maxLength":150},"placeholder":"Generalità richiedente..."},{"id":"field_1773140725626_trs9dspxi","type":"email","name":"email","label":"Email","validation":{"required":true},"placeholder":"esempio@email.it"},{"id":"field_1773140766609_s9c2a51zi","type":"tel","name":"telefono","label":"Telefono","validation":{"required":true,"pattern":"^[+]?[(]?[0-9]{3}[)]?[-s.]?[0-9]{3}[-s.]?[0-9]{4,6}$","patternMessage":"Inserire un numero di telefono valido"}},{"id":"field_1773140855834_wpggxj7t9","type":"radio","name":"altri_maggiorenni","label":"Presenza di altri componenti maggiorennii","validation":{"required":true},"options":[{"value":"si","label":"Si"},{"value":"no","label":"No"}]},{"id":"field_1773140953212_uzg8y9xlb","type":"select","name":"circoscrizione","label":"Circoscrizione di destinazione","validation":{"required":true},"options":[{"value":"","label":"-- Seleziona --"},{"value":"prima","label":"1ª - Centro Storico"},{"value":"seconda","label":"2ª - Picanello - Ognina - Barriera - Canalicchio"},{"value":"terza","label":"3ª - Borgo Sanzio"},{"value":"quarta","label":"4ª - Centro San Giovanni Galermo - Trappeto - Cibali"},{"value":"quinta","label":"5ª - Monte Po - Nesima - San Leone - Rapisardi"},{"value":"sesta","label":"6ª - San Giorgio - Librino - San Giuseppe La Rena - Zia Lisa - Villaggio Sant'Agata"}],"helpText":"Seleziona la circoscrizione"},{"id":"field_1773143441975_6wlgeimgo","type":"paragraph","name":"paragraph","label":"N.B. In caso di aggregazioni o convivenze indicare nell'allegato \\"Dichiarazione TARI\\" il soggetto iscritto al tributo TARI","validation":{}}],"version":"1.0"}	\N	f	\N	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	2026-03-10 11:02:20.884	\N	f
3	Richiesta cambio di residenza di cittadini stranieri	\N	\N	\N	<p>Per procedere alla presentazione è necessario munirsi di:</p><ul><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://cataniasemplice.comune.catania.it/assets/documentazione/cambio_residenza.pdf">Dichiarazione di Residenza sottoscritta da tutti i componenti maggiorenni (clicca per scaricare) ;</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://cataniasemplice.comune.catania.it/assets/documentazione/dichiarazione_tari.pdf">Dichiarazione Tari (clicca per scaricare) ;</a></p></li><li><p>Copia del documento d’identità del richiedente e delle persone che trasferiscono la residenza unitamente al richiedente (creare un unico file) ;</p></li><li><p>Titolo di proprietà o contratto d'affitto regolarmente registrato dell’appartamento in cui si va ad abitare (Decreto legge 28 marzo 2014, n. 47, convertito nella legge 23 maggio 2014 n.80, all’ art. 5);</p></li></ul><p></p>	<p><strong>N.B.&nbsp;</strong></p><ul><li><p><strong>Inoltrare la richiesta solo DOPO essersi effettivamente trasferiti nell'abitazione , al fine di accertare , da parte del personale comunale , l'effettiva presenza nel nuovo domicilio di residenza .</strong></p></li><li><p><strong>In caso di genitori "single" con presenza di minori è necessaria la dichiarazione di assenzo dell'altro genitore.</strong></p></li><li><p><strong>In caso di alloggi popolari , necessita nullaosta dell'Ente proprietario.</strong></p></li></ul><p></p>	\N	cambio-residenza	\N	0	t	2	HTML	{"fields":[{"id":"field_1773140657889_6v07emcaq","type":"text","name":"richiedente","label":"Richiedente","validation":{"required":true,"maxLength":150},"placeholder":"Generalità richiedente..."},{"id":"field_1773140725626_trs9dspxi","type":"email","name":"email","label":"Email","validation":{"required":true},"placeholder":"esempio@email.it"},{"id":"field_1773140766609_s9c2a51zi","type":"tel","name":"telefono","label":"Telefono","validation":{"required":true,"pattern":"^[+]?[(]?[0-9]{3}[)]?[-s.]?[0-9]{3}[-s.]?[0-9]{4,6}$","patternMessage":"Inserire un numero di telefono valido"}},{"id":"field_1773140855834_wpggxj7t9","type":"radio","name":"altri_maggiorenni","label":"Presenza di altri componenti maggiorennii","validation":{"required":true},"options":[{"value":"si","label":"Si"},{"value":"no","label":"No"}]},{"id":"field_1773140953212_uzg8y9xlb","type":"select","name":"circoscrizione","label":"Circoscrizione di destinazione","validation":{"required":true},"options":[{"value":"","label":"-- Seleziona --"},{"value":"prima","label":"1ª - Centro Storico"},{"value":"seconda","label":"2ª - Picanello - Ognina - Barriera - Canalicchio"},{"value":"terza","label":"3ª - Borgo Sanzio"},{"value":"quarta","label":"4ª - Centro San Giovanni Galermo - Trappeto - Cibali"},{"value":"quinta","label":"5ª - Monte Po - Nesima - San Leone - Rapisardi"},{"value":"sesta","label":"6ª - San Giorgio - Librino - San Giuseppe La Rena - Zia Lisa - Villaggio Sant'Agata"}],"helpText":"Seleziona la circoscrizione"},{"id":"field_1773143441975_6wlgeimgo","type":"paragraph","name":"paragraph","label":"N.B. In caso di aggregazioni o convivenze indicare nell'allegato \\"Dichiarazione TARI\\" il soggetto iscritto al tributo TARI","validation":{}}],"version":"1.0"}	\N	f	\N	\N	1	2026-03-20 00:00:00	\N	f	f	\N	\N	\N	\N	\N	\N	2026-03-20 08:15:54.285	\N	f
\.


--
-- TOC entry 3385 (class 0 OID 1215469)
-- Dependencies: 216
-- Data for Name: servizi_ruoli_user; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.servizi_ruoli_user (servizio_id, ruolo_user_id) FROM stdin;
\.


--
-- TOC entry 3415 (class 0 OID 1215666)
-- Dependencies: 246
-- Data for Name: statistiche_giornaliere; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.statistiche_giornaliere (id, data, istanze_inviate, istanze_concluse, istanze_respinte) FROM stdin;
\.


--
-- TOC entry 3417 (class 0 OID 1215677)
-- Dependencies: 248
-- Data for Name: statistiche_pagamenti; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.statistiche_pagamenti (id, data, numero_transazioni, importo_totale) FROM stdin;
\.


--
-- TOC entry 3397 (class 0 OID 1215559)
-- Dependencies: 228
-- Data for Name: status; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.status (id, stato, ordine, icon) FROM stdin;
1	ELABORAZIONE	1	yellow-circle.png
2	SUCCESSO	2	green-circle.png
3	ATTESA	3	blue-circle.png
4	RESPINTA	4	red-circle.png
\.


--
-- TOC entry 3387 (class 0 OID 1215476)
-- Dependencies: 218
-- Data for Name: steps; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.steps (id, descrizione, ordine, attivo, pagamento, allegati, allegati_op, allegati_required, allegati_op_required, allegati_richiesti, allegati_op_richiesti, protocollo, tipo_protocollo, unita_organizzativa, assegnabile_a_specifico_ufficio, setta_attributo, servizio_id, numerazione_interna) FROM stdin;
1	Ricezione	1	t	f	f	f	f	f	\N	\N	t	\N	\N	f	f	1	f
2	Verifica	2	t	f	f	f	f	f	\N	\N	f	\N	\N	f	f	1	f
3	Emissione	3	t	f	f	f	f	f	\N	\N	t	\N	\N	f	f	1	f
8	Ricezione	1	t	f	t	f	f	f	\N	\N	t	E	\N	f	f	2	f
11	Presentazione Istanza	1	t	f	t	f	f	f	\N	\N	t	E	UO002	f	f	3	f
12	Chiusura Pratica	2	t	f	f	f	f	f	\N	\N	f	\N	\N	f	f	3	f
\.


--
-- TOC entry 3403 (class 0 OID 1215594)
-- Dependencies: 234
-- Data for Name: tributi; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.tributi (id, codice, descrizione, attivo) FROM stdin;
1	0001	Diritti di segreteria	t
\.


--
-- TOC entry 3383 (class 0 OID 1215454)
-- Dependencies: 214
-- Data for Name: uffici; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.uffici (id, nome, descrizione, email, telefono, indirizzo, attivo) FROM stdin;
1	Ufficio Anagrafe	Ufficio servizi anagrafici	anagrafe@comune.catania.it	095 7421200	Via Etnea, 100 - Catania	t
\.


--
-- TOC entry 3393 (class 0 OID 1215521)
-- Dependencies: 224
-- Data for Name: utenti; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.utenti (id, codice_fiscale, nome, cognome, email, telefono, data_nascita, luogo_nascita, indirizzo, cap, citta, provincia, pec, created_at) FROM stdin;
1	RSSMRA80A01C351Z	Mario	Rossi	mario.rossi@example.com	3331234567	1980-01-01 00:00:00	Catania	Via Roma, 10	95100	Catania	CT	\N	2026-03-10 09:15:40.542
\.


--
-- TOC entry 3399 (class 0 OID 1215570)
-- Dependencies: 230
-- Data for Name: workflows; Type: TABLE DATA; Schema: public; Owner: io_user
--

COPY public.workflows (id, note, data_variazione, istanza_id, step_id, notifica_id, status_id, operatore_id) FROM stdin;
1		2026-03-10 09:21:06.234	1	1	\N	1	1
2	\N	2026-03-20 08:29:30.429	2	11	\N	1	\N
3	\N	2026-03-20 10:01:34.269	3	11	\N	1	\N
\.


--
-- TOC entry 3459 (class 0 OID 0)
-- Dependencies: 231
-- Name: allegati_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.allegati_id_seq', 8, true);


--
-- TOC entry 3460 (class 0 OID 0)
-- Dependencies: 221
-- Name: allegati_richiesti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.allegati_richiesti_id_seq', 16, true);


--
-- TOC entry 3461 (class 0 OID 0)
-- Dependencies: 255
-- Name: allegati_risposta_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.allegati_risposta_id_seq', 1, false);


--
-- TOC entry 3462 (class 0 OID 0)
-- Dependencies: 209
-- Name: aree_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.aree_id_seq', 2, true);


--
-- TOC entry 3463 (class 0 OID 0)
-- Dependencies: 251
-- Name: comunicazioni_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.comunicazioni_id_seq', 1, false);


--
-- TOC entry 3464 (class 0 OID 0)
-- Dependencies: 239
-- Name: customer_satisfaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.customer_satisfaction_id_seq', 1, false);


--
-- TOC entry 3465 (class 0 OID 0)
-- Dependencies: 249
-- Name: email_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.email_config_id_seq', 1, false);


--
-- TOC entry 3466 (class 0 OID 0)
-- Dependencies: 207
-- Name: enti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.enti_id_seq', 1, true);


--
-- TOC entry 3467 (class 0 OID 0)
-- Dependencies: 225
-- Name: istanze_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.istanze_id_seq', 3, true);


--
-- TOC entry 3468 (class 0 OID 0)
-- Dependencies: 219
-- Name: notifiche_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.notifiche_id_seq', 1, false);


--
-- TOC entry 3469 (class 0 OID 0)
-- Dependencies: 200
-- Name: operatori_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.operatori_id_seq', 2, true);


--
-- TOC entry 3470 (class 0 OID 0)
-- Dependencies: 237
-- Name: pagamenti_effettuati_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.pagamenti_effettuati_id_seq', 1, false);


--
-- TOC entry 3471 (class 0 OID 0)
-- Dependencies: 235
-- Name: pagamenti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.pagamenti_id_seq', 1, false);


--
-- TOC entry 3472 (class 0 OID 0)
-- Dependencies: 243
-- Name: protocollo_emergenza_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.protocollo_emergenza_id_seq', 1, false);


--
-- TOC entry 3473 (class 0 OID 0)
-- Dependencies: 241
-- Name: ricevute_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.ricevute_id_seq', 1, false);


--
-- TOC entry 3474 (class 0 OID 0)
-- Dependencies: 253
-- Name: risposte_comunicazioni_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.risposte_comunicazioni_id_seq', 1, false);


--
-- TOC entry 3475 (class 0 OID 0)
-- Dependencies: 202
-- Name: ruoli_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.ruoli_id_seq', 3, true);


--
-- TOC entry 3476 (class 0 OID 0)
-- Dependencies: 205
-- Name: ruoli_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.ruoli_user_id_seq', 1, false);


--
-- TOC entry 3477 (class 0 OID 0)
-- Dependencies: 211
-- Name: servizi_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.servizi_id_seq', 3, true);


--
-- TOC entry 3478 (class 0 OID 0)
-- Dependencies: 245
-- Name: statistiche_giornaliere_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.statistiche_giornaliere_id_seq', 1, false);


--
-- TOC entry 3479 (class 0 OID 0)
-- Dependencies: 247
-- Name: statistiche_pagamenti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.statistiche_pagamenti_id_seq', 1, false);


--
-- TOC entry 3480 (class 0 OID 0)
-- Dependencies: 227
-- Name: status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.status_id_seq', 4, true);


--
-- TOC entry 3481 (class 0 OID 0)
-- Dependencies: 217
-- Name: steps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.steps_id_seq', 12, true);


--
-- TOC entry 3482 (class 0 OID 0)
-- Dependencies: 233
-- Name: tributi_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.tributi_id_seq', 1, true);


--
-- TOC entry 3483 (class 0 OID 0)
-- Dependencies: 213
-- Name: uffici_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.uffici_id_seq', 1, true);


--
-- TOC entry 3484 (class 0 OID 0)
-- Dependencies: 223
-- Name: utenti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.utenti_id_seq', 1, true);


--
-- TOC entry 3485 (class 0 OID 0)
-- Dependencies: 229
-- Name: workflows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: io_user
--

SELECT pg_catalog.setval('public.workflows_id_seq', 3, true);


--
-- TOC entry 3178 (class 2606 OID 1215591)
-- Name: allegati allegati_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati
    ADD CONSTRAINT allegati_pkey PRIMARY KEY (id);


--
-- TOC entry 3160 (class 2606 OID 1215518)
-- Name: allegati_richiesti allegati_richiesti_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati_richiesti
    ADD CONSTRAINT allegati_richiesti_pkey PRIMARY KEY (id);


--
-- TOC entry 3211 (class 2606 OID 1215913)
-- Name: allegati_risposta allegati_risposta_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati_risposta
    ADD CONSTRAINT allegati_risposta_pkey PRIMARY KEY (id);


--
-- TOC entry 3144 (class 2606 OID 1215432)
-- Name: aree aree_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.aree
    ADD CONSTRAINT aree_pkey PRIMARY KEY (id);


--
-- TOC entry 3205 (class 2606 OID 1215890)
-- Name: comunicazioni comunicazioni_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.comunicazioni
    ADD CONSTRAINT comunicazioni_pkey PRIMARY KEY (id);


--
-- TOC entry 3189 (class 2606 OID 1215640)
-- Name: customer_satisfaction customer_satisfaction_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.customer_satisfaction
    ADD CONSTRAINT customer_satisfaction_pkey PRIMARY KEY (id);


--
-- TOC entry 3203 (class 2606 OID 1215699)
-- Name: email_config email_config_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.email_config
    ADD CONSTRAINT email_config_pkey PRIMARY KEY (id);


--
-- TOC entry 3142 (class 2606 OID 1215418)
-- Name: enti enti_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.enti
    ADD CONSTRAINT enti_pkey PRIMARY KEY (id);


--
-- TOC entry 3166 (class 2606 OID 1215544)
-- Name: istanze istanze_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.istanze
    ADD CONSTRAINT istanze_pkey PRIMARY KEY (id);


--
-- TOC entry 3158 (class 2606 OID 1215505)
-- Name: notifiche notifiche_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.notifiche
    ADD CONSTRAINT notifiche_pkey PRIMARY KEY (id);


--
-- TOC entry 3152 (class 2606 OID 1215468)
-- Name: operatore_servizi operatore_servizi_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.operatore_servizi
    ADD CONSTRAINT operatore_servizi_pkey PRIMARY KEY (operatore_id, servizio_id);


--
-- TOC entry 3130 (class 2606 OID 1215377)
-- Name: operatori operatori_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.operatori
    ADD CONSTRAINT operatori_pkey PRIMARY KEY (id);


--
-- TOC entry 3137 (class 2606 OID 1215394)
-- Name: operatori_ruoli operatori_ruoli_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.operatori_ruoli
    ADD CONSTRAINT operatori_ruoli_pkey PRIMARY KEY (operatore_id, ruolo_id);


--
-- TOC entry 3186 (class 2606 OID 1215628)
-- Name: pagamenti_effettuati pagamenti_effettuati_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.pagamenti_effettuati
    ADD CONSTRAINT pagamenti_effettuati_pkey PRIMARY KEY (id);


--
-- TOC entry 3183 (class 2606 OID 1215617)
-- Name: pagamenti pagamenti_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.pagamenti
    ADD CONSTRAINT pagamenti_pkey PRIMARY KEY (id);


--
-- TOC entry 3195 (class 2606 OID 1215663)
-- Name: protocollo_emergenza protocollo_emergenza_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.protocollo_emergenza
    ADD CONSTRAINT protocollo_emergenza_pkey PRIMARY KEY (id);


--
-- TOC entry 3193 (class 2606 OID 1215651)
-- Name: ricevute ricevute_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.ricevute
    ADD CONSTRAINT ricevute_pkey PRIMARY KEY (id);


--
-- TOC entry 3209 (class 2606 OID 1215902)
-- Name: risposte_comunicazioni risposte_comunicazioni_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.risposte_comunicazioni
    ADD CONSTRAINT risposte_comunicazioni_pkey PRIMARY KEY (id);


--
-- TOC entry 3135 (class 2606 OID 1215389)
-- Name: ruoli ruoli_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.ruoli
    ADD CONSTRAINT ruoli_pkey PRIMARY KEY (id);


--
-- TOC entry 3140 (class 2606 OID 1215405)
-- Name: ruoli_user ruoli_user_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.ruoli_user
    ADD CONSTRAINT ruoli_user_pkey PRIMARY KEY (id);


--
-- TOC entry 3147 (class 2606 OID 1215451)
-- Name: servizi servizi_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.servizi
    ADD CONSTRAINT servizi_pkey PRIMARY KEY (id);


--
-- TOC entry 3154 (class 2606 OID 1215473)
-- Name: servizi_ruoli_user servizi_ruoli_user_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.servizi_ruoli_user
    ADD CONSTRAINT servizi_ruoli_user_pkey PRIMARY KEY (servizio_id, ruolo_user_id);


--
-- TOC entry 3198 (class 2606 OID 1215674)
-- Name: statistiche_giornaliere statistiche_giornaliere_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.statistiche_giornaliere
    ADD CONSTRAINT statistiche_giornaliere_pkey PRIMARY KEY (id);


--
-- TOC entry 3201 (class 2606 OID 1215684)
-- Name: statistiche_pagamenti statistiche_pagamenti_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.statistiche_pagamenti
    ADD CONSTRAINT statistiche_pagamenti_pkey PRIMARY KEY (id);


--
-- TOC entry 3172 (class 2606 OID 1215567)
-- Name: status status_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.status
    ADD CONSTRAINT status_pkey PRIMARY KEY (id);


--
-- TOC entry 3156 (class 2606 OID 1215493)
-- Name: steps steps_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.steps
    ADD CONSTRAINT steps_pkey PRIMARY KEY (id);


--
-- TOC entry 3181 (class 2606 OID 1215603)
-- Name: tributi tributi_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.tributi
    ADD CONSTRAINT tributi_pkey PRIMARY KEY (id);


--
-- TOC entry 3150 (class 2606 OID 1215463)
-- Name: uffici uffici_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.uffici
    ADD CONSTRAINT uffici_pkey PRIMARY KEY (id);


--
-- TOC entry 3163 (class 2606 OID 1215530)
-- Name: utenti utenti_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.utenti
    ADD CONSTRAINT utenti_pkey PRIMARY KEY (id);


--
-- TOC entry 3176 (class 2606 OID 1215578)
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- TOC entry 3145 (class 1259 OID 1215931)
-- Name: aree_slug_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX aree_slug_key ON public.aree USING btree (slug);


--
-- TOC entry 3206 (class 1259 OID 1215914)
-- Name: comunicazioni_workflow_id_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX comunicazioni_workflow_id_key ON public.comunicazioni USING btree (workflow_id);


--
-- TOC entry 3190 (class 1259 OID 1215715)
-- Name: customer_satisfaction_servizio_id_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX customer_satisfaction_servizio_id_key ON public.customer_satisfaction USING btree (servizio_id);


--
-- TOC entry 3164 (class 1259 OID 1215707)
-- Name: istanze_data_invio_idx; Type: INDEX; Schema: public; Owner: io_user
--

CREATE INDEX istanze_data_invio_idx ON public.istanze USING btree (data_invio);


--
-- TOC entry 3167 (class 1259 OID 1215708)
-- Name: istanze_proto_numero_idx; Type: INDEX; Schema: public; Owner: io_user
--

CREATE INDEX istanze_proto_numero_idx ON public.istanze USING btree (proto_numero);


--
-- TOC entry 3168 (class 1259 OID 1215706)
-- Name: istanze_servizio_id_idx; Type: INDEX; Schema: public; Owner: io_user
--

CREATE INDEX istanze_servizio_id_idx ON public.istanze USING btree (servizio_id);


--
-- TOC entry 3169 (class 1259 OID 1215705)
-- Name: istanze_utente_id_idx; Type: INDEX; Schema: public; Owner: io_user
--

CREATE INDEX istanze_utente_id_idx ON public.istanze USING btree (utente_id);


--
-- TOC entry 3131 (class 1259 OID 1215701)
-- Name: operatori_user_name_idx; Type: INDEX; Schema: public; Owner: io_user
--

CREATE INDEX operatori_user_name_idx ON public.operatori USING btree (user_name);


--
-- TOC entry 3132 (class 1259 OID 1215700)
-- Name: operatori_user_name_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX operatori_user_name_key ON public.operatori USING btree (user_name);


--
-- TOC entry 3187 (class 1259 OID 1215714)
-- Name: pagamenti_effettuati_workflow_id_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX pagamenti_effettuati_workflow_id_key ON public.pagamenti_effettuati USING btree (workflow_id);


--
-- TOC entry 3184 (class 1259 OID 1215713)
-- Name: pagamenti_step_id_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX pagamenti_step_id_key ON public.pagamenti USING btree (step_id);


--
-- TOC entry 3191 (class 1259 OID 1215716)
-- Name: ricevute_modulo_id_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX ricevute_modulo_id_key ON public.ricevute USING btree (modulo_id);


--
-- TOC entry 3207 (class 1259 OID 1215915)
-- Name: risposte_comunicazioni_comunicazione_id_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX risposte_comunicazioni_comunicazione_id_key ON public.risposte_comunicazioni USING btree (comunicazione_id);


--
-- TOC entry 3133 (class 1259 OID 1215702)
-- Name: ruoli_nome_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX ruoli_nome_key ON public.ruoli USING btree (nome);


--
-- TOC entry 3138 (class 1259 OID 1215703)
-- Name: ruoli_user_nome_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX ruoli_user_nome_key ON public.ruoli_user USING btree (nome);


--
-- TOC entry 3148 (class 1259 OID 1215932)
-- Name: servizi_slug_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX servizi_slug_key ON public.servizi USING btree (slug);


--
-- TOC entry 3196 (class 1259 OID 1215717)
-- Name: statistiche_giornaliere_data_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX statistiche_giornaliere_data_key ON public.statistiche_giornaliere USING btree (data);


--
-- TOC entry 3199 (class 1259 OID 1215718)
-- Name: statistiche_pagamenti_data_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX statistiche_pagamenti_data_key ON public.statistiche_pagamenti USING btree (data);


--
-- TOC entry 3170 (class 1259 OID 1215709)
-- Name: status_ordine_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX status_ordine_key ON public.status USING btree (ordine);


--
-- TOC entry 3179 (class 1259 OID 1215712)
-- Name: tributi_codice_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX tributi_codice_key ON public.tributi USING btree (codice);


--
-- TOC entry 3161 (class 1259 OID 1215704)
-- Name: utenti_codice_fiscale_key; Type: INDEX; Schema: public; Owner: io_user
--

CREATE UNIQUE INDEX utenti_codice_fiscale_key ON public.utenti USING btree (codice_fiscale);


--
-- TOC entry 3173 (class 1259 OID 1215711)
-- Name: workflows_data_variazione_idx; Type: INDEX; Schema: public; Owner: io_user
--

CREATE INDEX workflows_data_variazione_idx ON public.workflows USING btree (data_variazione);


--
-- TOC entry 3174 (class 1259 OID 1215710)
-- Name: workflows_istanza_id_idx; Type: INDEX; Schema: public; Owner: io_user
--

CREATE INDEX workflows_istanza_id_idx ON public.workflows USING btree (istanza_id);


--
-- TOC entry 3221 (class 2606 OID 1215769)
-- Name: allegati_richiesti allegati_richiesti_notifica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati_richiesti
    ADD CONSTRAINT allegati_richiesti_notifica_id_fkey FOREIGN KEY (notifica_id) REFERENCES public.notifiche(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3222 (class 2606 OID 1215764)
-- Name: allegati_richiesti allegati_richiesti_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati_richiesti
    ADD CONSTRAINT allegati_richiesti_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.steps(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3238 (class 2606 OID 1215926)
-- Name: allegati_risposta allegati_risposta_risposta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati_risposta
    ADD CONSTRAINT allegati_risposta_risposta_id_fkey FOREIGN KEY (risposta_id) REFERENCES public.risposte_comunicazioni(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3230 (class 2606 OID 1215814)
-- Name: allegati allegati_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.allegati
    ADD CONSTRAINT allegati_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3236 (class 2606 OID 1215916)
-- Name: comunicazioni comunicazioni_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.comunicazioni
    ADD CONSTRAINT comunicazioni_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3234 (class 2606 OID 1215834)
-- Name: customer_satisfaction customer_satisfaction_servizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.customer_satisfaction
    ADD CONSTRAINT customer_satisfaction_servizio_id_fkey FOREIGN KEY (servizio_id) REFERENCES public.servizi(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3223 (class 2606 OID 1215779)
-- Name: istanze istanze_servizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.istanze
    ADD CONSTRAINT istanze_servizio_id_fkey FOREIGN KEY (servizio_id) REFERENCES public.servizi(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3224 (class 2606 OID 1215774)
-- Name: istanze istanze_utente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.istanze
    ADD CONSTRAINT istanze_utente_id_fkey FOREIGN KEY (utente_id) REFERENCES public.utenti(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3216 (class 2606 OID 1215739)
-- Name: operatore_servizi operatore_servizi_operatore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.operatore_servizi
    ADD CONSTRAINT operatore_servizi_operatore_id_fkey FOREIGN KEY (operatore_id) REFERENCES public.operatori(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3217 (class 2606 OID 1215744)
-- Name: operatore_servizi operatore_servizi_servizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.operatore_servizi
    ADD CONSTRAINT operatore_servizi_servizio_id_fkey FOREIGN KEY (servizio_id) REFERENCES public.servizi(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3212 (class 2606 OID 1215719)
-- Name: operatori_ruoli operatori_ruoli_operatore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.operatori_ruoli
    ADD CONSTRAINT operatori_ruoli_operatore_id_fkey FOREIGN KEY (operatore_id) REFERENCES public.operatori(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3213 (class 2606 OID 1215724)
-- Name: operatori_ruoli operatori_ruoli_ruolo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.operatori_ruoli
    ADD CONSTRAINT operatori_ruoli_ruolo_id_fkey FOREIGN KEY (ruolo_id) REFERENCES public.ruoli(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3231 (class 2606 OID 1215824)
-- Name: pagamenti pagamenti_codice_tributo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.pagamenti
    ADD CONSTRAINT pagamenti_codice_tributo_id_fkey FOREIGN KEY (codice_tributo_id) REFERENCES public.tributi(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3233 (class 2606 OID 1215829)
-- Name: pagamenti_effettuati pagamenti_effettuati_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.pagamenti_effettuati
    ADD CONSTRAINT pagamenti_effettuati_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3232 (class 2606 OID 1215819)
-- Name: pagamenti pagamenti_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.pagamenti
    ADD CONSTRAINT pagamenti_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.steps(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3235 (class 2606 OID 1215839)
-- Name: ricevute ricevute_modulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.ricevute
    ADD CONSTRAINT ricevute_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.servizi(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3237 (class 2606 OID 1215921)
-- Name: risposte_comunicazioni risposte_comunicazioni_comunicazione_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.risposte_comunicazioni
    ADD CONSTRAINT risposte_comunicazioni_comunicazione_id_fkey FOREIGN KEY (comunicazione_id) REFERENCES public.comunicazioni(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3214 (class 2606 OID 1215729)
-- Name: servizi servizi_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.servizi
    ADD CONSTRAINT servizi_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.aree(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3218 (class 2606 OID 1215754)
-- Name: servizi_ruoli_user servizi_ruoli_user_ruolo_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.servizi_ruoli_user
    ADD CONSTRAINT servizi_ruoli_user_ruolo_user_id_fkey FOREIGN KEY (ruolo_user_id) REFERENCES public.ruoli_user(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3219 (class 2606 OID 1215749)
-- Name: servizi_ruoli_user servizi_ruoli_user_servizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.servizi_ruoli_user
    ADD CONSTRAINT servizi_ruoli_user_servizio_id_fkey FOREIGN KEY (servizio_id) REFERENCES public.servizi(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3215 (class 2606 OID 1215734)
-- Name: servizi servizi_ufficio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.servizi
    ADD CONSTRAINT servizi_ufficio_id_fkey FOREIGN KEY (ufficio_id) REFERENCES public.uffici(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3220 (class 2606 OID 1215759)
-- Name: steps steps_servizio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.steps
    ADD CONSTRAINT steps_servizio_id_fkey FOREIGN KEY (servizio_id) REFERENCES public.servizi(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3225 (class 2606 OID 1215789)
-- Name: workflows workflows_istanza_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_istanza_id_fkey FOREIGN KEY (istanza_id) REFERENCES public.istanze(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3226 (class 2606 OID 1215799)
-- Name: workflows workflows_notifica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_notifica_id_fkey FOREIGN KEY (notifica_id) REFERENCES public.notifiche(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3227 (class 2606 OID 1215809)
-- Name: workflows workflows_operatore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_operatore_id_fkey FOREIGN KEY (operatore_id) REFERENCES public.operatori(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3228 (class 2606 OID 1215804)
-- Name: workflows workflows_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.status(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3229 (class 2606 OID 1215794)
-- Name: workflows workflows_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: io_user
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.steps(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3431 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


-- Completed on 2026-03-20 13:51:48

--
-- PostgreSQL database dump complete
--

\unrestrict gGpTfm3XbiNPhl9g0Qf4MmanjZZkOhhnGKOlHnCcfoctAqOzek9yTpzEmZGf0Hl

