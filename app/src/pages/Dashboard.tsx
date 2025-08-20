import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Progress } from '@ui/progress';
import { AnalyticsDashboard } from '@shared/components/analytics/analytics-dashboard';
import { 
  TrendingUp, 
  Target, 
  Zap, 
  Trophy, 
  Activity,
  Clock,
  DollarSign,
  ChevronRight,
  Loader2,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Lock
} from 'lucide-react';
import { GET_USER_STATS, GET_USER_BOTS } from '@/graphql/queries/user';
import { useToast } from '@shared/hooks/use-toast';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const address = publicKey?.toString();
  const { toast } = useToast();
  const defaultTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'performance'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Fetch user stats
  const { data: userStatsData, loading: userStatsLoading } = useQuery(GET_USER_STATS, {
    variables: { address: address || '' },
    skip: !address,
    pollInterval: 30000
  });

  // Fetch user bots
  const { data: userBotsData, loading: userBotsLoading } = useQuery(GET_USER_BOTS, {
    variables: { address: address || '' },
    skip: !address,
    pollInterval: 30000
  });

  const userStats = userStatsData?.userStats;
  const userBots = userBotsData?.bots || [];
  
  // Get top performing bots from user's own collection
  const topBots = [...userBots]
    .sort((a: any, b: any) => b.stats.winRate - a.stats.winRate)
    .slice(0, 5);

  const activeBots = userBots.filter((bot: any) => bot.isActive).length;
  
  // Mock XP and staking data (will be from GraphQL later)
  const xpBalance = 125000;
  const xpGenRate = 15000; // per hour
  const stakedIDLE = 100000;
  const stakingTier = 'SILVER';
  const daysUntilUnlock = 5;
  
  const totalGames = userBots.reduce((acc: number, bot: any) => acc + bot.stats.wins + bot.stats.losses, 0);
  const totalWins = userBots.reduce((acc: number, bot: any) => acc + bot.stats.wins, 0);
  const winRate = totalGames > 0 ? (totalWins / totalGames * 100).toFixed(1) : '0.0';
  const totalEarnings = userStats?.totalEarnings || '0';

  const formatEarnings = (earnings: string) => {
    const num = parseFloat(earnings);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(0);
  };

  const loading = userStatsLoading || userBotsLoading;

  if (!address) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-4">Please connect your wallet to view your dashboard</p>
          <Button onClick={() => navigate('/')} variant="default">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 pixel-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold pixel-title">Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Your AI Arena betting command center
              </p>
            </div>
            <Button 
              onClick={() => navigate('/tournaments')} 
              className="pixel-btn"
            >
              <Trophy className="mr-2 h-4 w-4" />
              View Tournaments
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Enhanced Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">XP Balance</CardTitle>
                  <Coins className="stat-icon h-5 w-5 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="stat-value text-3xl font-bold text-yellow-600 transition-transform">
                        {xpBalance.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        +{xpGenRate.toLocaleString()} XP/hr
                      </p>
                    </>
                  )}
                </CardContent>
              </div>

              <div className="stat-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Win Rate</CardTitle>
                  <Target className="stat-icon h-5 w-5 text-accent" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className={`stat-value text-3xl font-bold transition-transform ${
                        parseFloat(winRate) > 50 ? 'text-green-600' : 
                        parseFloat(winRate) < 50 && totalGames > 0 ? 'text-red-600' : 
                        'text-foreground'
                      }`}>
                        {winRate}%
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        {parseFloat(winRate) > 50 ? (
                          <>
                            <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                            <span className="text-green-600">Above average</span>
                          </>
                        ) : parseFloat(winRate) < 50 && totalGames > 0 ? (
                          <>
                            <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                            <span className="text-red-600">Below average</span>
                          </>
                        ) : (
                          <span>No games yet</span>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </div>

              <div className="stat-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Staked $IDLE</CardTitle>
                  <Lock className="stat-icon h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="stat-value text-3xl font-bold text-blue-600 transition-transform">
                        {stakedIDLE.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {stakingTier} tier • {daysUntilUnlock}d lock
                      </p>
                    </>
                  )}
                </CardContent>
              </div>

              <div className="stat-card hover-lift">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tournament Wins</CardTitle>
                  <Trophy className="stat-icon h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="stat-value text-3xl font-bold text-purple-600 transition-transform">
                        {totalWins}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                        <span>Today: 7 wins</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </div>
            </div>

            {/* Recent Betting Activity */}
            <div className="pixel-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold pixel-title">🎲 Recent Bets</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/tournaments')}
                  className="hover:bg-primary/10"
                >
                  View tournaments
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {/* Mock recent bets */}
                <div className="stat-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Lightning Poker</p>
                      <p className="text-xs text-muted-foreground">Bet on GPT-4 • 3.2x odds</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                        WON +32,000 XP
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="stat-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Prompt Racing</p>
                      <p className="text-xs text-muted-foreground">Bet on Claude • 2.1x odds</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-muted-foreground">
                        LOST -10,000 XP
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="stat-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Vibe Check</p>
                      <p className="text-xs text-muted-foreground">Bet on DeepSeek • 5.5x odds</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                        WON +55,000 XP
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Bots */}
            <div className="space-y-6">
              <div className="pixel-card p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold pixel-title">Your Bots</h2>
                  <p className="text-sm text-muted-foreground mt-1">AI agents that earn XP in the idle game</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
                    <Bot className="h-3 w-3 mr-1" />
                    {userBots.length} Bots
                  </Badge>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : userBots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userBots.slice(0, 6).map((bot: any) => {
                    const level = Math.floor((bot.experience?.currentExperience || 0) / 10000) || 1;
                    const personality = bot.personality || 'WORKER';
                    const personalityBonus = personality === 'CRIMINAL' ? '+20%' : 
                                            personality === 'GAMBLER' ? '+15%' : '+10%';
                    
                    return (
                      <Card key={bot.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">{bot.name}</h3>
                              <Badge variant="outline" className="mt-1">
                                {personality}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">Lv {level}</p>
                              <p className="text-xs text-muted-foreground">{personalityBonus} on underdogs</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">XP Earned</span>
                              <span className="font-semibold">{(bot.experience?.currentExperience || 0).toLocaleString()} XP</span>
                            </div>
                            <Progress value={level} className="h-2" />
                            {level === 100 && (
                              <Badge className="w-full justify-center bg-gradient-to-r from-yellow-500 to-orange-500">
                                Ready to burn for SOL!
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="pixel-card p-12 text-center">
                  <Bot className="h-20 w-20 text-muted-foreground/20 mx-auto mb-6 animate-pulse" />
                  <h3 className="text-2xl font-bold pixel-title mb-3">Deploy Your First Bot</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Deploy AI bots that earn XP automatically in the idle game!
                  </p>
                  <Button onClick={() => navigate('/deploy')} className="pixel-btn">
                    <Bot className="mr-2 h-4 w-4" />
                    Deploy Bot
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="pixel-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold pixel-title">Performance Analytics</h2>
                  <p className="text-sm text-muted-foreground mt-1">Deep dive into your bots' performance metrics</p>
                </div>
                <Badge className="bg-accent/10 text-accent border-accent/20">
                  <Activity className="h-3 w-3 mr-1" />
                  Live Data
                </Badge>
              </div>
            </div>
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}