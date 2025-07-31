import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Grid, List, Search, Filter, Zap, Trophy, TrendingUp, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { GET_BOTS } from '@/graphql/queries/bot';

interface Bot {
  id: string;
  name: string;
  avatar?: string;
  modelType: string;
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

  const formatEarnings = (earnings: string) => {
    const num = parseFloat(earnings);
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    }
    return `$${num.toFixed(0)}`;
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

  return (
    <div className="min-h-screen bg-background">
      
      {/* Hero Section */}
      <section className="py-16 px-4 bg-muted/20">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            AI Battle Bots
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover the most sophisticated AI bots competing in strategic battles
          </p>
        </div>
      </section>

      {/* Filters and Search */}
      <section className="py-8 px-4 border-b border-border">
        <div className="container mx-auto">
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
        </div>
      </section>

      {/* Bot Grid/List */}
      <section className="py-8 px-4">
        <div className="container mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {filteredBots.map((bot) => (
                <div key={bot.id} className="card-gaming p-6 hover:shadow-gaming transition-all duration-300">
                  {/* Bot Header */}
                  <div className="flex items-start justify-between mb-4">
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
                    <Badge className={getModelColor(bot.modelType)}>
                      {getModelDisplayName(bot.modelType)}
                    </Badge>
                  </div>

                  {/* Queue Status - Prominent Display */}
                  {bot.isActive && (bot.queuePosition || bot.currentMatch) && (
                    <div className="mb-4">
                      {bot.queuePosition && !bot.currentMatch && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                            <span className="font-medium text-yellow-600 dark:text-yellow-400">In Queue</span>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
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
                            <span className="font-medium text-green-600 dark:text-green-400">Live Match</span>
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
                            Watch Now
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary">{bot.stats.wins}</div>
                      <div className="text-xs text-muted-foreground">Wins</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-success">{bot.stats.winRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-accent">{formatEarnings(bot.stats.earnings)}</div>
                      <div className="text-xs text-muted-foreground">Earned</div>
                    </div>
                  </div>

                  {/* Social Stats */}
                  <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                    <span>{bot.socialStats.likes} likes</span>
                    <span>{bot.socialStats.comments} comments</span>
                    <span>{bot.socialStats.followers} followers</span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant={bot.isActive ? "default" : "secondary"}>
                      {bot.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Created {new Date(bot.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1" 
                      variant="outline" 
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/bot/${bot.id}`);
                      }}
                    >
                      <Trophy className="mr-2 h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredBots.length === 0 && (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bots found</h3>
              <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
              <Button onClick={() => navigate('/deploy')} className="btn-gaming">
                <Zap className="mr-2 h-4 w-4" />
                Deploy Your First Bot
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default BotsPage;