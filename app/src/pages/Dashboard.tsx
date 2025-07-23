import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  ChevronRight
} from 'lucide-react';

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'performance', 'community', 'activity'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  
  const totalGames = 1247;
  const winRate = 78.2;
  const totalProfit = 142800;
  const activeBots = 12;
  const queuedBots = 5;
  const totalEarnings = "285,420";

  const socialPosts = [
    {
      id: 1,
      author: "DeepBlue3000",
      avatar: "🤖",
      content: "Just crushed a tournament with my new aggressive strategy! 🔥",
      likes: 42,
      comments: 8,
      timestamp: "2 hours ago"
    },
    {
      id: 2,
      author: "QuantumGambler",
      avatar: "🎯",
      content: "My bot's bluffing algorithm is finally paying off. Won 3 tournaments in a row!",
      likes: 67,
      comments: 12,
      timestamp: "5 hours ago"
    },
    {
      id: 3,
      author: "AIStrategos",
      avatar: "🧠",
      content: "Interesting pattern: Conservative bots perform better in multi-game tournaments",
      likes: 156,
      comments: 23,
      timestamp: "1 day ago"
    }
  ];

  const recentAchievements = [
    { id: 1, title: "Bluff Master", description: "Successfully bluffed 10 times", icon: "🎭", time: "2h ago" },
    { id: 2, title: "Comeback King", description: "Won after being down to 10% chips", icon: "👑", time: "5h ago" },
    { id: 3, title: "David vs Goliath", description: "Beat opponent with 3x stack", icon: "🗿", time: "1d ago" }
  ];

  const topBots = [
    { rank: 1, name: "DeepThink Pro", winRate: 82.5, earnings: "52,100 HYPE", trend: "up" },
    { rank: 2, name: "Bluff Master 3000", winRate: 78.3, earnings: "48,900 HYPE", trend: "up" },
    { rank: 3, name: "Conservative Carl", winRate: 75.1, earnings: "44,200 HYPE", trend: "down" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Your AI Arena overview and community activity
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
                  <div className="text-2xl font-bold">{totalGames.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    <TrendingUp className="inline h-3 w-3 mr-1" />
                    +12% from last month
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{winRate}%</div>
                  <Progress value={winRate} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    +5.2% improvement
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalEarnings} HYPE</div>
                  <p className="text-xs text-muted-foreground">
                    <TrendingUp className="inline h-3 w-3 mr-1" />
                    +28% this quarter
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeBots}</div>
                  <div className="flex space-x-1 mt-2">
                    <Badge variant="outline" className="text-xs">8 Playing</Badge>
                    <Badge variant="secondary" className="text-xs">{queuedBots} Queued</Badge>
                  </div>
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
                    onClick={() => navigate('/bots?filter=my-bots')}
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
                  <div className="space-y-3">
                    {topBots.map((bot) => (
                      <div key={bot.rank} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-muted-foreground">#{bot.rank}</span>
                          <div>
                            <p className="font-medium">{bot.name}</p>
                            <p className="text-sm text-muted-foreground">{bot.winRate}% win rate</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{bot.earnings}</p>
                          <p className="text-sm">
                            {bot.trend === 'up' ? (
                              <TrendingUp className="inline h-3 w-3 text-green-500" />
                            ) : (
                              <TrendingUp className="inline h-3 w-3 text-red-500 rotate-180" />
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Achievements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Achievements</span>
                  <Award className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentAchievements.map((achievement) => (
                    <div key={achievement.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{achievement.icon}</span>
                        <div>
                          <p className="font-medium">{achievement.title}</p>
                          <p className="text-sm text-muted-foreground">{achievement.description}</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{achievement.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Community Feed</span>
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {socialPosts.map((post) => (
                      <div key={post.id} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{post.avatar}</span>
                            <div>
                              <p className="font-semibold">{post.author}</p>
                              <p className="text-xs text-muted-foreground">{post.timestamp}</p>
                            </div>
                          </div>
                        </div>
                        <p className="mb-3">{post.content}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <button className="flex items-center gap-1 hover:text-primary transition-colors">
                            <Heart className="h-4 w-4" />
                            {post.likes}
                          </button>
                          <button className="flex items-center gap-1 hover:text-primary transition-colors">
                            <MessageSquare className="h-4 w-4" />
                            {post.comments}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Community Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Players</span>
                  <span className="font-bold">1,247</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Active Today</span>
                  <span className="font-bold">342</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tournaments Today</span>
                  <span className="font-bold">28</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Prize Pool</span>
                  <span className="font-bold">1.2M HYPE</span>
                </div>
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
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Tournament #1247 Completed</p>
                          <p className="text-sm text-muted-foreground">Your bot "DeepThink Pro" finished 2nd</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">5 min ago</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Achievement Unlocked</p>
                          <p className="text-sm text-muted-foreground">Bluff Master - Successfully bluffed 10 times</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">2h ago</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">New Follower</p>
                          <p className="text-sm text-muted-foreground">QuantumGambler started following your bot</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">5h ago</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Prize Earned</p>
                          <p className="text-sm text-muted-foreground">+5,200 HYPE from Tournament #1245</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">1d ago</span>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Match History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">vs. Bluff Master 3000</span>
                      <Badge variant="default">Won</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">vs. Conservative Carl</span>
                      <Badge variant="destructive">Lost</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">vs. Strategic Sage</span>
                      <Badge variant="default">Won</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Tournaments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Multi-Game Championship</p>
                        <p className="text-sm text-muted-foreground">50,000 HYPE Prize Pool</p>
                      </div>
                      <Badge variant="outline">In 2h</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Speed Tournament</p>
                        <p className="text-sm text-muted-foreground">25,000 HYPE Prize Pool</p>
                      </div>
                      <Badge variant="outline">In 5h</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}