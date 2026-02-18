-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArenaAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "archetype" TEXT NOT NULL DEFAULT 'CHAMELEON',
    "modelId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "apiKey" TEXT NOT NULL,
    "reserveBalance" INTEGER NOT NULL DEFAULT 10000,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "riskTolerance" REAL NOT NULL DEFAULT 0.5,
    "maxWagerPercent" REAL NOT NULL DEFAULT 0.15,
    "elo" INTEGER NOT NULL DEFAULT 1500,
    "bankroll" INTEGER NOT NULL DEFAULT 10000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "totalWagered" INTEGER NOT NULL DEFAULT 0,
    "totalWon" INTEGER NOT NULL DEFAULT 0,
    "totalRake" INTEGER NOT NULL DEFAULT 0,
    "apiCostCents" INTEGER NOT NULL DEFAULT 0,
    "scratchpad" TEXT NOT NULL DEFAULT '',
    "lastActionType" TEXT NOT NULL DEFAULT '',
    "lastReasoning" TEXT NOT NULL DEFAULT '',
    "lastNarrative" TEXT NOT NULL DEFAULT '',
    "lastTargetPlot" INTEGER,
    "lastTickAt" DATETIME,
    "health" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "spawnedByUser" BOOLEAN NOT NULL DEFAULT false,
    "isInMatch" BOOLEAN NOT NULL DEFAULT false,
    "currentMatchId" TEXT,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ArenaAgent" ("apiCostCents", "apiKey", "archetype", "bankroll", "createdAt", "currentMatchId", "draws", "elo", "id", "isActive", "isInMatch", "lastActiveAt", "losses", "maxWagerPercent", "modelId", "name", "reserveBalance", "riskTolerance", "systemPrompt", "totalRake", "totalWagered", "totalWon", "updatedAt", "walletAddress", "wins") SELECT "apiCostCents", "apiKey", "archetype", "bankroll", "createdAt", "currentMatchId", "draws", "elo", "id", "isActive", "isInMatch", "lastActiveAt", "losses", "maxWagerPercent", "modelId", "name", "reserveBalance", "riskTolerance", "systemPrompt", "totalRake", "totalWagered", "totalWon", "updatedAt", "walletAddress", "wins" FROM "ArenaAgent";
DROP TABLE "ArenaAgent";
ALTER TABLE "new_ArenaAgent" RENAME TO "ArenaAgent";
CREATE UNIQUE INDEX "ArenaAgent_name_key" ON "ArenaAgent"("name");
CREATE UNIQUE INDEX "ArenaAgent_walletAddress_key" ON "ArenaAgent"("walletAddress");
CREATE UNIQUE INDEX "ArenaAgent_apiKey_key" ON "ArenaAgent"("apiKey");
CREATE INDEX "ArenaAgent_elo_idx" ON "ArenaAgent"("elo");
CREATE INDEX "ArenaAgent_isActive_idx" ON "ArenaAgent"("isActive");
CREATE INDEX "ArenaAgent_archetype_idx" ON "ArenaAgent"("archetype");
CREATE INDEX "ArenaAgent_apiKey_idx" ON "ArenaAgent"("apiKey");
CREATE TABLE "new_Plot" (
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
    "qualityScore" INTEGER,
    "qualityReview" TEXT,
    "totalInvested" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Plot_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Plot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ArenaAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Plot_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "ArenaAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Plot" ("apiCallsUsed", "buildCompletedAt", "buildCostArena", "buildStartedAt", "builderId", "buildingData", "buildingDesc", "buildingName", "buildingType", "createdAt", "id", "ownerId", "plotIndex", "status", "townId", "updatedAt", "x", "y", "zone") SELECT "apiCallsUsed", "buildCompletedAt", "buildCostArena", "buildStartedAt", "builderId", "buildingData", "buildingDesc", "buildingName", "buildingType", "createdAt", "id", "ownerId", "plotIndex", "status", "townId", "updatedAt", "x", "y", "zone" FROM "Plot";
DROP TABLE "Plot";
ALTER TABLE "new_Plot" RENAME TO "Plot";
CREATE INDEX "Plot_townId_idx" ON "Plot"("townId");
CREATE INDEX "Plot_status_idx" ON "Plot"("status");
CREATE INDEX "Plot_ownerId_idx" ON "Plot"("ownerId");
CREATE INDEX "Plot_builderId_idx" ON "Plot"("builderId");
CREATE UNIQUE INDEX "Plot_townId_plotIndex_key" ON "Plot"("townId", "plotIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

