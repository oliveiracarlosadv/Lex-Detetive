-- Perfil do usuário: escritório, atividade, registro profissional e logomarca dos relatórios.
ALTER TABLE "User" ADD COLUMN "office" TEXT;
ALTER TABLE "User" ADD COLUMN "activity" TEXT;
ALTER TABLE "User" ADD COLUMN "registryType" TEXT;
ALTER TABLE "User" ADD COLUMN "registryNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "registryUf" TEXT;
ALTER TABLE "User" ADD COLUMN "logo" TEXT;
