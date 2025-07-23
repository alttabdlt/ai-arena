import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Tournament, 
  TournamentPlayer,
  GAME_TYPE_INFO,
  DEMO_BOTS
} from '@/types/tournament';
import { 
  Users, 
  Clock, 
  Play, 
  UserPlus,
  Check,
  X
} from 'lucide-react';

export default function WaitingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isAdmin] = useState(true); // For demo purposes, always admin
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    // Load tournament from sessionStorage (demo)
    const tournamentData = sessionStorage.getItem(`tournament-${id}`);
    if (tournamentData) {
      setTournament(JSON.parse(tournamentData));
    } else {
      toast.error('Tournament not found');
      navigate('/tournaments');
    }
  }, [id, navigate]);

  useEffect(() => {
    // Countdown timer when all players ready
    if (tournament && tournament.players.length >= tournament.minPlayers) {
      const allReady = tournament.players.every(p => p.isReady);
      if (allReady && countdown === null) {
        setCountdown(10);
      }
    }
  }, [tournament, countdown]);

  useEffect(() => {
    // Handle countdown
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      handleStartGame();
    }
  }, [countdown]);

  const handleAddBot = () => {
    if (!tournament || tournament.players.length >= tournament.maxPlayers) return;

    const availableBots = DEMO_BOTS.filter(bot => 
      !tournament.players.some(p => p.name === bot.name)
    );

    if (availableBots.length === 0) {
      toast.error('No more bots available');
      return;
    }

    const newBot = availableBots[0];
    const newPlayer: TournamentPlayer = {
      id: `player-${Date.now()}`,
      name: newBot.name,
      aiModel: newBot.model,
      strategy: newBot.strategy,
      avatar: newBot.avatar,
      status: 'waiting',
      isReady: false,
      joinedAt: new Date()
    };

    const updatedTournament = {
      ...tournament,
      players: [...tournament.players, newPlayer]
    };

    setTournament(updatedTournament);
    sessionStorage.setItem(`tournament-${id}`, JSON.stringify(updatedTournament));
    toast.success(`${newBot.name} joined the tournament`);
  };

  const handleToggleReady = (playerId: string) => {
    if (!tournament) return;

    const updatedPlayers = tournament.players.map(p => 
      p.id === playerId ? { ...p, isReady: !p.isReady } : p
    );

    const updatedTournament = {
      ...tournament,
      players: updatedPlayers
    };

    setTournament(updatedTournament);
    sessionStorage.setItem(`tournament-${id}`, JSON.stringify(updatedTournament));

    // Reset countdown if someone unreadies
    if (!updatedPlayers.every(p => p.isReady)) {
      setCountdown(null);
    }
  };

  const handleStartGame = () => {
    if (!tournament) return;

    const updatedTournament = {
      ...tournament,
      status: 'in-progress' as const,
      startedAt: new Date()
    };

    sessionStorage.setItem(`tournament-${id}`, JSON.stringify(updatedTournament));
    
    // Navigate to appropriate game
    if (tournament.gameType === 'poker') {
      navigate(`/tournament/${id}`);
    } else if (tournament.gameType === 'reverse-hangman') {
      navigate(`/tournament/${id}/hangman`);
    }
  };

  const handleForceStart = () => {
    if (!tournament || tournament.players.length < tournament.minPlayers) {
      toast.error(`Need at least ${tournament.minPlayers} players to start`);
      return;
    }
    handleStartGame();
  };

  const handleCancel = () => {
    setCountdown(null);
  };

  if (!tournament) {
    return <div>Loading...</div>;
  }

  const gameInfo = GAME_TYPE_INFO[tournament.gameType];
  const canStart = tournament.players.length >= tournament.minPlayers;
  const allReady = tournament.players.every(p => p.isReady);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">{tournament.name}</h1>
            <p className="text-gray-700 mt-2">{tournament.description}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-3xl">{gameInfo.icon}</span>
              <span className="text-xl font-semibold">{gameInfo.name}</span>
            </div>
            <Badge variant="outline">
              {tournament.players.length}/{tournament.maxPlayers} Players
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Users className="h-6 w-6" />
                Players
              </h2>
              {isAdmin && tournament.players.length < tournament.maxPlayers && (
                <Button onClick={handleAddBot} size="sm" variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Bot
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {tournament.players.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No players yet. Waiting for players to join...</p>
                </div>
              ) : (
                tournament.players.map((player) => (
                  <div 
                    key={player.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        {player.avatar ? (
                          <img src={player.avatar} alt={player.name} className="w-8 h-8 rounded-full" />
                        ) : (
                          <span className="text-lg font-semibold">
                            {player.name[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold">{player.name}</div>
                        <div className="text-sm text-gray-700">
                          {player.aiModel} • {player.strategy}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {player.isReady ? (
                        <Badge className="bg-green-100 text-green-800">
                          <Check className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          Not Ready
                        </Badge>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleReady(player.id)}
                        >
                          Toggle Ready
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {countdown !== null && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-lg font-semibold">
                  Game starting in {countdown} seconds...
                </p>
                <Button 
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Tournament Settings</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Game Type</span>
                <span className="font-medium">{gameInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Players</span>
                <span className="font-medium">
                  {tournament.minPlayers}-{tournament.maxPlayers}
                </span>
              </div>
              {tournament.gameType === 'poker' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Starting Chips</span>
                    <span className="font-medium">
                      {tournament.config.startingChips?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Max Hands</span>
                    <span className="font-medium">
                      {tournament.config.maxHands === 999999 ? 'Unlimited' : tournament.config.maxHands}
                    </span>
                  </div>
                </>
              )}
              {tournament.gameType === 'reverse-hangman' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Rounds</span>
                    <span className="font-medium">
                      {tournament.config.maxRounds}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Time per Guess</span>
                    <span className="font-medium">
                      {tournament.config.timeLimit}s
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {isAdmin && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Admin Controls</h3>
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={handleForceStart}
                  disabled={!canStart}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Force Start Game
                </Button>
                <p className="text-xs text-gray-700 text-center">
                  {canStart 
                    ? 'Start the game without waiting for all players to be ready'
                    : `Need at least ${tournament.minPlayers} players to start`
                  }
                </p>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Invite Players</h3>
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Share this link with players:
              </p>
              <div className="flex space-x-2">
                <input
                  type="text"
                  readOnly
                  value={window.location.href}
                  className="flex-1 px-3 py-2 border rounded text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success('Link copied!');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}