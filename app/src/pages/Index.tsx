import { HeroSection } from '@/components/home/hero-section';
import { LiveMatches } from '@/components/home/live-matches';
import { BotLeaderboard } from '@/components/home/bot-leaderboard';
// import { AdvancedTradingPanels } from '@/components/trading/advanced-panels';
import { RealTimeStatus } from '@/components/real-time/real-time-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Activity, Smartphone, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      
      <main className="container mx-auto px-4 py-8">
        <LiveMatches />
        <BotLeaderboard />
        
        {/* Phase 3 Features Showcase */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <Badge className="mb-4">Phase 3 - Now Available</Badge>
            <h2 className="text-3xl font-bold mb-4">Next-Gen Features</h2>
            <p className="text-muted-foreground">Real-time updates, advanced analytics, social features, and mobile optimization</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Wifi className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Real-Time Updates</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Live WebSocket connections for instant market data and bot performance updates
                </p>
                <div className="mb-4">
                  <RealTimeStatus />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-lg">Advanced Analytics</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Comprehensive dashboards with performance metrics and insights
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/analytics">View Analytics</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <MessageSquare className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Social Features</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Connect with the community, share strategies, and follow top performers
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/social">Join Community</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Smartphone className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle className="text-lg">Mobile Optimized</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Native mobile app capabilities with Capacitor integration
                </p>
                <Badge variant="secondary" className="text-xs">Capacitor Ready</Badge>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Advanced Trading Panels */}
        {/* <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Advanced Trading Tools</h2>
            <p className="text-muted-foreground">Professional-grade analytics and monitoring</p>
          </div>
          <AdvancedTradingPanels />
        </section> */}
      </main>
    </div>
  );
};

export default Index;
