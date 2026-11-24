# Manual do Usuário

## Entrada no app (login)

- **Sem senha neste computador:** no primeiro acesso, marque “Usar sem senha neste computador” e o app passa a abrir direto. Liga e desliga em Configurações → Segurança (ao desligar, você cria a senha das próximas entradas). Vale só no próprio computador.
- **E-mail e senha:** a forma tradicional.
- **Entrar com Google (Gmail):** aparece quando o Gmail está configurado com Client ID; abre o Google no navegador e o app entra sozinho ao concluir.
- **Esqueci minha senha:** por segurança, o app não guarda a senha em forma legível, então não consegue enviá-la. Em vez disso, envia ao e-mail cadastrado um **código de 6 dígitos** (vale 15 minutos) para você criar uma senha nova. Requer uma conta Gmail conectada em Configurações → E-mail.

## Painel
Mostra pessoas e empresas monitoradas, processos encontrados, alertas não lidos, gráfico de movimentações (30 dias), processos por tribunal, **linha do tempo processual** e os alertas mais recentes. Use **⌘K / Ctrl+K** para buscar qualquer pessoa, cliente, processo ou página.

## Sino de notificações
O **sino** na barra superior mostra quantas **movimentações, intimações e novos processos** ainda não foram lidos. Clique para ver os mais recentes: cada item abre o processo e é marcado como lido. Há também **Marcar todas como lidas** e **Ver todos os alertas**. Quando chega uma novidade com o app aberto, aparece um aviso na tela; com o app minimizado, uma notificação do sistema (o app confere a cada 5 minutos).

## Pesquisa
1. (Opcional) Em **Cliente cadastrado**, escolha um cliente: os dados dele são preenchidos e o resultado fica vinculado à **rotina do cliente**. Também é possível abrir a pesquisa pelo botão **Pesquisar** na ficha do cliente.
2. Escolha **Pessoa física** (nome, CPF, RG, mãe, pai, **OAB** se for advogado) ou **Pessoa jurídica** (razão social, fantasia, CNPJ, sócios).
3. Opcionalmente informe **números de processo (CNJ)**.
4. Clique em **Pesquisar**. O **DJEN é a fonte principal**: é consultado primeiro, cobre os últimos 5 anos e traz até 500 publicações por nome. Cada fonte mostra se foi consultada, se não se aplica ou se falhou.

### Fontes consultadas
| Fonte | Busca por | O que traz |
|---|---|---|
| **DJEN — Diário de Justiça Eletrônico Nacional (CNJ)** | nome da parte, OAB, número | Intimações, citações e editais de todos os tribunais integrados, com partes (polo ativo/passivo), vara e advogados |
| CNJ DataJud | número do processo | Classe, assuntos, órgão, movimentações (todos os tribunais exceto STF) |
| Receita Federal (BrasilAPI) | CNPJ | Situação, endereço, atividade, sócios |
| Portal da Transparência | CPF/CNPJ | Sanções CEIS/CNEP (requer chave gratuita) |
| Diário Oficial da União | nome, CNPJ | Atos, contratos, licitações, nomeações |
| Querido Diário | nome, CNPJ | Diários oficiais municipais (pode levar até 1 minuto) |

**Homônimos:** a busca por nome descarta publicações em que o nome não aparece completo, mas pessoas diferentes com o mesmo nome continuam possíveis — confira as partes.
**Diários estaduais:** cada estado publica em portal próprio, sem API nacional; as publicações dos tribunais estaduais já chegam pelo DJEN.

**Resultado zero:** o sistema informa **"0 (zero) processos encontrados"** e avisa que **podem existir processos em sigilo** (segredo de justiça), que não aparecem em consultas públicas. Ausência de resultado **não** é certidão negativa.

**Consultar BNMP:** abre o Banco Nacional de Mandados de Prisão do CNJ. O nome/CPF é copiado automaticamente — cole no campo de pesquisa do portal (ele exige captcha).

