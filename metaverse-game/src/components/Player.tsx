import React from 'react';
import { Character } from './Character.tsx';
import { orientationDegrees } from '../../convex/util/geometry.ts';
import { characters } from '../../data/characters.ts';
import { toast } from 'react-toastify';
import { Player as ServerPlayer } from '../../convex/aiTown/player.ts';
import { GameId } from '../../convex/aiTown/ids.ts';
import { Id } from '../../convex/_generated/dataModel';
import { Location, locationFields, playerLocation } from '../../convex/aiTown/location.ts';
import { useHistoricalValue } from '../hooks/useHistoricalValue.ts';
import { PlayerDescription } from '../../convex/aiTown/playerDescription.ts';
import { WorldMap } from '../../convex/aiTown/worldMap.ts';
import { ServerGame } from '../hooks/serverGame.ts';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export type SelectElement = (element?: { kind: 'player'; id: GameId<'players'> }) => void;

const logged = new Set<string>();

export const Player = ({
  game,
  isViewer,
  player,
  onClick,
  historicalTime,
  showXP = false,
  worldId,
}: {
  game: ServerGame;
  isViewer: boolean;
  player: ServerPlayer;
  worldId?: Id<'worlds'>;
  onClick: SelectElement;
  historicalTime?: number;
  showXP?: boolean;
}) => {
  const playerDescription = game.playerDescriptions.get(player.id);
  let playerCharacter = playerDescription?.character;
  
  // Fallback character for human players or missing character descriptions
  if (!playerCharacter) {
    // Only log once per player to avoid console spam
    if (!logged.has(player.id)) {
      logged.add(player.id);
      console.warn(`Player ${player.id} has no character - using fallback. Description exists: ${!!playerDescription}`);
    }
    // Use different defaults based on context
    // For AI Arena bots, try to determine from agent descriptions
    const agent = [...(game.world.agents.values() || [])].find(a => a.playerId === player.id);
    if (agent) {
      // Map personality to f1-f8 characters from 32x32folk.png
      const personalityDefaults: Record<string, string> = {
        'CRIMINAL': 'f1',  // Use f1-f4 for criminals
        'GAMBLER': 'f5',   // Use f5-f6 for gamblers
        'WORKER': 'f7'     // Use f7-f8 for workers
      };
      playerCharacter = personalityDefaults[agent.personality || ''] || 'f1';
      console.log(`Player ${player.id} fallback: personality=${agent.personality} -> character=${playerCharacter}`);
    } else {
      // Use f1 as default for human players, f8 for others
      playerCharacter = player.human ? 'f1' : 'f8';
    }
  }
  
  const character = characters.find((c) => c.name === playerCharacter);

  const locationBuffer = game.world.historicalLocations?.get(player.id);
  const historicalLocation = useHistoricalValue<Location>(
    locationFields,
    historicalTime,
    playerLocation(player),
    locationBuffer,
  );
  // Use fallback character if not found
  let characterToUse = character;
  if (!character) {
    if (!logged.has(playerCharacter)) {
      logged.add(playerCharacter);
      console.warn(`Unknown character ${playerCharacter}, using fallback f1`);
    }
    // Use f1 as fallback for unknown characters
    characterToUse = characters.find((c) => c.name === 'f1');
    if (!characterToUse) {
      console.error('Fallback character f1 not found!');
      return null;
    }
  }
  
  // TypeScript guard - characterToUse is definitely defined here
  if (!characterToUse) {
    return null;
  }

  if (!historicalLocation) {
    return null;
  }

  const isSpeaking = !![...game.world.conversations.values()].find(
    (c) => c.isTyping?.playerId === player.id,
  );
  const isThinking =
    !isSpeaking &&
    !![...game.world.agents.values()].find(
      (a) => a.playerId === player.id && !!a.inProgressOperation,
    );
  
  // Get agent and experience data for XP display
  const agent = [...game.world.agents.values()].find(a => a.playerId === player.id);
  const hasXPData = agent?.aiArenaBotId && showXP && worldId;
  
  // Force refresh experience data every 5 seconds for real-time updates
  const [, setRefreshTrigger] = React.useState(0);
  React.useEffect(() => {
    if (hasXPData) {
      const interval = setInterval(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [hasXPData]);
  
  // Query real experience data from the database
  // @ts-ignore - Known Convex type depth issue
  const experienceData = useQuery(api.aiTown.idleGains.getPlayerIdleStats,
    hasXPData ? { worldId: worldId!, playerId: player.id as string } : 'skip'
  );
  
  // Use real data from database, default to level 1 if no data exists
  const level = hasXPData ? (experienceData?.level || 1) : undefined;
  const currentXP = hasXPData ? (experienceData?.currentXP || 0) : undefined;
  const maxXP = hasXPData ? 100 * (level || 1) : undefined;
  
  const tileDim = game.worldMap.tileDim;
  const historicalFacing = { dx: historicalLocation.dx, dy: historicalLocation.dy };
  return (
    <>
      <Character
        x={historicalLocation.x * tileDim + tileDim / 2}
        y={historicalLocation.y * tileDim + tileDim / 2}
        orientation={orientationDegrees(historicalFacing)}
        isMoving={historicalLocation.speed > 0}
        isThinking={isThinking}
        isSpeaking={isSpeaking}
        emoji={
          player.activity && player.activity.until > (historicalTime ?? Date.now())
            ? player.activity?.emoji
            : undefined
        }
        isViewer={isViewer}
        textureUrl={characterToUse.textureUrl}
        spritesheetData={characterToUse.spritesheetData}
        speed={characterToUse.speed}
        level={level}
        currentXP={currentXP}
        maxXP={maxXP}
        showXP={!!hasXPData}
        onClick={() => {
          onClick({ kind: 'player', id: player.id });
        }}
      />
    </>
  );
};
