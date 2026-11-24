# Guia de Instalação

## 1. Aplicativo desktop (recomendado)

**Requisitos mínimos:** 4 GB de memória RAM e processador Intel Core i3 (ou equivalente AMD), Windows 10/11, macOS 11+ ou Linux 64 bits. O app usa o vídeo integrado do computador para manter as telas lisas e deixa o serviço de buscas em prioridade baixa, para não travar o uso. Se a placa de vídeo apresentar falha, o app passa a abrir sem ela automaticamente. Em computadores com até 6 GB de RAM ou até 4 núcleos (ex.: 4 GB + Intel i3), o app entra sozinho no **modo econômico**: limita a memória da interface e do servidor, faz uma verificação por vez e não roda a IA local a cada alerta — para esses computadores recomendamos a IA **Google Gemini** (gratuita, na nuvem).

| Sistema | Arquivo | Como instalar |
|---|---|---|
| Windows 10/11 (64 bits) | `Lex-Detetive-X.Y.Z-Windows-Setup.exe` | Duplo clique → **Avançar → Aceito (licença) → Pasta → Instalar → Concluir** |
| macOS Apple Silicon (M1–M4) | `Lex-Detetive-X.Y.Z-Mac-Apple-Silicon-M1-M4.pkg` | Duplo clique → **Continuar → Licença → Instalar → Fechar** |
| macOS Intel | `Lex-Detetive-X.Y.Z-Mac-Intel.pkg` | Idem |
| macOS (alternativa) | `…-Mac-Apple-Silicon-M1-M4.dmg` / `…-Mac-Intel.dmg` | Arraste o app para **Aplicativos** |
| Linux Ubuntu/Debian | `Lex-Detetive-X.Y.Z-Linux-Ubuntu-Debian.deb` | `sudo apt install ./Lex-Detetive-X.Y.Z-Linux-Ubuntu-Debian.deb` |
| Linux (qualquer distribuição) | `Lex-Detetive-X.Y.Z-Linux-qualquer-distribuicao.AppImage` | `chmod +x` no arquivo e execute |

> No Mac, veja em  → Sobre este Mac: “Chip Apple” = arm64; “Processador Intel” = x64.

No **GitHub → Releases** fica sempre só a **última versão** (hoje a 0.1.13; o instalador de Windows mais recente é o 0.1.11, enquanto a montagem automática do GitHub estiver suspensa). No Google Drive, a pasta **instaladores/vX.Y.Z** também guarda só a **última versão**.

> **Aviso de segurança na primeira abertura.** Enquanto os instaladores não forem assinados digitalmente
> (certificado de desenvolvedor Apple/Microsoft — ver roadmap), o sistema pode alertar:
> - **macOS:** clique com o botão direito no instalador → **Abrir** → **Abrir**.
>   Se necessário: Ajustes do Sistema → Privacidade e Segurança → **Abrir mesmo assim**.
> - **Windows:** na tela “O Windows protegeu o computador”, clique em **Mais informações → Executar assim mesmo**.

Ao abrir, aparece a **splash screen** enquanto os serviços locais iniciam. No primeiro uso, crie a conta de administrador.

### Onde ficam os dados

| Sistema | Pasta |
|---|---|
| macOS/Linux | `~/.lex-detetive` |
| Windows | `C:\Users\<usuário>\.lex-detetive` |

Contém `lex.db` (banco SQLite), `master.key` (chave de criptografia — **sem ela os dados não podem ser lidos**), `backups/` e `logs/`.

## 2. IA local (opcional, recomendado)

1. Instale o **Ollama**: https://ollama.com
2. Baixe um modelo. Sugestões:
   - `ollama pull qwen2.5:7b` — bom equilíbrio (8 GB de RAM livres)
   - `ollama pull qwen2.5:14b` ou `llama3.1:8b` — melhor qualidade
   - `qwen2.5:3b` — computadores modestos (mais sujeito a erros e invenções)
3. Em **Configurações → Lex AI**, escolha **Ollama** e o modelo.

LM Studio também é suportado (servidor local em `http://127.0.0.1:1234/v1`).

## 3. Atualização via arquivo

1. Baixe o instalador da nova versão.
2. No app: menu **Lex Detetive → Atualizar via arquivo…** (ou **Configurações → Backup e atualização**).
3. Escolha o instalador. O sistema **faz um backup completo** em `~/.lex-detetive/backups/` e abre o instalador.
4. Conclua o assistente. Na próxima abertura, as **migrações do banco** são aplicadas automaticamente, sem perda de dados.

Para voltar a um backup: **Lex Detetive → Restaurar backup…**.

## 4. Desinstalação

- **Windows:** Menu Iniciar → **Lex Detetive → Desinstalar Lex Detetive** (ou Configurações → Aplicativos). O desinstalador pergunta se deve **apagar também todos os dados**.
- **macOS:** menu **Lex Detetive → Desinstalar Lex Detetive…**, ou o app **Desinstalar Lex Detetive** que acompanha o `.dmg`. Ele pergunta se deve **manter ou apagar todos os dados**.
- **Linux:** `sudo apt remove lex-detetive-desktop` e, para apagar os dados, `rm -rf ~/.lex-detetive`.

## 5. A partir do código-fonte (desenvolvedores)

Requisitos: Node.js 20+ (macOS: `brew install node`), Git.

```bash
git clone https://github.com/oliveiracarlosadv/Lex-Detetive.git
```

```bash
cd Lex-Detetive && bash scripts/install.sh
```

```bash
npm start
```

Abra http://localhost:3333. Desenvolvimento com recarga automática: `npm run dev` (interface em http://localhost:3000).

### Gerar instaladores

```bash
cd apps/desktop && npm install
```

```bash
npm run dist:mac
```

`npm run dist:win` e `npm run dist:linux` geram os demais. O fluxo do GitHub Actions (`.github/workflows/release.yml`) gera os três ao publicar uma tag `vX.Y.Z`.
