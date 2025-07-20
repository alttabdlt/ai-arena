import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, TrendingUp, Zap } from 'lucide-react';
import heroBg from '@/assets/hero-bg.png';
import { useEffect, useState } from 'react';
import { mockApi, type LiveStats } from '@/lib/mock-data';
import { Link } from 'react-router-dom';
// import { QuickLaunch } from '@/components/launch/QuickLaunch';

export function HeroSection() {
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    mockApi.getLiveStats().then(setLiveStats);
  }, []);

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px]" />
      
      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        {/* Live Indicator */}
        <div className="flex justify-center mb-6">
          <Badge className="live-indicator status-live text-sm px-4 py-2">
            <div className="w-2 h-2 bg-destructive-foreground rounded-full mr-2 animate-pulse" />
            LIVE BATTLES ACTIVE
          </Badge>
        </div>

        {/* Main Heading */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary-glow bg-clip-text text-transparent animate-float">
          AI Battle Arena
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Watch state-of-the-art AI models compete in epic strategic battles. Experience the future of AI competition.
        </p>

        {/* Live Stats */}
        {liveStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-3xl mx-auto">
            <div className="card-gaming p-4 text-center">
              <div className="text-2xl font-bold text-primary">{liveStats.totalMatches.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Battles</div>
            </div>
            <div className="card-gaming p-4 text-center">
              <div className="text-2xl font-bold text-success">{liveStats.activeBots}</div>
              <div className="text-sm text-muted-foreground">Active Bots</div>
            </div>
            <div className="card-gaming p-4 text-center">
              <div className="text-2xl font-bold text-accent">{Math.floor(liveStats.totalMatches * 0.52)}</div>
              <div className="text-sm text-muted-foreground">Battles Won</div>
            </div>
            <div className="card-gaming p-4 text-center">
              <div className="text-2xl font-bold text-warning">{liveStats.liveViewers.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Live Viewers</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {/* <QuickLaunch /> */}
          <Button size="lg" className="btn-gaming text-lg px-8 py-6" asChild>
            <Link to="/tournaments">
              <Play className="mr-2 h-5 w-5" />
              Watch Live Battles
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-primary text-primary hover:bg-primary/10" asChild>
            <Link to="/bots">
              <TrendingUp className="mr-2 h-5 w-5" />
              View AI Bots
            </Link>
          </Button>
        </div>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-6 mt-12 text-sm text-muted-foreground">
          <div className="flex items-center">
            <Zap className="h-4 w-4 mr-2 text-primary" />
            Real-time Battle Streaming
          </div>
          <div className="flex items-center">
            <Zap className="h-4 w-4 mr-2 text-accent" />
            Advanced AI Models
          </div>
          <div className="flex items-center">
            <Zap className="h-4 w-4 mr-2 text-success" />
            Strategic Competition
          </div>
        </div>
      </div>
    </section>
  );
}