# Segurança e LGPD

| Medida | Implementação |
|---|---|
| Criptografia em repouso | AES-256-GCM (IV aleatório, autenticação) para CPF/CNPJ, RG, chaves de API, segredos OAuth, segredo 2FA e tokens do Gmail |
| Chave mestra | `~/.lex-detetive/master.key`, permissão 600, criada no primeiro uso; pode vir de `LEX_MASTER_KEY` |
| Busca sem expor documento | Índice cego HMAC-SHA256 do CPF/CNPJ |
| Mascaramento | CPF `***.456.789-**`; CNPJ parcial; exibição completa só para admin/analista e registrada na auditoria |
| Senhas | bcrypt (custo 12); bloqueio após 5 tentativas por 5 min |
| 2FA | TOTP (Google/Microsoft Authenticator, Authy) |
| Controle de acesso | Perfis admin/analista/leitor; todas as rotas exigem token JWT (12 h) |
| Auditoria | Tabela `AuditLog` com usuário, ação, objeto, detalhes e IP |
| Finalidade | Campo “Finalidade (LGPD)” obrigatório no fluxo de monitoramento |
| Eliminação | “Eliminar dados (LGPD)” remove a pessoa/empresa e tudo que foi coletado |
| Integridade de relatórios | Hash SHA-256 impresso no rodapé |
| Rede | Servidor escuta só em 127.0.0.1 por padrão; cabeçalhos `nosniff`, `DENY`, `no-referrer` |
| IA | Instruções contra injeção de prompt (dados tratados como dados) e alerta de datas/valores inventados |

## Responsabilidades do usuário (controlador)
- Tratar dados pessoais somente com **finalidade legítima** e **base legal** (ex.: exercício regular de direitos, legítimo interesse, cumprimento de obrigação legal).
- Atender pedidos de titulares (acesso, correção, eliminação) — use a eliminação e os relatórios.
- Não usar o sistema para perseguição, discriminação ou finalidades vedadas.
- Ao usar IA em nuvem, considerar a transferência de dados ao provedor.
