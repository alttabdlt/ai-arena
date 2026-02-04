import { JOIN_GAME, LEAVE_GAME, UPDATE_GAME_SPEED, SIGNAL_FRONTEND_READY } from '@/graphql/mutations/game';
import { gql, useMutation, useSubscription, useQuery } from '@apollo/client';
import { IGameDecision as AIDecision, Card, PokerPhase as GamePhase, PokerPlayer as Player, PokerStyleBonus as StyleBonus } from '@game/shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@auth/contexts/AuthContext';

interface UsePokerGameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  phase: GamePhase;
  currentPlayer: Player | null;
  winners: any[];
  isHandComplete: boolean;
  currentAIThinking: string | null;
  currentAIReasoning: string | null;
  recentActions: any[];
  aiDecisionHistory: Map<string, AIDecision>;
  recentStyleBonuses: StyleBonus[];
  recentMisreads: any[];
  recentPointEvents: any[];
  recentAchievementEvents: any[];
  dealerPosition?: number | null;
  smallBlindPosition?: number | null;
  bigBlindPosition?: number | null;
}

const GAME_STATE_UPDATE = gql`
  subscription GameStateUpdate($gameId: String!) {
    gameStateUpdate(gameId: $gameId) {
      gameId
      type
      timestamp
      data
    }
  }
`;

const GAME_EVENT = gql`
  subscription GameEvent($gameId: String!) {
    gameEvent(gameId: $gameId) {
      gameId
      event
      playerId
      data
      timestamp
    }
  }
`;

interface UseServerSidePokerOptions {
  gameId: string;
  tournament?: any;
}

