#!/usr/bin/env bash
# Instalação do Lex Detetive a partir do código-fonte (macOS / Linux).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Lex Detetive — instalação"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale a versão 20 ou superior (macOS: brew install node)." >&2
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then echo "Node.js $NODE_MAJOR é antigo. Use 20 ou superior." >&2; exit 1; fi

echo "==> Instalando dependências"
npm install --no-audit --no-fund
# npm 11+ bloqueia scripts de instalação; o Prisma precisa deles para baixar o motor do banco.
npm install-scripts approve prisma @prisma/client @prisma/engines >/dev/null 2>&1 || true
npm rebuild prisma @prisma/client @prisma/engines >/dev/null 2>&1 || true

echo "==> Compilando interface e servidor"
npm run build

echo "==> Preparando banco de dados local (~/.lex-detetive)"
npm run db:migrate -w apps/api

if command -v ollama >/dev/null 2>&1; then
  echo "==> Ollama encontrado: $(ollama --version 2>/dev/null | head -1)"
else
  echo "==> Ollama não encontrado (opcional, para IA local): https://ollama.com"
fi

echo
echo "Pronto! Para iniciar:  npm start"
echo "Depois abra:           http://localhost:3333"
