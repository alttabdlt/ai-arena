-- CreateTable
CREATE TABLE "AgentRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentAId" TEXT NOT NULL,
    "agentBId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "score" INTEGER NOT NULL DEFAULT 0,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionAt" DATETIME,
    "friendSince" DATETIME,
    "rivalSince" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRelationship_agentAId_fkey" FOREIGN KEY ("agentAId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentRelationship_agentBId_fkey" FOREIGN KEY ("agentBId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgentRelationship_agentAId_idx" ON "AgentRelationship"("agentAId");

-- CreateIndex
CREATE INDEX "AgentRelationship_agentBId_idx" ON "AgentRelationship"("agentBId");

-- CreateIndex
CREATE INDEX "AgentRelationship_status_idx" ON "AgentRelationship"("status");

-- CreateIndex
CREATE INDEX "AgentRelationship_updatedAt_idx" ON "AgentRelationship"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRelationship_agentAId_agentBId_key" ON "AgentRelationship"("agentAId", "agentBId");
