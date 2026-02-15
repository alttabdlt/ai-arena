-- CreateTable
CREATE TABLE "TelegramIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramUserId" TEXT NOT NULL,
    "username" TEXT,
    "linkedWalletAddress" TEXT,
    "verificationState" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentOperatorLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "telegramIdentityId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentOperatorLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentOperatorLink_telegramIdentityId_fkey" FOREIGN KEY ("telegramIdentityId") REFERENCES "TelegramIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "issuerType" TEXT NOT NULL DEFAULT 'TELEGRAM',
    "issuerIdentityId" TEXT,
    "issuerLabel" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'SUGGEST',
    "intent" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL DEFAULT '{}',
    "constraintsJson" TEXT NOT NULL DEFAULT '{}',
    "auditMetaJson" TEXT NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "createdTick" INTEGER,
    "expiresAtTick" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "statusReason" TEXT NOT NULL DEFAULT '',
    "resultJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "executedAt" DATETIME,
    "rejectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "expiredAt" DATETIME,
    CONSTRAINT "AgentCommand_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentCommand_issuerIdentityId_fkey" FOREIGN KEY ("issuerIdentityId") REFERENCES "TelegramIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramIdentity_telegramUserId_key" ON "TelegramIdentity"("telegramUserId");

-- CreateIndex
CREATE INDEX "TelegramIdentity_linkedWalletAddress_idx" ON "TelegramIdentity"("linkedWalletAddress");

-- CreateIndex
CREATE INDEX "TelegramIdentity_verificationState_idx" ON "TelegramIdentity"("verificationState");

-- CreateIndex
CREATE UNIQUE INDEX "AgentOperatorLink_agentId_telegramIdentityId_role_key" ON "AgentOperatorLink"("agentId", "telegramIdentityId", "role");

-- CreateIndex
CREATE INDEX "AgentOperatorLink_agentId_role_isActive_idx" ON "AgentOperatorLink"("agentId", "role", "isActive");

-- CreateIndex
CREATE INDEX "AgentOperatorLink_walletAddress_isActive_idx" ON "AgentOperatorLink"("walletAddress", "isActive");

-- CreateIndex
CREATE INDEX "AgentOperatorLink_telegramIdentityId_isActive_idx" ON "AgentOperatorLink"("telegramIdentityId", "isActive");

-- CreateIndex
CREATE INDEX "AgentCommand_agentId_status_priority_createdAt_idx" ON "AgentCommand"("agentId", "status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "AgentCommand_status_createdAt_idx" ON "AgentCommand"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentCommand_expiresAtTick_idx" ON "AgentCommand"("expiresAtTick");

-- CreateIndex
CREATE INDEX "AgentCommand_issuerIdentityId_idx" ON "AgentCommand"("issuerIdentityId");
