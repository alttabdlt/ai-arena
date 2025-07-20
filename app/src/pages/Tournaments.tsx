import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Clock, 
  Users, 
  Trophy, 
  Zap, 
  Eye,
  Calendar,
  Target,
  Activity,
  Crown,
  Flame
} from 'lucide-react';
import { mockApi, type Match } from '@/lib/mock-data';
import { Link } from 'react-router-dom';

interface Tournament {
  id: number;
  name: string;
  status: 'LIVE' | 'UPCOMING' | 'COMPLETED';
  startTime: number;
  prize: number;
  participants: number;
  maxParticipants: number;
  format: string;
  duration: string;
  currentRound?: string;
  viewers: number;
  bracket?: Match[];
}

const TournamentsPage = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matchData] = await Promise.all([
          mockApi.getMatches()
        ]);
        
        setMatches(matchData);
        
        // Mock tournament data
        const mockTournaments: Tournament[] = [
          {
            id: 1,
            name: "HyperEVM Championship",
            status: "LIVE",
            startTime: Date.now() - 1000 * 60 * 30,
            prize: 50000,
            participants: 16,
            maxParticipants: 16,
            format: "Single Elimination",
            duration: "4 hours",
            currentRound: "Quarterfinals",
            viewers: 2847,
            bracket: matchData
          },
          {
            id: 2,
            name: "Bonding Curve Masters",
            status: "UPCOMING",
            startTime: Date.now() + 1000 * 60 * 60 * 2,
            prize: 25000,
            participants: 12,
            maxParticipants: 16,
            format: "Round Robin",
            duration: "3 hours",
            viewers: 0
          },
          {
            id: 3,
            name: "AI Bot Royale",
            status: "UPCOMING",
            startTime: Date.now() + 1000 * 60 * 60 * 24,
            prize: 75000,
            participants: 0,
            maxParticipants: 32,
            format: "Double Elimination",
            duration: "6 hours",
            viewers: 0
          },
          {
            id: 4,
            name: "Weekly Showcase",
            status: "COMPLETED",
            startTime: Date.now() - 1000 * 60 * 60 * 24 * 3,
            prize: 10000,
            participants: 8,
            maxParticipants: 8,
            format: "Single Elimination",
            duration: "2 hours",
            viewers: 1205
          }
        ];
        
        setTournaments(mockTournaments);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatTimeUntil = (timestamp: number) => {
    const diff = timestamp - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diff < 0) return "Started";
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LIVE': return 'bg-destructive text-destructive-foreground';
      case 'UPCOMING': return 'bg-warning text-warning-foreground';
      case 'COMPLETED': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading tournaments...</p>
          </div>
        </div>
      </div>
    );
  }

  const liveTournaments = tournaments.filter(t => t.status === 'LIVE');
  const upcomingTournaments = tournaments.filter(t => t.status === 'UPCOMING');
  const completedTournaments = tournaments.filter(t => t.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-background">
      
      {/* Hero Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Tournament Arena
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Watch AI bots battle in real-time tournaments. Witness the future of competitive AI.
          </p>
          
          {/* Live Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">{liveTournaments.length}</div>
              <div className="text-sm text-muted-foreground">Live Now</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {tournaments.reduce((sum, t) => sum + t.viewers, 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Viewers</div>
            </div>
            {/* <div className="text-center">
              <div className="text-2xl font-bold text-success">
                ${tournaments.reduce((sum, t) => sum + t.prize, 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Prizes</div>
            </div> */}
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{upcomingTournaments.length}</div>
              <div className="text-sm text-muted-foreground">Upcoming</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Tournaments */}
      {liveTournaments.length > 0 && (
        <section className="py-8 px-4 bg-muted/20">
          <div className="container mx-auto">
            <div className="flex items-center space-x-3 mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse"></div>
                <h2 className="text-2xl font-bold text-destructive">LIVE TOURNAMENTS</h2>
              </div>
              <Badge className="bg-destructive text-destructive-foreground">
                {liveTournaments.length} Active
              </Badge>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              {liveTournaments.map((tournament) => (
                <Card key={tournament.id} className="card-gaming p-6 border-destructive/20">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-xl font-bold">{tournament.name}</h3>
                        <Badge className={getStatusColor(tournament.status)}>
                          <Play className="h-3 w-3 mr-1" />
                          LIVE
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{tournament.currentRound}</p>
                    </div>
                    {/* <div className="text-right">
                      <div className="text-lg font-bold text-success">${tournament.prize.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Prize Pool</div>
                    </div> */}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary">{tournament.participants}</div>
                      <div className="text-xs text-muted-foreground">Participants</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-accent">{tournament.viewers.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Viewers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-warning">{tournament.format}</div>
                      <div className="text-xs text-muted-foreground">Format</div>
                    </div>
                  </div>
                  
                  <Button className="w-full btn-gaming" asChild>
                    <Link to={`/tournament/${tournament.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Watch Live
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <section className="py-8 px-4">
        <div className="container mx-auto">
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="live-matches">Live Matches</TabsTrigger>
              <TabsTrigger value="completed">Results</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Upcoming Tournaments</h3>
                  <Badge variant="outline">{upcomingTournaments.length} Scheduled</Badge>
                </div>
                
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingTournaments.map((tournament) => (
                    <Card key={tournament.id} className="card-gaming p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-bold text-lg mb-1">{tournament.name}</h4>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4 mr-1" />
                            Starts in {formatTimeUntil(tournament.startTime)}
                          </div>
                        </div>
                        <Badge className={getStatusColor(tournament.status)}>
                          {tournament.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        {/* <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Prize Pool:</span>
                          <span className="font-medium text-success">${tournament.prize.toLocaleString()}</span>
                        </div> */}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Format:</span>
                          <span className="font-medium">{tournament.format}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="font-medium">{tournament.duration}</span>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Participants:</span>
                            <span className="font-medium">{tournament.participants}/{tournament.maxParticipants}</span>
                          </div>
                          <Progress 
                            value={(tournament.participants / tournament.maxParticipants) * 100} 
                            className="h-2" 
                          />
                        </div>
                      </div>
                      
                      <Button variant="outline" className="w-full" disabled>
                        <Clock className="mr-2 h-4 w-4" />
                        Registration Closed
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="live-matches" className="mt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Live Matches</h3>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    {matches.filter(m => m.status === 'LIVE').length} Live
                  </Badge>
                </div>
                
                <div className="grid gap-6">
                  {matches.map((match) => (
                    <Card key={match.id} className="card-gaming p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-3">
                            <img src={match.botAAvatar} alt={match.botA} className="w-10 h-10 rounded-full" />
                            <div>
                              <div className="font-medium">{match.botA}</div>
                              <div className="text-sm text-muted-foreground">
                                {match.botAStrategy?.slice(0, 30)}...
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-center px-4">
                            <div className="text-sm text-muted-foreground mb-1">VS</div>
                            <Badge className={getStatusColor(match.status)}>
                              {match.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <div className="font-medium">{match.botB}</div>
                              <div className="text-sm text-muted-foreground">
                                {match.botBStrategy?.slice(0, 30)}...
                              </div>
                            </div>
                            <img src={match.botBAvatar} alt={match.botB} className="w-10 h-10 rounded-full" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">{match.handsPlayed}</div>
                          <div className="text-xs text-muted-foreground">Hands Played</div>
                        </div>
                        {/* <div className="text-center">
                          <div className="text-lg font-bold text-accent">${match.poolA.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Pool A</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-accent">${match.poolB.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Pool B</div>
                        </div> */}
                        {/* <div className="text-center">
                          <div className="text-lg font-bold text-warning">{match.oddsA.toFixed(1)}x</div>
                          <div className="text-xs text-muted-foreground">Odds</div>
                        </div> */}
                      </div>
                      
                      <Button className="w-full btn-gaming" asChild>
                        <Link to={`/tournament/1`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Watch Match
                        </Link>
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Recent Results</h3>
                  <Badge variant="outline">{completedTournaments.length} Completed</Badge>
                </div>
                
                <div className="grid gap-4">
                  {completedTournaments.map((tournament) => (
                    <Card key={tournament.id} className="card-gaming p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Trophy className="h-8 w-8 text-warning" />
                          <div>
                            <h4 className="font-bold">{tournament.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Completed {Math.floor((Date.now() - tournament.startTime) / (1000 * 60 * 60 * 24))} days ago
                            </p>
                          </div>
                        </div>
                        {/* <div className="text-right">
                          <div className="font-bold text-success">${tournament.prize.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">Prize Pool</div>
                        </div> */}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
};

export default TournamentsPage;