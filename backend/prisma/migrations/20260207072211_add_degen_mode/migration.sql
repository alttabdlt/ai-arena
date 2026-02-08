-- CreateTable
CREATE TABLE "UserBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 10000,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalStaked" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentStake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalYieldEarned" INTEGER NOT NULL DEFAULT 0,
    "stakedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unstakedAt" DATETIME,
    CONSTRAINT "AgentStake_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "price" REAL NOT NULL,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PredictionMarket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT,
    "question" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionAAgentId" TEXT,
    "optionBAgentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "outcome" TEXT,
    "poolA" INTEGER NOT NULL DEFAULT 0,
    "poolB" INTEGER NOT NULL DEFAULT 0,
    "rakePercent" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "PredictionBet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PredictionBet_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PredictionMarket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBalance_walletAddress_key" ON "UserBalance"("walletAddress");

-- CreateIndex
CREATE INDEX "UserBalance_walletAddress_idx" ON "UserBalance"("walletAddress");

-- CreateIndex
CREATE INDEX "AgentStake_walletAddress_isActive_idx" ON "AgentStake"("walletAddress", "isActive");

-- CreateIndex
CREATE INDEX "AgentStake_agentId_isActive_idx" ON "AgentStake"("agentId", "isActive");

-- CreateIndex
CREATE INDEX "PriceSnapshot_createdAt_idx" ON "PriceSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "PredictionMarket_status_idx" ON "PredictionMarket"("status");

-- CreateIndex
CREATE INDEX "PredictionBet_marketId_idx" ON "PredictionBet"("marketId");

-- CreateIndex
CREATE INDEX "PredictionBet_walletAddress_idx" ON "PredictionBet"("walletAddress");
