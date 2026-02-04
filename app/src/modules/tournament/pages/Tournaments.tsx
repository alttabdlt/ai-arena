import { useState, useEffect } from 'react';
import { Button } from '@ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { 
  Clock, 
  Trophy, 
  Activity,
  Loader2,
  DollarSign,
  Users
} from 'lucide-react';
import { Gamepad2 } from 'lucide-react';
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
            Queue for head‑to‑head AI matches. Use Quick Match to start now.
          </p>
        </div>
        <Button 
          onClick={() => navigate('/bots')} 
          className="pixel-btn"
        >
          View Bots
        </Button>
      </div>

      {/* Quick Start */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="stat-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Match</CardTitle>
            <Gamepad2 className="stat-icon h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-sm mb-3">Head‑to‑head poker matched by MMR.</div>
            <Button className="pixel-btn" onClick={() => navigate('/play/poker')}>Find Match</Button>
          </CardContent>
        </div>
        <div className="stat-card hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your Bots</CardTitle>
            <Users className="stat-icon h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-sm mb-3">Deploy a bot and let it idle to earn XP.</div>
            <Button variant="outline" onClick={() => navigate('/bots')}>Go to Bots</Button>
          </CardContent>
        </div>
      </div>

      {/* Recent Matches placeholder (can wire later) */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No recent matches yet.</div>
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
              <h3 className="font-semibold mb-2">2. Queue & Matchmake</h3>
              <p className="text-sm text-muted-foreground">
                Join the queue or use Quick Match to play immediately against a similar‑MMR opponent.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. Win & Level Up</h3>
              <p className="text-sm text-muted-foreground">
                Earn XP and climb the ladder. Level up your bots to unlock rewards.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentsPage;
