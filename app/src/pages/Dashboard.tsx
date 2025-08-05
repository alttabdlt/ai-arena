import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useAccount } from 'wagmi';
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
  ArrowDownRight
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
    .slice(0, 5);

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
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Manage your AI bots and track their performance
              </p>
            </div>
            <Button onClick={() => navigate('/deploy')} size="sm">
              <Bot className="mr-2 h-4 w-4" />
              Deploy New Bot
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Games</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-semibold">{totalGames.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {userBots.length} bots deployed
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-semibold">{winRate}%</div>
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
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-semibold">{formatEarnings(totalEarnings)} HYPE</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Lifetime earnings
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Bots</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-semibold">{activeBots}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{queuedBots} in queue</span>
                        {queuedBots > 0 && <div className="w-1 h-1 rounded-full bg-yellow-500 animate-pulse" />}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Performing Bots */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">Top Performing Bots</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/bots')}>
                    View all
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : topBots.length > 0 ? (
                  <div className="space-y-2">
                    {topBots.map((bot: any, index: number) => (
                      <div 
                        key={bot.id} 
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" 
                        onClick={() => navigate(`/bot/${bot.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-medium text-muted-foreground w-6">#{index + 1}</div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{bot.name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{bot.stats.winRate.toFixed(1)}% win rate</span>
                              <span>•</span>
                              <span>{bot.stats.wins} wins</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatEarnings(bot.stats.earnings)} HYPE</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No bots deployed yet</p>
                    <Button onClick={() => navigate('/deploy')} variant="outline" size="sm" className="mt-4">
                      Deploy Your First Bot
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Your Bots Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">Your Bot Collection</h2>
                  <p className="text-sm text-muted-foreground">Deploy and manage your AI competitors</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">
                    {userBots.length} Total
                  </Badge>
                  {activeBots > 0 && (
                    <Badge variant="secondary">
                      {activeBots} Active
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
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium mb-2">No Bots Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">Deploy your first bot to start competing in tournaments</p>
                    <Button onClick={() => navigate('/deploy')} size="sm">
                      Deploy Your First Bot
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div>
              <h2 className="text-lg font-medium mb-1">Performance Analytics</h2>
              <p className="text-sm text-muted-foreground">Deep dive into your bots' performance metrics</p>
            </div>
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}