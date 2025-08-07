import { useState, useEffect } from 'react';
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
import { StardewSpriteSelector, BotPersonality } from '@/services/stardewSpriteSelector';
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
  Share2,
  MapPin
} from 'lucide-react';
import { GET_BOT_DETAIL, GET_BOT_MATCHES } from '@/graphql/queries/bot';
import { TOGGLE_BOT_ACTIVE, ENTER_QUEUE } from '@/graphql/mutations/bot';
import { format, formatDistanceToNow } from 'date-fns';
import { LiveMatchCard } from '@bot/components/LiveMatchCard';
import { PerformanceByGame } from '@bot/components/PerformanceByGame';
import { BotAchievements } from '@bot/components/BotAchievements';
import { MatchHistoryEnhanced } from '@bot/components/MatchHistoryEnhanced';
import { EnergyPurchaseModal } from '@/components/energy/EnergyPurchaseModal';
import { useEnergy } from '@/hooks/useEnergy';
import { cn } from '@/lib/utils';

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
  const [spriteData, setSpriteData] = useState<{ imageData: string } | null>(null);
  const [spriteSelector] = useState(() => new StardewSpriteSelector());

  // Queries
  const { data: botData, loading: botLoading, refetch: refetchBot } = useQuery(GET_BOT_DETAIL, {
    variables: { id },
    skip: !id,
  });

  // TODO: Add matches query when available in backend
  const matchesLoading = false;
  const matchesData = null;

  // Energy hook
  const { 
    energy, 
    pauseBot, 
    resumeBot, 
    getEnergyPercentage,
    getTimeRemaining 
  } = useEnergy(id);

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

  const bot = botData?.bot;
  const isOwner = user?.address?.toLowerCase() === bot?.creator?.address?.toLowerCase();
  const stats: BotStats | undefined = bot?.stats;
  const matches: Match[] = matchesData?.matches || [];

  // Generate sprite when bot data is loaded
  useEffect(() => {
    if (bot && bot.personality) {
      // If bot has existing avatar, use it
      if (bot.avatar && bot.avatar.startsWith('data:image')) {
        setSpriteData({ imageData: bot.avatar });
      } else {
        // Generate sprite based on personality
        spriteSelector.selectSprite(
          bot.personality as BotPersonality,
          bot.id
        ).then(sprite => {
          setSpriteData({ imageData: sprite.imageData });
        }).catch(error => {
          console.error('Failed to generate sprite:', error);
        });
      }
    }
  }, [bot, spriteSelector]);

  if (botLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!bot) {
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

  const formatModelType = (modelType: string) => {
    const modelMap: Record<string, string> = {
      'DEEPSEEK_CHAT': 'DeepSeek',
      'GPT_4O': 'GPT-4o',
      'GPT_4O_MINI': 'GPT-4o Mini',
      'CLAUDE_3_5_SONNET': 'Claude 3.5',
      'CLAUDE_3_OPUS': 'Claude Opus',
      'CLAUDE_3_HAIKU': 'Claude Haiku',
      'LLAMA_3_70B': 'Llama 3 70B',
      'MIXTRAL_8X7B': 'Mixtral 8x7B',
    };
    
    return modelMap[modelType] || modelType.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
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
                View bot performance and statistics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon">
              <Heart className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
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
                  {/* Bot Sprite Display */}
                  <div className="relative">
                    {spriteData && spriteData.imageData ? (
                      <div 
                        className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center"
                        style={{ imageRendering: 'pixelated' }}
                      >
                        <img 
                          src={spriteData.imageData}
                          alt={bot.name}
                          className="w-full h-full object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <Bot className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{bot.name}</CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1">
                          {getModelIcon(bot.modelType)}
                          <span>{formatModelType(bot.modelType)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          <span className="text-xs">{bot.personality}</span>
                        </div>
                      </div>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={bot.isActive ? 'default' : 'secondary'}>
                    {bot.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">
                    #{bot.tokenId}
                  </Badge>
                  {energy && (
                    <div className="flex items-center gap-1">
                      <Zap className={cn(
                        "h-3 w-3",
                        getEnergyPercentage(energy) > 50 ? "text-green-500" :
                        getEnergyPercentage(energy) > 20 ? "text-yellow-500" :
                        "text-red-500"
                      )} />
                      <span className="text-xs font-medium">
                        {energy.currentEnergy}/{energy.maxEnergy} ⚡
                      </span>
                      {energy.isPaused && (
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          Paused
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isOwner && (
                  <div>
                    <h3 className="font-semibold mb-2">Strategy Prompt</h3>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      {bot.prompt}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Created {formatDistanceToNow(new Date(bot.createdAt), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>Owner: {bot.creator.username || bot.creator.address.slice(0, 6) + '...' + bot.creator.address.slice(-4)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                  <span className={`text-2xl font-bold ${getWinRateColor(stats?.winRate || 0)}`}>
                    {(stats?.winRate || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Record</span>
                  <span className="font-medium">{stats?.wins || 0}W - {stats?.losses || 0}L</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Position</span>
                  <span className="font-medium">#{(stats?.avgFinishPosition || 0).toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Earnings</span>
                  <span className="font-medium">{stats?.earnings || '0'} HYPE</span>
                </div>
                
                {bot.queuePosition && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Queue Position</span>
                      <Badge variant="outline">#{bot.queuePosition}</Badge>
                    </div>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats and History */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="matches">Match History</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="metaverse">Metaverse</TabsTrigger>
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
                    <span className="text-2xl font-bold">{stats?.wins || 0}</span>
                    {(stats?.wins || 0) > (stats?.losses || 0) ? (
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
                    <span className="text-2xl font-bold">{(stats?.wins || 0) + (stats?.losses || 0)}</span>
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
                    <span className="text-2xl font-bold">{stats?.earnings || '0'}</span>
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
                <Progress value={stats?.winRate || 0} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>0%</span>
                  <span className="font-medium">{(stats?.winRate || 0).toFixed(1)}%</span>
                  <span>100%</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="metaverse" className="mt-6">
            <div className="space-y-4">
              {/* Metaverse Connection Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    Metaverse Status
                  </CardTitle>
                  <CardDescription>Your bot's presence in the AI Arena crime metaverse</CardDescription>
                </CardHeader>
                <CardContent>
                  {bot.metaverseAgentId ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Connection Status</span>
                        <Badge variant="default" className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          Connected
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Current Zone</p>
                          <p className="text-lg font-medium capitalize">
                            {bot.currentZone || 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Last Zone Change</p>
                          <p className="text-sm">
                            {bot.lastZoneChange 
                              ? formatDistanceToNow(new Date(bot.lastZoneChange), { addSuffix: true })
                              : 'Never moved'
                            }
                          </p>
                        </div>
                      </div>
                      
                      {bot.metaversePosition && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">World Position</p>
                          <div className="flex gap-4">
                            <Badge variant="outline">
                              X: {Math.round(bot.metaversePosition.x || 0)}
                            </Badge>
                            <Badge variant="outline">
                              Y: {Math.round(bot.metaversePosition.y || 0)}
                            </Badge>
                          </div>
                        </div>
                      )}
                      
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Your bot is actively living in the metaverse, forming alliances, 
                          committing crimes, and building their criminal empire 24/7.
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Share2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Not Connected to Metaverse</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Your bot is not currently active in the AI Arena metaverse.
                        Connect your bot to enable 24/7 autonomous gameplay.
                      </p>
                      {/* TODO: Add deploy to metaverse button here */}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Zone Information */}
              {bot.currentZone && (
                <Card>
                  <CardHeader>
                    <CardTitle>Zone Details</CardTitle>
                    <CardDescription>Information about the current zone</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {bot.currentZone === 'casino' && (
                        <>
                          <Badge variant="default" className="mb-2">🎰 Casino</Badge>
                          <p className="text-sm text-muted-foreground">
                            High-risk gambling zone where fortunes are made and lost. 
                            Your bot frequents poker tables and makes risky deals.
                          </p>
                        </>
                      )}
                      {bot.currentZone === 'darkAlley' && (
                        <>
                          <Badge variant="destructive" className="mb-2">🔫 Dark Alley</Badge>
                          <p className="text-sm text-muted-foreground">
                            Dangerous zone for criminal activities. 
                            Your bot engages in robberies and shady transactions.
                          </p>
                        </>
                      )}
                      {bot.currentZone === 'suburb' && (
                        <>
                          <Badge variant="secondary" className="mb-2">🏠 Suburb</Badge>
                          <p className="text-sm text-muted-foreground">
                            Safe residential area for building houses and trading. 
                            Your bot focuses on accumulating wealth and forming partnerships.
                          </p>
                        </>
                      )}
                      {bot.currentZone === 'downtown' && (
                        <>
                          <Badge variant="outline" className="mb-2">🏙️ Downtown</Badge>
                          <p className="text-sm text-muted-foreground">
                            Central hub for meetings and commerce. 
                            Your bot networks and conducts legitimate business.
                          </p>
                        </>
                      )}
                      {bot.currentZone === 'underground' && (
                        <>
                          <Badge variant="destructive" className="mb-2">👊 Underground</Badge>
                          <p className="text-sm text-muted-foreground">
                            Fight club zone for combat and betting. 
                            Your bot tests their strength against others.
                          </p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}