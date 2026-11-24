#!/usr/bin/env bash
# Dá nomes claros aos instaladores e cria o LEIA-ME da pasta.
# Uso: bash scripts/installer-names.sh <pasta> <versão>
set -euo pipefail
DIR="$1"; VERSION="$2"
shopt -s nullglob
for f in "$DIR"/*mac-arm64*; do mv "$f" "${f/mac-arm64/Mac-Apple-Silicon-M1-M4}"; done
for f in "$DIR"/*mac-x64*;   do mv "$f" "${f/mac-x64/Mac-Intel}"; done
for f in "$DIR"/*linux-amd64*.deb; do mv "$f" "${f/linux-amd64/Linux-Ubuntu-Debian}"; done
for f in "$DIR"/*linux-x86_64*.AppImage; do mv "$f" "${f/linux-x86_64/Linux-qualquer-distribuicao}"; done
for f in "$DIR"/Lex-Detetive-Setup-*.exe; do mv "$f" "$DIR/Lex-Detetive-${VERSION}-Windows-Setup.exe"; done
has() { compgen -G "$DIR/*$1*" >/dev/null; }
{
  echo "LEX DETETIVE ${VERSION} — QUAL INSTALADOR USAR"
  echo
  if has Mac-Apple-Silicon; then
    echo "MAC COM CHIP APPLE (M1, M2, M3 ou M4)  ← a maioria dos Macs a partir de 2021"
    echo "  Lex-Detetive-${VERSION}-Mac-Apple-Silicon-M1-M4.pkg   (recomendado: instalador passo a passo)"
    echo "  Lex-Detetive-${VERSION}-Mac-Apple-Silicon-M1-M4.dmg   (alternativa: arrastar para Aplicativos)"
    echo
  fi
  if has Mac-Intel; then
    echo "MAC COM PROCESSADOR INTEL  ← Macs até 2020"
    echo "  Lex-Detetive-${VERSION}-Mac-Intel.pkg"
    echo "  Lex-Detetive-${VERSION}-Mac-Intel.dmg"
    echo
  fi
  if has Mac-; then
    echo "  Como saber: menu  → Sobre este Mac."
    echo "    \"Chip Apple M1/M2/M3/M4\"  → use Apple Silicon"
    echo "    \"Processador Intel\"       → use Intel"
    echo
  else
    echo "MAC: esta versão não tem instalador para Mac. Use uma versão mais recente."
    echo
  fi
  if has Windows-Setup; then
    echo "WINDOWS 10 ou 11 (64 bits)"
    echo "  Lex-Detetive-${VERSION}-Windows-Setup.exe"
    echo
  fi
  if has Linux-; then
    echo "LINUX"
    has Linux-Ubuntu && echo "  Ubuntu / Debian:        Lex-Detetive-${VERSION}-Linux-Ubuntu-Debian.deb"
    has Linux-qualquer && echo "  Qualquer distribuição:  Lex-Detetive-${VERSION}-Linux-qualquer-distribuicao.AppImage"
    echo
  fi
  echo "Atualizando uma versão anterior: instale por cima; seus dados são mantidos."
  echo "Requisitos mínimos: 4 GB de memória RAM e processador Intel Core i3 (ou equivalente)."
} > "$DIR/LEIA-ME - qual instalador usar.txt"
