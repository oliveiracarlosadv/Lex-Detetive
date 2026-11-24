-- Desinstalador do Lex Detetive para macOS
set appPath to "/Applications/Lex Detetive.app"
set dataPath to (POSIX path of (path to home folder)) & ".lex-detetive"

display dialog "Deseja desinstalar o Lex Detetive deste Mac?" buttons {"Cancelar", "Desinstalar"} default button "Cancelar" cancel button "Cancelar" with title "Desinstalar Lex Detetive" with icon caution

set choice to button returned of (display dialog "Deseja apagar também TODOS os dados do Lex Detetive?" & return & return & "Isso inclui banco de dados, clientes, processos, e-mails, configurações e backups (" & dataPath & ")." & return & return & "Esta ação não pode ser desfeita." buttons {"Manter meus dados", "Apagar tudo"} default button "Manter meus dados" with title "Desinstalar Lex Detetive" with icon caution)

try
	tell application "Lex Detetive" to quit
end try
delay 1

try
	do shell script "rm -rf " & quoted form of appPath & "; pkgutil --forget com.lextecnologias.lexdetetive >/dev/null 2>&1; true" with administrator privileges
on error errMsg
	display dialog "Não foi possível remover o aplicativo: " & errMsg buttons {"OK"} default button "OK" with icon stop
	return
end try

if choice is "Apagar tudo" then
	do shell script "rm -rf " & quoted form of dataPath
	set msg to "O Lex Detetive e todos os seus dados foram removidos."
else
	set msg to "O Lex Detetive foi removido. Seus dados foram mantidos em " & dataPath & "."
end if
display dialog msg buttons {"OK"} default button "OK" with title "Desinstalar Lex Detetive"