Para acompanhar, clique em **Monitorar**, escolha a frequência e informe a **finalidade (LGPD)**. Com cliente escolhido, o botão vira **Monitorar e vincular**: todos os processos encontrados (agora e nas próximas verificações) são vinculados ao cliente, com o papel deduzido do polo (autor/réu).

## Monitoramento

O botão **Consultar agora** (no topo da tela) atualiza na hora todos os monitorados ativos da lista, um de cada vez, mostrando o andamento. Para atualizar só um, use **Consultar** na linha dele. Dica: filtre a lista antes para consultar apenas alguns.
Lista pessoas e empresas acompanhadas. Ajuste a **frequência** (1, 5, 15, 30 min, 1 h, 6 h, 24 h), pause/ative, use **Verificar agora** ou **Excluir** (lixeira). Excluir apaga o acompanhamento e os processos, movimentações e alertas coletados (LGPD); se a pessoa for cliente, o cadastro do cliente é mantido e volta a mostrar **Monitorar**. O botão **Excluir monitorado** também fica no topo da ficha.

Na página de cada pessoa/empresa:
- **Processos:** vincule processos conhecidos pelo número CNJ — movimentações e intimações passam a ser monitoradas.
- **Alertas**, **Cadastro e histórico** (snapshots e alterações cadastrais) e **Lex AI** (parecer consolidado).
- **Relatório**, **E-mail**, **Consultar BNMP** e **Eliminar dados (LGPD)**.

## Conferência de CPF (homônimos)
O DJEN busca pelo nome e não pelo CPF. Por isso o Lex Detetive procura, no texto de cada publicação, o CPF/CNPJ escrito logo após o nome do monitorado e compara com o cadastrado:
- **CPF confere** — a publicação traz o CPF do monitorado;
- **CPF diferente** — traz outro CPF ao lado do mesmo nome (possível homônimo): não entra automaticamente na rotina do cliente e o alerta fica marcado;
- **CPF não informado** — a publicação não traz documento (a maioria dos casos): confira as partes.

Na tela do monitoramento, o CPF do monitorado aparece acima dos processos, com o resumo da conferência e o filtro *Todos / Ocultar CPF diferente / Só com CPF conferido*. Os processos aparecem na ordem: confirmados, sem CPF, diferentes. **Verificar agora** refaz a busca completa e confere também os processos antigos. O tribunal aparece como etiqueta colorida (verde: estadual; azul: federal; dourado: trabalho; cinza: eleitoral e superiores).

## Alertas e ficha do processo

Alertas de movimentação/intimação só aparecem para o que é **novo de verdade**: publicações dos últimos 15 dias ou posteriores à última já conhecida do processo. Publicações antigas que a fonte só entrega depois (as fontes devolvem um número limitado de páginas por consulta) entram no histórico do processo, sem alerta. Se duas fontes trazem novidade do mesmo processo na mesma verificação, sai um único alerta.

Na lateral direita da tela **Alertas** ficam os nomes de **autores e réus** que aparecem nos alertas (filtre por nome ou por Autores/Réus). Clique no nome para ver só os alertas dele. Se o nome já é cliente cadastrado, aparece “Já cadastrado como cliente” e, havendo processos ainda não vinculados, a pergunta **Vincular? Sim / Não**. Se não é cliente, use **Cadastrar cliente**: o cadastro abre preenchido e, ao salvar, os processos do alerta já ficam vinculados com o papel (autor ou réu).
**Cadastrar cliente:** no topo da tela de Alertas (cadastro em branco) ou em cada alerta (**Cadastrar como cliente**), com o nome e o tipo já preenchidos; ao salvar, o monitoramento e os processos daquela pessoa/empresa passam a fazer parte do novo cliente.

Quando há **nova movimentação ou intimação**, o alerta traz a ficha:

**PROCESSO · TRIBUNAL · VARA · AUTOR · RÉU · VALOR DA CAUSA**, **audiências marcadas**, **audiências realizadas**, **últimas movimentações** e se há **liminar, contestação, réplica e sentença** (com data) — além do **resumo do Lex AI**.

