#!/bin/sh
# Carica il dump con i dati di test al PRIMO avvio del container Postgres.
#
# L'entrypoint dell'immagine esegue gli script di /docker-entrypoint-initdb.d
# solo quando la cartella dati è vuota: con un volume già inizializzato questo
# file viene ignorato (per ricaricare: docker compose down, poi
# docker volume rm citta-semplice-2026_postgres_data).
#
# Il dump non contiene _prisma_migrations: lo schema arriva interamente da qui.
set -eu

DUMP=/seed/db_demo.sql

if [ ! -f "$DUMP" ]; then
  echo "[seed] $DUMP assente: database lasciato vuoto"
  exit 0
fi

echo "[seed] caricamento di $DUMP in $POSTGRES_DB..."

# Il dump è prodotto da pg_dump 18 su un server 15: `SET transaction_timeout`
# esiste solo da Postgres 17 e con ON_ERROR_STOP farebbe fallire l'intero
# caricamento. Lo si scarta in lettura, senza modificare il file.
sed '/^SET transaction_timeout = /d' "$DUMP" |
  psql -v ON_ERROR_STOP=1 --quiet \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

echo "[seed] dump caricato"
