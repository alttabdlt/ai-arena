import { useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';
import GameHeader from './GameHeader.tsx';

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

  const handleBotSelect = (bot: any) => {
    setSelectedBot(bot);
    setSelectedBotId(bot.id);
    
    // Find the player with matching aiArenaBotId
    if (bot.metaverseAgentId && game) {
      const agent = [...game.world.agents.values()].find(a => a.id === bot.metaverseAgentId);
      if (agent) {
        setSelectedElement({ kind: 'player', id: agent.playerId });
      }
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
    </div>
  );
}