Intimações/citações aparecem em vermelho, com prioridade crítica. Use **Comunicar por e-mail** para avisar o cliente com um texto já preenchido.

> A API pública do DataJud não divulga os nomes das partes; nesses casos aparece “não informado pela fonte”.

## Processo
Ficha completa, todas as movimentações (intimações destacadas) e **Lex AI**: resumo, partes, advogados, juízes, valores, datas, eventos, **riscos, oportunidades, prescrição, prazos** e **parecer inicial**. “Análise rápida” usa regras (sem IA).

## Clientes

**Busca de CNPJ (APIs públicas):** no cadastro de cliente pessoa jurídica e na Pesquisa (pessoa jurídica), digite o CNPJ e clique em **Buscar dados**: razão social, nome fantasia, data de abertura, endereço, contatos e sócios são preenchidos com os dados públicos da Receita Federal, consultados ao mesmo tempo na **BrasilAPI** e no **CNPJá** (API aberta, sem chave). Se uma das APIs estiver fora do ar, a outra cobre. Na pesquisa e no monitoramento, os dados cadastrais também trazem Simples Nacional, MEI, matriz/filial e atividades secundárias.

No cadastro do cliente há o campo **Redes sociais**: informe nomes de usuário ou links dos perfis, separados por vírgula. Eles aparecem no Contato do cliente e são enviados ao monitoramento dele, para a busca em redes sociais.
Cadastro completo: dados gerais (CPF/CNPJ criptografado, RG, nascimento, estado civil, profissão…), **e-mails**, telefone, WhatsApp, site e **endereço com preenchimento automático pelo CEP**.
Na aba **Processos**, clique em **Vincular processo** para associar processos **já cadastrados/encontrados** ou informar um **número novo** (consultado no DataJud), definindo o papel do cliente (autor, réu…). **Monitorar** cria o acompanhamento automático do cliente.

**Consultar bases** (na lista de clientes e na ficha do cliente): pesquisa na hora, de uma vez, em **todos os diários e bases** — DJEN (fonte principal), DataJud, Diário Oficial da União, diários municipais, Receita Federal e Portal da Transparência — usando os dados do cliente e os números dos processos já vinculados a ele. No resultado, use **Monitorar e vincular** para que os processos encontrados passem a fazer parte da rotina do cliente.

## Configurações → Sobre
Mostra a **versão do sistema**, o **desenvolvedor** (Lex Tecnologias), o contato e os requisitos mínimos. O administrador pode **atualizar com arquivo**: escolha o instalador da nova versão; o app faz um backup completo antes de instalar e mantém os dados.

## E-mail (Gmail)
**Escrever e-mail** abre a janela de redação no estilo Gmail: Para/Cc/Cco com sugestões dos e-mails de clientes, assunto, formatação, anexos, **anexar relatório Lex Detetive** e **Lex AI** (redigir a partir de uma instrução, melhorar, tom formal ou cordial, encurtar, corrigir, traduzir).
- Rascunhos são salvos automaticamente no app **e** nos Rascunhos do Gmail.
- Ao enviar, a mensagem fica em **Enviados** do Gmail e na **caixa de saída** do app (E-mail → Enviados).
- **Revise sempre o texto da IA.** Se ela incluir datas, horários ou valores que você não informou, o sistema avisa.

## Vincular processo ao cliente

Na Pesquisa, ao clicar em **Vincular ao cliente**, o app procura entre os clientes cadastrados alguém com o mesmo nome de uma das partes (ou com o CPF/CNPJ pesquisado) e já deixa esse cliente escolhido, com o papel (autor ou réu) preenchido. Basta conferir e clicar em Vincular.
Na página do processo, na lista de processos do monitoramento, nos resultados da pesquisa e nos alertas há a opção **Vincular ao cliente**: escolha o cliente cadastrado e o papel dele (autor, réu, terceiro, interessado). A página do processo mostra os **clientes vinculados**.

## Redes sociais

