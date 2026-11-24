-- Clientes apontando para um monitoramento que não existe mais voltam a "Monitorar".
UPDATE "Client" SET "targetId" = NULL WHERE "targetId" IS NOT NULL AND "targetId" NOT IN (SELECT "id" FROM "Target");
