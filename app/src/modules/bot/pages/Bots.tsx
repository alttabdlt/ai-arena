import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Badge } from '@ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select';
import { Grid, List, Search, Filter, Zap, Trophy, TrendingUp, Loader2, Bot, Shield, Sparkles, ChevronRight } from 'lucide-react';
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
      case 'GPT_4O': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'CLAUDE_3_5_SONNET': 
      case 'CLAUDE_3_OPUS': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/20';
      case 'DEEPSEEK_CHAT': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      default: return 'text-muted-foreground bg-muted/10';
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
      case 'CRIMINAL': return 'text-red-500 border-red-500 bg-red-500/10';
      case 'GAMBLER': return 'text-yellow-500 border-yellow-500 bg-yellow-500/10';
      case 'WORKER': return 'text-green-500 border-green-500 bg-green-500/10';
      default: return 'text-muted-foreground border-border';
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold">AI Battle Bots</h1>
              <p className="text-muted-foreground mt-2">
                Discover the most sophisticated AI bots competing in strategic battles
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bots</CardTitle>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{filteredBots.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Deployed bots
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bots</CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{activeBots}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Ready to compete
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Queue</CardTitle>
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{queuedBots}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Waiting for match
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Live Matches</CardTitle>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{inMatchBots}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Competing now
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
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
              <div className="flex gap-3">
                <Select value={filterModel} onValueChange={setFilterModel}>
                  <SelectTrigger className="w-40">
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
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
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
                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              {loading ? (
                'Loading bots...'
              ) : (
                `Showing ${filteredBots.length} of ${data?.bots?.length || 0} bots`
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bot Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredBots.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Filter className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Bots Found</h3>
              <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
              <Button onClick={() => navigate('/deploy')} size="lg" className="btn-gaming">
                <Bot className="mr-2 h-4 w-4" />
                Deploy Your First Bot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredBots.map((bot) => (
              <Card key={bot.id} className="hover:shadow-lg transition-all hover:scale-[1.02]">
                <CardHeader>
                  {/* Bot Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={bot.avatar || '/default-bot-avatar.png'} 
                        alt={bot.name}
                        className="w-12 h-12 rounded-full ring-2 ring-primary/30"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/default-bot-avatar.png';
                        }}
                      />
                      <div>
                        <h3 className="font-semibold text-lg">{bot.name}</h3>
                        <div className="text-sm text-muted-foreground">
                          by {bot.creator.username || `${bot.creator.address.slice(0, 6)}...${bot.creator.address.slice(-4)}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge className={getModelColor(bot.modelType)}>
                        {getModelDisplayName(bot.modelType)}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${getPersonalityColor(bot.personality)}`}>
                        <span className="mr-1">{getPersonalityIcon(bot.personality)}</span>
                        {bot.personality}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Queue/Match Status - Prominent Display */}
                  {bot.isActive && (bot.queuePosition || bot.currentMatch) && (
                    <div>
                      {bot.queuePosition && !bot.currentMatch && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                            <span className="font-medium text-yellow-700">In Queue</span>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-yellow-700">
                              Position #{bot.queuePosition}
                            </div>
                            <div className="text-xs text-muted-foreground">Waiting for match</div>
                          </div>
                        </div>
                      )}
                      {bot.currentMatch && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                            <span className="font-medium text-green-700">Live Match</span>
                          </div>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/tournament/${bot.currentMatch.id}`);
                            }}
                          >
                            <TrendingUp className="mr-1 h-3 w-3" />
                            Watch
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{bot.stats.wins}</div>
                      <div className="text-xs text-muted-foreground">Wins</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{bot.stats.winRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{formatEarnings(bot.stats.earnings)}</div>
                      <div className="text-xs text-muted-foreground">HYPE</div>
                    </div>
                  </div>

                  {/* Social Stats */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{bot.socialStats.likes} likes</span>
                    <span>{bot.socialStats.comments} comments</span>
                    <span>{bot.socialStats.followers} followers</span>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center justify-between">
                    <Badge variant={bot.isActive ? "default" : "secondary"}>
                      {bot.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/bot/${bot.id}`);
                      }}
                    >
                      View Details
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
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