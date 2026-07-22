#!/usr/bin/env bash
# Fallisce se le copie di schema Prisma nelle app divergono dal canonico.
# Usare in pre-commit / CI per prevenire drift tra office e portal.
set -euo pipefail

cd "$(dirname "$0")"

CANONICAL="prisma/schema.prisma"
TARGETS=(
  "citta-semplice-office/prisma/schema.prisma"
  "citta-semplice-portal/prisma/schema.prisma"
)

status=0
for t in "${TARGETS[@]}"; do
  if [ ! -f "$t" ]; then
    echo "✗ mancante: $t" >&2
    status=1
    continue
  fi
  if ! diff -q "$CANONICAL" "$t" >/dev/null; then
    echo "✗ DRIFT: $t differisce dal canonico ($CANONICAL)" >&2
    diff "$CANONICAL" "$t" >&2 || true
    status=1
  else
    echo "✓ ok: $t"
  fi
done

if [ "$status" -ne 0 ]; then
  echo "" >&2
  echo "Esegui ./sync-schema.sh per riallineare." >&2
fi
exit "$status"