- Informe os **nomes de usuário** (ex.: @fulano, fulano.silva ou o link do perfil) na pesquisa, no cadastro do monitorado ou na aba **Publicações e redes** do monitorado.
- O app confirma se o nome de usuário existe no GitHub, Bluesky, X (Twitter), YouTube, Telegram, Mastodon, GitLab, SoundCloud, Vimeo e Linktree. “Confirmado” quer dizer que o nome de usuário existe na rede, **não** que seja do investigado: confira a titularidade.
- Instagram, Facebook, TikTok, Threads, LinkedIn, Kwai e Pinterest só mostram perfis a quem está logado; o app gera os links para você conferir manualmente.
- Pelo nome, o app lista contas com o mesmo nome (Bluesky, GitHub) e publicações públicas que citam o nome (Bluesky). Com a chave gratuita do buscador Brave (Configurações → Fontes), também procura páginas do Instagram, Facebook, LinkedIn, X, TikTok e YouTube que citam o nome.
- O app **não** testa em quais sites um e-mail tem cadastro: isso exigiria usar telas de login e recuperação de senha de terceiros e poderia avisar a pessoa investigada.

## Diários oficiais (União, estados e municípios)

- **União (DOU)** e **municípios (Querido Diário)**: consultados em toda pesquisa e verificação, pelo nome, CNPJ e CPF. O Querido Diário costuma ser lento (até 1 minuto); o app tenta de novo antes de desistir.
- **Estados (27 UFs)**: não há busca nacional, então o app procura o nome e o CPF/CNPJ dentro do site do Diário Oficial de cada estado escolhido em Configurações → Fontes (padrão: Pará) e dos estados dos tribunais onde o pesquisado tem processos (ex.: TJSP → São Paulo; TRT8 → Pará e Amapá). Automático com a chave do Brave ou SearXNG; sempre com buscas prontas no Google.
- Resultados na aba **Publicações e redes** e na seção **Publicações em diários oficiais** do relatório.

## Filtro por ano

Na Pesquisa e na lista de processos do monitorado, escolha o **ano do processo** (tirado do número CNJ) para ver só os processos daquele ano.

## Buscadores na internet

- Em toda pesquisa e verificação, o app busca o **nome completo** e o **CPF/CNPJ** (com e sem pontuação) do pesquisado.
- **Automático:** com a chave gratuita do **Brave Search** e/ou o endereço de um servidor **SearXNG** (metabuscador que consulta Google, Bing, DuckDuckGo e outros), em Configurações → Fontes. Páginas que citam o próprio CPF/CNPJ aparecem primeiro e geram alerta.
- **Sempre:** links prontos para abrir as mesmas buscas no **Google, Bing, DuckDuckGo e Yandex**.
- Por que não automático no Google, Bing e DuckDuckGo: a API do Google está fechada a novos clientes (e será desligada em 2027), a do Bing foi encerrada em 2025 e o DuckDuckGo bloqueia consultas automáticas.
- Atenção (LGPD): ao usar a busca automática, o nome e o documento são enviados ao buscador configurado.
- Resultados aparecem na aba **Publicações e redes** do monitorado e na seção **Buscadores na internet** do relatório.

## Relatórios (formato)

- Todos os tipos trazem a seção **Publicações em diários oficiais** (DJEN, DOU e diários municipais) e, exceto o processual, **Redes sociais**.
- Cada processo tem um quadro **Em resumo** (classe, partes, posição do investigado, situação, último ato, audiência e marcos) para leitura rápida.
- As tabelas têm largura fixa por coluna: palavras e números de processo não são partidos.

## Relatórios
Sintético, Analítico, Processual, Due Diligence, Compliance e Investigação, em PDF, DOCX, ODT, XLSX, CSV, HTML, TXT ou JSON, com identidade Lex Tecnologias e **código de integridade SHA-256**.

## Fontes
Conectores ativos e cobertura por tribunal, sistema (PJe, e-SAJ, Eproc, Projudi…) e cartórios, com links para consulta manual quando não há API pública.
