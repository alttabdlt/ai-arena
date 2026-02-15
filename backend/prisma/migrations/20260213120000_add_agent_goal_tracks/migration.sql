-- CreateTable
CREATE TABLE "AgentGoalTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "townId" TEXT,
    "horizon" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "focusZone" TEXT,
    "targetValue" INTEGER NOT NULL,
    "progressValue" INTEGER NOT NULL DEFAULT 0,
    "startedTick" INTEGER NOT NULL,
    "deadlineTick" INTEGER,
    "lastEvaluatedTick" INTEGER,
    "completedTick" INTEGER,
    "failedTick" INTEGER,
    "rewardProfile" TEXT NOT NULL DEFAULT '{}',
    "penaltyProfile" TEXT NOT NULL DEFAULT '{}',
    "lastProgressLabel" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentGoalTrack_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentGoalTrack_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgentGoalTrack_agentId_status_idx" ON "AgentGoalTrack"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentGoalTrack_agentId_horizon_status_idx" ON "AgentGoalTrack"("agentId", "horizon", "status");

-- CreateIndex
CREATE INDEX "AgentGoalTrack_townId_idx" ON "AgentGoalTrack"("townId");

-- CreateIndex
CREATE INDEX "AgentGoalTrack_deadlineTick_idx" ON "AgentGoalTrack"("deadlineTick");
