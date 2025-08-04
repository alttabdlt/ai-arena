-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'DEVELOPER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AIModel" AS ENUM ('GPT_4O', 'CLAUDE_3_5_SONNET', 'CLAUDE_3_OPUS', 'DEEPSEEK_CHAT');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "QueueType" AS ENUM ('STANDARD', 'PRIORITY', 'PREMIUM');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'MATCHED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('TOURNAMENT', 'HEAD_TO_HEAD', 'PRACTICE');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('ROOKIE', 'PRO', 'CHAMPIONSHIP');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AchievementRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('WEAPON', 'ARMOR', 'TOOL', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "FurnitureType" AS ENUM ('DECORATION', 'FUNCTIONAL', 'DEFENSIVE', 'TROPHY');

-- CreateEnum
CREATE TYPE "BotPersonality" AS ENUM ('CRIMINAL', 'GAMBLER', 'WORKER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "username" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "kycTier" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "prompt" VARCHAR(1000) NOT NULL,
    "personality" "BotPersonality" NOT NULL DEFAULT 'WORKER',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "modelType" "AIModel" NOT NULL,
    "creatorId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentTransaction" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "amount" DECIMAL(78,18) NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "queueType" "QueueType" NOT NULL DEFAULT 'STANDARD',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "matchedAt" TIMESTAMP(3),

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "type" "MatchType" NOT NULL DEFAULT 'TOURNAMENT',
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "gameHistory" JSONB NOT NULL,
    "decisions" JSONB NOT NULL,
    "result" JSONB,
    "replayUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "tournamentId" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "finalRank" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIDecision" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "handNumber" INTEGER NOT NULL,
    "decision" JSONB NOT NULL,
    "gameState" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TournamentType" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'UPCOMING',
    "entryFee" DECIMAL(78,18) NOT NULL,
    "prizePool" DECIMAL(78,18) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentParticipant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Like" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerAddress" TEXT NOT NULL,
    "followingAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "rarity" "AchievementRarity" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotEquipment" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentType" "EquipmentType" NOT NULL,
    "rarity" "ItemRarity" NOT NULL,
    "powerBonus" INTEGER NOT NULL DEFAULT 0,
    "defenseBonus" INTEGER NOT NULL DEFAULT 0,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotHouse" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "houseScore" INTEGER NOT NULL DEFAULT 100,
    "defenseLevel" INTEGER NOT NULL DEFAULT 1,
    "lastRobbed" TIMESTAMP(3),
    "robberyCooldown" TIMESTAMP(3),
    "worldPosition" JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotHouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Furniture" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "furnitureType" "FurnitureType" NOT NULL,
    "rarity" "ItemRarity" NOT NULL,
    "scoreBonus" INTEGER NOT NULL DEFAULT 0,
    "defenseBonus" INTEGER NOT NULL DEFAULT 0,
    "position" JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "rotation": 0}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Furniture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RobberyLog" (
    "id" TEXT NOT NULL,
    "robberBotId" TEXT NOT NULL,
    "victimBotId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "powerUsed" INTEGER NOT NULL,
    "defenseFaced" INTEGER NOT NULL,
    "lootValue" INTEGER NOT NULL DEFAULT 0,
    "itemsStolen" JSONB NOT NULL DEFAULT '[]',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RobberyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotActivityScore" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "lootboxesOpened" INTEGER NOT NULL DEFAULT 0,
    "socialInteractions" INTEGER NOT NULL DEFAULT 0,
    "successfulRobberies" INTEGER NOT NULL DEFAULT 0,
    "defenseSuccesses" INTEGER NOT NULL DEFAULT 0,
    "tradesCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotActivityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LootboxReward" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "lootboxRarity" "ItemRarity" NOT NULL,
    "equipmentRewards" JSONB NOT NULL DEFAULT '[]',
    "furnitureRewards" JSONB NOT NULL DEFAULT '[]',
    "currencyReward" INTEGER NOT NULL DEFAULT 0,
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LootboxReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "initiatorBotId" TEXT NOT NULL,
    "receiverBotId" TEXT NOT NULL,
    "offeredItems" JSONB NOT NULL DEFAULT '[]',
    "requestedItems" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Bot_creatorId_idx" ON "Bot"("creatorId");

-- CreateIndex
CREATE INDEX "Bot_createdAt_idx" ON "Bot"("createdAt");

-- CreateIndex
CREATE INDEX "Bot_isActive_idx" ON "Bot"("isActive");

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
CREATE UNIQUE INDEX "BotHouse_botId_key" ON "BotHouse"("botId");

-- CreateIndex
CREATE INDEX "BotHouse_botId_idx" ON "BotHouse"("botId");

-- CreateIndex
CREATE INDEX "Furniture_houseId_idx" ON "Furniture"("houseId");

-- CreateIndex
CREATE INDEX "RobberyLog_robberBotId_idx" ON "RobberyLog"("robberBotId");

-- CreateIndex
CREATE INDEX "RobberyLog_victimBotId_idx" ON "RobberyLog"("victimBotId");

-- CreateIndex
CREATE INDEX "RobberyLog_timestamp_idx" ON "RobberyLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "BotActivityScore_botId_key" ON "BotActivityScore"("botId");

-- CreateIndex
CREATE INDEX "BotActivityScore_botId_idx" ON "BotActivityScore"("botId");

-- CreateIndex
CREATE INDEX "LootboxReward_botId_idx" ON "LootboxReward"("botId");

-- CreateIndex
CREATE INDEX "LootboxReward_matchId_idx" ON "LootboxReward"("matchId");

-- CreateIndex
CREATE INDEX "Trade_initiatorBotId_idx" ON "Trade"("initiatorBotId");

-- CreateIndex
CREATE INDEX "Trade_receiverBotId_idx" ON "Trade"("receiverBotId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentTransaction" ADD CONSTRAINT "DeploymentTransaction_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentTransaction" ADD CONSTRAINT "DeploymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIDecision" ADD CONSTRAINT "AIDecision_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerAddress_fkey" FOREIGN KEY ("followerAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingAddress_fkey" FOREIGN KEY ("followingAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotEquipment" ADD CONSTRAINT "BotEquipment_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotHouse" ADD CONSTRAINT "BotHouse_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Furniture" ADD CONSTRAINT "Furniture_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "BotHouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobberyLog" ADD CONSTRAINT "RobberyLog_robberBotId_fkey" FOREIGN KEY ("robberBotId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobberyLog" ADD CONSTRAINT "RobberyLog_victimBotId_fkey" FOREIGN KEY ("victimBotId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotActivityScore" ADD CONSTRAINT "BotActivityScore_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootboxReward" ADD CONSTRAINT "LootboxReward_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootboxReward" ADD CONSTRAINT "LootboxReward_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_initiatorBotId_fkey" FOREIGN KEY ("initiatorBotId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_receiverBotId_fkey" FOREIGN KEY ("receiverBotId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

