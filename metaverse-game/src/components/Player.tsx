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
  const playerCharacter = game.playerDescriptions.get(player.id)?.character;
  if (!playerCharacter) {
    console.warn(`Player ${player.id} has no character description - skipping render`);
    return null;
  }
  const character = characters.find((c) => c.name === playerCharacter);

  const locationBuffer = game.world.historicalLocations?.get(player.id);
  const historicalLocation = useHistoricalValue<Location>(
    locationFields,
    historicalTime,
    playerLocation(player),
    locationBuffer,
  );
  if (!character) {
    if (!logged.has(playerCharacter)) {
      logged.add(playerCharacter);
      toast.error(`Unknown character ${playerCharacter}`);
    }
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
        textureUrl={character.textureUrl}
        spritesheetData={character.spritesheetData}
        speed={character.speed}
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
