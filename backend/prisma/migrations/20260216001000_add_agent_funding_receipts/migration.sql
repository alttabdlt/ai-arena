-- CreateTable
CREATE TABLE "AgentFundingReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "txHash" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "arenaAmount" INTEGER NOT NULL,
    "rawAmount" TEXT NOT NULL,
    "blockNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentFundingReceipt_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentFundingReceipt_txHash_key" ON "AgentFundingReceipt"("txHash");

-- CreateIndex
CREATE INDEX "AgentFundingReceipt_agentId_createdAt_idx" ON "AgentFundingReceipt"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentFundingReceipt_walletAddress_createdAt_idx" ON "AgentFundingReceipt"("walletAddress", "createdAt");
