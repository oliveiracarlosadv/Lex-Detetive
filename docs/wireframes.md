# Wireframes e telas

Estilo: inspirado em Linear/Notion/Raycast/Stripe — barra lateral azul-escuro, conteúdo em cartões claros, dourado para ações principais e destaques, modo claro/escuro, paleta de comandos ⌘K.

## Estrutura geral
```
┌──────────────┬───────────────────────────────────────────────────────────┐
│ 🔍 Lex       │ [🔍 Buscar pessoas, empresas, clientes, processos…  ⌘K]  🔔 ☾ │
│   Detetive   ├───────────────────────────────────────────────────────────┤
│ [✎ Escrever] │  Título da página                         [Ação] [Ação]   │
│              │  descrição                                                 │
│ ▣ Painel     │  ┌───────────┐┌───────────┐┌───────────┐┌───────────┐      │
│ ⌕ Pesquisa   │  │ indicador ││ indicador ││ indicador ││ indicador │      │
│ ◎ Monitor.   │  └───────────┘└───────────┘└───────────┘└───────────┘      │
│ ☺ Clientes   │  ┌─────────────────────────────┐┌─────────────────┐        │
│ 🔔 Alertas 5 │  │ cartão principal            ││ cartão lateral  │        │
│ ✉ E-mail     │  └─────────────────────────────┘└─────────────────┘        │
│ ▤ Relatórios │                                                            │
│ ▥ Fontes     │                                                            │
│ ☰ Auditoria  │                                       ┌──────────────────┐ │
│ ⚙ Config.    │                                       │ Nova mensagem –⤢×│ │
│──────────────│                                       │ Para / Assunto   │ │
│ CT Carlos  ⎋ │                                       │ corpo… [Enviar]✨│ │
└──────────────┴───────────────────────────────────────┴──────────────────┘─┘
```

## Pesquisa
```
┌ PF | PJ ─────────────┐ ┌ Fontes consultadas ─────────── [Consultar BNMP ↗] ┐
│ Nome completo        │ │ ✓ CNJ DataJud            1 proc.                  │
│ CPF        RG        │ │ ○ Receita (não se aplica)                         │
│ Mãe / Pai            │ │ ✕ Querido Diário (indisponível)                   │
│ Processos (CNJ)      │ └───────────────────────────────────────────────────┘
│ [ Pesquisar ]        │ ┌ 🔒 Nenhum processo localizado… não existem processos│
└──────────────────────┘ │   ou tramitam em SEGREDO DE JUSTIÇA  [BNMP]       │
                         └───────────────────────────────────────────────────┘
                         ┌ Processos (tabela) ┐ ┌ Monitorar continuamente ──┐
```

## Alerta de intimação (ficha)
```
┌ ⚖ [Intimação] • há 2 min · Construtora Modelo S.A. ───────────────────────┐
│ Intimação/citação — 8540159-80.2021.5.08.9999                             │
│ PROCESSO  8540159-…   TRIBUNAL TRT8   VARA 6ª Vara   AUTOR …   RÉU …       │
│ VALOR DA CAUSA R$ 106.177,00                                               │
│ ┌ ✨ Resumo Lex AI ──────────────────────────────────────────────────────┐ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│ [✓ Liminar 16/01] [✓ Contestação 14/08] [✕ Réplica] [✕ Sentença]          │
│ Audiências marcadas … | Audiências realizadas … | Últimas movimentações … │
│ Abrir processo · ✉ Comunicar por e-mail · Marcar como lido                │
└───────────────────────────────────────────────────────────────────────────┘
```

## Cliente
```
← Clientes
(👤) Nome do cliente  [ativo] · resp. Dr. Carlos   [✉ Enviar e-mail][WhatsApp][Editar][Monitorar][BNMP]
[ Dados gerais | Processos (1) | E-mails ]
┌ Identificação ───────────────────────┐ ┌ Contato ────────────┐
│ Tipo, CPF, RG, nascimento, profissão │ │ ✉ e-mail(s)  ☎  📍   │
└──────────────────────────────────────┘ └─────────────────────┘
Processos: [Vincular processo] → diálogo: papel (autor/réu…) · número novo · lista de processos cadastrados/encontrados
```

## Janela de e-mail (estilo Gmail)
```
┌ Nova mensagem ─────────────────────── – ⤢ × ┐
│ De: escritorio@gmail.com                     │
│ Para [ana@…×] ______________        Cc Cco   │
│ Assunto ____________________________         │
│ corpo com formatação…                        │
│ 📎 relatorio-analitico.pdf                    │
│ B I U • 1. ⌧ 🔗                              │
│ (Enviar) 📎 📄▾ (✨ Lex AI)  Rascunho salvo 🗑│
└──────────────────────────────────────────────┘
```

## Splash screen (desktop)
```
┌──────────────────────────────┐
│            [🔍🌿]            │
│         Lex Detetive         │
│       LEX TECNOLOGIAS        │
│        ━━━━━━──────          │
│     Iniciando serviços…      │
│  versão 0.1.0                │
└──────────────────────────────┘
```
