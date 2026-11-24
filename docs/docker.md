# Guia Docker

## Modo escritório (um servidor para a equipe)

```bash
docker compose up -d --build
```

Acesse `http://<ip-do-servidor>:3333`. Os dados ficam no volume `lex-data` (`/data` no contêiner).

- **IA local:** com o Ollama no hospedeiro, configure em Lex AI o endereço `http://host.docker.internal:11434`.
- **Backup do volume:** `docker run --rm -v lex-detetive_lex-data:/data -v "$PWD":/b alpine tar czf /b/lex-backup.tgz -C /data .`
- **HTTPS:** coloque um proxy reverso (Caddy, Nginx, Traefik) na frente e ative 2FA para todos.
- **Gmail:** cadastre no Google a URI de redirecionamento com o endereço público do servidor.

## Preparação SaaS

```bash
docker compose --profile saas up -d
```

Sobe também PostgreSQL 17, Redis 7 e Ollama — infraestrutura alvo do modo multiempresa (ver [arquitetura](arquitetura.md#evolução-para-saas)). A aplicação ainda usa SQLite nesta versão.
