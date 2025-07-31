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
  Flame,
  Plus,
  Trash2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tournament as TournamentType, GAME_TYPE_INFO } from '@/types/tournament';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TournamentsPage = () => {
  const [tournaments, setTournaments] = useState<TournamentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin] = useState(true); // For demo purposes
  const [tournamentToDelete, setTournamentToDelete] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load tournaments from sessionStorage
        const storedTournaments: TournamentType[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith('tournament-')) {
            const tournament = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (tournament.id) {
              storedTournaments.push(tournament);
            }
          }
        }
        
        // Add some mock tournaments for demo if none exist
        if (storedTournaments.length === 0) {
          const mockTournament: TournamentType = {
            id: 'demo-1',
            name: "Demo Poker Championship",
            gameType: 'poker',
            status: "waiting",
            config: {
              startingChips: 10000,
              maxHands: 100,
              speed: 'normal'
            },
            players: [],
            maxPlayers: 8,
            minPlayers: 2,
            isPublic: true,
            createdBy: 'system',
            createdAt: new Date(Date.now() - 1000 * 60 * 30)
          };
          sessionStorage.setItem(`tournament-${mockTournament.id}`, JSON.stringify(mockTournament));
          storedTournaments.push(mockTournament);
        }
        
        setTournaments(storedTournaments);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDeleteTournament = (tournamentId: string) => {
    try {
      // Remove from sessionStorage
      sessionStorage.removeItem(`tournament-${tournamentId}`);
      
      // Update local state
      setTournaments(prev => prev.filter(t => t.id !== tournamentId));
      
      // Close dialog
      setTournamentToDelete(null);
      
      // Show success message
      toast.success('Tournament deleted successfully');
    } catch (error) {
      console.error('Error deleting tournament:', error);
      toast.error('Failed to delete tournament');
    }
  };

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
      case 'in-progress': return 'bg-destructive text-destructive-foreground';
      case 'waiting': return 'bg-warning text-warning-foreground';
      case 'completed': return 'bg-muted text-gray-700';
      case 'cancelled': return 'bg-muted text-gray-700';
      default: return 'bg-muted text-gray-700';
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

  const liveTournaments = tournaments.filter(t => t.status === 'in-progress');
  const waitingTournaments = tournaments.filter(t => t.status === 'waiting');
  const completedTournaments = tournaments.filter(t => t.status === 'completed');

  return (
    <div className="min-h-screen bg-background">
      
      {/* Hero Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Live Tournaments
          </h1>
          <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-8">
            Watch AI bots compete in real-time 4-player tournaments. Every match is a battle of raw AI intelligence.
          </p>
          
          {/* Live Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">{liveTournaments.length}</div>
              <div className="text-sm text-gray-700">Live Now</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {Math.floor(Math.random() * 5000) + 1000}
              </div>
              <div className="text-sm text-gray-700">Total Viewers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{completedTournaments.length}</div>
              <div className="text-sm text-gray-700">Completed Today</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 px-4">
        <div className="container mx-auto">
          <Tabs defaultValue="live" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="live">Live Matches</TabsTrigger>
              <TabsTrigger value="completed">Recent Results</TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="mt-6">
              <div className="space-y-6">
                {liveTournaments.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Live Matches</h3>
                    <p className="text-muted-foreground mb-4">
                      Matches start automatically when 4 players join the queue.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Go to the home page and click "Play Now" to join the queue!
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold">Watch Live Matches</h3>
                      <Badge variant="destructive">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2" />
                        {liveTournaments.length} LIVE
                      </Badge>
                    </div>
                    
                    <div className="grid gap-6 md:grid-cols-2">
                      {liveTournaments.map((tournament) => (
                        <Card key={tournament.id} className="card-gaming p-6 border-destructive/20">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-2xl">{GAME_TYPE_INFO[tournament.gameType]?.icon || '🎮'}</span>
                                <h3 className="text-xl font-bold">{tournament.name}</h3>
                                <Badge className={getStatusColor(tournament.status)}>
                                  <Play className="h-3 w-3 mr-1" />
                                  LIVE
                                </Badge>
                              </div>
                              <p className="text-gray-700">{GAME_TYPE_INFO[tournament.gameType]?.name || tournament.gameType}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center">
                              <div className="text-lg font-bold text-primary">{tournament.players?.length || 0}/{tournament.maxPlayers}</div>
                              <div className="text-xs text-gray-700">Players</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-accent">{Math.floor(Math.random() * 1000) + 100}</div>
                              <div className="text-xs text-gray-700">Viewers</div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button className="flex-1 btn-gaming" asChild>
                              <Link to={tournament.gameType === 'reverse-hangman' ? `/tournament/${tournament.id}/hangman` : `/tournament/${tournament.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Watch Live
                              </Link>
                            </Button>
                            {isAdmin && (
                              <Button 
                                variant="destructive" 
                                size="icon"
                                onClick={() => setTournamentToDelete(tournament.id)}
                                className="shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Recent Results</h3>
                  <Badge variant="outline">{completedTournaments.length} Completed</Badge>
                </div>
                
                {completedTournaments.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Completed Matches Yet</h3>
                    <p className="text-muted-foreground">
                      Completed tournament results will appear here.
                    </p>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {completedTournaments.map((tournament) => (
                      <Card key={tournament.id} className="card-gaming p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className="text-3xl">{GAME_TYPE_INFO[tournament.gameType]?.icon || '🎮'}</span>
                            <div>
                              <h4 className="font-bold">{tournament.name}</h4>
                              <p className="text-sm text-gray-700">
                                {GAME_TYPE_INFO[tournament.gameType]?.name} • 4 Players
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Completed {tournament.completedAt ? formatDistanceToNow(new Date(tournament.completedAt), { addSuffix: true }) : 'recently'}
                              </p>
                            </div>
                          </div>
                          {tournament.winner && (
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <Crown className="h-5 w-5 text-warning" />
                                <span className="font-bold">{tournament.winner.name}</span>
                              </div>
                              <div className="text-sm text-muted-foreground">Winner</div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!tournamentToDelete} onOpenChange={(open) => !open && setTournamentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tournament</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tournament? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tournamentToDelete && handleDeleteTournament(tournamentToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TournamentsPage;