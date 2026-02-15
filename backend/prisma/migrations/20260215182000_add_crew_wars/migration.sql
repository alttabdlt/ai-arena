-- CreateTable
CREATE TABLE "Crew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL DEFAULT '#22d3ee',
    "description" TEXT NOT NULL DEFAULT '',
    "treasuryArena" INTEGER NOT NULL DEFAULT 0,
    "territoryControl" INTEGER NOT NULL DEFAULT 0,
    "momentum" INTEGER NOT NULL DEFAULT 0,
    "warScore" INTEGER NOT NULL DEFAULT 0,
    "lastResolvedTick" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CrewMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crewId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewMembership_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewMembership_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crewId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'telegram',
    "note" TEXT NOT NULL DEFAULT '',
    "paramsJson" TEXT NOT NULL DEFAULT '{}',
    "issuerIdentityId" TEXT,
    "issuerLabel" TEXT,
    "createdTick" INTEGER NOT NULL DEFAULT 0,
    "expiresAtTick" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "statusReason" TEXT NOT NULL DEFAULT '',
    "appliedAt" DATETIME,
    "expiredAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewOrder_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewOrder_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewOrder_issuerIdentityId_fkey" FOREIGN KEY ("issuerIdentityId") REFERENCES "TelegramIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewBattleEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tick" INTEGER NOT NULL,
    "winnerCrewId" TEXT NOT NULL,
    "loserCrewId" TEXT NOT NULL,
    "territorySwing" INTEGER NOT NULL DEFAULT 0,
    "treasurySwing" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL DEFAULT '',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrewBattleEvent_winnerCrewId_fkey" FOREIGN KEY ("winnerCrewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewBattleEvent_loserCrewId_fkey" FOREIGN KEY ("loserCrewId") REFERENCES "Crew" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Crew_slug_key" ON "Crew"("slug");

-- CreateIndex
CREATE INDEX "Crew_warScore_updatedAt_idx" ON "Crew"("warScore", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMembership_agentId_key" ON "CrewMembership"("agentId");

-- CreateIndex
CREATE INDEX "CrewMembership_crewId_isActive_idx" ON "CrewMembership"("crewId", "isActive");

-- CreateIndex
CREATE INDEX "CrewMembership_agentId_isActive_idx" ON "CrewMembership"("agentId", "isActive");

-- CreateIndex
CREATE INDEX "CrewOrder_crewId_status_createdAt_idx" ON "CrewOrder"("crewId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CrewOrder_agentId_status_createdAt_idx" ON "CrewOrder"("agentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CrewOrder_expiresAtTick_idx" ON "CrewOrder"("expiresAtTick");

-- CreateIndex
CREATE INDEX "CrewOrder_issuerIdentityId_idx" ON "CrewOrder"("issuerIdentityId");

-- CreateIndex
CREATE INDEX "CrewBattleEvent_tick_createdAt_idx" ON "CrewBattleEvent"("tick", "createdAt");

-- CreateIndex
CREATE INDEX "CrewBattleEvent_winnerCrewId_createdAt_idx" ON "CrewBattleEvent"("winnerCrewId", "createdAt");

-- CreateIndex
CREATE INDEX "CrewBattleEvent_loserCrewId_createdAt_idx" ON "CrewBattleEvent"("loserCrewId", "createdAt");
