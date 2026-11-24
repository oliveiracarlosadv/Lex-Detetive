-- Conexão simples com o Gmail por senha de app (SMTP/IMAP), além do OAuth.
ALTER TABLE "MailAccount" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'oauth';
ALTER TABLE "MailAccount" ADD COLUMN "appPasswordEnc" TEXT;
