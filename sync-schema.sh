#!/usr/bin/env bash
# Sincronizza lo schema Prisma canonico nelle app office e portal.
# Unica fonte di verità: prisma/schema.prisma
set -euo pipefail

cd "$(dirname "$0")"

CANONICAL="prisma/schema.prisma"
TARGETS=(
  "citta-semplice-office/prisma/schema.prisma"
  "citta-semplice-portal/prisma/schema.prisma"
)

if [ ! -f "$CANONICAL" ]; then
  echo "✗ schema canonico non trovato: $CANONICAL" >&2
  exit 1
fi

for t in "${TARGETS[@]}"; do
  mkdir -p "$(dirname "$t")"
  cp "$CANONICAL" "$t"
  echo "✓ sincronizzato → $t"
done

echo ""
echo "Ora rigenera i client Prisma nelle app:"
echo "  (cd citta-semplice-office && npm run db:generate)"
echo "  (cd citta-semplice-portal && npm run db:generate)"
