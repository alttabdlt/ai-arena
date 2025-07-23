import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { 
  GameType, 
  CreateTournamentData, 
  GAME_TYPE_INFO,
  DEMO_BOTS
} from '@/types/tournament';
import { toast } from 'sonner';
import SpinWheel from '@/components/SpinWheel';

export default function CreateTournament() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [gameSelected, setGameSelected] = useState(false);
  
  const [formData, setFormData] = useState<CreateTournamentData>({
    name: '',
    description: '',
    gameType: '' as GameType,
    config: {},
    maxPlayers: 8,
    minPlayers: 2,
    isPublic: true
  });

  const handleGameSelect = (gameType: GameType) => {
    const gameInfo = GAME_TYPE_INFO[gameType];
    setFormData({
      ...formData,
      gameType,
      config: gameInfo.defaultConfig || {},
      minPlayers: gameInfo.minPlayers,
      maxPlayers: gameInfo.maxPlayers
    });
    setGameSelected(true);
    
    setTimeout(() => {
      setStep(2);
    }, 2000);
  };

  const handleConfigUpdate = (key: string, value: any) => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        [key]: value
      }
    });
  };

  const handleCreate = async () => {
    if (!formData.gameType) {
      toast.error('Please select a game type first');
      return;
    }
    
    try {
      // For demo purposes, create a mock tournament
      const tournamentId = `tournament-${Date.now()}`;
      
      // Store in sessionStorage for demo
      const tournament = {
        id: tournamentId,
        ...formData,
        status: 'waiting',
        players: isDemoMode ? DEMO_BOTS.map((bot, index) => ({
          id: `player-${index}`,
          name: bot.name,
          aiModel: bot.model,
          strategy: bot.strategy,
          avatar: bot.avatar,
          status: 'ready',
          isReady: true,
          joinedAt: new Date()
        })) : [],
        createdBy: 'admin',
        createdAt: new Date()
      };
      
      sessionStorage.setItem(`tournament-${tournamentId}`, JSON.stringify(tournament));
      
      toast.success('Tournament created successfully!');
      
      if (isDemoMode) {
        // For demo mode, go directly to game based on game type
        const path = formData.gameType === 'reverse-hangman' 
          ? `/tournament/${tournamentId}/hangman` 
          : `/tournament/${tournamentId}`;
        navigate(path);
      } else {
        // Otherwise go to waiting room
        navigate(`/tournaments/${tournamentId}/waiting`);
      }
    } catch (error) {
      toast.error('Failed to create tournament');
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Spin the Wheel!</h2>
        <p className="text-gray-700">Let fate decide which game your tournament will feature</p>
      </div>

      <div className="flex justify-center">
        <SpinWheel onGameSelected={handleGameSelect} />
      </div>
    </div>
  );

  const renderStep2 = () => {
    if (!formData.gameType) {
      return (
        <div className="space-y-6 text-center">
          <h2 className="text-2xl font-bold mb-2">No Game Selected</h2>
          <p className="text-gray-700">Please go back and spin the wheel to select a game.</p>
          <Button variant="outline" onClick={() => setStep(1)}>
            Back to Spin Wheel
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Configure {GAME_TYPE_INFO[formData.gameType].name}</h2>
          <p className="text-gray-700">Set up the game rules and parameters</p>
        </div>

      {formData.gameType === 'poker' && (
        <div className="space-y-4">
          <div>
            <Label>Starting Chips</Label>
            <select 
              className="w-full mt-1 p-2 border border-gray-300 rounded text-gray-900 bg-white focus:border-primary focus:outline-none"
              value={formData.config.startingChips}
              onChange={(e) => handleConfigUpdate('startingChips', Number(e.target.value))}
            >
              <option value={10000}>10,000</option>
              <option value={25000}>25,000</option>
              <option value={50000}>50,000</option>
              <option value={100000}>100,000</option>
            </select>
          </div>

          <div>
            <Label>Max Hands</Label>
            <select 
              className="w-full mt-1 p-2 border border-gray-300 rounded text-gray-900 bg-white focus:border-primary focus:outline-none"
              value={formData.config.maxHands}
              onChange={(e) => handleConfigUpdate('maxHands', Number(e.target.value))}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={999999}>Unlimited</option>
            </select>
          </div>

          <div>
            <Label>Game Speed</Label>
            <select 
              className="w-full mt-1 p-2 border border-gray-300 rounded text-gray-900 bg-white focus:border-primary focus:outline-none"
              value={formData.config.speed}
              onChange={(e) => handleConfigUpdate('speed', e.target.value)}
            >
              <option value="thinking">Thinking (60s)</option>
              <option value="normal">Normal (30s)</option>
              <option value="fast">Fast (10s)</option>
            </select>
          </div>
        </div>
      )}

      {formData.gameType === 'reverse-hangman' && (
        <div className="space-y-4">
          <div>
            <Label>Rounds</Label>
            <select 
              className="w-full mt-1 p-2 border border-gray-300 rounded text-gray-900 bg-white focus:border-primary focus:outline-none"
              value={formData.config.maxRounds}
              onChange={(e) => handleConfigUpdate('maxRounds', Number(e.target.value))}
            >
              <option value={3}>3 Rounds</option>
              <option value={5}>5 Rounds</option>
              <option value={10}>10 Rounds</option>
            </select>
          </div>

          <div>
            <Label>Time Limit per Guess</Label>
            <select 
              className="w-full mt-1 p-2 border border-gray-300 rounded text-gray-900 bg-white focus:border-primary focus:outline-none"
              value={formData.config.timeLimit}
              onChange={(e) => handleConfigUpdate('timeLimit', Number(e.target.value))}
            >
              <option value={60}>60 seconds</option>
              <option value={120}>120 seconds</option>
              <option value={180}>180 seconds</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Button onClick={() => setStep(3)}>
          Next
        </Button>
      </div>
    </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Tournament Details</h2>
        <p className="text-gray-700">Give your tournament a name and description</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Tournament Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Friday Night Poker Championship"
            className="mt-1"
          />
        </div>

        <div>
          <Label>Description (Optional)</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your tournament..."
            className="mt-1"
            rows={3}
          />
        </div>

        <div>
          <Label>Player Limits</Label>
          <div className="grid grid-cols-2 gap-4 mt-1">
            <div>
              <Input
                type="number"
                value={formData.minPlayers}
                onChange={(e) => setFormData({ ...formData, minPlayers: Number(e.target.value) })}
                min={GAME_TYPE_INFO[formData.gameType].minPlayers}
                max={formData.maxPlayers}
                placeholder="Min players"
              />
            </div>
            <div>
              <Input
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => setFormData({ ...formData, maxPlayers: Number(e.target.value) })}
                min={formData.minPlayers}
                max={GAME_TYPE_INFO[formData.gameType].maxPlayers}
                placeholder="Max players"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="public"
            checked={formData.isPublic}
            onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="public">Make tournament public</Label>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Demo Mode</h3>
        <p className="text-sm text-gray-700 mb-3">
          Instantly fill your tournament with 8 pre-configured AI bots for testing
        </p>
        <Button
          variant={isDemoMode ? "default" : "outline"}
          onClick={() => setIsDemoMode(!isDemoMode)}
        >
          {isDemoMode ? '✓ Demo Mode Enabled' : 'Enable Demo Mode'}
        </Button>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button 
          onClick={handleCreate}
          disabled={!formData.name}
        >
          {isDemoMode ? 'Create & Start Demo' : 'Create Tournament'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Create Tournament</h1>
        <div className="flex items-center space-x-2 mt-4">
          {[1, 2, 3].map((i) => {
            const labels = ['Spin', 'Configure', 'Details'];
            return (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step >= i ? 'bg-primary text-white' : 'bg-gray-200'
                  }`}>
                    {i}
                  </div>
                  <span className="text-xs mt-1 text-gray-600">{labels[i-1]}</span>
                </div>
                {i < 3 && (
                  <div className={`w-20 h-1 mb-6 mx-2 ${
                    step > i ? 'bg-primary' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Card className="p-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </Card>
    </div>
  );
}