import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { 
  TrendingUp, 
  Target, 
  Zap, 
  Trophy, 
  Activity,
  MessageSquare,
  Heart,
  BarChart3,
  Users,
  Clock,
  DollarSign,
  Award,
  ChevronRight,
  Loader2,
  Bot
} from 'lucide-react';
import { GET_USER_STATS, GET_USER_BOTS, GET_PLATFORM_STATS } from '@/graphql/queries/user';
import { GET_TOP_BOTS } from '@/graphql/queries/bot';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { address } = useAccount();
  const defaultTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'performance', 'community', 'activity'].includes(tab)) {
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

  // Fetch platform stats
  const { data: platformStatsData, loading: platformStatsLoading } = useQuery(GET_PLATFORM_STATS, {
    pollInterval: 60000
  });

  // Fetch top bots
  const { data: topBotsData, loading: topBotsLoading } = useQuery(GET_TOP_BOTS, {
    variables: { limit: 3 }
  });

  const userStats = userStatsData?.userStats;
  const userBots = userBotsData?.bots || [];
  const platformStats = platformStatsData?.platformStats;
  const topBots = topBotsData?.topBots || [];

  const activeBots = userBots.filter((bot: any) => bot.isActive).length;
  const queuedBots = userBots.filter((bot: any) => bot.queuePosition).length;
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

  const loading = userStatsLoading || userBotsLoading || platformStatsLoading || topBotsLoading;

  if (!address) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-4">Please connect your wallet to view your dashboard</p>
          <Button onClick={() => navigate('/')} className="btn-gaming">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Your AI Arena overview and bot performance
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Games</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{totalGames.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        Across {userBots.length} bots
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{winRate}%</div>
                      <Progress value={parseFloat(winRate)} className="mt-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {totalWins} wins
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{formatEarnings(totalEarnings)} HYPE</div>
                      <p className="text-xs text-muted-foreground">
                        Lifetime earnings
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{activeBots}</div>
                      <div className="flex space-x-1 mt-2">
                        <Badge variant="outline" className="text-xs">{activeBots - queuedBots} Idle</Badge>
                        <Badge variant="secondary" className="text-xs">{queuedBots} Queued</Badge>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions & Top Bots */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Quick Actions</span>
                    <Zap className="h-5 w-5 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-between" 
                    variant="outline"
                    onClick={() => navigate('/deploy')}
                  >
                    <span>Deploy New Bot</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button 
                    className="w-full justify-between" 
                    variant="outline"
                    onClick={() => navigate('/queue')}
                  >
                    <span>View Tournament Queue</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button 
                    className="w-full justify-between" 
                    variant="outline"
                    onClick={() => navigate('/bots')}
                  >
                    <span>Manage Your Bots</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Top Performing Bots</span>
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : topBots.length > 0 ? (
                    <div className="space-y-3">
                      {topBots.map((bot: any, index: number) => (
                        <div key={bot.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/bot/${bot.id}`)}>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                            <div>
                              <p className="font-medium">{bot.name}</p>
                              <p className="text-sm text-muted-foreground">{bot.stats.winRate.toFixed(1)}% win rate</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatEarnings(bot.stats.earnings)} HYPE</p>
                            <p className="text-sm text-success">
                              {bot.stats.wins} wins
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No bots deployed yet</p>
                      <Button onClick={() => navigate('/deploy')} className="mt-4">
                        Deploy Your First Bot
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Your Bots */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Your Bots</span>
                  <Bot className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : userBots.length > 0 ? (
                  <div className="space-y-3">
                    {userBots.slice(0, 5).map((bot: any) => (
                      <div key={bot.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer" onClick={() => navigate(`/bot/${bot.id}`)}>
                        <div className="flex items-center gap-3">
                          <img 
                            src={bot.avatar || '/default-bot-avatar.png'} 
                            alt={bot.name}
                            className="w-10 h-10 rounded-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/default-bot-avatar.png';
                            }}
                          />
                          <div>
                            <p className="font-medium">{bot.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {bot.stats.wins}W / {bot.stats.losses}L
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={bot.isActive ? "default" : "secondary"}>
                            {bot.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {bot.queuePosition && (
                            <Badge variant="outline">#{bot.queuePosition}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {userBots.length > 5 && (
                      <Button variant="outline" className="w-full" onClick={() => navigate('/bots')}>
                        View All {userBots.length} Bots
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground mb-4">You haven't deployed any bots yet</p>
                    <Button onClick={() => navigate('/deploy')} className="btn-gaming">
                      Deploy Your First Bot
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Community Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Players</span>
                      <span className="font-bold">{platformStats?.totalUsers.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Active Today</span>
                      <span className="font-bold">{platformStats?.activeUsers24h.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Bots</span>
                      <span className="font-bold">{platformStats?.totalBots.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Bots in Queue</span>
                      <span className="font-bold">{platformStats?.queuedBots.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Prize Pool</span>
                      <span className="font-bold">{formatEarnings(platformStats?.totalEarnings || '0')} HYPE</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Activity</span>
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4" />
                  <p>Activity feed coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}