#!/bin/sh
# Executado pelo apt/dpkg após remover o Lex Detetive.
# "remove" mantém os dados; "purge" (apt purge lex-detetive-desktop) também é só do pacote:
# os dados ficam na pasta de cada usuário (~/.lex-detetive) e são apagados manualmente.
if [ "$1" = "purge" ]; then
  echo "Lex Detetive removido. Para apagar também os dados de um usuário: rm -rf ~/.lex-detetive"
fi
exit 0
