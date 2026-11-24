# Roadmap

## v0.1 — MVP local (atual)
- Pesquisa PF/PJ, DataJud por número, CNPJ/QSA, CEIS/CNEP, diários municipais, BNMP (link)
- Monitoramento 1 min–24 h, intimações, ficha do processo e resumo IA
- Clientes com vínculo de processos; e-mail via Gmail com IA
- Relatórios em 8 formatos; LGPD (criptografia, 2FA, auditoria)
- Desktop: splash, instaladores, atualização via arquivo com backup, desinstalador

## v0.1.1 — Fontes públicas e rotina do cliente
- DJEN (diário dos tribunais, CNJ): intimações, citações e editais por nome, OAB e número
- Diário Oficial da União; Querido Diário com tempo maior de resposta
- Pesquisa vinculada ao cliente cadastrado: resultados entram automaticamente na rotina do cliente
- Monitoramento de intimações por OAB
- Botões para criar chaves de API (IA, Portal da Transparência, Google)
- Instaladores para Windows, macOS (Apple Silicon e Intel) e Linux

## v0.2 — Cobertura e qualidade (próximos 2 meses)
- Assinatura de código (Apple Developer ID + notarização; certificado Windows) para eliminar alertas de segurança
- Conectores de consulta pública por tribunal (PJe/e-SAJ/Eproc) onde permitido, respeitando termos de uso e captcha
- Busca por nome no DataJud via integrações licenciadas (Escavador, Jusbrasil, Codilo — mediante contrato)
- OCR de PDFs (Tesseract/PaddleOCR) e leitura de peças anexadas
- Notificações por e-mail, Telegram e WhatsApp (API oficial)
- Agenda de prazos e audiências com exportação para Google Agenda

## v0.3 — IA avançada (3–4 meses)
- RAG local com vetorização (Qdrant/ChromaDB) sobre processos e documentos
- Agente autônomo de monitoramento (triagem e priorização)
- Geração de minutas e petições iniciais a partir dos achados
- Assinatura digital de relatórios (ICP-Brasil)

## v1.0 — SaaS (6+ meses)
- PostgreSQL multiempresa, BullMQ/Redis, workers escaláveis
- Painel web multiusuário com SSO
- App Android/iOS (Capacitor)
- Marketplace de integrações, white label, multi-idioma
