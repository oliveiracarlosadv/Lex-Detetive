; Lex Detetive — personalizações do instalador/desinstalador do Windows (NSIS)

!macro customInstall
  ; Atalho do desinstalador no Menu Iniciar (pasta "Lex Detetive")
  CreateShortCut "$SMPROGRAMS\Lex Detetive\Desinstalar Lex Detetive.lnk" "$INSTDIR\Uninstall Lex Detetive.exe"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Lex Detetive\Desinstalar Lex Detetive.lnk"
  ; Em atualizações o desinstalador roda em modo silencioso: nunca apagar dados nesse caso.
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Deseja apagar também TODOS os dados do Lex Detetive?$\r$\n$\r$\nIsso inclui banco de dados, clientes, processos, e-mails, configurações e backups (pasta $PROFILE\.lex-detetive).$\r$\n$\r$\nEsta ação não pode ser desfeita." /SD IDNO IDNO lexKeepData
      RMDir /r "$PROFILE\.lex-detetive"
      Goto lexDone
    lexKeepData:
      MessageBox MB_OK|MB_ICONINFORMATION "Seus dados foram mantidos em $PROFILE\.lex-detetive e serão usados se você reinstalar o Lex Detetive." /SD IDOK
    lexDone:
  ${endIf}
!macroend
