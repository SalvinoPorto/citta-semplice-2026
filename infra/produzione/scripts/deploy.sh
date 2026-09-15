#!/usr/bin/env bash
# Deploy o aggiornamento dello stack `citta`. Da lanciare su un nodo manager.
#
#   VERSIONE=v1.2.0 infra/produzione/scripts/deploy.sh
#
# Idempotente: rilanciarlo con la stessa versione non riavvia nulla; con una
# versione nuova esegue il rolling update definito in stack.yml.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${VERSIONE:?imposta VERSIONE (es. VERSIONE=v1.2.0)}"
[ -f config.env ] || { echo "manca config.env: copia config.env.example e compilalo" >&2; exit 1; }

set -a
# shellcheck disable=SC1091
. ./config.env
set +a
export VERSIONE

# Configs Swarm immutabili: il nome cambia quando cambia il contenuto.
TRAEFIK_DINAMICA_HASH=$(sha256sum traefik/dinamica.yml | cut -c1-12)
CRONTAB_HASH=$(sha256sum cron/crontab | cut -c1-12)
export TRAEFIK_DINAMICA_HASH CRONTAB_HASH

echo "Deploy di citta ${VERSIONE} da ${REGISTRY}"
docker stack deploy \
  --compose-file stack.yml \
  --with-registry-auth \
  --prune \
  --detach=false \
  citta

# Le configs delle versioni precedenti restano: si rimuovono quelle non più usate
# (docker rifiuta di cancellare una config ancora montata).
docker config ls --filter label=com.docker.stack.namespace=citta --format '{{.Name}}' \
  | grep -v -e "_${TRAEFIK_DINAMICA_HASH}\$" -e "_${CRONTAB_HASH}\$" \
  | xargs -r docker config rm >/dev/null 2>&1 || true

docker stack services citta
