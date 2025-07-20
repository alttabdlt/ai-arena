import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  BarChart3, 
  PieChart, 
  Activity,
  DollarSign,
  Users,
  Calendar,
  Info
} from 'lucide-react';
import { mockApi, type Bot } from '@/lib/mock-data';

interface PerformanceData {
  period: string;
  returns: number;
  trades: number;
  winRate: number;
}

interface InvestmentTier {
  min: number;
  max: number | null;
  apy: number;
  fee: number;
}

const BotDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bot, setBot] = useState<Bot | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [selectedTier, setSelectedTier] = useState(0);
  const [loading, setLoading] = useState(true);

  const performanceData: PerformanceData[] = [
    { period: '24h', returns: 3.2, trades: 147, winRate: 78.3 },
    { period: '7d', returns: 18.7, trades: 1024, winRate: 76.8 },
    { period: '30d', returns: 45.3, trades: 4389, winRate: 74.2 },
    { period: '90d', returns: 128.9, trades: 13205, winRate: 75.6 },
  ];

  const investmentTiers: InvestmentTier[] = [
    { min: 100, max: 999, apy: 15.2, fee: 2.5 },
    { min: 1000, max: 4999, apy: 18.7, fee: 2.0 },
    { min: 5000, max: 19999, apy: 22.1, fee: 1.5 },
    { min: 20000, max: null, apy: 25.8, fee: 1.0 },
  ];

  useEffect(() => {
    const fetchBot = async () => {
      if (!id) return;
      
      try {
        const bots = await mockApi.getBots();
        const foundBot = bots.find(b => b.id === parseInt(id));
        setBot(foundBot || null);
      } catch (error) {
        console.error('Error fetching bot:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBot();
  }, [id]);

  useEffect(() => {
    const amount = parseFloat(investmentAmount) || 0;
    for (let i = 0; i < investmentTiers.length; i++) {
      const tier = investmentTiers[i];
      if (amount >= tier.min && (tier.max === null || amount <= tier.max)) {
        setSelectedTier(i);
        break;
      }
    }
  }, [investmentAmount]);

  const handleInvest = () => {
    // Handle investment logic here
    console.log('Investing', investmentAmount, 'in bot', bot?.name);
  };

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;
  const calculateAPY = (bot: Bot) => ((bot.winRate / 100) * (bot.totalEarnings / 10000) * 365).toFixed(1);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading bot details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Bot Not Found</h2>
            <p className="text-muted-foreground mb-6">The bot you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/bots')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Bots
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentAPY = calculateAPY(bot);

  return (
    <div className="min-h-screen bg-background">
      
      {/* Hero Section */}
      <section className="py-8 px-4 bg-muted/20">
        <div className="container mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/bots')}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bots
          </Button>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Bot Info */}
            <div className="lg:flex-1">
              <div className="flex items-start space-x-6 mb-6">
                <img
                  src={bot.avatar}
                  alt={bot.name}
                  className="w-24 h-24 rounded-full ring-4 ring-primary/30"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-3xl font-bold">{bot.name}</h1>
                    {bot.isLive && (
                      <Badge className="status-live">
                        <div className="w-2 h-2 bg-destructive-foreground rounded-full mr-2 animate-pulse" />
                        LIVE
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg text-muted-foreground mb-3">
                    Developed by {bot.developer} • Powered by {bot.modelProvider}
                  </p>
                  <Badge className="mb-4">{bot.style}</Badge>
                  
                  {bot.currentStrategy && bot.isLive && (
                    <div className="p-3 bg-primary/10 rounded text-sm text-primary animate-pulse">
                      <Zap className="h-4 w-4 inline mr-2" />
                      Currently: {bot.currentStrategy}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="card-gaming p-4 text-center">
                  <div className="text-2xl font-bold text-accent">{currentAPY}%</div>
                  <div className="text-xs text-muted-foreground">Current APY</div>
                </Card>
                <Card className="card-gaming p-4 text-center">
                  <div className="text-2xl font-bold text-success">{bot.winRate}%</div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                </Card>
                <Card className="card-gaming p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{formatCurrency(bot.totalEarnings / 1000)}K</div>
                  <div className="text-xs text-muted-foreground">Total AUM</div>
                </Card>
                <Card className="card-gaming p-4 text-center">
                  <div className="text-2xl font-bold text-warning">{bot.elo}</div>
                  <div className="text-xs text-muted-foreground">ELO Rating</div>
                </Card>
              </div>
            </div>

            {/* Investment Panel */}
            <div className="lg:w-96">
              <Card className="card-gaming p-6">
                <h3 className="text-lg font-semibold mb-4">Invest in {bot.name}</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="amount">Investment Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount in USD"
                      value={investmentAmount}
                      onChange={(e) => setInvestmentAmount(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {investmentAmount && (
                    <div className="p-4 bg-muted/50 rounded">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Investment Tier:</span>
                        <span className="font-medium">
                          {investmentTiers[selectedTier].min === 20000 
                            ? 'Premium' 
                            : `Tier ${selectedTier + 1}`
                          }
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Expected APY:</span>
                        <span className="font-medium text-accent">
                          {investmentTiers[selectedTier].apy}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Management Fee:</span>
                        <span className="font-medium">
                          {investmentTiers[selectedTier].fee}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold border-t pt-2">
                        <span>Est. Annual Return:</span>
                        <span className="text-success">
                          {formatCurrency(
                            parseFloat(investmentAmount) * 
                            (investmentTiers[selectedTier].apy / 100)
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full btn-gaming" 
                    size="lg"
                    disabled={!investmentAmount || parseFloat(investmentAmount) < 100}
                    onClick={handleInvest}
                  >
                    <Target className="mr-2 h-4 w-4" />
                    Invest Now
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Minimum investment: $100. Funds are deployed within 24 hours.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Content */}
      <section className="py-8 px-4">
        <div className="container mx-auto">
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="strategy">Strategy</TabsTrigger>
              <TabsTrigger value="trading">Trading</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="mt-6">
              <div className="grid gap-6">
                <Card className="card-gaming p-6">
                  <h3 className="text-lg font-semibold mb-4">Performance History</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {performanceData.map((data) => (
                      <div key={data.period} className="text-center p-4 bg-muted/50 rounded">
                        <div className="text-sm text-muted-foreground mb-1">{data.period.toUpperCase()}</div>
                        <div className={`text-xl font-bold mb-1 ${data.returns >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {data.returns >= 0 ? '+' : ''}{data.returns}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {data.trades} trades • {data.winRate}% success
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="card-gaming p-6">
                  <h3 className="text-lg font-semibold mb-4">Investment Tiers</h3>
                  <div className="space-y-3">
                    {investmentTiers.map((tier, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                        <div>
                          <div className="font-medium">
                            {formatCurrency(tier.min)}{tier.max ? ` - ${formatCurrency(tier.max)}` : '+'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {tier.fee}% management fee
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-accent">{tier.apy}% APY</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="strategy" className="mt-6">
              <Card className="card-gaming p-6">
                <h3 className="text-lg font-semibold mb-4">Trading Strategy</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Style: {bot.style}</h4>
                    <p className="text-muted-foreground">
                      This bot employs a sophisticated {bot.style.toLowerCase()} approach to maximize returns
                      while managing risk through advanced AI algorithms.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">AI Model: {bot.modelProvider}</h4>
                    <p className="text-muted-foreground">
                      Powered by cutting-edge {bot.modelProvider} technology for superior market analysis
                      and decision making capabilities.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Risk Management</h4>
                    <p className="text-muted-foreground">
                      Advanced risk controls including stop-loss mechanisms, position sizing, and
                      portfolio diversification to protect investor capital.
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="trading" className="mt-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="card-gaming p-6">
                  <h3 className="text-lg font-semibold mb-4">Recent Trades</h3>
                  <div className="space-y-4">
                    {[
                      { pair: 'BTC/USDT', type: 'BUY', amount: '0.1234', price: '$42,150', profit: '+$120', time: '2m ago' },
                      { pair: 'ETH/USDT', type: 'SELL', amount: '2.45', price: '$2,890', profit: '+$85', time: '5m ago' },
                      { pair: 'BTC/USDT', type: 'BUY', amount: '0.0567', price: '$42,080', profit: '+$67', time: '8m ago' },
                      { pair: 'ADA/USDT', type: 'SELL', amount: '1000', price: '$0.48', profit: '+$23', time: '12m ago' },
                    ].map((trade, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={trade.type === 'BUY' ? 'default' : 'secondary'} className="min-w-[50px]">
                            {trade.type}
                          </Badge>
                          <div>
                            <p className="font-medium">{trade.pair}</p>
                            <p className="text-sm text-muted-foreground">{trade.amount} @ {trade.price}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-success font-medium">{trade.profit}</p>
                          <p className="text-xs text-muted-foreground">{trade.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="card-gaming p-6">
                  <h3 className="text-lg font-semibold mb-4">Trade Settings</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Max Position Size</span>
                      <span className="font-medium">5% of portfolio</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Stop Loss</span>
                      <span className="font-medium">-2%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Take Profit</span>
                      <span className="font-medium">+8%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Trade Frequency</span>
                      <span className="font-medium">3-5 trades/day</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Risk Level</span>
                      <Badge className="bg-warning text-warning-foreground">Medium</Badge>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="portfolio" className="mt-6">
              <Card className="card-gaming p-6">
                <h3 className="text-lg font-semibold mb-4">Portfolio Composition</h3>
                <div className="text-center py-12">
                  <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Portfolio details coming soon</p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="about" className="mt-6">
              <Card className="card-gaming p-6">
                <h3 className="text-lg font-semibold mb-4">About {bot.name}</h3>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    {bot.name} is an advanced AI trading bot developed by {bot.developer} using {bot.modelProvider} technology.
                    With a proven track record of {bot.winRate}% success rate and {formatCurrency(bot.totalEarnings)} in total AUM,
                    this bot represents cutting-edge algorithmic trading capabilities.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded">
                      <div className="flex items-center mb-2">
                        <Users className="h-4 w-4 mr-2 text-primary" />
                        <span className="font-medium">Developer</span>
                      </div>
                      <p className="text-muted-foreground">{bot.developer}</p>
                    </div>
                    
                    <div className="p-4 bg-muted/50 rounded">
                      <div className="flex items-center mb-2">
                        <Zap className="h-4 w-4 mr-2 text-accent" />
                        <span className="font-medium">AI Model</span>
                      </div>
                      <p className="text-muted-foreground">{bot.modelProvider}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
};

export default BotDetail;