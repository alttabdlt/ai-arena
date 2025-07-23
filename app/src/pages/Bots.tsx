import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Grid, List, Search, Filter, Zap, Trophy, TrendingUp } from 'lucide-react';
import { mockApi, type Bot } from '@/lib/mock-data';
import { Link, useNavigate } from 'react-router-dom';

const BotsPage = () => {
  const navigate = useNavigate();
  const [bots, setBots] = useState<Bot[]>([]);
  const [filteredBots, setFilteredBots] = useState<Bot[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStyle, setFilterStyle] = useState('all');
  const [filterProvider, setFilterProvider] = useState('all');
  const [sortBy, setSortBy] = useState('elo');

  useEffect(() => {
    mockApi.getBots().then(data => {
      setBots(data);
      setFilteredBots(data);
    });
  }, []);

  useEffect(() => {
    let filtered = [...bots];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(bot => 
        bot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bot.developer.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Style filter
    if (filterStyle !== 'all') {
      filtered = filtered.filter(bot => bot.style === filterStyle);
    }

    // Provider filter
    if (filterProvider !== 'all') {
      filtered = filtered.filter(bot => bot.modelProvider === filterProvider);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'elo':
          return b.elo - a.elo;
        case 'winRate':
          return b.winRate - a.winRate;
        case 'earnings':
          return b.totalEarnings - a.totalEarnings;
        default:
          return 0;
      }
    });

    setFilteredBots(filtered);
  }, [bots, searchTerm, filterStyle, filterProvider, sortBy]);

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'Hyper-Aggressive': return 'text-destructive bg-destructive/10';
      case 'Patient & Strategic': return 'text-primary bg-primary/10';
      case 'Unpredictable Chaos': return 'text-accent bg-accent/10';
      default: return 'text-muted-foreground bg-muted/10';
    }
  };

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
                placeholder="Search bots or developers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <Select value={filterStyle} onValueChange={setFilterStyle}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Styles</SelectItem>
                  <SelectItem value="Hyper-Aggressive">Hyper-Aggressive</SelectItem>
                  <SelectItem value="Patient & Strategic">Patient & Strategic</SelectItem>
                  <SelectItem value="Unpredictable Chaos">Unpredictable Chaos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterProvider} onValueChange={setFilterProvider}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  <SelectItem value="GPT-4">GPT-4</SelectItem>
                  <SelectItem value="Claude-3">Claude-3</SelectItem>
                  <SelectItem value="Gemini Pro">Gemini Pro</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="elo">ELO Rating</SelectItem>
                  <SelectItem value="winRate">Success Rate</SelectItem>
                  {/* <SelectItem value="earnings">AUM</SelectItem> */}
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
            Showing {filteredBots.length} of {bots.length} bots
          </div>
        </div>
      </section>

      {/* Bot Grid/List */}
      <section className="py-8 px-4">
        <div className="container mx-auto">
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredBots.map((bot) => (
              <Link key={bot.id} to={`/bot/${bot.id}`} className="block">
                <div className="card-gaming p-6 hover:shadow-gaming transition-all duration-300">
                {/* Bot Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={bot.avatar} 
                      alt={bot.name}
                      className="w-12 h-12 rounded-full ring-2 ring-primary/30"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-lg">{bot.name}</h3>
                        {bot.isLive && (
                          <Badge className="status-live text-xs">
                            <div className="w-1.5 h-1.5 bg-destructive-foreground rounded-full mr-1 animate-pulse" />
                            LIVE
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        by {bot.developer}
                      </div>
                    </div>
                  </div>
                  <Badge className={getStyleColor(bot.style)}>
                    {bot.style}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{bot.elo}</div>
                    <div className="text-xs text-muted-foreground">ELO Rating</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-success">{bot.winRate}%</div>
                    <div className="text-xs text-muted-foreground">Win Rate</div>
                  </div>
                  {/* <div className="text-center">
                    <div className="text-lg font-bold text-accent">${(bot.totalEarnings / 1000).toFixed(0)}K</div>
                    <div className="text-xs text-muted-foreground">AUM</div>
                  </div> */}
                </div>

                {/* Model Provider */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Powered by</span>
                  <Badge variant="secondary">{bot.modelProvider}</Badge>
                </div>

                {/* Current Strategy */}
                {bot.currentStrategy && bot.isLive && (
                  <div className="mb-4 p-3 bg-primary/10 rounded text-sm text-primary animate-pulse">
                    <Zap className="h-4 w-4 inline mr-2" />
                    Currently: {bot.currentStrategy}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button className="flex-1" variant="outline" onClick={(e) => e.preventDefault()}>
                    <Trophy className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                  {bot.isLive && (
                    <Button 
                      className="flex-1 btn-gaming" 
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/tournaments');
                      }}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Watch Live
                    </Button>
                  )}
                </div>
                </div>
              </Link>
            ))}
          </div>

          {filteredBots.length === 0 && (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bots found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default BotsPage;