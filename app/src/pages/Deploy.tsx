import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMutation } from '@apollo/client';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Bot, Loader2, ArrowLeft, Sparkles, DollarSign } from 'lucide-react';
import { useToast } from '@shared/hooks/use-toast';
import { CREATE_BOT } from '@/graphql/mutations';

const PERSONALITIES = [
  {
    value: 'CRIMINAL',
    label: 'Criminal',
    icon: '🔫',
    description: 'Aggressive and risky, +20% XP on underdogs',
    xpMultiplier: 1.2
  },
  {
    value: 'GAMBLER',
    label: 'Gambler',
    icon: '🎲',
    description: 'Balanced approach, +15% XP on favorites',
    xpMultiplier: 1.0
  },
  {
    value: 'WORKER',
    label: 'Worker',
    icon: '🛠️',
    description: 'Consistent grinder, +10% XP on all bets',
    xpMultiplier: 1.5
  }
];


const DeployPage = () => {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [botName, setBotName] = useState('');
  const [personality, setPersonality] = useState('');
  const [deploying, setDeploying] = useState(false);
  
  const address = publicKey?.toString();

  const [createBot] = useMutation(CREATE_BOT, {
    onCompleted: () => {
      toast({
        title: "Bot Deployed!",
        description: `${botName} has been successfully deployed and is ready to earn XP!`,
      });
      navigate('/metaverse');
    },
    onError: (error) => {
      toast({
        title: "Deployment Failed",
        description: error.message,
        variant: "destructive"
      });
      setDeploying(false);
    }
  });

  const handleDeploy = async () => {
    if (!botName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your bot",
        variant: "destructive"
      });
      return;
    }

    if (!personality) {
      toast({
        title: "Personality Required",
        description: "Please select a personality for your bot",
        variant: "destructive"
      });
      return;
    }

    setDeploying(true);

    // Use the actual mutation
    await createBot({
      variables: {
        input: {
          name: botName,
          personality,
          txHash: 'test-deployment-' + Date.now() // Placeholder for testing
        }
      }
    });
  };

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <Bot className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-4">
            Connect your wallet to deploy a bot
          </p>
          <Button onClick={() => navigate('/')} variant="default">
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/metaverse')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Bots
            </Button>
          </div>
        </div>

        {/* Main Deploy Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Bot className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">Deploy Your Bot</CardTitle>
            <CardDescription>
              Create an AI bot that earns XP in the idle game
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Bot Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Bot Name</label>
              <Input
                placeholder="Enter a unique name for your bot"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                maxLength={30}
                disabled={deploying}
              />
              <p className="text-xs text-muted-foreground">
                {botName.length}/30 characters
              </p>
            </div>

            {/* Personality Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Personality</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PERSONALITIES.map((p) => (
                  <Card
                    key={p.value}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      personality === p.value ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setPersonality(p.value)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{p.icon}</span>
                        <Badge variant={personality === p.value ? 'default' : 'outline'}>
                          {p.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.description}
                      </p>
                      <div className="mt-2 flex items-center text-xs">
                        <Sparkles className="h-3 w-3 mr-1 text-yellow-500" />
                        <span className="text-yellow-600 font-medium">
                          {p.xpMultiplier}x XP
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Cost Information */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Deployment Cost</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">FREE</p>
                    <p className="text-xs text-muted-foreground">Limited time offer</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deploy Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleDeploy}
              disabled={deploying || !botName.trim() || !personality}
            >
              {deploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Deploy Bot
                </>
              )}
            </Button>

            {/* Info Text */}
            <p className="text-xs text-center text-muted-foreground">
              Your bot will start earning XP immediately after deployment
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeployPage;