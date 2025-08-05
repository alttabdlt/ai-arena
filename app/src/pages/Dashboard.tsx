import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Progress } from '@ui/progress';
import { ScrollArea } from '@ui/scroll-area';
import { AnalyticsDashboard } from '@shared/components/analytics/analytics-dashboard';
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
import { GET_USER_STATS, GET_USER_BOTS } from '@/graphql/queries/user';
import { BotCard } from '@/components/bot/BotCard';
import { useMutation } from '@apollo/client';
import { ENTER_QUEUE } from '@/graphql/mutations/queue';
import { TOGGLE_BOT_ACTIVE, DELETE_BOT } from '@/graphql/mutations/bot';
import { useToast } from '@shared/hooks/use-toast';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { address } = useAccount();
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
    .slice(0, 3);

  const activeBots = userBots.filter((bot: any) => bot.isActive).length;
  const queuedBots = userBots.filter((bot: any) => bot.queuePosition).length;
  
  // Mutations
  const [enterQueue] = useMutation(ENTER_QUEUE, {
    refetchQueries: ['GetUserBots']
  });
  
  const [toggleBotActive] = useMutation(TOGGLE_BOT_ACTIVE, {
    refetchQueries: ['GetUserBots']
  });
  
  const [deleteBot] = useMutation(DELETE_BOT, {
    refetchQueries: ['GetUserBots']
  });
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
        {/* Header with Stats */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Manage your AI bots and track their performance
              </p>
            </div>
            <Button 
              onClick={() => navigate('/deploy')} 
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Bot className="mr-2 h-5 w-5" />
              Deploy New Bot
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Games</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold">{totalGames.toLocaleString()}</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Across {userBots.length} bots
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-green-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-green-600">{winRate}%</div>
                      <Progress value={parseFloat(winRate)} className="mt-2 h-2" />
                      <p className="text-sm text-muted-foreground mt-1">
                        {totalWins} wins
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-yellow-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-yellow-600">{formatEarnings(totalEarnings)}</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        HYPE earned
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-purple-600">{activeBots}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">{activeBots - queuedBots} Idle</Badge>
                        <Badge className="text-xs bg-purple-500/20 text-purple-700 hover:bg-purple-500/30">{queuedBots} Queued</Badge>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Performing Bots */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Your Top Performing Bots</span>
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
              
              {/* Quick Stats */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Quick Stats</span>
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-muted-foreground">Best Win Streak</span>
                      <span className="font-bold">0</span>
                    </div>
                    <Progress value={0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-muted-foreground">Tournament Rank</span>
                      <span className="font-bold">-</span>
                    </div>
                    <Progress value={0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-muted-foreground">Activity Score</span>
                      <span className="font-bold">0</span>
                    </div>
                    <Progress value={0} className="h-2" />
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={() => navigate('/queue')}
                  >
                    View Tournament Queue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Your Bots Grid */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Your Bot Collection</h2>
                  <p className="text-muted-foreground mt-1">Deploy and manage your AI competitors</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <Bot className="h-3 w-3 mr-1" />
                    {userBots.length} Total
                  </Badge>
                  <Badge variant="default">
                    <Activity className="h-3 w-3 mr-1" />
                    {activeBots} Active
                  </Badge>
                  {queuedBots > 0 && (
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      {queuedBots} Queued
                    </Badge>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : userBots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {userBots.map((bot: any) => (
                    <BotCard
                      key={bot.id}
                      bot={bot}
                      onQueue={async () => {
                        try {
                          await enterQueue({
                            variables: {
                              botId: bot.id,
                              queueType: 'STANDARD'
                            }
                          });
                          toast({
                            title: "Bot Queued!",
                            description: `${bot.name} has been added to the tournament queue.`,
                          });
                        } catch (error: any) {
                          toast({
                            title: "Queue Failed",
                            description: error.message || "Failed to queue bot",
                            variant: "destructive"
                          });
                        }
                      }}
                      onManage={async () => {
                        try {
                          await toggleBotActive({
                            variables: { botId: bot.id }
                          });
                          toast({
                            title: bot.isActive ? "Bot Deactivated" : "Bot Activated",
                            description: `${bot.name} has been ${bot.isActive ? 'deactivated' : 'activated'}.`,
                          });
                        } catch (error: any) {
                          toast({
                            title: "Toggle Failed",
                            description: error.message || "Failed to toggle bot status",
                            variant: "destructive"
                          });
                        }
                      }}
                      onDelete={async () => {
                        if (confirm(`Are you sure you want to delete ${bot.name}? This action cannot be undone.`)) {
                          try {
                            const result = await deleteBot({
                              variables: { botId: bot.id }
                            });
                            if (result.data?.deleteBot?.success) {
                              toast({
                                title: "Bot Deleted",
                                description: `${bot.name} has been successfully deleted${result.data.deleteBot.metaverseDeleted ? ' from both AI Arena and the metaverse' : ''}.`,
                              });
                            } else {
                              throw new Error(result.data?.deleteBot?.message || 'Failed to delete bot');
                            }
                          } catch (error: any) {
                            toast({
                              title: "Delete Failed",
                              description: error.message || "Failed to delete bot",
                              variant: "destructive"
                            });
                          }
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Bots Yet</h3>
                    <p className="text-muted-foreground mb-6">Deploy your first bot to start competing in tournaments</p>
                    <Button onClick={() => navigate('/deploy')} size="lg" className="btn-gaming">
                      <Bot className="mr-2 h-4 w-4" />
                      Deploy Your First Bot
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold">Performance Analytics</h2>
              <p className="text-muted-foreground mt-1">Deep dive into your bots' performance metrics</p>
            </div>
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}