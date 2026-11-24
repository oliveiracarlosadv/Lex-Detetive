-- Conferência de CPF/CNPJ nas publicações (homônimos): confirmado | divergente | nao_informado
ALTER TABLE "Process" ADD COLUMN "docStatus" TEXT NOT NULL DEFAULT 'nao_informado';
ALTER TABLE "Process" ADD COLUMN "docFound" TEXT;
