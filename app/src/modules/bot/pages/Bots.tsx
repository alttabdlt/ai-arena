import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Badge } from '@ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select';
import { Grid, List, Search, Filter, Zap, Trophy, Activity, Loader2, Bot, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { GET_BOTS } from '@/graphql/queries/bot';

interface Bot {
  id: string;
  name: string;
  avatar?: string;
  modelType: string;
  personality: string;
  isActive: boolean;
  isDemo?: boolean;
  channel?: string;
  createdAt: string;
  creator: {
    id: string;
    address: string;
    username?: string;
  };
  stats: {
    wins: number;
    losses: number;
    earnings: string;
    winRate: number;
    avgFinishPosition: number;
  };
  socialStats: {
    likes: number;
    comments: number;
    followers: number;
  };
  queuePosition?: number;
  currentMatch?: {
    id: string;
    type: string;
    status: string;
    startedAt: string;
  };
}

const BotsPage = () => {
  const navigate = useNavigate();
  const [filteredBots, setFilteredBots] = useState<Bot[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModel, setFilterModel] = useState('all');
  const [filterActive, setFilterActive] = useState('all');
  const [sortBy, setSortBy] = useState('WIN_RATE_DESC');

  // Convert sort and filter values to GraphQL enum values
  const getQueryVariables = () => {
    const variables: any = {
      limit: 50,
      offset: 0,
      sort: sortBy
    };

    const filter: any = {};
    
    if (filterModel !== 'all') {
      filter.modelType = filterModel;
    }
    
    if (filterActive !== 'all') {
      filter.isActive = filterActive === 'active';
    }

    if (Object.keys(filter).length > 0) {
      variables.filter = filter;
    }

    return variables;
  };

  const { data, loading, error } = useQuery(GET_BOTS, {
    variables: getQueryVariables(),
    pollInterval: 30000 // Poll every 30 seconds for updates
  });

  useEffect(() => {
    if (data?.bots) {
      let filtered = [...data.bots];

      // Client-side search filter
      if (searchTerm) {
        filtered = filtered.filter((bot: Bot) => 
          bot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bot.creator.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bot.creator.address.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setFilteredBots(filtered);
    }
  }, [data, searchTerm]);

  const getModelColor = (model: string) => {
    switch (model) {
      case 'GPT_4O': return 'text-green-600';
      case 'CLAUDE_3_5_SONNET': 
      case 'CLAUDE_3_OPUS': return 'text-purple-600';
      case 'DEEPSEEK_CHAT': return 'text-blue-600';
      default: return 'text-muted-foreground';
    }
  };

  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'GPT_4O': return 'GPT-4o';
      case 'CLAUDE_3_5_SONNET': return 'Claude 3.5';
      case 'CLAUDE_3_OPUS': return 'Claude Opus';
      case 'DEEPSEEK_CHAT': return 'DeepSeek';
      default: return model;
    }
  };

  const getPersonalityIcon = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL': return '🔫';
      case 'GAMBLER': return '🎲';
      case 'WORKER': return '🛠️';
      default: return '🤖';
    }
  };

  const getPersonalityColor = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL': return 'text-red-600';
      case 'GAMBLER': return 'text-yellow-600';
      case 'WORKER': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  const formatEarnings = (earnings: string) => {
    const num = parseFloat(earnings);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(0);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Error Loading Bots</h2>
          <p className="text-muted-foreground">{error.message}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const activeBots = filteredBots.filter(bot => bot.isActive).length;
  const queuedBots = filteredBots.filter(bot => bot.queuePosition).length;
  const inMatchBots = filteredBots.filter(bot => bot.currentMatch).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Bots</h1>
              <p className="text-muted-foreground mt-1">
                Discover and explore AI bots competing in tournaments
              </p>
            </div>
            <Button 
              onClick={() => navigate('/deploy')} 
              size="sm"
            >
              <Bot className="mr-2 h-4 w-4" />
              Deploy New Bot
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bots</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{filteredBots.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Deployed bots
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Bots</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{activeBots}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Ready to compete
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Queue</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{queuedBots}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Waiting for match
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Live Matches</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{inMatchBots}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Competing now
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bots or creators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <Select value={filterModel} onValueChange={setFilterModel}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  <SelectItem value="GPT_4O">GPT-4o</SelectItem>
                  <SelectItem value="CLAUDE_3_5_SONNET">Claude 3.5</SelectItem>
                  <SelectItem value="CLAUDE_3_OPUS">Claude Opus</SelectItem>
                  <SelectItem value="DEEPSEEK_CHAT">DeepSeek</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WIN_RATE_DESC">Win Rate</SelectItem>
                  <SelectItem value="WINS_DESC">Total Wins</SelectItem>
                  <SelectItem value="EARNINGS_DESC">Earnings</SelectItem>
                  <SelectItem value="CREATED_DESC">Newest</SelectItem>
                  <SelectItem value="CREATED_ASC">Oldest</SelectItem>
                </SelectContent>
              </Select>

              {/* View Toggle */}
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {!loading && (
            <div className="text-sm text-muted-foreground">
              Showing {filteredBots.length} of {data?.bots?.length || 0} bots
            </div>
          )}
        </div>

        {/* Bot Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredBots.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Bots Found</h3>
              <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or filters</p>
              <Button onClick={() => navigate('/deploy')} size="sm">
                <Bot className="mr-2 h-4 w-4" />
                Deploy Your First Bot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredBots.map((bot) => (
              <Card key={bot.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  {/* Bot Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={bot.avatar || '/default-bot-avatar.png'} 
                        alt={bot.name}
                        className="w-10 h-10 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/default-bot-avatar.png';
                        }}
                      />
                      <div>
                        <h3 className="font-medium">{bot.name}</h3>
                        <div className="text-xs text-muted-foreground">
                          by {bot.creator.username || `${bot.creator.address.slice(0, 6)}...${bot.creator.address.slice(-4)}`}
                          {bot.channel && (
                            <span className="ml-2">
                              📺 {bot.channel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <span className={getModelColor(bot.modelType)}>{getModelDisplayName(bot.modelType)}</span>
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <span className="mr-1">{getPersonalityIcon(bot.personality)}</span>
                        <span className={getPersonalityColor(bot.personality)}>{bot.personality}</span>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Queue/Match Status */}
                  {bot.isActive && (bot.queuePosition || bot.currentMatch) && (
                    <div className="mb-3">
                      {bot.queuePosition && !bot.currentMatch && (
                        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-md p-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Queue Position: #{bot.queuePosition}</span>
                          </div>
                        </div>
                      )}
                      {bot.currentMatch && (
                        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-md p-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-green-800 dark:text-green-200">Live Match</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/tournament/${bot.currentMatch.id}`);
                            }}
                          >
                            Watch
                            <ChevronRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="text-lg font-semibold">{bot.stats.wins}</div>
                      <div className="text-xs text-muted-foreground">Wins</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="text-lg font-semibold">{bot.stats.winRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="text-lg font-semibold">{formatEarnings(bot.stats.earnings)}</div>
                      <div className="text-xs text-muted-foreground">HYPE</div>
                    </div>
                  </div>

                  {/* Social Stats */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>{bot.socialStats.likes} likes</span>
                    <span>•</span>
                    <span>{bot.socialStats.comments} comments</span>
                    <span>•</span>
                    <span>{bot.socialStats.followers} followers</span>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {bot.isActive && (
                        <div className="w-2 h-2 rounded-full bg-green-500" title="Active" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {bot.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(bot.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BotsPage;