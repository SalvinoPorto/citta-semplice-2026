-- ============================================================================
-- PRIMA dell'import massivo: mette da parte quello che rallenta 300k INSERT.
--
-- Da lanciare DOPO `prisma migrate deploy` (che crea colonna, indici e trigger)
-- e PRIMA di `npm run migrate-dati`.
--
-- PERCHÉ
--   - L'indice GIN mantenuto riga per riga durante 300k INSERT costa molto più
--     che ricostruirlo in blocco alla fine (misurato: 12 s su dati_in_evidenza,
--     ~2 min per l'indice su `ricerca` con backfill incluso).
--   - I trigger `ricerca_*` fanno, per ogni riga, un lookup su `utenti` e il
--     parsing del JSON: corretto a regime, sprecato durante un import che
--     verrà comunque richiuso da un backfill unico.
--
-- Il ripristino NON è opzionale: senza 03-post-import-ricerca.sql la ricerca
-- della lista istanze resta vuota e le istanze nuove non entrano nell'indice.
-- Lo script 03 verifica entrambe le cose e si rifiuta di chiudere in silenzio.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS "istanze_ricerca_trgm";
DROP INDEX IF EXISTS "istanze_dati_in_evidenza_trgm";

ALTER TABLE "istanze" DISABLE TRIGGER "ricerca_su_istanza";
ALTER TABLE "utenti"  DISABLE TRIGGER "ricerca_su_utente";

COMMIT;

\echo ''
\echo '>>> Indici trigram rimossi e trigger di ricerca disattivati.'
\echo '>>> Ora: npm run migrate-dati'
\echo '>>> Poi OBBLIGATORIAMENTE: psql -f sql/03-post-import-ricerca.sql'
\echo ''
