-- Add explicit payout budget buckets to the economy pool.
ALTER TABLE "EconomyPool" ADD COLUMN "opsBudget" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EconomyPool" ADD COLUMN "pvpBudget" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EconomyPool" ADD COLUMN "rescueBudget" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EconomyPool" ADD COLUMN "insuranceBudget" INTEGER NOT NULL DEFAULT 0;

-- Immutable economy movement ledger.
CREATE TABLE "EconomyLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "tick" INTEGER,
    "agentId" TEXT,
    "townId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "EconomyLedger_createdAt_idx" ON "EconomyLedger"("createdAt");
CREATE INDEX "EconomyLedger_type_createdAt_idx" ON "EconomyLedger"("type", "createdAt");
CREATE INDEX "EconomyLedger_agentId_createdAt_idx" ON "EconomyLedger"("agentId", "createdAt");
CREATE INDEX "EconomyLedger_townId_createdAt_idx" ON "EconomyLedger"("townId", "createdAt");
CREATE INDEX "EconomyLedger_poolId_createdAt_idx" ON "EconomyLedger"("poolId", "createdAt");
