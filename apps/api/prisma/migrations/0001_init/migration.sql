-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'analista',
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "documentEnc" TEXT,
    "documentHash" TEXT,
    "documentMasked" TEXT,
    "rgEnc" TEXT,
    "motherName" TEXT,
    "fatherName" TEXT,
    "partners" TEXT,
    "notes" TEXT,
    "purpose" TEXT,
    "monitored" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 1440,
    "lastCheckedAt" DATETIME,
    "nextCheckAt" DATETIME,
    "lastCheckSummary" TEXT,
    "registry" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "system" TEXT,
    "className" TEXT,
    "subjects" TEXT,
    "organ" TEXT,
    "degree" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "value" REAL,
    "parties" TEXT,
    "filedAt" DATETIME,
    "lastMovementAt" DATETIME,
    "source" TEXT NOT NULL,
    "raw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Process_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Movement_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "changes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Snapshot_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetId" TEXT,
    "processId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetId" TEXT,
    "processId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Analysis_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Analysis_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "documentEnc" TEXT,
    "documentHash" TEXT,
    "documentMasked" TEXT,
    "rgEnc" TEXT,
    "stateReg" TEXT,
    "birthDate" DATETIME,
    "maritalStatus" TEXT,
    "profession" TEXT,
    "nationality" TEXT,
    "email" TEXT,
    "email2" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "website" TEXT,
    "zip" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "contactPerson" TEXT,
    "responsible" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "targetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClientProcess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'parte',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientProcess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientProcess_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MailAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "scope" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'rascunhos',
    "fromEmail" TEXT,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "bcc" TEXT,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "attachments" TEXT,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "gmailDraftId" TEXT,
    "error" TEXT,
    "clientId" TEXT,
    "processId" TEXT,
    "targetId" TEXT,
    "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Target_documentHash_idx" ON "Target"("documentHash");

-- CreateIndex
CREATE UNIQUE INDEX "Process_targetId_number_key" ON "Process"("targetId", "number");

-- CreateIndex
CREATE INDEX "Movement_date_idx" ON "Movement"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Movement_processId_fingerprint_key" ON "Movement"("processId", "fingerprint");

-- CreateIndex
CREATE INDEX "Alert_read_createdAt_idx" ON "Alert"("read", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_targetId_key" ON "Client"("targetId");

-- CreateIndex
CREATE INDEX "Client_documentHash_idx" ON "Client"("documentHash");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProcess_clientId_processId_key" ON "ClientProcess"("clientId", "processId");

-- CreateIndex
CREATE UNIQUE INDEX "MailAccount_userId_key" ON "MailAccount"("userId");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_folder_updatedAt_idx" ON "EmailMessage"("userId", "folder", "updatedAt");

