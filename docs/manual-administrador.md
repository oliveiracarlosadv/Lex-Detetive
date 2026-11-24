# Manual do Administrador

## Usuários e perfis
Configurações → **Usuários**.

| Perfil | Pode |
|---|---|
| admin | Tudo, inclusive usuários, configurações, chaves, backup e auditoria |
| analista | Pesquisar, monitorar, clientes, IA, relatórios, e-mail |
| leitor | Somente consulta (não altera dados; não vê documentos completos) |

Recomende a todos ativar **2FA** em Configurações → Segurança.

## Lex AI
Configurações → **Lex AI**: escolha o provedor (Ollama, LM Studio, OpenAI, Gemini, Claude, Grok, OpenRouter), o modelo e a chave de API (guardada criptografada). Use **Testar**. O **resumo automático** de movimentações/intimações pode ser desligado.

- Local (Ollama/LM Studio): os dados não saem do computador.
- Nuvem: os dados do processo enviados para análise saem para o provedor escolhido — avalie a base legal (LGPD) e o contrato com o provedor.

## Fontes
- **Portal da Transparência (CEIS/CNEP):** cadastre-se em portaldatransparencia.gov.br/api-de-dados para obter a chave gratuita.
- **DataJud:** usa a chave pública divulgada pelo CNJ; troque se o CNJ publicar outra.

## E-mail (Gmail) — configuração única
1. Acesse **console.cloud.google.com** → crie um projeto (ex.: “Lex Detetive”).
2. **APIs e serviços → Biblioteca → Gmail API → Ativar**.
3. **Tela de permissão OAuth**: tipo **Externo**; nome “Lex Detetive”; adicione os e-mails dos usuários como **usuários de teste** (ou publique o app).
4. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
5. Em **URIs de redirecionamento autorizados**, adicione exatamente o endereço exibido em Configurações → E-mail (padrão: `http://127.0.0.1:3333/api/mail/oauth/callback`).
   - Para o botão **Entrar com Google** na tela de entrada, adicione também `http://127.0.0.1:3333/api/auth/google/callback`. O login pelo Google só aceita e-mails de usuários já cadastrados no app.
6. Copie **Client ID** e **Client Secret** para Configurações → E-mail → **Salvar credenciais**.
7. Cada usuário clica em **Conectar com Google** e autoriza. No app desktop a autorização abre no navegador padrão.

Escopos usados: `gmail.compose` (enviar e rascunhos) e `gmail.readonly` (listar “Enviados”). O token fica criptografado e pode ser revogado em **Desconectar**.

## Assinatura de e-mail
Em Configurações → E-mail: texto da assinatura e, opcionalmente, **assinatura em imagem** (PNG/JPG, ex.: cartão do escritório). A imagem vai embutida no e-mail (anexo inline), que é o formato exibido pelo Gmail.

## Backup
- Automático **antes de cada atualização** e antes de restaurações.
- Manual: Configurações → **Backup e atualização → Fazer backup agora**, ou menu **Lex Detetive → Fazer backup agora**.
- Os 20 backups mais recentes ficam em `~/.lex-detetive/backups`. **Copie periodicamente para outro local** (HD externo, nuvem privada). O arquivo contém a chave de criptografia: guarde-o com o mesmo cuidado dos dados.

## Auditoria
Menu **Auditoria**: logins (inclusive falhas), pesquisas, visualização de dados sensíveis, criação/alteração/eliminação, relatórios gerados (com hash), e-mails enviados, uso de IA, mudanças de configuração e backups.

## Rede local (vários computadores)
Por padrão o servidor só aceita conexões do próprio computador (`127.0.0.1`). Para uso em rede no escritório, rode o servidor (código-fonte ou Docker) com `HOST=0.0.0.0`, de preferência atrás de HTTPS (proxy reverso) e com 2FA obrigatório.

## Solução de problemas
- Registro do servidor: `~/.lex-detetive/logs/servidor.log` (menu **Abrir registro do servidor**).
- “Porta em uso”: o app tenta 3333–3352; o OAuth do Gmail exige a 3333 — feche o programa que a ocupa.
- IA não responde: confira se o Ollama está aberto (`ollama list`) e o modelo existe.
