import { JOIN_GAME, LEAVE_GAME, UPDATE_GAME_SPEED, SIGNAL_FRONTEND_READY } from '@/graphql/mutations/game';
import { gql, useMutation, useSubscription, useQuery } from '@apollo/client';
import { IGameDecision as AIDecision, Card, PokerPhase as GamePhase, PokerPlayer as Player, PokerStyleBonus as StyleBonus } from '@game/shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@auth/contexts/AuthContext';

type BackendRecord = Record<string, unknown>;
type DecisionShape = {
  action?: string | { type?: string; amount?: number; data?: { amount?: number } };
};

function toRecord(value: unknown): BackendRecord {
  return value && typeof value === 'object' ? (value as BackendRecord) : {};
}

interface UsePokerGameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  phase: GamePhase;
  currentPlayer: Player | null;
  winners: unknown[];
  isHandComplete: boolean;
  currentAIThinking: string | null;
  currentAIReasoning: string | null;
  recentActions: Array<{ t: number; text: string }>;
  aiDecisionHistory: Map<string, AIDecision>;
  recentStyleBonuses: StyleBonus[];
  recentMisreads: unknown[];
  recentPointEvents: unknown[];
  recentAchievementEvents: unknown[];
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
  tournament?: unknown;
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
  const [config] = useState({
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
          if (!isInitialized) {
            setIsInitialized(true);
            setCurrentGameState('playing');
          }
        }
      } catch {
        // ignore malformed state payloads
      }
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
          if (evt.playerId) {
            handlePlayerDecision(evt.playerId, decisionPayload, true);
          }
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
      } catch {
        // ignore malformed event payloads
      }
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
      } catch {
        // ignore malformed initial game state
      }
    }
  });

  const updateGameStateFromBackend = useCallback((backendStateRaw: unknown, _isCatchUp = false) => {
    const backendState = toRecord(backendStateRaw);
    const gameSpecific = toRecord(backendState.gameSpecific);
    const rawPlayers = Array.isArray(backendState.players) ? backendState.players : [];
    const players: (Player & { avatar?: string; isAI?: boolean })[] = rawPlayers.map((rawPlayer) => {
      const p = toRecord(rawPlayer);
      const holeCards = Array.isArray(p.holeCards) ? p.holeCards : [];
      const cards = Array.isArray(p.cards) ? p.cards : [];
      const normalizedCards = (holeCards.length > 0 ? holeCards : cards).map((card) => String(card)) as Card[];
      const chips = typeof p.chips === 'number' ? p.chips : 0;
      const folded = Boolean(p.folded);
      const id = String(p.id ?? '');
      return {
        id,
        name: String(p.name ?? id),
        chips,
        cards: normalizedCards,
        folded,
        allIn: Boolean(p.isAllIn),
        bet: typeof p.bet === 'number' ? p.bet : 0,
        position: typeof p.position === 'number' ? p.position : 0,
        hasActed: Boolean(p.hasActed),
        isActive: !folded && chips > 0,
        avatar: '',
        isAI: true,
      };
    });

    const currentTurn = typeof backendState.currentTurn === 'string' ? backendState.currentTurn : null;
    const currentPlayer = currentTurn ? players.find((p) => p.id === currentTurn) || null : null;
    const handNumber = typeof gameSpecific.handNumber === 'number' ? gameSpecific.handNumber : null;
    if (handNumber && handNumber !== currentHandNumber.current) {
      currentHandNumber.current = handNumber;
    }

    const newCommunityCards = (Array.isArray(gameSpecific.communityCards) ? gameSpecific.communityCards : []).map((c) => String(c)) as Card[];
    const bettingRound = typeof gameSpecific.bettingRound === 'string' ? gameSpecific.bettingRound : null;
    const phase = typeof backendState.phase === 'string' ? backendState.phase : null;
    const newPhase = (bettingRound || phase || 'waiting') as GamePhase;

    setGameState(prev => ({
      ...prev,
      players,
      communityCards: newCommunityCards,
      pot: typeof gameSpecific.pot === 'number'
        ? gameSpecific.pot
        : typeof backendState.pot === 'number'
          ? backendState.pot
          : 0,
      currentBet: typeof gameSpecific.currentBet === 'number'
        ? gameSpecific.currentBet
        : typeof backendState.currentBet === 'number'
          ? backendState.currentBet
          : 0,
      phase: newPhase,
      currentPlayer,
      isHandComplete: Boolean(gameSpecific.isHandComplete) || newPhase === 'showdown',
      dealerPosition: typeof backendState.dealerPosition === 'number'
        ? backendState.dealerPosition
        : typeof gameSpecific.dealerPosition === 'number'
          ? gameSpecific.dealerPosition
          : null,
      smallBlindPosition: typeof backendState.smallBlindPosition === 'number'
        ? backendState.smallBlindPosition
        : typeof gameSpecific.smallBlindPosition === 'number'
          ? gameSpecific.smallBlindPosition
          : null,
      bigBlindPosition: typeof backendState.bigBlindPosition === 'number'
        ? backendState.bigBlindPosition
        : typeof gameSpecific.bigBlindPosition === 'number'
          ? gameSpecific.bigBlindPosition
          : null
    }));
  }, []);

  const handlePlayerDecision = useCallback((playerId: string, decisionRaw: unknown, _buffered = false) => {
    const decision = toRecord(decisionRaw) as DecisionShape;
    setGameState(prev => {
      const newMap = new Map(prev.aiDecisionHistory);
      newMap.set(playerId, decision as unknown as AIDecision);
      const type = typeof decision?.action === 'string' ? decision.action : decision?.action?.type;
      const amt = (() => {
        const a = decision.action;
        if (!a) return undefined;
        if (typeof a === 'object' && typeof a.amount === 'number') return a.amount;
        if (typeof a === 'object' && a.data && typeof a.data.amount === 'number') return a.data.amount;
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
