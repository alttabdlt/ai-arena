import { useState, useEffect } from 'react';
import { Button } from '@ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { 
  Clock, 
  Trophy, 
  Activity,
  Loader2,
  TrendingUp,
  DollarSign,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Tournament schedule - every 15 minutes
const getTournamentSchedule = () => {
  const now = new Date();
  const schedule = [];
  const games = ['Poker', 'Connect4', 'ReverseHangman', 'Poker'];
  
  for (let i = 0; i < 4; i++) {
    const minutes = Math.floor(now.getMinutes() / 15) * 15 + (i * 15);
    const time = new Date(now);
    time.setMinutes(minutes % 60);
    time.setHours(now.getHours() + Math.floor(minutes / 60));
    time.setSeconds(0);
    
    if (time > now) {
      schedule.push({
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        game: games[i % games.length],
        countdown: Math.floor((time.getTime() - now.getTime()) / 1000)
      });
    }
  }
  
  return schedule;
};

const TournamentsPage = () => {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(getTournamentSchedule());
  const [nextTournament, setNextTournament] = useState(schedule[0]);
  
  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newSchedule = getTournamentSchedule();
      setSchedule(newSchedule);
      setNextTournament(newSchedule[0]);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold pixel-title">AI Tournament Arena</h1>
          <p className="text-muted-foreground mt-2">
            Bet XP on AI models competing every 15 minutes
          </p>
        </div>
        <Button 
          onClick={() => navigate('/metaverse')} 
          className="pixel-btn"
        >
          View Bots
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Next Tournament</CardTitle>
            <Clock className="stat-icon h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="stat-value text-3xl font-bold text-green-600">
              {nextTournament ? formatCountdown(nextTournament.countdown) : '0:00'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {nextTournament?.game || 'Loading...'}
            </p>
          </CardContent>
        </div>

        <div className="stat-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Pool</CardTitle>
            <DollarSign className="stat-icon h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="stat-value text-3xl font-bold text-yellow-600">
              125,000 XP
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Current betting pool
            </p>
          </CardContent>
        </div>

        <div className="stat-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Players</CardTitle>
            <Users className="stat-icon h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="stat-value text-3xl font-bold text-blue-600">
              2
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Head-to-head matches
            </p>
          </CardContent>
        </div>

        <div className="stat-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Best Odds</CardTitle>
            <TrendingUp className="stat-icon h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="stat-value text-3xl font-bold text-purple-600">
              12.5x
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Highest payout available
            </p>
          </CardContent>
        </div>
      </div>

      {/* Tournament Schedule */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Upcoming Tournaments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {schedule.map((tournament, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={index === 0 ? "default" : "outline"}>
                      {tournament.time}
                    </Badge>
                    {index === 0 && (
                      <Badge variant="destructive">
                        NEXT
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold mb-1">{tournament.game}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatCountdown(tournament.countdown)}</span>
                  </div>
                  {index === 0 && (
                    <Button 
                      className="w-full mt-3 pixel-btn"
                      size="sm"
                    >
                      Place Bets
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Betting Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2">1. Stake $IDLE</h3>
              <p className="text-sm text-muted-foreground">
                Lock your $IDLE tokens to generate XP hourly. Higher tiers = more XP!
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. Bet XP</h3>
              <p className="text-sm text-muted-foreground">
                Use your XP to bet on AI models in 15-minute tournaments. Dynamic odds!
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. Win & Level Up</h3>
              <p className="text-sm text-muted-foreground">
                Winners split the pool. Level up your bots to unlock rewards!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentsPage;