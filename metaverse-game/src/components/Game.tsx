import React, { useRef, useState, useEffect } from 'react';
import PixiGame from './PixiGame.tsx';
import GameHeader from './GameHeader.tsx';
import InventoryModal from './InventoryModal.tsx';
import IdleGainsNotification from './IdleGainsNotification.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from './PlayerDetails.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';
import { useUserBots } from '../hooks/useUserBots.ts';
import { useUserChannels } from '../hooks/useUserChannels.ts';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

export default function Game() {
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [selectedBotId, setSelectedBotId] = useState<string>();
  const [selectedBot, setSelectedBot] = useState<any>();
  const [showInventory, setShowInventory] = useState(false);
  const [selectedChannelName, setSelectedChannelName] = useState<string>('main');
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [showIdleGains, setShowIdleGains] = useState(false);
  const [idleGains, setIdleGains] = useState<any>(null);
  const [hasShownNotification, setHasShownNotification] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(Date.now());
  const [gameWrapperRef, { width, height }] = useElementSize();
  
  // Fetch user's bots from AI Arena backend
  const { bots: userBots, loading: botsLoading, error: botsError } = useUserBots();
  
  // Fetch user's channels from AI Arena backend
  const { channels, loading: channelsLoading, error: channelsError } = useUserChannels();
  
  // Update selected world ID when channel changes
  useEffect(() => {
    const selectedChannel = channels.find(c => c.name === selectedChannelName);
    if (selectedChannel?.worldId) {
      setSelectedWorldId(selectedChannel.worldId);
      console.log(`🌍 Switched to world: ${selectedChannel.worldId} (Channel: ${selectedChannelName})`);
    } else {
      // Fall back to default world if channel has no world
      setSelectedWorldId(null);
    }
  }, [selectedChannelName, channels]);
  
  
  // Reset notification flag when switching bots
  useEffect(() => {
    setHasShownNotification(false);
  }, [selectedBotId]);

  // Update timestamp every 15 seconds for stat refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, []);

  // Get world status - use selected world or fall back to default
  // @ts-ignore - TypeScript type depth issue with generated Convex API
  const defaultWorldStatus = useQuery(api.world.defaultWorldStatus);
  
  // Use selected world ID if available, otherwise use default
  const worldId = selectedWorldId || defaultWorldStatus?.worldId;
  const engineId = defaultWorldStatus?.engineId; // Engine is the same for all worlds
  
  // Get world state early so it's available for allAgents
  const worldState = useQuery(api.world.worldState, worldId ? { worldId: worldId as any } : 'skip');

  const game = useServerGame(worldId as any);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);
  
  // Get all agents in the world (must be after worldState)
  const allAgents = worldState?.world?.agents || [];
  
  // Calculate and show idle gains notification
  const selectedPlayerId = selectedElement?.id || (allAgents && allAgents[0]?.playerId);
  const idleGainsData = useQuery(
    api.aiTown.idleGains.calculateIdleGains,
    worldId && selectedPlayerId ? {
      worldId: worldId as any,
      playerId: selectedPlayerId,
      currentTime: currentTimestamp
    } : 'skip'
  );
  
  // Show idle gains notification when data is available
  useEffect(() => {
    if (idleGainsData && !hasShownNotification && selectedBot) {
      setIdleGains(idleGainsData);
      setShowIdleGains(true);
      setHasShownNotification(true);
      
      // Auto-hide after user closes or timeout
      setTimeout(() => {
        setShowIdleGains(false);
      }, 30000); // Hide after 30 seconds
    }
  }, [idleGainsData, hasShownNotification, selectedBot]);

  // Get current player ID for inventory
  // If no player is selected, try to use the first agent with an aiArenaBotId
  const currentPlayerId = selectedElement?.id || '';
  
  // Find agent with this player ID to get aiArenaBotId
  const currentAgent = currentPlayerId 
    ? allAgents.find(agent => agent.playerId === currentPlayerId)
    : allAgents.find(agent => agent.aiArenaBotId); // Default to first bot with aiArenaBotId
    
  const aiArenaBotId = currentAgent?.aiArenaBotId || '';
  const effectivePlayerId = currentPlayerId || currentAgent?.playerId || '';

  // Query inventory for item count
  const inventory = useQuery(api.aiTown.inventory.getPlayerInventory,
    worldId && effectivePlayerId ? { worldId: worldId as any, playerId: effectivePlayerId } : 'skip'
  );
  const itemCount = inventory?.items?.length || 0;

  // Transform and merge bot data from GraphQL and Convex agents
  const transformedBots = React.useMemo(() => {
    if (!worldState?.world?.agents || !game) return [];
    
    // Debug logging
    console.log('Transforming bots:', {
      agentsCount: allAgents.length,
      userBotsCount: userBots.length,
      botsLoading,
      botsError,
    });
    
    // If still loading bots from GraphQL, don't show any bots yet
    if (botsLoading) {
      console.log('Still loading bots from GraphQL...');
      return [];
    }
    
    // If there was an error loading bots, don't show any bots
    if (botsError) {
      console.error('Error loading bots from GraphQL:', botsError);
      return [];
    }
    
    // Create a map of aiArenaBotId to agent for quick lookup
    const agentsByBotId = new Map();
    allAgents.forEach(agent => {
      if (agent.aiArenaBotId) {
        agentsByBotId.set(agent.aiArenaBotId, agent);
      }
    });
    
    // Only show bots that the user owns (from GraphQL)
    if (userBots.length > 0) {
      return userBots.map(bot => {
        // Find the corresponding agent in the metaverse
        const agent = agentsByBotId.get(bot.id);
        
        return {
          id: bot.id,
          name: bot.name,
          tokenId: bot.tokenId,
          personality: bot.personality,
          stats: bot.stats || { wins: 0, losses: 0 },
          isActive: bot.isActive && (!agent?.knockedOutUntil || Date.now() > agent.knockedOutUntil),
          metaverseAgentId: agent?.id || bot.metaverseAgentId,
          playerId: agent?.playerId,
          aiArenaBotId: bot.id,
          inMetaverse: !!agent, // Indicator if bot is actually in the metaverse
        };
      });
    }
    
    // No fallback - only show bots the user owns
    return [];
  }, [allAgents, game, userBots, botsLoading, botsError, worldState]);

  const handleBotSelect = (bot: any) => {
    setSelectedBot(bot);
    setSelectedBotId(bot.id);
    
    // Set the selected element to the bot's player
    if (bot.playerId) {
      setSelectedElement({ kind: 'player', id: bot.playerId });
    }
  };

  if (!worldId || !engineId || !game) {
    return null;
  }
  return (
    <div className="flex flex-col h-full w-full">
      {/* Idle Gains Notification */}
      {showIdleGains && idleGains && selectedBot && (
        <IdleGainsNotification
          gains={idleGains}
          botName={selectedBot.name}
          onClose={() => setShowIdleGains(false)}
          onViewDetails={() => {
            // Switch to activity tab in PlayerDetails
            if (selectedElement) {
              // This would require adding a prop to PlayerDetails to control the tab
              // For now, just close the notification
              setShowIdleGains(false);
            }
          }}
        />
      )}
      
      {/* Game Header */}
      <GameHeader 
        selectedBotId={selectedBotId}
        onBotSelect={handleBotSelect}
        bots={transformedBots}
        channels={channels}
        selectedChannelName={selectedChannelName}
        onChannelSelect={(channel) => {
          setSelectedChannelName(channel.name);
          // Clear selected bot when switching worlds
          setSelectedBotId(undefined);
          setSelectedBot(undefined);
          setSelectedElement(undefined);
        }}
        channelsLoading={channelsLoading}
      />
      
      {/* Game Content */}
      <div className="flex-1 relative p-4 min-h-0">
        {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
        <div className="h-full grid grid-cols-[1fr_400px] gap-4">
          {/* Game area */}
          <div className="relative overflow-hidden bg-gray-800 rounded-lg border border-gray-700" ref={gameWrapperRef}>
            <Stage width={width} height={height} options={{ backgroundColor: 0x1a1a1a }}>
              {/* Re-propagate context because contexts are not shared between renderers.
              https://github.com/michalochman/react-pixi-fiber/issues/145#issuecomment-531549215 */}
              <ConvexProvider client={convex}>
                <PixiGame
                  game={game}
                  worldId={worldId as any}
                  engineId={engineId}
                  width={width}
                  height={height}
                  historicalTime={historicalTime}
                  setSelectedElement={setSelectedElement}
                  ownedBots={transformedBots}
                />
              </ConvexProvider>
            </Stage>
          </div>
        {/* Chat panel */}
        <div
          className="flex flex-col h-full overflow-y-auto bg-gray-900 text-gray-100 rounded-lg border border-gray-700 p-4"
          ref={scrollViewRef}
        >
          <PlayerDetails
            worldId={worldId as any}
            engineId={engineId}
            game={game}
            playerId={selectedElement?.id}
            setSelectedElement={setSelectedElement}
            scrollViewRef={scrollViewRef}
          />
        </div>
        </div>
      </div>

      {/* Inventory Modal */}
      {worldId && effectivePlayerId ? (
        <InventoryModal
          isOpen={showInventory}
          onClose={() => setShowInventory(false)}
          worldId={worldId as any}
          playerId={effectivePlayerId}
          aiArenaBotId={aiArenaBotId}
        />
      ) : (
        showInventory && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-900 border border-red-900/50 rounded-lg p-8 max-w-md">
              <h2 className="text-xl font-bold text-red-400 mb-4">No Bot Selected</h2>
              <p className="text-gray-300 mb-4">
                {!worldId ? 'World is not loaded yet.' : 
                 !effectivePlayerId ? 'Please select a bot in the game or ensure you have registered bots.' :
                 'Loading...'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Debug: worldId={worldId ? 'exists' : 'null'}, 
                agents={allAgents.length}, 
                selectedId={currentPlayerId || 'none'}
              </p>
              <button
                onClick={() => setShowInventory(false)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
