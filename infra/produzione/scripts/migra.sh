#!/usr/bin/env bash
# Applica le migrazioni Prisma (`prisma migrate deploy`) come servizio Swarm
# one-shot, con l'utente proprietario dello schema. Va eseguito PRIMA di
# deploy.sh quando una release contiene migrazioni.
#
#   VERSIONE=v1.2.0 infra/produzione/scripts/migra.sh
#
# Esce con 0 solo se il job termina con successo.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${VERSIONE:?imposta VERSIONE (es. VERSIONE=v1.2.0)}"
set -a
# shellcheck disable=SC1091
. ./config.env
set +a

nome=citta_migrazioni
docker service rm "$nome" >/dev/null 2>&1 || true

docker service create \
  --name "$nome" \
  --detach \
  --with-registry-auth \
  --restart-condition none \
  --constraint node.role==manager \
  --secret source="${SEGRETO_DATABASE_URL_MIGRAZIONI:-citta_database_url_migrazioni_v1}",target=database_url \
  "${REGISTRY}/citta-migrator:${VERSIONE}" >/dev/null

docker service logs --follow --raw "$nome" &
log_pid=$!
trap 'kill "$log_pid" 2>/dev/null || true; docker service rm "$nome" >/dev/null 2>&1 || true' EXIT

esito=1
while :; do
  stato=$(docker service ps "$nome" --no-trunc --format '{{.CurrentState}}' | head -n1)
  case "$stato" in
    Complete*) esito=0; break ;;
    Failed* | Rejected* | Shutdown* | Orphaned*) break ;;
  esac
  sleep 2
done

sleep 2 # lascia arrivare le ultime righe di log
[ "$esito" -eq 0 ] && echo "Migrazioni applicate." || echo "Migrazioni FALLITE: stato $stato" >&2
exit "$esito"
