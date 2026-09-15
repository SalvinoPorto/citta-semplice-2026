#!/usr/bin/env bash
# Crea i segreti Swarm dello stack. Da lanciare su un nodo manager.
#
#   infra/produzione/scripts/crea-segreti.sh            # versione v1
#   infra/produzione/scripts/crea-segreti.sh v2         # rotazione
#   TLS_CERT=/percorso/fullchain.pem TLS_KEY=/percorso/privkey.pem \
#     infra/produzione/scripts/crea-segreti.sh
#
# I valori si digitano senza eco: non finiscono né nella history né su file.
# I segreti già esistenti vengono saltati; un valore vuoto salta il segreto.
# stack.yml li richiede TUTTI: per un'integrazione non ancora attiva inserire
# un segnaposto (es. "non-configurato"), altrimenti il deploy fallisce con
# "secret not found".
set -euo pipefail

versione=${1:-v1}

crea() {
  local nome="citta_${1}_${versione}" descrizione=$2 valore
  if docker secret inspect "$nome" >/dev/null 2>&1; then
    echo "= $nome esiste già"
    return
  fi
  read -rsp "$descrizione: " valore
  echo
  if [ -z "$valore" ]; then
    echo "- $nome saltato (valore vuoto): stack.yml lo richiede, il deploy fallirà finché non esiste"
    return
  fi
  printf '%s' "$valore" | docker secret create "$nome" - >/dev/null
  echo "+ $nome"
}

crea_da_file() {
  local nome="citta_${1}_${versione}" file=$2
  if docker secret inspect "$nome" >/dev/null 2>&1; then
    echo "= $nome esiste già"
  elif [ -n "$file" ] && [ -r "$file" ]; then
    docker secret create "$nome" "$file" >/dev/null
    echo "+ $nome (da $file)"
  else
    echo "- $nome saltato: imposta ${1^^} con il percorso del file"
  fi
}

echo "Password nelle URL: codificarle (@ -> %40, : -> %3A, / -> %2F)."
crea database_url              "DATABASE_URL applicativa (postgresql://citta_app_v1:PWD@10.30.0.10:5432/io_db?schema=public)"
crea database_url_migrazioni   "DATABASE_URL migrazioni (postgresql://citta_owner:PWD@10.30.0.10:5432/io_db?schema=public)"
crea s3_access_key_id          "S3 access key id (garage key create)"
crea s3_secret_access_key      "S3 secret access key"
crea portal_nextauth_secret    "NEXTAUTH_SECRET portal (openssl rand -base64 48)"
crea office_nextauth_secret    "NEXTAUTH_SECRET office (openssl rand -base64 48, diverso dal portal)"
crea cron_secret               "CRON_SECRET (openssl rand -hex 32)"
crea cig_secret_key            "CIG_SECRET_KEY (SSO dell'ente)"
crea urbi_password             "URBI_PASSWORD"
crea pmpay_password            "PMPAY_PASSWORD"
crea_da_file tls_cert "${TLS_CERT:-}"
crea_da_file tls_key  "${TLS_KEY:-}"
