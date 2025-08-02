import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { Button } from '@ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { Progress } from '@ui/progress';
import { Alert, AlertDescription } from '@ui/alert';
import { useAuth } from '@auth/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  BarChart3, 
  Activity,
  DollarSign,
  Users,
  Calendar,
  Info,
  Bot,
  Power,
  PowerOff,
  Trophy,
  Hash,
  Clock,
  Loader2,
  Play,
  Brain,
  Heart,
  MessageCircle,
  Share2
} from 'lucide-react';
import { GET_BOT_DETAIL, GET_BOT_MATCHES } from '@/graphql/queries/bot';
import { TOGGLE_BOT_ACTIVE, ENTER_QUEUE } from '@/graphql/mutations/bot';
import { format, formatDistanceToNow } from 'date-fns';
import { LiveMatchCard } from '@bot/components/LiveMatchCard';
import { PerformanceByGame } from '@bot/components/PerformanceByGame';
import { BotAchievements } from '@bot/components/BotAchievements';
import { MatchHistoryEnhanced } from '@bot/components/MatchHistoryEnhanced';

interface BotStats {
  wins: number;
  losses: number;
  earnings: string;
  winRate: number;
  avgFinishPosition: number;
}

interface Match {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  participants: Array<{
    bot: {
      id: string;
      name: string;
      avatar: string;
    };
    finalRank?: number;
    points: number;
  }>;
  result?: {
    winner?: {
      id: string;
      name: string;
    };
    duration?: number;
    totalHands?: number;
  };
}

export default function BotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('performance');

  // Queries
  const { data: botData, loading: botLoading, refetch: refetchBot } = useQuery(GET_BOT_DETAIL, {
    variables: { id },
    skip: !id,
  });

  const { data: matchesData, loading: matchesLoading } = useQuery(GET_BOT_MATCHES, {
    variables: { botId: id, limit: 20 },
    skip: !id,
  });

  // Mutations
  const [toggleBotActive] = useMutation(TOGGLE_BOT_ACTIVE, {
    onCompleted: () => {
      toast({
        title: 'Bot status updated',
        description: `Bot is now ${botData?.bot?.isActive ? 'inactive' : 'active'}`,
      });
      refetchBot();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [enterQueue] = useMutation(ENTER_QUEUE, {
    onCompleted: () => {
      toast({
        title: 'Entered queue',
        description: 'Your bot has been added to the matchmaking queue',
      });
      navigate('/queue');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (botLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!botData?.bot) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Alert>
            <AlertDescription>Bot not found</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const bot = botData.bot;
  // Compare addresses in lowercase to handle checksum differences
  const isOwner = user?.address?.toLowerCase() === bot.creator.address?.toLowerCase();
  const stats: BotStats = bot.stats;
  const matches: Match[] = matchesData?.matches || [];
  
  // Debug ownership detection
  console.log('BotDetail ownership check:', {
    userAddress: user?.address,
    botCreatorAddress: bot.creator.address,
    isOwner,
    user
  });

  const handleToggleActive = async () => {
    try {
      await toggleBotActive({ variables: { botId: bot.id } });
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    }
  };

  const handleEnterQueue = async () => {
    try {
      await enterQueue({ variables: { botId: bot.id, queueType: 'STANDARD' } });
    } catch (error) {
      console.error('Failed to enter queue:', error);
    }
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return 'text-green-500';
    if (winRate >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getModelIcon = (modelType: string) => {
    switch (modelType) {
      case 'GPT_4O':
        return <Brain className="h-4 w-4 text-green-500" />;
      case 'CLAUDE_3_5_SONNET':
      case 'CLAUDE_3_OPUS':
        return <Zap className="h-4 w-4 text-purple-500" />;
      case 'DEEPSEEK_CHAT':
        return <Brain className="h-4 w-4 text-blue-500" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/bots')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Bot Profile</h1>
              <p className="text-muted-foreground">
                {isOwner ? 'Manage your bot' : 'Public profile'}
              </p>
            </div>
          </div>
          {!isOwner && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <Heart className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Live Match Card - Show prominently if bot is in a match */}
        {bot.currentMatch && (
          <div className="mb-8">
            <LiveMatchCard currentMatch={bot.currentMatch} botId={bot.id} />
          </div>
        )}

        {/* Bot Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{bot.avatar}</div>
                  <div>
                    <CardTitle className="text-2xl">{bot.name}</CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-2 mt-1">
                        {getModelIcon(bot.modelType)}
                        <span>{bot.modelType.replace(/_/g, ' ')}</span>
                      </div>
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={bot.isActive ? 'default' : 'secondary'}>
                  {bot.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Strategy Prompt</h3>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {bot.prompt}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Created {formatDistanceToNow(new Date(bot.createdAt), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>by {bot.creator.username || bot.creator.address.slice(0, 6) + '...' + bot.creator.address.slice(-4)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                  <span className={`text-2xl font-bold ${getWinRateColor(stats.winRate)}`}>
                    {stats.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Record</span>
                  <span className="font-medium">{stats.wins}W - {stats.losses}L</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Position</span>
                  <span className="font-medium">#{stats.avgFinishPosition.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Earnings</span>
                  <span className="font-medium">{stats.earnings} HYPE</span>
                </div>
                
                {bot.queuePosition && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Queue Position</span>
                      <Badge variant="outline">#{bot.queuePosition}</Badge>
                    </div>
                  </div>
                )}

                {isOwner && (
                  <div className="pt-4 space-y-2">
                    <Button
                      onClick={handleToggleActive}
                      variant={bot.isActive ? 'destructive' : 'default'}
                      className="w-full"
                      size="sm"
                    >
                      {bot.isActive ? (
                        <>
                          <PowerOff className="h-4 w-4 mr-2" />
                          Deactivate Bot
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4 mr-2" />
                          Activate Bot
                        </>
                      )}
                    </Button>
                    
                    {bot.isActive && !bot.queuePosition && (
                      <Button
                        onClick={handleEnterQueue}
                        variant="outline"
                        className="w-full"
                        size="sm"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Enter Queue
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats and History */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="matches">Match History</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-6">
            <PerformanceByGame performances={[]} />
          </TabsContent>

          <TabsContent value="achievements" className="mt-6">
            <BotAchievements achievements={[]} totalAchievements={20} />
          </TabsContent>

          <TabsContent value="matches" className="mt-6">
            <MatchHistoryEnhanced 
              matches={matches} 
              botId={bot.id} 
              loading={matchesLoading} 
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Performance Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{stats.wins}</span>
                    {stats.wins > stats.losses ? (
                      <TrendingUp className="h-6 w-6 text-green-500" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Total Wins</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Games Played</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{stats.wins + stats.losses}</span>
                    <Activity className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Total Matches</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tournament Earnings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{stats.earnings}</span>
                    <DollarSign className="h-6 w-6 text-yellow-500" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">HYPE Earned</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Win Rate Progress</CardTitle>
                <CardDescription>Overall performance across all matches</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={stats.winRate} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>0%</span>
                  <span className="font-medium">{stats.winRate.toFixed(1)}%</span>
                  <span>100%</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}