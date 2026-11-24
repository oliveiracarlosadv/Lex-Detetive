# Documentação da API

Base: `http://127.0.0.1:3333/api`. Autenticação: `Authorization: Bearer <token>` (obtido em `/auth/login`). Respostas em JSON.
Perfil **leitor** só pode usar `GET` (exceto senha/2FA). Rotas marcadas *admin* exigem perfil admin.

## Autenticação
| Método | Rota | Descrição |
|---|---|---|
| GET | `/auth/status` | Público. `{ needsSetup }` |
| POST | `/auth/setup` | Público, só sem usuários. `{name,email,password}` → `{token,user}` |
| POST | `/auth/login` | Público. `{email,password,code?}` → `{token,user}` ou `{requires2fa:true}` |
| GET | `/auth/me` | Usuário atual |
| POST | `/auth/password` | `{current,next}` |
| POST | `/auth/2fa/setup` · `/auth/2fa/enable` · `/auth/2fa/disable` | QR code / `{code}` |
| GET/POST/PATCH | `/users`, `/users/:id` | *admin* |

## Pesquisa e fontes
| Método | Rota | Descrição |
|---|---|---|
| POST | `/search` | `{kind,name?,cpf?,cnpj?,rg?,motherName?,fatherName?,tradeName?,partners?,processNumbers?,sources?}` → resultados por fonte |
| GET | `/connectors` | Conectores e status |
| GET | `/sources/catalog` | Cobertura por tribunal/cartório |

## Pessoas e empresas (monitoramento)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/targets?kind=&monitored=&q=` | Lista |
| POST | `/targets` | Cria e executa a pesquisa inicial |
| GET | `/targets/:id?reveal=true` | Detalhe (reveal registra auditoria) |
| PATCH | `/targets/:id` | `{monitored,intervalMinutes,...}` |
| DELETE | `/targets/:id` | Eliminação LGPD |
| POST | `/targets/:id/check` | Verificar agora |
| POST | `/targets/:id/processes` | `{number}` vincula processo CNJ |
| GET | `/processes?q=` · `/processes/:id` | Busca / detalhe com `card` (ficha) |
| GET | `/dashboard` | Indicadores e séries |
| GET | `/alerts?unread=&targetId=` · POST `/alerts/:id/read` · POST `/alerts/read-all` | Alertas |

## Clientes
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/clients` | Lista (`?q=&status=`) / cria |
| GET/PATCH/DELETE | `/clients/:id` | Detalhe / altera / elimina |
| POST | `/clients/:id/processes` | `{processId}` ou `{number}`, `role` |
| DELETE | `/clients/:id/processes/:linkId` | Desvincula |
| POST | `/clients/:id/monitor` | Cria monitoramento do cliente |
| GET | `/cep/:cep` | Endereço pelo CEP |

## Lex AI
| Método | Rota | Descrição |
|---|---|---|
| GET | `/ai/providers` · `/ai/models?provider=` | Provedores / modelos locais |
| POST | `/ai/test` | `{provider?}` |
| POST | `/ai/processes/:id/analyze` · `/ai/targets/:id/analyze` | `{useAi?}` |
| POST | `/ai/compose` | `{mode,instruction?,html?,subject?,processId?,clientId?}` → `{subject,html,warnings}` |

## E-mail (Gmail)
| Método | Rota | Descrição |
|---|---|---|
| GET/DELETE | `/mail/account` | Status / desconectar |
| POST | `/mail/oauth/start` | `{returnTo}` → `{url}` |
| GET | `/mail/oauth/callback` | Público (redirecionamento do Google) |
| GET | `/mail/messages?folder=enviados|rascunhos|falhas&q=&clientId=` | Caixa do app |
| POST | `/mail/drafts` · `/mail/send` | `{to[],cc[],bcc[],subject,html,attachments[],clientId?,processId?,targetId?}` |
| GET | `/mail/gmail/sent` | Pasta “Enviados” do Gmail |

## Relatórios, sistema e backup
| Método | Rota | Descrição |
|---|---|---|
| GET | `/reports/types` | Tipos e formatos |
| GET | `/reports/targets/:id?type=&format=` | Arquivo (cabeçalho `X-Integrity-SHA256`) |
| GET | `/health` | Público |
| GET / PUT | `/settings` | Configurações (PUT *admin*; segredos nunca retornam) |
| GET | `/audit` | *admin* |
| GET/POST | `/backups` · GET `/backups/:name` | *admin* |