export function useServerSidePoker({ gameId, tournament }: UseServerSidePokerOptions) {
  const { isAuthenticated } = useAuth();
  const [signalFrontendReady] = useMutation(SIGNAL_FRONTEND_READY);
  const [joinGame] = useMutation(JOIN_GAME);
  const [leaveGame] = useMutation(LEAVE_GAME);
  const [updateGameSpeed] = useMutation(UPDATE_GAME_SPEED);
  const hasSignaledReady = useRef(false);
  const hasJoinedGame = useRef(false);
  const hasInitializedFromMatch = useRef(false);
  const isCatchingUp = useRef(false);
  const eventBuffer = useRef<any[]>([]);
  const isProcessingBuffer = useRef(false);
  const currentHandNumber = useRef(1);

  const [gameState, setGameState] = useState<UsePokerGameState>({
    players: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    phase: 'waiting' as GamePhase,
    currentPlayer: null,
    winners: [],
    isHandComplete: false,
    currentAIThinking: null,
    currentAIReasoning: null,
    recentActions: [],
    aiDecisionHistory: new Map(),
    recentStyleBonuses: [],
    recentMisreads: [],
    recentPointEvents: [],
    recentAchievementEvents: [],
    dealerPosition: null,
    smallBlindPosition: null,
    bigBlindPosition: null
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [currentGameState, setCurrentGameState] = useState<'setup' | 'playing' | 'paused' | 'finished'>('setup');
  const [config] = useState<any>({
    startingChips: 100000,
    blindStructure: 'normal',
    maxHands: 20,
    speed: 'normal',
    mode: 'balanced',
    showAIThinking: true,
    showDecisionHistory: true
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    if (gameId && !hasJoinedGame.current) {
      hasJoinedGame.current = true;
      joinGame({ variables: { gameId } }).catch(() => {});
      signalFrontendReady({ variables: { matchId: gameId } }).catch(() => {});
    }
    return () => {
      if (!isAuthenticated) return;
      if (gameId && hasJoinedGame.current) {
        leaveGame({ variables: { gameId } }).catch(() => {});
      }
    };
  }, [gameId, joinGame, leaveGame, signalFrontendReady, isAuthenticated]);

  const processEventBuffer = useCallback(() => {
    if (isProcessingBuffer.current || eventBuffer.current.length === 0) return;
    isProcessingBuffer.current = true;
    const events = [...eventBuffer.current];
    eventBuffer.current = [];
    const stateUpdates = events.filter(e => e.type === 'state');
    stateUpdates.forEach((e, idx) => updateGameStateFromBackend(e.data, idx !== stateUpdates.length - 1));
    const decisions = events.filter(e => e.type === 'decision');
    decisions.forEach(e => handlePlayerDecision(e.playerId, e.data, true));
    isProcessingBuffer.current = false;
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (eventBuffer.current.length > 0) processEventBuffer();
    }, 100);
    return () => clearTimeout(t);
  }, [processEventBuffer]);

  useSubscription(GAME_STATE_UPDATE, {
    variables: { gameId },
    skip: !gameId,
    onData: ({ data }) => {
      const payload = data.data?.gameStateUpdate;
      if (!payload?.data) return;
      try {
        const parsed = JSON.parse(payload.data);
        if (parsed?.state) {
          // Apply state immediately for real-time feel
          updateGameStateFromBackend(parsed.state);
          // Also buffer it in case batch processing is desired later
          eventBuffer.current.push({ type: 'state', data: parsed.state });
          if (!isInitialized) {
            setIsInitialized(true);
            setCurrentGameState('playing');
          }
        }
      } catch {}
    }
  });

  useSubscription(GAME_EVENT, {
    variables: { gameId },
    skip: !gameId,
    onData: ({ data }) => {
      const evt = data.data?.gameEvent;
      if (!evt) return;
      try {
        const parsed = evt.data ? JSON.parse(evt.data) : {};
        if (evt.event === 'player_decision') {
          // Server sends { playerId, decision, handNumber? }
          const decisionPayload = parsed?.decision ?? parsed;
          eventBuffer.current.push({ type: 'decision', playerId: evt.playerId, data: decisionPayload });
        } else if (parsed?.event === 'hand_complete') {
          setGameState(prev => ({
            ...prev,
            isHandComplete: true,
            winners: parsed.winners || [],
            recentActions: [...prev.recentActions, { t: Date.now(), text: `Hand ${parsed.handNumber || ''} complete` }].slice(-20)
          }));
        } else if (parsed?.event === 'hand_started') {
          // Reset per-hand UI state
          setGameState(prev => ({
            ...prev,
            isHandComplete: false,
            winners: [],
            aiDecisionHistory: new Map(),
            recentActions: [...prev.recentActions, { t: Date.now(), text: `Hand ${parsed.handNumber || ''} started` }].slice(-20)
          }));
        } else if (parsed?.event === 'thinking_start' && evt.playerId) {
          setGameState(prev => ({ ...prev, currentAIThinking: evt.playerId }));
        } else if (parsed?.event === 'thinking_complete') {
          setGameState(prev => ({ ...prev, currentAIThinking: null }));
        }
      } catch {}
    }
  });

  // Seed initial state so the table renders immediately while waiting for first subscription
  const GAME_BY_ID = gql`
    query GameById($gameId: String!) {
      gameById(gameId: $gameId) {
        id
        status
        gameState
      }
    }
  `;

  useQuery(GAME_BY_ID, {
    variables: { gameId },
    skip: !gameId || isInitialized,
    onCompleted: (data) => {
      const json = data?.gameById?.gameState;
      if (!json) return;
      try {
        const parsed = JSON.parse(json);
        if (parsed) {
          updateGameStateFromBackend(parsed, true);
          setIsInitialized(true);
          setCurrentGameState('playing');
        }
      } catch {}
    }
  });

  const updateGameStateFromBackend = useCallback((backendState: any, isCatchUp = false) => {
    const players: (Player & { avatar?: string; isAI?: boolean })[] = (backendState.players || []).map((p: any) => ({
      id: p.id,
      name: p.name || p.id,
      chips: p.chips || 0,
      cards: p.holeCards || p.cards || [],
      folded: !!p.folded,
      allIn: !!p.isAllIn,
      bet: p.bet || 0,
      position: p.position || 0,
      hasActed: !!p.hasActed,
      isActive: !p.folded && (p.chips > 0),
      avatar: '',
      isAI: true
    }));

    const currentPlayer = backendState.currentTurn ? players.find((p) => p.id === backendState.currentTurn) || null : null;
    if (backendState.gameSpecific?.handNumber && backendState.gameSpecific.handNumber !== currentHandNumber.current) {
      currentHandNumber.current = backendState.gameSpecific.handNumber;
    }

    const newCommunityCards = backendState.gameSpecific?.communityCards || [];
    const newPhase = (backendState.gameSpecific?.bettingRound || backendState.phase || 'waiting') as GamePhase;

    setGameState(prev => ({
      ...prev,
      players,
      communityCards: newCommunityCards,
      pot: backendState.gameSpecific?.pot ?? backendState.pot ?? 0,
      currentBet: backendState.gameSpecific?.currentBet ?? backendState.currentBet ?? 0,
      phase: newPhase,
      currentPlayer,
      isHandComplete: newPhase === 'handComplete' || newPhase === 'showdown',
      dealerPosition: backendState.dealerPosition ?? backendState.gameSpecific?.dealerPosition ?? null,
      smallBlindPosition: backendState.smallBlindPosition ?? backendState.gameSpecific?.smallBlindPosition ?? null,
      bigBlindPosition: backendState.bigBlindPosition ?? backendState.gameSpecific?.bigBlindPosition ?? null
    }));
  }, []);

  const handlePlayerDecision = useCallback((playerId: string, decision: any, _buffered = false) => {
    setGameState(prev => {
      const newMap = new Map(prev.aiDecisionHistory);
      newMap.set(playerId, decision);
      const type = typeof decision?.action === 'string' ? decision.action : decision?.action?.type;
      const amt = (() => {
        const a = decision?.action;
        if (!a) return undefined;
        if (typeof a?.amount === 'number') return a.amount;
        if (typeof a?.data?.amount === 'number') return a.data.amount;
        return undefined;
      })();
      const who = prev.players.find(p => p.id === playerId)?.name || playerId;
      const summary = type ? `${who}: ${type}${amt !== undefined ? ` ${amt}` : ''}` : `${who}: action`;
      const recentActions = [...prev.recentActions, { t: Date.now(), text: summary }].slice(-20);
      return { ...prev, aiDecisionHistory: newMap, currentAIThinking: null, recentActions };
    });
  }, []);

  const startNewHand = useCallback(() => {
    // No explicit mutation; the backend starts next hand automatically a moment after handComplete.
    // This function exists to satisfy UI button; we could send a nudge via updateGameSpeed as a noop.
    updateGameSpeed({ variables: { gameId, speed: 'normal' } }).catch(() => {});
  }, [gameId, updateGameSpeed]);

  return {
    gameState,
    isInitialized,
    isPaused: currentGameState === 'paused',
    gameSpeed: 'normal',
    config,
    currentGameState,
    startNewHand,
    pauseGame: () => updateGameSpeed({ variables: { gameId, speed: 'thinking' } }).catch(() => {}),
    resumeGame: () => updateGameSpeed({ variables: { gameId, speed: 'normal' } }).catch(() => {}),
    changeSpeed: (speed: string) => updateGameSpeed({ variables: { gameId, speed } }).catch(() => {}),
    getDecisionHistory: () => Array.from(gameState.aiDecisionHistory.values()),
    getCurrentHandDecisions: () => gameState.aiDecisionHistory,
    getCurrentHandNumber: () => currentHandNumber.current,
    updateConfig: () => {},
    stopGame: () => {},
    getPointLeaderboard: () => [],
    getPlayerPoints: () => null,
  };
}
