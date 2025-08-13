import * as PIXI from 'pixi.js';
import { useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useEffect, useRef, useState } from 'react';
import { PixiStaticMap } from './PixiStaticMap.tsx';
import PixiViewport from './PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import { Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api.js';
import { useSendInput } from '../hooks/sendInput.ts';
import { toastOnError } from '../toasts.ts';
import { DebugPath } from './DebugPath.tsx';
import { PositionIndicator } from './PositionIndicator.tsx';
import { SHOW_DEBUG_UI } from './Game.tsx';
import { ServerGame } from '../hooks/serverGame.ts';

export const PixiGame = (props: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  historicalTime: number | undefined;
  width: number;
  height: number;
  setSelectedElement: SelectElement;
  ownedBots?: any[];
  setFocusOnPlayer?: (fn: (playerId: string) => void) => void;
}) => {
  // PIXI setup.
  const pixiApp = useApp();
  const viewportRef = useRef<Viewport | undefined>();

  // @ts-ignore - TypeScript depth issue
  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId: props.worldId }) ?? null;
  const humanPlayerId = [...props.game.world.players.values()].find(
    (p) => p.human === humanTokenIdentifier,
  )?.id;

  const moveTo = useSendInput(props.engineId, 'moveTo');

  // Interaction for clicking on the world to navigate.
  const dragStart = useRef<{ screenX: number; screenY: number } | null>(null);
  const onMapPointerDown = (e: any) => {
    // https://pixijs.download/dev/docs/PIXI.FederatedPointerEvent.html
    dragStart.current = { screenX: e.screenX, screenY: e.screenY };
  };

  const [lastDestination, setLastDestination] = useState<{
    x: number;
    y: number;
    t: number;
  } | null>(null);
  const onMapPointerUp = async (e: any) => {
    if (dragStart.current) {
      const { screenX, screenY } = dragStart.current;
      dragStart.current = null;
      const [dx, dy] = [screenX - e.screenX, screenY - e.screenY];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        console.log(`Skipping navigation on drag event (${dist}px)`);
        return;
      }
    }
    if (!humanPlayerId) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const gameSpacePx = viewport.toWorld(e.screenX, e.screenY);
    const tileDim = props.game.worldMap.tileDim;
    const gameSpaceTiles = {
      x: gameSpacePx.x / tileDim,
      y: gameSpacePx.y / tileDim,
    };
    setLastDestination({ t: Date.now(), ...gameSpaceTiles });
    const roundedTiles = {
      x: Math.floor(gameSpaceTiles.x),
      y: Math.floor(gameSpaceTiles.y),
    };
    console.log(`Moving to ${JSON.stringify(roundedTiles)}`);
    await toastOnError(moveTo({ playerId: humanPlayerId, destination: roundedTiles }));
  };
  const { width, height, tileDim } = props.game.worldMap;
  
  // Get all players, but filter to only show owned bots if provided
  const allPlayers = [...props.game.world.players.values()];
  
  // If ownedBots is provided (even if empty), use it to filter
  // This ensures we don't show bots the user doesn't own
  const players = props.ownedBots !== undefined
    ? allPlayers.filter(player => {
        // Check if this player corresponds to an owned bot
        const agent = [...props.game.world.agents.values()].find(a => a.playerId === player.id);
        if (!agent) return false;
        
        // Check if this agent's aiArenaBotId matches any of our owned bots
        return props.ownedBots?.some(bot => bot.id === agent.aiArenaBotId) || false;
      })
    : []; // If ownedBots is undefined, show no players (still loading)

  // Zoom on the user's avatar when it is created
  useEffect(() => {
    if (!viewportRef.current || humanPlayerId === undefined) return;

    const humanPlayer = props.game.world.players.get(humanPlayerId)!;
    viewportRef.current.animate({
      position: new PIXI.Point(humanPlayer.position.x * tileDim, humanPlayer.position.y * tileDim),
      scale: 1.5,
    });
  }, [humanPlayerId]);

  // Function to focus camera on a specific player
  const focusOnPlayer = (playerId: string) => {
    if (!viewportRef.current || !playerId || playerId === 'null') return;
    
    const player = props.game.world.players.get(playerId as any);
    if (!player) {
      if (playerId !== 'null' && playerId !== undefined) {
        console.log(`Player ${playerId} not found`);
      }
      return;
    }
    
    // Animate viewport to center on player
    viewportRef.current.animate({
      position: new PIXI.Point(player.position.x * tileDim, player.position.y * tileDim),
      scale: 1.5,
      time: 500, // 500ms animation
    });
  };

  // Expose focusOnPlayer to parent component
  useEffect(() => {
    if (props.setFocusOnPlayer) {
      props.setFocusOnPlayer(focusOnPlayer);
    }
  }, [props.game.world.players, tileDim]);

  return (
    <PixiViewport
      app={pixiApp}
      screenWidth={props.width}
      screenHeight={props.height}
      worldWidth={width * tileDim}
      worldHeight={height * tileDim}
      viewportRef={viewportRef}
    >
      <PixiStaticMap
        map={props.game.worldMap}
        onpointerup={onMapPointerUp}
        onpointerdown={onMapPointerDown}
      />
      {players.map(
        (p) =>
          // Only show the path for the human player in non-debug mode.
          (SHOW_DEBUG_UI || p.id === humanPlayerId) && (
            <DebugPath key={`path-${p.id}`} player={p} tileDim={tileDim} />
          ),
      )}
      {lastDestination && <PositionIndicator destination={lastDestination} tileDim={tileDim} />}
      {players.map((p) => {
        // Check if this player is a bot (has an agent with aiArenaBotId)
        const agent = [...props.game.world.agents.values()].find(a => a.playerId === p.id);
        const isBot = !!agent?.aiArenaBotId;
        
        return (
          <Player
            key={`player-${p.id}`}
            game={props.game}
            player={p}
            worldId={props.worldId}
            isViewer={p.id === humanPlayerId}
            onClick={props.setSelectedElement}
            historicalTime={props.historicalTime}
            showXP={isBot}
          />
        );
      })}
    </PixiViewport>
  );
};
export default PixiGame;
