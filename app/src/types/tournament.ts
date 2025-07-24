export type GameType = 'poker' | 'reverse-hangman' | 'chess' | 'go';
export type TournamentStatus = 'waiting' | 'in-progress' | 'completed' | 'cancelled';
export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'eliminated';

export interface TournamentPlayer {
  id: string;
  name: string;
  botId?: string;
  aiModel: string;
  strategy?: string;
  status: PlayerStatus;
  isReady: boolean;
  joinedAt: Date;
  avatar?: string;
}

export interface GameConfig {
  // Poker config
  startingChips?: number;
  blindStructure?: string;
  maxHands?: number;
  speed?: 'thinking' | 'normal' | 'fast';
  
  // Reverse Hangman config
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert' | 'random';
  maxRounds?: number;
  timeLimit?: number;
  
  // Common config
  entryFee?: number;
  prizePool?: number;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  gameType: GameType;
  status: TournamentStatus;
  config: GameConfig;
  players: TournamentPlayer[];
  maxPlayers: number;
  minPlayers: number;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  winner?: TournamentPlayer;
}

export interface CreateTournamentData {
  name: string;
  description?: string;
  gameType: GameType;
  config: GameConfig;
  maxPlayers: number;
  minPlayers: number;
  isPublic: boolean;
}

export interface DemoBot {
  name: string;
  model: string;
  strategy: string;
  avatar?: string;
}

export const DEMO_BOTS: DemoBot[] = [
  { 
    name: "PokerPro", 
    model: "deepseek-chat", 
    strategy: "Aggressive poker specialist with deep understanding of pot odds",
    avatar: "/avatars/pokerpro.png"
  },
  { 
    name: "BluffMaster", 
    model: "deepseek-chat", 
    strategy: "Masters the art of deception and psychological warfare",
    avatar: "/avatars/bluffmaster.png"
  },
  { 
    name: "Calculator", 
    model: "deepseek-chat", 
    strategy: "Pure mathematical approach to every decision",
    avatar: "/avatars/calculator.png"
  },
  { 
    name: "Intuition", 
    model: "claude-3-opus", 
    strategy: "Reads opponents and situations with uncanny accuracy",
    avatar: "/avatars/intuition.png"
  },
  { 
    name: "Rookie", 
    model: "gpt-4o", 
    strategy: "Still learning but shows flashes of brilliance",
    avatar: "/avatars/rookie.png"
  },
  { 
    name: "Veteran", 
    model: "claude-3-5-sonnet", 
    strategy: "Decades of experience in high-stakes games",
    avatar: "/avatars/veteran.png"
  },
  { 
    name: "WildCard", 
    model: "deepseek-chat", 
    strategy: "Completely unpredictable chaos agent",
    avatar: "/avatars/wildcard.png"
  },
  { 
    name: "ZenMaster", 
    model: "claude-3-opus", 
    strategy: "Calm, collected, and impossibly patient",
    avatar: "/avatars/zenmaster.png"
  }
];

export const GAME_TYPE_INFO: Record<GameType, {
  name: string;
  description: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  defaultConfig: GameConfig;
  disabled?: boolean;
}> = {
  'poker': {
    name: 'Texas Hold\'em Poker',
    description: 'Classic poker with big blinds, bluffs, and all-ins',
    icon: '🃏',
    minPlayers: 2,
    maxPlayers: 8,
    defaultConfig: {
      startingChips: 10000,
      blindStructure: 'standard',
      maxHands: 100,
      speed: 'normal' as const
    }
  },
  'reverse-hangman': {
    name: 'Reverse Engineering',
    description: 'Guess the prompt that created the AI output',
    icon: '🔍',
    minPlayers: 1,
    maxPlayers: 8,
    defaultConfig: {
      maxRounds: 5,
      timeLimit: 120
    }
  },
  'chess': {
    name: 'Chess',
    description: 'The classic game of strategy (Coming Soon)',
    icon: '♟️',
    minPlayers: 2,
    maxPlayers: 2,
    defaultConfig: {},
    disabled: true
  },
  'go': {
    name: 'Go',
    description: 'Ancient board game of territory (Coming Soon)',
    icon: '⚫',
    minPlayers: 2,
    maxPlayers: 2,
    defaultConfig: {},
    disabled: true
  }
};