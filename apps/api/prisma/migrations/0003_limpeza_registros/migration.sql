-- Mantém somente processos obtidos de fontes oficiais (DataJud, DJEN) ou cadastrados manualmente.
DELETE FROM "Process" WHERE "source" NOT LIKE '%datajud%' AND "source" NOT LIKE '%djen%' AND "source" <> 'manual';
DELETE FROM "Alert" WHERE "processId" IS NOT NULL AND "processId" NOT IN (SELECT "id" FROM "Process");
DELETE FROM "Setting" WHERE "key" NOT LIKE 'ai.%' AND "key" NOT LIKE 'org.%' AND "key" NOT LIKE 'mail.%' AND "key" NOT LIKE 'gmail.%' AND "key" NOT LIKE 'monitor.%' AND "key" NOT LIKE 'privacy.%' AND "key" NOT LIKE 'datajud.%' AND "key" NOT LIKE 'transparencia.%';
