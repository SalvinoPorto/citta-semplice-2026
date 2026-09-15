#!/bin/sh
# Invoca un job dell'office con l'header x-cron-secret.
# Uso: chiama /api/cron/protocollazione
#
# Il segreto passa a curl da stdin (-H @-), non sulla riga di comando: così non
# compare nella lista dei processi.
set -eu

percorso=${1:?uso: chiama /api/cron/<job>}
segreto=$(cat /run/secrets/cron_secret)

printf 'x-cron-secret: %s\n' "$segreto" | curl \
  --silent --show-error --fail-with-body \
  --max-time "${CRON_MAX_TIME:-900}" \
  -H @- \
  "${OFFICE_URL:-http://office:3000}${percorso}"
