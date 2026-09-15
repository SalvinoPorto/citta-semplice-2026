#!/bin/sh
# Entrypoint delle immagini applicative.
#
# Docker Swarm monta i segreti come file in /run/secrets/<target>, ma le app
# leggono solo variabili d'ambiente. Qui ogni file diventa la variabile omonima
# in maiuscolo: /run/secrets/database_url -> DATABASE_URL.
#
# Con docker compose di sviluppo la cartella non esiste e lo script non fa
# nulla. Un segreto vince su una variabile d'ambiente con lo stesso nome.
set -eu

if [ -d /run/secrets ]; then
  for file in /run/secrets/*; do
    [ -f "$file" ] || continue
    nome=$(basename "$file" | tr '[:lower:]-' '[:upper:]_')
    case "$nome" in
      *[!A-Z0-9_]* | [0-9]*)
        echo "carica-segreti: nome non valido per una variabile, ignorato: $file" >&2
        continue
        ;;
    esac
    export "$nome=$(cat "$file")"
  done
fi

exec "$@"
