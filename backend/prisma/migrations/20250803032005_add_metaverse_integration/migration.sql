-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'DISABLED');

-- AlterTable
ALTER TABLE "Bot" ADD COLUMN     "currentZone" TEXT,
ADD COLUMN     "lastZoneChange" TIMESTAMP(3),
ADD COLUMN     "metaverseAgentId" TEXT,
ADD COLUMN     "metaversePosition" JSONB DEFAULT '{}';

-- CreateTable
CREATE TABLE "BotSync" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "syncErrors" JSONB NOT NULL DEFAULT '[]',
    "convexWorldId" TEXT,
    "convexAgentId" TEXT,
    "convexPlayerId" TEXT,
    "personalityMapped" BOOLEAN NOT NULL DEFAULT false,
    "positionSynced" BOOLEAN NOT NULL DEFAULT false,
    "statsSynced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotSync_botId_key" ON "BotSync"("botId");

-- CreateIndex
CREATE INDEX "BotSync_syncStatus_idx" ON "BotSync"("syncStatus");

-- CreateIndex
CREATE INDEX "BotSync_lastSyncedAt_idx" ON "BotSync"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "Bot_metaverseAgentId_idx" ON "Bot"("metaverseAgentId");

-- AddForeignKey
ALTER TABLE "BotSync" ADD CONSTRAINT "BotSync_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
