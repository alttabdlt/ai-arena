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
      case 'in-progress': return 'bg-red-500/20 text-red-700 hover:bg-red-500/30';
      case 'waiting': return 'bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30';
      case 'completed': return 'bg-green-500/20 text-green-700 hover:bg-green-500/30';
      case 'cancelled': return 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30';
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold">Tournaments</h1>
              <p className="text-muted-foreground mt-2">
                Watch AI bots compete in real-time strategic battles
              </p>
            </div>
            <Button 
              onClick={() => navigate('/queue')} 
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Bot className="mr-2 h-5 w-5" />
              Join Queue
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Live Now</CardTitle>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Flame className="h-5 w-5 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{liveTournaments.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Active battles
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Queue</CardTitle>
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{waitingTournaments.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Waiting to start
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Viewers</CardTitle>
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {Math.floor(Math.random() * 5000) + 1000}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Watching now
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{completedTournaments.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
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
                  <Swords className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Active Tournaments</h3>
                  <p className="text-muted-foreground mb-6">
                    Tournaments start automatically when bots join the queue
                  </p>
                  <Button onClick={() => navigate('/queue')} size="lg" className="btn-gaming">
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
                      <h3 className="text-xl font-bold">Live Now</h3>
                      <Badge className="bg-red-500/20 text-red-700">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2" />
                        {liveTournaments.length} LIVE
                      </Badge>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {liveTournaments.map((tournament) => (
                        <Card key={tournament.id} className="hover:shadow-lg transition-all hover:scale-[1.02] border-red-500/20">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-2xl">{GAME_TYPE_INFO[tournament.gameType]?.icon || '🎮'}</span>
                                  <h3 className="text-lg font-bold">{tournament.name}</h3>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {GAME_TYPE_INFO[tournament.gameType]?.name || tournament.gameType}
                                </p>
                              </div>
                              <Badge className={getStatusColor(tournament.status)}>
                                <Play className="h-3 w-3 mr-1" />
                                LIVE
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-2xl font-bold text-primary">{tournament.players?.length || 0}/{tournament.maxPlayers}</p>
                                <p className="text-xs text-muted-foreground">Players</p>
                              </div>
                              <div>
                                <p className="text-2xl font-bold text-accent">{Math.floor(Math.random() * 1000) + 100}</p>
                                <p className="text-xs text-muted-foreground">Viewers</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button className="flex-1" asChild>
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
                                >
                                  <Trash2 className="h-4 w-4" />
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
                      <h3 className="text-xl font-bold">Starting Soon</h3>
                      <Badge className="bg-yellow-500/20 text-yellow-700">
                        <Clock className="h-3 w-3 mr-1" />
                        {waitingTournaments.length} Waiting
                      </Badge>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {waitingTournaments.map((tournament) => (
                        <Card key={tournament.id} className="hover:shadow-lg transition-all hover:scale-[1.02] border-yellow-500/20">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-2xl">{GAME_TYPE_INFO[tournament.gameType]?.icon || '🎮'}</span>
                                  <h3 className="text-lg font-bold">{tournament.name}</h3>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {GAME_TYPE_INFO[tournament.gameType]?.name || tournament.gameType}
                                </p>
                              </div>
                              <Badge className={getStatusColor(tournament.status)}>
                                <Clock className="h-3 w-3 mr-1" />
                                Waiting
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm text-muted-foreground">Players</span>
                                  <span className="font-bold">{tournament.players?.length || 0}/{tournament.maxPlayers}</span>
                                </div>
                                <Progress value={(tournament.players?.length || 0) / tournament.maxPlayers * 100} className="h-2" />
                              </div>
                              
                              <p className="text-sm text-center text-muted-foreground">
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
              <h3 className="text-xl font-bold">Recent Results</h3>
              <Badge variant="outline">{completedTournaments.length} Completed</Badge>
            </div>
            
            {completedTournaments.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Completed Tournaments Yet</h3>
                  <p className="text-muted-foreground">
                    Completed tournament results will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {completedTournaments.map((tournament) => (
                  <Card key={tournament.id} className="hover:shadow-lg transition-all hover:scale-[1.02]">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-3xl">{GAME_TYPE_INFO[tournament.gameType]?.icon || '🎮'}</span>
                          <div>
                            <h4 className="font-bold text-lg">{tournament.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {GAME_TYPE_INFO[tournament.gameType]?.name} • {tournament.maxPlayers} Players
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Completed {tournament.completedAt ? formatDistanceToNow(new Date(tournament.completedAt), { addSuffix: true }) : 'recently'}
                            </p>
                          </div>
                        </div>
                        {tournament.winner && (
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Crown className="h-5 w-5 text-yellow-500" />
                              <span className="font-bold text-lg">{tournament.winner.name}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">Champion</p>
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