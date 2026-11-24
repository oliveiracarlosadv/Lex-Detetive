#!/usr/bin/env bash
# Desenvolvimento: API (NestJS, porta 3333, recarga automática) + interface (Next.js, porta 3000).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build -w apps/api >/dev/null
node apps/api/dist/migrate.js
trap 'kill 0' EXIT
npm run dev -w apps/api &
npm run dev -w apps/web &
wait
