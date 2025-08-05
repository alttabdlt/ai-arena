import React, { useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';
import GameHeader from './GameHeader.tsx';
import InventoryModal from './InventoryModal.tsx';

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
  const [gameWrapperRef, { width, height }] = useElementSize();

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  // Get current player ID for inventory
  // If no player is selected, try to use the first agent with an aiArenaBotId
  const currentPlayerId = selectedElement?.id || '';
  
  // Get all agents in the world
  const allAgents = worldState?.world?.agents || [];
  
  // Find agent with this player ID to get aiArenaBotId
  const currentAgent = currentPlayerId 
    ? allAgents.find(agent => agent.playerId === currentPlayerId)
    : allAgents.find(agent => agent.aiArenaBotId); // Default to first bot with aiArenaBotId
    
  const aiArenaBotId = currentAgent?.aiArenaBotId || '';
  const effectivePlayerId = currentPlayerId || currentAgent?.playerId || '';

  // Query inventory for item count
  const inventory = useQuery(api.aiTown.inventory.getPlayerInventory,
    worldId && effectivePlayerId ? { worldId, playerId: effectivePlayerId } : 'skip'
  );
  const itemCount = inventory?.items?.length || 0;

  // Transform agents to bot data for the selector
  const transformedBots = React.useMemo(() => {
    if (!worldState?.world?.agents || !game) return [];
    
    // Debug logging
    console.log('Transforming bots:', {
      agentsCount: allAgents.length,
      hasPlayerDescriptions: !!game.playerDescriptions,
      playerDescSize: game.playerDescriptions?.size,
    });
    
    // For now, show all agents (not just ones with aiArenaBotId) so users can see them
    return allAgents
      .map((agent, index) => {
        // Find the player description for this agent
        const playerDesc = game.playerDescriptions?.get(agent.playerId);
        
        return {
          id: agent.id,
          name: playerDesc?.name || `Agent ${index + 1}`,
          tokenId: 1000 + index, // Generate a token ID
          personality: agent.personality,
          stats: {
            wins: 0, // TODO: Get from AI Arena backend
            losses: 0,
          },
          isActive: !agent.knockedOutUntil || Date.now() > agent.knockedOutUntil,
          metaverseAgentId: agent.id,
          playerId: agent.playerId,
          aiArenaBotId: agent.aiArenaBotId,
        };
      });
  }, [allAgents, game]);

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
      {/* Game Header */}
      <GameHeader 
        selectedBotId={selectedBotId}
        onBotSelect={handleBotSelect}
        onInventoryClick={() => setShowInventory(true)}
        itemCount={itemCount}
        bots={transformedBots}
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
                  worldId={worldId}
                  engineId={engineId}
                  width={width}
                  height={height}
                  historicalTime={historicalTime}
                  setSelectedElement={setSelectedElement}
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
            worldId={worldId}
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
          worldId={worldId}
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
