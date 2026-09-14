#!/bin/bash
pg_dump -a -t uffici citta_semplice_bck | psql citta_semplice
pg_dump -a -t operatori citta_semplice_bck | psql citta_semplice
pg_dump -a -t utenti citta_semplice_bck | psql citta_semplice
pg_dump -a -t aree citta_semplice_bck | psql citta_semplice
pg_dump -a -t servizi citta_semplice_bck | psql citta_semplice
pg_dump -a -t fasi citta_semplice_bck | psql citta_semplice
pg_dump -a -t steps citta_semplice_bck | psql citta_semplice
psql -c 'ALTER TABLE istanza_attivita DROP CONSTRAINT istanza_attivita_istanza_id_fkey;' citta_semplice
pg_dump -a -t istanza_attivita citta_semplice_bck | psql citta_semplice
pg_dump -a -t istanze citta_semplice_bck | psql citta_semplice
psql -c 'ALTER TABLE istanza_attivita ADD CONSTRAINT istanza_attivita_istanza_id_fkey FOREIGN KEY (istanza_id) REFERENCES public.istanze (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE' citta_semplice
pg_dump -a -t istanza_fasi citta_semplice_bck | psql citta_semplice
pg_dump -a -t allegati citta_semplice_bck | psql citta_semplice
pg_dump -a -t allegati_richiesti citta_semplice_bck | psql citta_semplice
pg_dump -a -t comunicazioni citta_semplice_bck | psql citta_semplice
pg_dump -a -t risposte_comunicazioni citta_semplice_bck | psql citta_semplice
pg_dump -a -t allegati_risposta citta_semplice_bck | psql citta_semplice
pg_dump -a -t customer_satisfaction  citta_semplice_bck | psql citta_semplice
pg_dump -a -t email_config citta_semplice_bck | psql citta_semplice
pg_dump -a -t enti citta_semplice_bck | psql citta_semplice
pg_dump -a -t ruoli citta_semplice_bck | psql citta_semplice
pg_dump -a -t operatori_ruoli citta_semplice_bck | psql citta_semplice
pg_dump -a -t operatori_servizi citta_semplice_bck | psql citta_semplice
pg_dump -a -t pagamenti citta_semplice_bck | psql citta_semplice
pg_dump -a -t pagamenti_attesi citta_semplice_bck | psql citta_semplice
pg_dump -a -t protocollo_emergenza citta_semplice_bck | psql citta_semplice
pg_dump -a -t protocollo_emergenza_counters citta_semplice_bck | psql citta_semplice
pg_dump -a -t ricevute citta_semplice_bck | psql citta_semplice
pg_dump -a -t ruoli_user citta_semplice_bck | psql citta_semplice
pg_dump -a -t servizi_ruoli_user citta_semplice_bck | psql citta_semplice
pg_dump -a -t statistiche_giornaliere citta_semplice_bck | psql citta_semplice
pg_dump -a -t statistiche_pagamenti citta_semplice_bck | psql citta_semplice
