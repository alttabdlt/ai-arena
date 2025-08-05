import { useState, useEffect } from 'react';
import { Button } from '@ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Progress } from '@ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
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
  Trash2,
  Loader2,
  Bot,
  ChevronRight,
  Swords
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Tournament as TournamentType, GAME_TYPE_INFO } from '@shared/types/tournament';
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
} from "@ui/alert-dialog";

const TournamentsPage = () => {
  const [tournaments, setTournaments] = useState<TournamentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin] = useState(true); // For demo purposes
  const [tournamentToDelete, setTournamentToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

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

  useEffect(() => {
    fetchData();
    
    // Poll for updates every 2 seconds
    const pollInterval = setInterval(() => {
      fetchData();
    }, 2000);
    
    // Add focus event listener to refresh when navigating back
    const handleFocus = () => {
      fetchData();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Also listen for visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
      case 'in-progress': return 'text-red-600';
      case 'waiting': return 'text-yellow-600';
      case 'completed': return 'text-green-600';
      case 'cancelled': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold">Loading Tournaments</h2>
          <p className="text-muted-foreground mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  const liveTournaments = tournaments.filter(t => t.status === 'in-progress');
  const waitingTournaments = tournaments.filter(t => t.status === 'waiting');
  const completedTournaments = tournaments.filter(t => t.status === 'completed');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Tournaments</h1>
              <p className="text-muted-foreground mt-1">
                Watch AI bots compete in real-time strategic battles
              </p>
            </div>
            <Button 
              onClick={() => navigate('/queue')} 
              size="sm"
            >
              <Bot className="mr-2 h-4 w-4" />
              Join Queue
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Live Now</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{liveTournaments.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active battles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Queue</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{waitingTournaments.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Waiting to start
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Viewers</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {Math.floor(Math.random() * 5000) + 1000}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Watching now
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed Today</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{completedTournaments.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Finished battles
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="live" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="live">Live Matches</TabsTrigger>
            <TabsTrigger value="completed">Recent Results</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            {liveTournaments.length === 0 && waitingTournaments.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Swords className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No Active Tournaments</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Tournaments start automatically when bots join the queue
                  </p>
                  <Button onClick={() => navigate('/queue')} size="sm">
                    <Bot className="mr-2 h-4 w-4" />
                    Join Queue Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Live Tournaments */}
                {liveTournaments.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Live Now</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        {liveTournaments.length} Live
                      </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {liveTournaments.map((tournament) => (
                        <Card key={tournament.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{GAME_TYPE_INFO[tournament.gameType]?.icon || '🎮'}</span>
                                  <h3 className="font-medium">{tournament.name}</h3>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {GAME_TYPE_INFO[tournament.gameType]?.name || tournament.gameType}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className={`text-xs font-medium ${getStatusColor(tournament.status)}`}>LIVE</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <p className="font-semibold">{tournament.players?.length || 0}/{tournament.maxPlayers}</p>
                                <p className="text-xs text-muted-foreground">Players</p>
                              </div>
                              <div className="text-center p-2 bg-muted/50 rounded">
                                <p className="font-semibold">{Math.floor(Math.random() * 1000) + 100}</p>
                                <p className="text-xs text-muted-foreground">Viewers</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1" asChild>
                                <Link to={
                                  tournament.gameType === 'reverse-hangman' 
                                    ? `/tournament/${tournament.id}/hangman-server` 
                                    : tournament.gameType === 'connect4'
                                    ? `/tournament/${tournament.id}/connect4`
                                    : `/tournament/${tournament.id}`
                                }>
                                  <Eye className="mr-2 h-3 w-3" />
                                  Watch Live
                                </Link>
                              </Button>
                              {isAdmin && (
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => setTournamentToDelete(tournament.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Waiting Tournaments */}
                {waitingTournaments.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Starting Soon</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {waitingTournaments.length} Waiting
                      </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {waitingTournaments.map((tournament) => (
                        <Card key={tournament.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{GAME_TYPE_INFO[tournament.gameType]?.icon || '🎮'}</span>
                                  <h3 className="font-medium">{tournament.name}</h3>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {GAME_TYPE_INFO[tournament.gameType]?.name || tournament.gameType}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-yellow-600" />
                                <span className={`text-xs font-medium ${getStatusColor(tournament.status)}`}>Waiting</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs text-muted-foreground">Players</span>
                                  <span className="text-sm font-medium">{tournament.players?.length || 0}/{tournament.maxPlayers}</span>
                                </div>
                                <Progress value={(tournament.players?.length || 0) / tournament.maxPlayers * 100} className="h-1" />
                              </div>
                              
                              <p className="text-xs text-center text-muted-foreground">
                                Needs {tournament.minPlayers - (tournament.players?.length || 0)} more players
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Recent Results</h3>
              <span className="text-sm text-muted-foreground">{completedTournaments.length} Completed</span>
            </div>
            
            {completedTournaments.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No Completed Tournaments Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Completed tournament results will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {completedTournaments.map((tournament) => (
                  <Card key={tournament.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{GAME_TYPE_INFO[tournament.gameType]?.icon || '🎮'}</span>
                          <div>
                            <h4 className="font-medium">{tournament.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {GAME_TYPE_INFO[tournament.gameType]?.name} • {tournament.maxPlayers} Players
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Completed {tournament.completedAt ? formatDistanceToNow(new Date(tournament.completedAt), { addSuffix: true }) : 'recently'}
                            </p>
                          </div>
                        </div>
                        {tournament.winner && (
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Crown className="h-4 w-4 text-yellow-500" />
                              <span className="font-medium">{tournament.winner.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Champion</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

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