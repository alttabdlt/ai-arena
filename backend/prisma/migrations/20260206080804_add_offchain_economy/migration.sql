-- CreateTable
CREATE TABLE "EconomyPool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reserveBalance" INTEGER NOT NULL DEFAULT 0,
    "arenaBalance" INTEGER NOT NULL DEFAULT 0,
    "feeBps" INTEGER NOT NULL DEFAULT 100,
    "cumulativeFeesReserve" INTEGER NOT NULL DEFAULT 0,
    "cumulativeFeesArena" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EconomySwap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amountIn" INTEGER NOT NULL,
    "amountOut" INTEGER NOT NULL,
    "feeAmount" INTEGER NOT NULL,
    "priceBefore" REAL NOT NULL,
    "priceAfter" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EconomySwap_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isInMatch" BOOLEAN NOT NULL DEFAULT false,
    "currentMatchId" TEXT,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ArenaAgent" ("apiCostCents", "apiKey", "archetype", "bankroll", "createdAt", "currentMatchId", "draws", "elo", "id", "isActive", "isInMatch", "lastActiveAt", "losses", "maxWagerPercent", "modelId", "name", "riskTolerance", "systemPrompt", "totalRake", "totalWagered", "totalWon", "updatedAt", "walletAddress", "wins") SELECT "apiCostCents", "apiKey", "archetype", "bankroll", "createdAt", "currentMatchId", "draws", "elo", "id", "isActive", "isInMatch", "lastActiveAt", "losses", "maxWagerPercent", "modelId", "name", "riskTolerance", "systemPrompt", "totalRake", "totalWagered", "totalWon", "updatedAt", "walletAddress", "wins" FROM "ArenaAgent";
DROP TABLE "ArenaAgent";
ALTER TABLE "new_ArenaAgent" RENAME TO "ArenaAgent";
CREATE UNIQUE INDEX "ArenaAgent_name_key" ON "ArenaAgent"("name");
CREATE UNIQUE INDEX "ArenaAgent_walletAddress_key" ON "ArenaAgent"("walletAddress");
CREATE UNIQUE INDEX "ArenaAgent_apiKey_key" ON "ArenaAgent"("apiKey");
CREATE INDEX "ArenaAgent_elo_idx" ON "ArenaAgent"("elo");
CREATE INDEX "ArenaAgent_isActive_idx" ON "ArenaAgent"("isActive");
CREATE INDEX "ArenaAgent_archetype_idx" ON "ArenaAgent"("archetype");
CREATE INDEX "ArenaAgent_apiKey_idx" ON "ArenaAgent"("apiKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EconomySwap_agentId_idx" ON "EconomySwap"("agentId");

-- CreateIndex
CREATE INDEX "EconomySwap_createdAt_idx" ON "EconomySwap"("createdAt");
