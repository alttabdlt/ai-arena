-- CreateTable
CREATE TABLE "Town" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',
    "totalPlots" INTEGER NOT NULL DEFAULT 25,
    "builtPlots" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BUILDING',
    "completionPct" REAL NOT NULL DEFAULT 0,
    "totalInvested" INTEGER NOT NULL DEFAULT 0,
    "yieldPerTick" INTEGER NOT NULL DEFAULT 0,
    "totalYieldPaid" INTEGER NOT NULL DEFAULT 0,
    "lore" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "townId" TEXT NOT NULL,
    "plotIndex" INTEGER NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "zone" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "status" TEXT NOT NULL DEFAULT 'EMPTY',
    "buildingType" TEXT,
    "buildingName" TEXT,
    "buildingDesc" TEXT,
    "buildingData" TEXT NOT NULL DEFAULT '{}',
    "ownerId" TEXT,
    "builderId" TEXT,
    "buildCostArena" INTEGER NOT NULL DEFAULT 0,
    "apiCallsUsed" INTEGER NOT NULL DEFAULT 0,
    "buildStartedAt" DATETIME,
    "buildCompletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plot_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Plot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ArenaAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Plot_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "ArenaAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "plotId" TEXT,
    "townId" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "input" TEXT NOT NULL DEFAULT '',
    "output" TEXT NOT NULL DEFAULT '',
    "apiCalls" INTEGER NOT NULL DEFAULT 1,
    "apiCostCents" INTEGER NOT NULL DEFAULT 0,
    "modelUsed" TEXT NOT NULL DEFAULT '',
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "arenaEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkLog_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TownContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "townId" TEXT NOT NULL,
    "arenaSpent" INTEGER NOT NULL DEFAULT 0,
    "apiCallsMade" INTEGER NOT NULL DEFAULT 0,
    "plotsBuilt" INTEGER NOT NULL DEFAULT 0,
    "yieldShare" REAL NOT NULL DEFAULT 0,
    "totalYieldClaimed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TownContribution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TownContribution_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TownEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "townId" TEXT NOT NULL,
    "agentId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TownEvent_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Town_name_key" ON "Town"("name");

-- CreateIndex
CREATE INDEX "Town_status_idx" ON "Town"("status");

-- CreateIndex
CREATE INDEX "Town_level_idx" ON "Town"("level");

-- CreateIndex
CREATE INDEX "Plot_townId_idx" ON "Plot"("townId");

-- CreateIndex
CREATE INDEX "Plot_status_idx" ON "Plot"("status");

-- CreateIndex
CREATE INDEX "Plot_ownerId_idx" ON "Plot"("ownerId");

-- CreateIndex
CREATE INDEX "Plot_builderId_idx" ON "Plot"("builderId");

-- CreateIndex
CREATE UNIQUE INDEX "Plot_townId_plotIndex_key" ON "Plot"("townId", "plotIndex");

-- CreateIndex
CREATE INDEX "WorkLog_agentId_idx" ON "WorkLog"("agentId");

-- CreateIndex
CREATE INDEX "WorkLog_plotId_idx" ON "WorkLog"("plotId");

-- CreateIndex
CREATE INDEX "WorkLog_townId_idx" ON "WorkLog"("townId");

-- CreateIndex
CREATE INDEX "WorkLog_workType_idx" ON "WorkLog"("workType");

-- CreateIndex
CREATE INDEX "WorkLog_createdAt_idx" ON "WorkLog"("createdAt");

-- CreateIndex
CREATE INDEX "TownContribution_agentId_idx" ON "TownContribution"("agentId");

-- CreateIndex
CREATE INDEX "TownContribution_townId_idx" ON "TownContribution"("townId");

-- CreateIndex
CREATE UNIQUE INDEX "TownContribution_agentId_townId_key" ON "TownContribution"("agentId", "townId");

-- CreateIndex
CREATE INDEX "TownEvent_townId_idx" ON "TownEvent"("townId");

-- CreateIndex
CREATE INDEX "TownEvent_eventType_idx" ON "TownEvent"("eventType");

-- CreateIndex
CREATE INDEX "TownEvent_createdAt_idx" ON "TownEvent"("createdAt");
