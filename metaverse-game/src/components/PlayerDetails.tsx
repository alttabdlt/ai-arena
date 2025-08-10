import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import closeImg from '../../assets/close.svg';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import ActivityLogs from './ActivityLogs';
import XPBar from './XPBar';
import BotStatsPanel from './BotStatsPanel';
import InventoryPanel from './InventoryPanel';
import { toastOnError } from '../toasts';
import { useSendInput } from '../hooks/sendInput';
import { Player } from '../../convex/aiTown/player';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';
import { MessageSquare, Activity, Zap, Pause, TrendingUp, Package, ChartBar } from 'lucide-react';

export default function PlayerDetails({
  worldId,
  engineId,
  game,
  playerId,
  setSelectedElement,
  scrollViewRef,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
}) {
  // 1. All useState hooks first
  const [activeTab, setActiveTab] = useState<'stats' | 'inventory' | 'chat' | 'activity'>('activity');
  
  // 2. All useQuery and useSendInput hooks - must be called unconditionally
  // @ts-ignore - Known Convex type depth issue
  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId });
  
  const startConversation = useSendInput(engineId, 'startConversation');
  const acceptInvite = useSendInput(engineId, 'acceptInvite');
  const rejectInvite = useSendInput(engineId, 'rejectInvite');
  const leaveConversation = useSendInput(engineId, 'leaveConversation');
  
  // 3. Calculate values needed for conditional hooks
  const players = [...game.world.players.values()];
  const humanPlayer = players.find((p) => p.human === humanTokenIdentifier);
  const humanConversation = humanPlayer ? game.world.playerConversation(humanPlayer) : undefined;
  
  // Always select the other player if we're in a conversation with them.
  if (humanPlayer && humanConversation) {
    const otherPlayerIds = [...humanConversation.participants.keys()].filter(
      (p) => p !== humanPlayer.id,
    );
    playerId = otherPlayerIds[0];
  }

  const player = playerId && game.world.players.get(playerId);
  const playerConversation = player && game.world.playerConversation(player);
  const playerDescription = playerId && game.playerDescriptions.get(playerId);
  const agent = player && [...game.world.agents.values()].find(a => a.playerId === player.id);
  
  // 4. Conditional useQuery hooks - always called but with skip conditions
  const experienceData = useQuery(api.aiTown.idleGains.getPlayerIdleStats,
    player && agent?.aiArenaBotId ? { worldId, playerId: player.id as string } : 'skip'
  );
  
  const inventory = useQuery(api.aiTown.inventory.getPlayerInventory,
    player ? { worldId, playerId: player.id as string } : 'skip'
  );
  
  // 5. NOW we can have early returns after ALL hooks have been called
  if (!playerId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-center">Click on an agent to see chat</p>
      </div>
    );
  }
  if (!player) {
    return null;
  }
  const isMe = humanPlayer && player.id === humanPlayer.id;
  const canInvite = !isMe && !playerConversation && humanPlayer && !humanConversation;
  const sameConversation =
    !isMe &&
    humanPlayer &&
    humanConversation &&
    playerConversation &&
    humanConversation.id === playerConversation.id;

  const humanStatus =
    humanPlayer && humanConversation && humanConversation.participants.get(humanPlayer.id)?.status;
  const playerStatus = playerConversation && playerConversation.participants.get(playerId)?.status;

  const haveInvite = sameConversation && humanStatus?.kind === 'invited';
  const waitingForAccept =
    sameConversation && playerConversation.participants.get(playerId)?.status.kind === 'invited';
  const waitingForNearby =
    sameConversation && playerStatus?.kind === 'walkingOver' && humanStatus?.kind === 'walkingOver';

  const inConversationWithMe =
    sameConversation &&
    playerStatus?.kind === 'participating' &&
    humanStatus?.kind === 'participating';

  const onStartConversation = async () => {
    if (!humanPlayer || !playerId) {
      return;
    }
    console.log(`Starting conversation`);
    await toastOnError(startConversation({ playerId: humanPlayer.id, invitee: playerId }));
  };
  const onAcceptInvite = async () => {
    if (!humanPlayer || !humanConversation || !playerId) {
      return;
    }
    await toastOnError(
      acceptInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onRejectInvite = async () => {
    if (!humanPlayer || !humanConversation) {
      return;
    }
    await toastOnError(
      rejectInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onLeaveConversation = async () => {
    if (!humanPlayer || !inConversationWithMe || !humanConversation) {
      return;
    }
    await toastOnError(
      leaveConversation({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  // const pendingSuffix = (inputName: string) =>
  //   [...inflightInputs.values()].find((i) => i.name === inputName) ? ' opacity-50' : '';

  const pendingSuffix = (s: string) => '';
  
  // Note: agent is already calculated above before the hooks
  // Note: experienceData and inventory hooks are already called above
  
  // Get energy data from player
  const botEnergy = player ? {
    currentEnergy: player.currentEnergy || 30,
    maxEnergy: player.maxEnergy || 30,
    isPaused: player.currentEnergy <= 0,
    consumptionRate: 1,
    regenerationRate: 1,
    netConsumption: player.currentEnergy > 0 ? 1 : -1
  } : null;
  
  const getEnergyPercentage = () => {
    if (!botEnergy) return 0;
    return (botEnergy.currentEnergy / botEnergy.maxEnergy) * 100;
  };
  
  const getEnergyColor = (percentage: number) => {
    if (percentage > 50) return '#10b981'; // green
    if (percentage > 20) return '#eab308'; // yellow
    return '#ef4444'; // red
  };
  
  const energyPercentage = getEnergyPercentage();
  
  return (
    <>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">
            {playerDescription?.name}
          </h2>
          <button
            className="text-gray-400 hover:text-gray-200 transition-colors p-1"
            onClick={() => setSelectedElement(undefined)}
          >
            <img className="w-5 h-5" src={closeImg} />
          </button>
        </div>
        
        {/* XP Bar */}
        {agent?.aiArenaBotId && experienceData && (
          <div className="mb-3">
            <XPBar
              currentXP={experienceData.currentXP || 0}
              requiredXP={100 * (experienceData.level || 1)}
              level={experienceData.level || 1}
              prestige={experienceData.prestige || 0}
              compact={true}
              showLabels={false}
            />
          </div>
        )}
        
        {/* Energy Display */}
        {botEnergy && agent?.aiArenaBotId && (
          <div className="p-2 bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-medium text-gray-200">
                  {botEnergy.currentEnergy}/{botEnergy.maxEnergy} Energy
                </span>
                {botEnergy.isPaused && (
                  <div className="flex items-center gap-1 text-gray-400">
                    <Pause className="w-3 h-3" />
                    <span className="text-xs">Resting</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {botEnergy.netConsumption > 0 ? `-${botEnergy.netConsumption}` : `+${Math.abs(botEnergy.netConsumption)}`}/h
              </span>
            </div>
            <div className="relative h-1.5 bg-gray-700 rounded-full overflow-hidden mt-1.5">
              <div 
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{ 
                  width: `${energyPercentage}%`,
                  backgroundColor: getEnergyColor(energyPercentage)
                }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-0.5 mb-4 bg-gray-800/50 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md transition-all ${
            activeTab === 'stats'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <ChartBar className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Stats</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md transition-all ${
            activeTab === 'inventory'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Inventory</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md transition-all ${
            activeTab === 'chat'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Chat</span>
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md transition-all ${
            activeTab === 'activity'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Activity</span>
        </button>
      </div>
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'stats' && (
          <BotStatsPanel
            stats={{
              name: playerDescription?.name || 'Unknown Bot',
              personality: agent?.personality || 'WORKER',
              tokenId: agent?.aiArenaBotId?.slice(-4),
              level: experienceData?.level || 1,
              currentXP: experienceData?.currentXP || 0,
              requiredXP: 100 * (experienceData?.level || 1),
              prestige: experienceData?.prestige || 0,
              categoryXP: {
                combat: experienceData?.combatXP || 0,
                social: experienceData?.socialXP || 0,
                exploration: experienceData?.tradingXP || 0,  // Map trading to exploration
                achievement: experienceData?.gamblingXP || 0,  // Map gambling to achievement
                robbery: experienceData?.criminalXP || 0,
              },
              skills: {
                strength: experienceData?.allocatedSkills?.strength || 10,
                agility: experienceData?.allocatedSkills?.defense || 10,
                intelligence: experienceData?.allocatedSkills?.intelligence || 10,
                charisma: experienceData?.allocatedSkills?.charisma || 10,
                luck: experienceData?.allocatedSkills?.luck || 10,
              },
              totalSteps: experienceData?.stepsTaken || 0,
              dailySteps: player?.stepsTaken || 0,  // Will track daily in future
              stepStreak: 0,  // Will implement streak tracking
              currentEnergy: botEnergy?.currentEnergy || 0,
              maxEnergy: botEnergy?.maxEnergy || 30,
              energyRegenRate: botEnergy?.regenerationRate || 1,
              powerBonus: player?.equipment?.powerBonus || 0,
              defenseBonus: player?.equipment?.defenseBonus || 0,
              robberySuccess: 0,
              robberyAttempts: 0,
              combatWins: 0,
              combatLosses: 0,
              totalLootDrops: experienceData?.totalLootDrops || 0,
              itemsCollected: inventory?.items?.length || 0,
              rareItemsFound: 0,
              conversations: 0,
              alliances: 0,
              enemies: 0,
            }}
          />
        )}
        
        {activeTab === 'inventory' && (
          <InventoryPanel
            items={inventory?.items?.map((item: any) => ({
              id: item.id,
              name: item.name,
              type: item.type.toLowerCase() as any,
              rarity: item.rarity,
              quantity: 1,
              description: item.metadata?.description,
              stats: {
                power: item.powerBonus,
                defense: item.defenseBonus,
              },
              value: item.value || 100,
              equipped: item.equipped,
            })) || []}
            maxSlots={50}
            onItemClick={(item) => console.log('Item clicked:', item)}
          />
        )}
        
        {activeTab === 'chat' && (
          <>
            {canInvite && (
              <button
                className={
                  'mt-3 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors' +
                  pendingSuffix('startConversation')
                }
                onClick={onStartConversation}
              >
                Start conversation
              </button>
            )}
            {waitingForAccept && (
              <button className="mt-3 w-full py-2 px-4 bg-gray-600 text-white rounded opacity-50 cursor-not-allowed">
                Waiting for accept...
              </button>
            )}
            {waitingForNearby && (
              <button className="mt-3 w-full py-2 px-4 bg-gray-600 text-white rounded opacity-50 cursor-not-allowed">
                Walking over...
              </button>
            )}
            {inConversationWithMe && (
              <button
                className={
                  'mt-3 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors' +
                  pendingSuffix('leaveConversation')
                }
                onClick={onLeaveConversation}
              >
                Leave conversation
              </button>
            )}
            {haveInvite && (
              <>
                <button
                  className={
                    'mt-3 w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded transition-colors' +
                    pendingSuffix('acceptInvite')
                  }
                  onClick={onAcceptInvite}
                >
                  Accept
                </button>
                <button
                  className={
                    'mt-3 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors' +
                    pendingSuffix('rejectInvite')
                  }
                  onClick={onRejectInvite}
                >
                  Reject
                </button>
              </>
            )}
            {!playerConversation && player.activity && player.activity.until > Date.now() && (
              <div className="mt-3 p-2 bg-gray-800 rounded text-sm text-center">
                {player.activity.description}
              </div>
            )}
            {playerConversation && playerStatus?.kind === 'participating' && (
              <Messages
                worldId={worldId}
                engineId={engineId}
                inConversationWithMe={inConversationWithMe ?? false}
                conversation={{ kind: 'active', doc: playerConversation }}
                humanPlayer={humanPlayer}
                scrollViewRef={scrollViewRef}
              />
            )}
            {playerConversation && playerStatus?.kind === 'participating' && !inConversationWithMe && (
              <div className="text-center text-gray-400 p-2 text-xs border-t border-gray-700 mt-2">
                <p>Viewing bot-to-bot conversation</p>
              </div>
            )}
            {!playerConversation && !canInvite && !waitingForAccept && !waitingForNearby && !haveInvite && (
              <div className="text-center text-gray-400 p-4">
                <p>No active conversation</p>
              </div>
            )}
          </>
        )}
        
        {activeTab === 'activity' && (
          <ActivityLogs
            worldId={worldId}
            playerId={playerId as string}
            agentId={agent?.id}
            aiArenaBotId={agent?.aiArenaBotId}
          />
        )}
      </div>
    </>
  );
}
