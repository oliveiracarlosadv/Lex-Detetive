#!/usr/bin/env bash
# Monta o site público (GitHub Pages): página de apresentação na raiz e o app web em /app/.
# Uso: bash scripts/build-pages.sh [pasta-de-saída]   (padrão: dist-pages)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-dist-pages}"
REPO_PATH="${PAGES_BASE:-/Lex-Detetive}"

rm -rf "$OUT" && mkdir -p "$OUT"
echo "==> App web (PWA) em ${REPO_PATH}/app"
( cd apps/web && rm -rf out .next && NEXT_PUBLIC_BASE_PATH="${REPO_PATH}/app" npx next build >/dev/null 2>&1 || NEXT_PUBLIC_BASE_PATH="${REPO_PATH}/app" npx next build )
cp -R apps/web/out "$OUT/app"
# Versão única desta publicação no modo offline (força o navegador a buscar a atualização).
STAMP="$(date +%Y%m%d%H%M%S)"
sed -i '' "s/const VERSION = 'dev';/const VERSION = '${STAMP}';/" "$OUT/app/sw.js"
echo "==> Página de apresentação"
cp -R site/. "$OUT/"
touch "$OUT/.nojekyll"   # o GitHub Pages não deve processar as pastas que começam com "_" (_next)
echo "Site pronto em $OUT"
