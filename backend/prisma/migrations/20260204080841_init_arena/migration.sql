-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "username" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "kycTier" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "personality" TEXT NOT NULL DEFAULT 'WORKER',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "modelType" TEXT,
    "creatorId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stats" TEXT NOT NULL DEFAULT '{}',
    "character" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bot_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeploymentTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeploymentTransaction_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeploymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "queueType" TEXT NOT NULL DEFAULT 'STANDARD',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "matchedAt" DATETIME,
    "tournamentId" TEXT,
    CONSTRAINT "QueueEntry_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QueueEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'TOURNAMENT',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "gameHistory" TEXT NOT NULL,
    "decisions" TEXT NOT NULL,
    "result" TEXT,
    "replayUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "tournamentId" TEXT,
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "finalRank" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MatchParticipant_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "handNumber" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "gameState" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIDecision_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "entryFee" DECIMAL NOT NULL,
    "prizePool" DECIMAL NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TournamentParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TournamentParticipant_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TournamentParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Like" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Like_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerAddress" TEXT NOT NULL,
    "followingAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_followerAddress_fkey" FOREIGN KEY ("followerAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Follow_followingAddress_fkey" FOREIGN KEY ("followingAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "rarity" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotEquipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "powerBonus" INTEGER NOT NULL DEFAULT 0,
    "defenseBonus" INTEGER NOT NULL DEFAULT 0,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "consumable" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER,
    "maxUses" INTEGER,
    "speedBonus" INTEGER NOT NULL DEFAULT 0,
    "agilityBonus" INTEGER NOT NULL DEFAULT 0,
    "rangeBonus" INTEGER NOT NULL DEFAULT 0,
    "healingPower" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotEquipment_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotHouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "houseScore" INTEGER NOT NULL DEFAULT 100,
    "defenseLevel" INTEGER NOT NULL DEFAULT 1,
    "lastRobbed" DATETIME,
    "robberyCooldown" DATETIME,
    "worldPosition" TEXT NOT NULL DEFAULT '{"x": 0, "y": 0}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotHouse_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Furniture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "houseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "furnitureType" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "scoreBonus" INTEGER NOT NULL DEFAULT 0,
    "defenseBonus" INTEGER NOT NULL DEFAULT 0,
    "position" TEXT NOT NULL DEFAULT '{"x": 0, "y": 0, "rotation": 0}',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Furniture_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "BotHouse" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotActivityScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "lootboxesOpened" INTEGER NOT NULL DEFAULT 0,
    "activitiesCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastActive" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotActivityScore_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotExperience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentXP" INTEGER NOT NULL DEFAULT 0,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "xpToNextLevel" INTEGER NOT NULL DEFAULT 100,
    "combatXP" INTEGER NOT NULL DEFAULT 0,
    "socialXP" INTEGER NOT NULL DEFAULT 0,
    "criminalXP" INTEGER NOT NULL DEFAULT 0,
    "gamblingXP" INTEGER NOT NULL DEFAULT 0,
    "tradingXP" INTEGER NOT NULL DEFAULT 0,
    "prestigeLevel" INTEGER NOT NULL DEFAULT 0,
    "prestigeTokens" INTEGER NOT NULL DEFAULT 0,
    "skillPoints" INTEGER NOT NULL DEFAULT 0,
    "allocatedSkills" TEXT NOT NULL DEFAULT '{}',
    "bettingWins" INTEGER NOT NULL DEFAULT 0,
    "bettingLosses" INTEGER NOT NULL DEFAULT 0,
    "winStreak" INTEGER NOT NULL DEFAULT 0,
    "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "totalBetXP" INTEGER NOT NULL DEFAULT 0,
    "totalWonXP" INTEGER NOT NULL DEFAULT 0,
    "lastXPGain" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotExperience_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LootboxReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "lootboxRarity" TEXT NOT NULL,
    "equipmentRewards" TEXT NOT NULL DEFAULT '[]',
    "furnitureRewards" TEXT NOT NULL DEFAULT '[]',
    "currencyReward" INTEGER NOT NULL DEFAULT 0,
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LootboxReward_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LootboxReward_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotEnergy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "currentEnergy" INTEGER NOT NULL DEFAULT 100,
    "maxEnergy" INTEGER NOT NULL DEFAULT 100,
    "lastRegenTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "regenRate" INTEGER NOT NULL DEFAULT 1,
    "walkCost" INTEGER NOT NULL DEFAULT 1,
    "combatCost" INTEGER NOT NULL DEFAULT 10,
    "robberyCost" INTEGER NOT NULL DEFAULT 5,
    "activityCost" INTEGER NOT NULL DEFAULT 3,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "autoResumeAt" INTEGER,
    "totalConsumed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BotEnergy_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnergyPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "energyAmount" INTEGER NOT NULL,
    "hypeSpent" REAL NOT NULL,
    "packType" TEXT NOT NULL,
    "txHash" TEXT,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnergyPurchase_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "xpGained" INTEGER NOT NULL DEFAULT 0,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotActivityLog_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdleProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastXPClaim" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleMultiplier" REAL NOT NULL DEFAULT 1.0,
    "totalIdleTime" INTEGER NOT NULL DEFAULT 0,
    "totalIdleXP" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IdleProgress_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlobalJackpot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "currentAmount" INTEGER NOT NULL DEFAULT 0,
    "contributions" INTEGER NOT NULL DEFAULT 0,
    "lastContribution" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contributionRate" REAL NOT NULL DEFAULT 0.01,
    "winChance" REAL NOT NULL DEFAULT 0.001,
    "minAmount" INTEGER NOT NULL DEFAULT 1000,
    "totalWon" INTEGER NOT NULL DEFAULT 0,
    "totalWinners" INTEGER NOT NULL DEFAULT 0,
    "biggestWin" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JackpotHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "botName" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "winChance" REAL NOT NULL,
    "contributions" INTEGER NOT NULL,
    "jackpotId" TEXT NOT NULL,
    "wonAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JackpotHistory_jackpotId_fkey" FOREIGN KEY ("jackpotId") REFERENCES "GlobalJackpot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BettingTournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startTime" DATETIME NOT NULL,
    "gameType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "bettingDeadline" DATETIME NOT NULL,
    "totalBettingPool" INTEGER NOT NULL DEFAULT 0,
    "housePoolContribution" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BettingParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initialOdds" REAL NOT NULL,
    "currentOdds" REAL NOT NULL,
    "totalBetsPlaced" INTEGER NOT NULL DEFAULT 0,
    "placement" INTEGER,
    "score" INTEGER,
    CONSTRAINT "BettingParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "BettingTournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BettingEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "potentialPayout" REAL NOT NULL,
    "actualPayout" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BettingEntry_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BettingEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "BettingTournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BettingEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "BettingParticipant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BettingPool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "totalPool" INTEGER NOT NULL DEFAULT 0,
    "houseCut" INTEGER NOT NULL DEFAULT 0,
    "payoutPool" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StakedIDLE" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "xpGenerationRate" INTEGER NOT NULL,
    "stakingTier" TEXT NOT NULL,
    "lockedUntil" DATETIME NOT NULL,
    "totalXPGenerated" INTEGER NOT NULL DEFAULT 0,
    "lastClaimTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StakedIDLE_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XPBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "currentXP" INTEGER NOT NULL DEFAULT 0,
    "totalEarnedXP" INTEGER NOT NULL DEFAULT 0,
    "totalSpentXP" INTEGER NOT NULL DEFAULT 0,
    "monthlyDecay" INTEGER NOT NULL DEFAULT 0,
    "lastDecayDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "XPBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArenaAgent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "archetype" TEXT NOT NULL DEFAULT 'CHAMELEON',
    "modelId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "apiKey" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "ArenaMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT,
    "winnerId" TEXT,
    "wagerAmount" INTEGER NOT NULL DEFAULT 0,
    "totalPot" INTEGER NOT NULL DEFAULT 0,
    "rakeAmount" INTEGER NOT NULL DEFAULT 0,
    "gameState" TEXT NOT NULL DEFAULT '{}',
    "turnNumber" INTEGER NOT NULL DEFAULT 0,
    "currentTurnId" TEXT,
    "depositTxHash" TEXT,
    "resolveTxHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "tournamentId" TEXT,
    CONSTRAINT "ArenaMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "ArenaTournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ArenaMatch_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "ArenaAgent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArenaMatch_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "ArenaAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ArenaMatch_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "ArenaAgent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArenaMove" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL DEFAULT '',
    "gameStateBefore" TEXT NOT NULL DEFAULT '{}',
    "apiCostCents" INTEGER NOT NULL DEFAULT 0,
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArenaMove_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ArenaMatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArenaMove_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpponentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "patterns" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "lastPlayedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpponentRecord_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpponentRecord_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "ArenaAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArenaTournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'SWISS',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "gameTypes" TEXT NOT NULL DEFAULT '[]',
    "wagerPerMatch" INTEGER NOT NULL DEFAULT 100,
    "totalRounds" INTEGER NOT NULL DEFAULT 5,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "prizePool" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ArenaTournamentEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0,
    "buchholz" REAL NOT NULL DEFAULT 0,
    "rank" INTEGER,
    CONSTRAINT "ArenaTournamentEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "ArenaTournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArenaTournamentEntry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ArenaAgent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_address_idx" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_tokenId_key" ON "Bot"("tokenId");

-- CreateIndex
CREATE INDEX "Bot_creatorId_idx" ON "Bot"("creatorId");

-- CreateIndex
CREATE INDEX "Bot_createdAt_idx" ON "Bot"("createdAt");

-- CreateIndex
CREATE INDEX "Bot_isActive_idx" ON "Bot"("isActive");

-- CreateIndex
CREATE INDEX "Bot_tokenId_idx" ON "Bot"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentTransaction_botId_key" ON "DeploymentTransaction"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentTransaction_txHash_key" ON "DeploymentTransaction"("txHash");

-- CreateIndex
CREATE INDEX "DeploymentTransaction_userId_idx" ON "DeploymentTransaction"("userId");

-- CreateIndex
CREATE INDEX "DeploymentTransaction_txHash_idx" ON "DeploymentTransaction"("txHash");

-- CreateIndex
CREATE INDEX "DeploymentTransaction_status_idx" ON "DeploymentTransaction"("status");

-- CreateIndex
CREATE INDEX "QueueEntry_botId_idx" ON "QueueEntry"("botId");

-- CreateIndex
CREATE INDEX "QueueEntry_status_idx" ON "QueueEntry"("status");

-- CreateIndex
CREATE INDEX "QueueEntry_queueType_idx" ON "QueueEntry"("queueType");

-- CreateIndex
CREATE INDEX "QueueEntry_priority_idx" ON "QueueEntry"("priority");

-- CreateIndex
CREATE INDEX "QueueEntry_tournamentId_idx" ON "QueueEntry"("tournamentId");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Match_type_idx" ON "Match"("type");

-- CreateIndex
CREATE INDEX "Match_createdAt_idx" ON "Match"("createdAt");

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_idx" ON "MatchParticipant"("matchId");

-- CreateIndex
CREATE INDEX "MatchParticipant_botId_idx" ON "MatchParticipant"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchParticipant_matchId_botId_key" ON "MatchParticipant"("matchId", "botId");

-- CreateIndex
CREATE INDEX "AIDecision_matchId_idx" ON "AIDecision"("matchId");

-- CreateIndex
CREATE INDEX "AIDecision_botId_idx" ON "AIDecision"("botId");

-- CreateIndex
CREATE INDEX "Tournament_type_idx" ON "Tournament"("type");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Tournament_startTime_idx" ON "Tournament"("startTime");

-- CreateIndex
CREATE INDEX "TournamentParticipant_tournamentId_idx" ON "TournamentParticipant"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentParticipant_botId_idx" ON "TournamentParticipant"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_botId_key" ON "TournamentParticipant"("tournamentId", "botId");

-- CreateIndex
CREATE INDEX "Comment_botId_idx" ON "Comment"("botId");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "Like_botId_idx" ON "Like"("botId");

-- CreateIndex
CREATE INDEX "Like_userId_idx" ON "Like"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_userId_botId_key" ON "Like"("userId", "botId");

-- CreateIndex
CREATE INDEX "Follow_followerAddress_idx" ON "Follow"("followerAddress");

-- CreateIndex
CREATE INDEX "Follow_followingAddress_idx" ON "Follow"("followingAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerAddress_followingAddress_key" ON "Follow"("followerAddress", "followingAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_name_key" ON "Achievement"("name");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "BotEquipment_botId_idx" ON "BotEquipment"("botId");

-- CreateIndex
CREATE INDEX "BotEquipment_equipped_idx" ON "BotEquipment"("equipped");

-- CreateIndex
CREATE INDEX "BotEquipment_consumable_idx" ON "BotEquipment"("consumable");

-- CreateIndex
CREATE UNIQUE INDEX "BotHouse_botId_key" ON "BotHouse"("botId");

-- CreateIndex
CREATE INDEX "BotHouse_botId_idx" ON "BotHouse"("botId");

-- CreateIndex
CREATE INDEX "Furniture_houseId_idx" ON "Furniture"("houseId");

-- CreateIndex
CREATE UNIQUE INDEX "BotActivityScore_botId_key" ON "BotActivityScore"("botId");

-- CreateIndex
CREATE INDEX "BotActivityScore_botId_idx" ON "BotActivityScore"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "BotExperience_botId_key" ON "BotExperience"("botId");

-- CreateIndex
CREATE INDEX "BotExperience_botId_idx" ON "BotExperience"("botId");

-- CreateIndex
CREATE INDEX "BotExperience_level_idx" ON "BotExperience"("level");

-- CreateIndex
CREATE INDEX "BotExperience_totalXP_idx" ON "BotExperience"("totalXP");

-- CreateIndex
CREATE INDEX "LootboxReward_botId_idx" ON "LootboxReward"("botId");

-- CreateIndex
CREATE INDEX "LootboxReward_matchId_idx" ON "LootboxReward"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "BotEnergy_botId_key" ON "BotEnergy"("botId");

-- CreateIndex
CREATE INDEX "BotEnergy_botId_idx" ON "BotEnergy"("botId");

-- CreateIndex
CREATE INDEX "EnergyPurchase_botId_idx" ON "EnergyPurchase"("botId");

-- CreateIndex
CREATE INDEX "EnergyPurchase_purchasedAt_idx" ON "EnergyPurchase"("purchasedAt");

-- CreateIndex
CREATE INDEX "BotActivityLog_botId_timestamp_idx" ON "BotActivityLog"("botId", "timestamp");

-- CreateIndex
CREATE INDEX "BotActivityLog_personality_idx" ON "BotActivityLog"("personality");

-- CreateIndex
CREATE UNIQUE INDEX "IdleProgress_botId_key" ON "IdleProgress"("botId");

-- CreateIndex
CREATE INDEX "IdleProgress_botId_idx" ON "IdleProgress"("botId");

-- CreateIndex
CREATE INDEX "IdleProgress_lastActiveAt_idx" ON "IdleProgress"("lastActiveAt");

-- CreateIndex
CREATE INDEX "JackpotHistory_botId_idx" ON "JackpotHistory"("botId");

-- CreateIndex
CREATE INDEX "JackpotHistory_wonAt_idx" ON "JackpotHistory"("wonAt");

-- CreateIndex
CREATE INDEX "JackpotHistory_amount_idx" ON "JackpotHistory"("amount");

-- CreateIndex
CREATE INDEX "BettingTournament_startTime_idx" ON "BettingTournament"("startTime");

-- CreateIndex
CREATE INDEX "BettingTournament_status_idx" ON "BettingTournament"("status");

-- CreateIndex
CREATE INDEX "BettingParticipant_tournamentId_idx" ON "BettingParticipant"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "BettingParticipant_tournamentId_aiModel_key" ON "BettingParticipant"("tournamentId", "aiModel");

-- CreateIndex
CREATE INDEX "BettingEntry_botId_idx" ON "BettingEntry"("botId");

-- CreateIndex
CREATE INDEX "BettingEntry_tournamentId_idx" ON "BettingEntry"("tournamentId");

-- CreateIndex
CREATE INDEX "BettingEntry_status_idx" ON "BettingEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BettingPool_tournamentId_key" ON "BettingPool"("tournamentId");

-- CreateIndex
CREATE INDEX "BettingPool_tournamentId_idx" ON "BettingPool"("tournamentId");

-- CreateIndex
CREATE INDEX "StakedIDLE_userId_idx" ON "StakedIDLE"("userId");

-- CreateIndex
CREATE INDEX "StakedIDLE_isActive_idx" ON "StakedIDLE"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "XPBalance_userId_key" ON "XPBalance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaAgent_name_key" ON "ArenaAgent"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaAgent_walletAddress_key" ON "ArenaAgent"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaAgent_apiKey_key" ON "ArenaAgent"("apiKey");

-- CreateIndex
CREATE INDEX "ArenaAgent_elo_idx" ON "ArenaAgent"("elo");

-- CreateIndex
CREATE INDEX "ArenaAgent_isActive_idx" ON "ArenaAgent"("isActive");

-- CreateIndex
CREATE INDEX "ArenaAgent_archetype_idx" ON "ArenaAgent"("archetype");

-- CreateIndex
CREATE INDEX "ArenaAgent_apiKey_idx" ON "ArenaAgent"("apiKey");

-- CreateIndex
CREATE INDEX "ArenaMatch_status_idx" ON "ArenaMatch"("status");

-- CreateIndex
CREATE INDEX "ArenaMatch_player1Id_idx" ON "ArenaMatch"("player1Id");

-- CreateIndex
CREATE INDEX "ArenaMatch_player2Id_idx" ON "ArenaMatch"("player2Id");

-- CreateIndex
CREATE INDEX "ArenaMatch_gameType_idx" ON "ArenaMatch"("gameType");

-- CreateIndex
CREATE INDEX "ArenaMatch_createdAt_idx" ON "ArenaMatch"("createdAt");

-- CreateIndex
CREATE INDEX "ArenaMatch_tournamentId_idx" ON "ArenaMatch"("tournamentId");

-- CreateIndex
CREATE INDEX "ArenaMove_matchId_turnNumber_idx" ON "ArenaMove"("matchId", "turnNumber");

-- CreateIndex
CREATE INDEX "ArenaMove_agentId_idx" ON "ArenaMove"("agentId");

-- CreateIndex
CREATE INDEX "OpponentRecord_agentId_idx" ON "OpponentRecord"("agentId");

-- CreateIndex
CREATE INDEX "OpponentRecord_opponentId_idx" ON "OpponentRecord"("opponentId");

-- CreateIndex
CREATE UNIQUE INDEX "OpponentRecord_agentId_opponentId_key" ON "OpponentRecord"("agentId", "opponentId");

-- CreateIndex
CREATE INDEX "ArenaTournament_status_idx" ON "ArenaTournament"("status");

-- CreateIndex
CREATE INDEX "ArenaTournamentEntry_tournamentId_idx" ON "ArenaTournamentEntry"("tournamentId");

-- CreateIndex
CREATE INDEX "ArenaTournamentEntry_agentId_idx" ON "ArenaTournamentEntry"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaTournamentEntry_tournamentId_agentId_key" ON "ArenaTournamentEntry"("tournamentId", "agentId");
