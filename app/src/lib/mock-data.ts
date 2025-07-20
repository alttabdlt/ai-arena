import botTerminatorImg from '@/assets/bot-terminator.png';
import botZenMasterImg from '@/assets/bot-zen-master.png';
import botGamblerImg from '@/assets/bot-gambler.png';

export interface Bot {
  id: number;
  name: string;
  elo: number;
  winRate: number;
  modelProvider: string;
  avatar: string;
  style: string;
  developer: string;
  currentStrategy?: string;
  isLive?: boolean;
  totalEarnings: number;
}

export interface Match {
  id: number;
  botA: string;
  botB: string;
  botAAvatar: string;
  botBAvatar: string;
  status: 'LIVE' | 'UPCOMING' | 'COMPLETED';
  handsPlayed: number;
  totalHands: number;
  startTime: number;
  botAStrategy?: string;
  botBStrategy?: string;
}

export interface LiveStats {
  totalMatches: number;
  activeBots: number;
  liveViewers: number;
}

export const MOCK_BOTS: Bot[] = [
  {
    id: 1,
    name: "GPT-4o Terminator",
    elo: 2347,
    winRate: 67.3,
    modelProvider: "OpenAI",
    avatar: botTerminatorImg,
    style: "Hyper-Aggressive",
    developer: "0x1234...",
    currentStrategy: "Analyzing opponent bluff patterns...",
    isLive: true,
    totalEarnings: 125000
  },
  {
    id: 2,
    name: "GPT-4o Zen Master",
    elo: 2156,
    winRate: 72.1,
    modelProvider: "OpenAI",
    avatar: botZenMasterImg,
    style: "Patient & Strategic",
    developer: "0x5678...",
    currentStrategy: "Calculating optimal fold equity...",
    isLive: true,
    totalEarnings: 98500
  },
  {
    id: 3,
    name: "GPT-4o Gambler",
    elo: 1892,
    winRate: 58.9,
    modelProvider: "OpenAI",
    avatar: botGamblerImg,
    style: "Unpredictable Chaos",
    developer: "0x9abc...",
    currentStrategy: "All-in or nothing strategy engaged!",
    isLive: false,
    totalEarnings: 45200
  }
];

export const MOCK_MATCHES: Match[] = [
  {
    id: 1,
    botA: "GPT-4o Terminator",
    botB: "GPT-4o Zen Master",
    botAAvatar: botTerminatorImg,
    botBAvatar: botZenMasterImg,
    status: "LIVE",
    handsPlayed: 45,
    totalHands: 100,
    startTime: Date.now() - 1000 * 60 * 15,
    botAStrategy: "Aggressive betting on strong hands",
    botBStrategy: "Waiting for premium opportunities"
  },
  {
    id: 2,
    botA: "GPT-4o Gambler",
    botB: "GPT-4o Terminator",
    botAAvatar: botGamblerImg,
    botBAvatar: botTerminatorImg,
    status: "UPCOMING",
    handsPlayed: 0,
    totalHands: 100,
    startTime: Date.now() + 1000 * 60 * 30,
    botAStrategy: "Random chaos mode activated",
    botBStrategy: "Exploit opponent's unpredictability"
  }
];

export const MOCK_LIVE_STATS: LiveStats = {
  totalMatches: 1247,
  activeBots: 156,
  liveViewers: 8432
};

// Mock API with realistic delays
export const mockApi = {
  async getBots(): Promise<Bot[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return MOCK_BOTS;
  },
  
  async getMatches(): Promise<Match[]> {
    await new Promise(resolve => setTimeout(resolve, 400));
    return MOCK_MATCHES;
  },
  
  async getLiveStats(): Promise<LiveStats> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return MOCK_LIVE_STATS;
  },
  
  // Mock WebSocket for live updates
  subscribeToMatch(matchId: number, callback: (data: any) => void) {
    const interval = setInterval(() => {
      const strategies = [
        "Calculating pot odds...",
        "Detected bluff pattern in opponent",
        "Adjusting aggression level",
        "Analyzing betting history",
        "Optimal fold detected",
        "Strong hand - increasing bet size",
        "Reading opponent micro-expressions",
        "Neural network processing...",
        "Risk assessment complete"
      ];
      
      callback({
        type: 'strategy_update',
        botId: Math.random() > 0.5 ? 1 : 2,
        strategy: strategies[Math.floor(Math.random() * strategies.length)],
        timestamp: Date.now()
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }
};