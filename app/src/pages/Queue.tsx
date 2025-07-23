import { useState, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  Users, 
  Timer, 
  AlertCircle, 
  Zap, 
  Trophy, 
  Bot,
  LogOut,
  Loader2,
  Info
} from 'lucide-react';
import { GET_QUEUE_STATUS, GET_USER_BOTS_IN_QUEUE, GET_QUEUED_BOTS, QUEUE_UPDATE_SUBSCRIPTION } from '@/graphql/queries/queue';
import { LEAVE_QUEUE } from '@/graphql/mutations/queue';
import { formatDistanceToNow } from 'date-fns';

interface QueuedBot {
  id: string;
  name: string;
  avatar: string;
  modelType: string;
  queuePosition?: number;
  stats: {
    wins: number;
    losses: number;
    winRate: number;
  };
  queueEntries?: Array<{
    id: string;
    queueType: string;
    status: string;
    enteredAt: string;
    expiresAt: string;
  }>;
  creator?: {
    address: string;
    username?: string;
  };
}

export default function Queue() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('my-bots');

  // Queries
  const { data: queueStatus, loading: statusLoading } = useQuery(GET_QUEUE_STATUS, {
    pollInterval: 5000, // Poll every 5 seconds
  });

  const { data: userBots, loading: botsLoading, refetch: refetchUserBots } = useQuery(GET_USER_BOTS_IN_QUEUE, {
    variables: { address: user?.address },
    skip: !user?.address,
    pollInterval: 5000,
  });

  const { data: queuedBots, loading: queuedLoading } = useQuery(GET_QUEUED_BOTS, {
    variables: { limit: 20 },
    pollInterval: 10000,
  });

  // Mutations
  const [leaveQueue] = useMutation(LEAVE_QUEUE, {
    onCompleted: () => {
      toast({
        title: 'Left queue',
        description: 'Your bot has been removed from the queue',
      });
      refetchUserBots();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Subscribe to queue updates
  const { data: queueUpdate } = useSubscription(QUEUE_UPDATE_SUBSCRIPTION);

  useEffect(() => {
    if (queueUpdate) {
      // Refetch data when queue updates
      refetchUserBots();
    }
  }, [queueUpdate, refetchUserBots]);

  const handleLeaveQueue = async (botId: string) => {
    try {
      await leaveQueue({ variables: { botId } });
    } catch (error) {
      console.error('Failed to leave queue:', error);
    }
  };

  const myBotsInQueue = userBots?.bots?.filter((bot: QueuedBot) => 
    bot.queueEntries?.some(entry => entry.status === 'WAITING')
  ) || [];

  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Queue Status</h1>
          <p className="text-muted-foreground">
            Monitor queue positions and estimated wait times for upcoming matches
          </p>
        </div>

        {/* Queue Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total in Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{queueStatus?.queueStatus?.totalInQueue || 0}</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Wait</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatWaitTime(queueStatus?.queueStatus?.averageWaitTime || 0)}
                </span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Next Match</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {queueStatus?.queueStatus?.nextMatchTime 
                    ? formatDistanceToNow(new Date(queueStatus.queueStatus.nextMatchTime), { addSuffix: true })
                    : 'Soon'}
                </span>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">My Bots in Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{myBotsInQueue.length}</span>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Queue Types */}
        {queueStatus?.queueStatus?.queueTypes && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Queue Distribution</CardTitle>
              <CardDescription>Bots waiting in each queue type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {queueStatus.queueStatus.queueTypes.map((queueType: any) => (
                  <div key={queueType.type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{queueType.type}</span>
                        <Badge variant="secondary">{queueType.count} bots</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        ~{formatWaitTime(queueType.estimatedWaitTime)} wait
                      </span>
                    </div>
                    <Progress value={(queueType.count / queueStatus.queueStatus.totalInQueue) * 100} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for My Bots vs All Queued Bots */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-bots">My Bots</TabsTrigger>
            <TabsTrigger value="all-bots">All Queued Bots</TabsTrigger>
          </TabsList>

          <TabsContent value="my-bots" className="mt-6">
            {!isAuthenticated ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please connect your wallet and authenticate to view your bots in queue.
                </AlertDescription>
              </Alert>
            ) : botsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : myBotsInQueue.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  You don't have any bots in the queue. Deploy a bot to start competing!
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myBotsInQueue.map((bot: QueuedBot) => {
                  const queueEntry = bot.queueEntries?.find(e => e.status === 'WAITING');
                  if (!queueEntry) return null;

                  return (
                    <Card key={bot.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{bot.avatar}</div>
                            <div>
                              <CardTitle className="text-lg">{bot.name}</CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {bot.modelType.replace('_', ' ')}
                                </Badge>
                                <span className="text-xs">
                                  Position #{bot.queuePosition || 'TBD'}
                                </span>
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Queue Type</span>
                            <Badge>{queueEntry.queueType}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Entered</span>
                            <span>{formatDistanceToNow(new Date(queueEntry.enteredAt), { addSuffix: true })}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Expires</span>
                            <span>{formatDistanceToNow(new Date(queueEntry.expiresAt), { addSuffix: true })}</span>
                          </div>
                          <div className="pt-2">
                            <Button
                              onClick={() => handleLeaveQueue(bot.id)}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              <LogOut className="h-4 w-4 mr-2" />
                              Leave Queue
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all-bots" className="mt-6">
            {queuedLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {queuedBots?.queuedBots?.map((bot: QueuedBot, index: number) => (
                  <Card key={bot.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{bot.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{bot.name}</CardTitle>
                          <CardDescription className="text-xs">
                            <Badge variant="outline" className="text-xs">
                              {bot.modelType.replace('_', ' ')}
                            </Badge>
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="ml-auto">
                          #{index + 1}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Win Rate</span>
                        <span className="font-medium">{bot.stats.winRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Record</span>
                        <span>{bot.stats.wins}W - {bot.stats.losses}L</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}