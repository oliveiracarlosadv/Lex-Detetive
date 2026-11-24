#!/usr/bin/env bash
# Espelha no Google Drive SOMENTE o código-fonte, a documentação, a identidade visual
# e os instaladores — nada de node_modules, builds intermediários ou bancos de dados.
# Destino padrão pode ser trocado com LEX_DRIVE_DIR.
set -euo pipefail
cd "$(dirname "$0")/.."
# Pasta do projeto no Google Drive deste computador (qualquer conta conectada).
DEFAULT_DEST="$(ls -d "$HOME"/Library/CloudStorage/GoogleDrive-*/"Meu Drive/00.4 -  LexTecnologias/01 - Sistemas/04 - Lex Detetive" 2>/dev/null | head -1)"
DEST="${LEX_DRIVE_DIR:-$DEFAULT_DEST}"
[ -d "$DEST" ] || { echo "Pasta do Drive não encontrada: $DEST" >&2; exit 1; }

echo "==> Código-fonte → $DEST/codigo-fonte"
rsync -a --delete \
  --exclude '.git/' --exclude 'node_modules/' --exclude 'dist/' --exclude '.next/' --exclude 'out/' \
  --exclude 'apps/api/public/' --exclude 'apps/desktop/staging/' --exclude 'installers/' --exclude 'dist-pages/' --exclude 'apps/web/out/' \
  --exclude 'apps/desktop/build/mac/*.app/' --exclude '*.db' --exclude '*.db-*' --exclude '.env' \
  --exclude '*.tsbuildinfo' --exclude 'next-env.d.ts' --exclude '.DS_Store' \
  ./ "$DEST/codigo-fonte/"

echo "==> Documentação e identidade visual"
rsync -a --delete docs/ "$DEST/documentacao/"
rsync -a --delete brand/ "$DEST/identidade-visual/"

# Instaladores só com --instaladores (na publicação). Sem a opção, a sincronização do dia a dia
# não mexe na pasta de instaladores — evita trocar a versão publicada por um instalador de teste.
if [ "${1:-}" != "--instaladores" ]; then
  echo "==> Instaladores: não alterados (use --instaladores ao publicar)"
  echo "Sincronizado."
  exit 0
fi
echo "==> Instaladores"
# Instaladores em instaladores/vX.Y.Z/ — só a última versão é mantida no Drive.
VERSION="${LEX_VERSION:-$(node -p "require('./apps/desktop/package.json').version")}"
VDIR="$DEST/instaladores/v$VERSION"
shopt -s nullglob
files=(installers/build/*-"$VERSION"*.{pkg,dmg,exe,AppImage,deb})
if [ ${#files[@]} -gt 0 ]; then
  mkdir -p "$VDIR"
  for f in "${files[@]}"; do rsync -a "$f" "$VDIR/"; done
  bash scripts/installer-names.sh "$VDIR" "$VERSION"   # nomes claros (Apple Silicon/Intel…) + LEIA-ME
  # No Drive fica só a última versão (as anteriores vão para a lixeira do Google Drive).
  # Exceção: pastas "-somente-Windows", mantidas enquanto o Windows não puder ser gerado.
  for old in "$DEST"/instaladores/v*; do
    if [ -d "$old" ] && [ "$old" != "$VDIR" ] && [[ "$old" != *-somente-Windows ]]; then
      rm -rf -- "$old"
      echo "   versão anterior removida: $(basename "$old")"
    fi
  done
  echo "   ${#files[@]} instalador(es) em instaladores/v$VERSION"
else
  echo "   Nenhum instalador da versão $VERSION em installers/build (baixe com: gh release download v$VERSION -D installers/build)"
fi
# Arquivos soltos de sincronizações antigas vão para a pasta da versão correspondente.
for f in "$DEST"/instaladores/*.{pkg,dmg,exe,AppImage,deb}; do
  v=$(basename "$f" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  [ -n "$v" ] && mkdir -p "$DEST/instaladores/v$v" && mv "$f" "$DEST/instaladores/v$v/"
done

echo "Sincronizado."
