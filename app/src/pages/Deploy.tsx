import { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useMutation } from '@apollo/client';
import { parseEther } from 'viem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bot, Wallet, Brain, Zap, AlertCircle, Info, CheckCircle, Upload, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DEPLOY_BOT } from '@/graphql/mutations/deployBot';
import { useNavigate } from 'react-router-dom';
import { WALLET_ADDRESSES, FEE_CONFIG } from '@/config/wallets';
import { AllTestsRunner } from '@/components/poker/AllTestsRunner';

// Available bot avatars
const AVATARS = [
  { id: 'bot-strategist', name: 'The Strategist', icon: '🎯' },
  { id: 'bot-terminator', name: 'The Terminator', icon: '🤖' },
  { id: 'bot-zen-master', name: 'Zen Master', icon: '🧘' },
  { id: 'bot-calculator', name: 'The Calculator', icon: '🧮' },
  { id: 'bot-eagle', name: 'Eagle Eye', icon: '🦅' },
  { id: 'bot-fox', name: 'Sly Fox', icon: '🦊' },
  { id: 'bot-warrior', name: 'The Warrior', icon: '⚔️' },
  { id: 'bot-sage', name: 'The Sage', icon: '🦉' },
  { id: 'bot-dragon', name: 'Dragon', icon: '🐉' },
  { id: 'bot-phoenix', name: 'Phoenix', icon: '🔥' }
];

// Game Types
const GAME_TYPES = [
  { id: 'poker', name: 'Texas Hold\'em Poker', icon: '🃏', description: 'Classic poker with bluffing and strategy' },
  { id: 'chess', name: 'Chess', icon: '♟️', description: 'The ultimate strategy game', status: 'coming-soon' },
  { id: 'go', name: 'Go', icon: '⚫', description: 'Ancient game of territorial control', status: 'coming-soon' },
  { id: 'hangman', name: 'Hangman', icon: '📝', description: 'Word guessing game', status: 'coming-soon' },
  { id: 'blackjack', name: 'Blackjack', icon: '🎰', description: 'Beat the dealer at 21', status: 'coming-soon' }
];

// AI Models
const AI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', icon: Brain, color: 'text-green-500' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', icon: Zap, color: 'text-purple-500' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', icon: Brain, color: 'text-purple-600' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', icon: Zap, color: 'text-blue-500' }
];

export default function Deploy() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const [deployBot] = useMutation(DEPLOY_BOT);
  const [formData, setFormData] = useState({
    name: '',
    avatar: '',
    prompt: '',
    modelType: ''
  });
  const [promptLength, setPromptLength] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [testGameType, setTestGameType] = useState<string>('');
  const [allTestsPassed, setAllTestsPassed] = useState(false);
  
  const { sendTransaction, data: hash, error: sendError, isPending: isWriting } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Update txHash when writeContract succeeds
  useEffect(() => {
    if (hash) {
      setTxHash(hash);
    }
  }, [hash]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && txHash) {
      // Call deployBot mutation
      deployBot({
        variables: {
          input: {
            name: formData.name,
            avatar: formData.avatar,
            prompt: formData.prompt,
            modelType: formData.modelType.toUpperCase().replace('-', '_'),
            txHash: txHash,
          },
        },
      }).then((result) => {
        toast({
          title: "Bot Deployed Successfully!",
          description: "Your bot has been added to the matchmaking queue.",
        });
        
        // Reset form
        setFormData({
          name: '',
          avatar: '',
          prompt: '',
          modelType: ''
        });
        setPromptLength(0);
        setIsSubmitting(false);
        setTxHash(undefined);
        
        // Navigate to bots page
        navigate('/bots');
      }).catch((error) => {
        console.error('Bot deployment error:', error);
        toast({
          title: "Bot Deployment Failed",
          description: error.message || "Failed to deploy bot.",
          variant: "destructive"
        });
        setIsSubmitting(false);
      });
    }
  }, [isConfirmed, txHash, deployBot, formData, navigate, toast]);

  const handlePromptChange = (value: string) => {
    if (value.length <= 1000) {
      setFormData({ ...formData, prompt: value });
      setPromptLength(value.length);
      // Reset test status when prompt changes
      if (allTestsPassed) {
        setAllTestsPassed(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to deploy a bot.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.name || !formData.avatar || !formData.prompt || !formData.modelType) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (!allTestsPassed) {
      toast({
        title: "Tests Not Passed",
        description: "Your bot must pass all test scenarios before deployment. Please select poker in the test section and run all tests.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Send deployment fee transaction to deployment wallet
      sendTransaction({
        to: WALLET_ADDRESSES.DEPLOYMENT_WALLET as `0x${string}`,
        value: parseEther(FEE_CONFIG.DEPLOYMENT_FEE),
      });
    } catch (error) {
      console.error('Deployment error:', error);
      toast({
        title: "Deployment Failed",
        description: "Failed to send deployment transaction.",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Deploy Your AI Bot</h1>
          <p className="text-muted-foreground">
            Create an AI competitor with a custom strategy and watch it battle in tournaments across multiple games.
          </p>
        </div>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Deployment Fee:</strong> {FEE_CONFIG.DEPLOYMENT_FEE} HYPE per bot. Your bot will automatically enter the matchmaking queue and compete in tournaments. Winners earn HYPE prizes!
          </AlertDescription>
        </Alert>

        {!isConnected && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Connect Your Wallet</h3>
                  <p className="text-sm text-muted-foreground">
                    You need to connect your wallet to deploy a bot
                  </p>
                </div>
                <ConnectButton />
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Multi-Game Competition Info */}
            <Card>
              <CardHeader>
                <CardTitle>Multi-Game Competition</CardTitle>
                <CardDescription>Your bot will compete across multiple game types</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Spin-the-Wheel System:</strong> Your bot will be randomly assigned to different games during tournaments. 
                    Write a universal strategy that can adapt to any competitive scenario - from poker bluffs to chess tactics.
                    Currently supporting: Texas Hold'em Poker (Chess, Go, Hangman, and more coming soon!)
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Bot Name */}
            <Card>
              <CardHeader>
                <CardTitle>Bot Identity</CardTitle>
                <CardDescription>Choose a name and avatar for your bot</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Bot Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Strategic Genius 3000"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.slice(0, 30) })}
                    maxLength={30}
                    disabled={!isConnected}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.name.length}/30 characters
                  </p>
                </div>

                <div>
                  <Label>Avatar</Label>
                  <div className="grid grid-cols-5 gap-3 mt-2">
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, avatar: avatar.id })}
                        disabled={!isConnected}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          formData.avatar === avatar.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="text-2xl mb-1">{avatar.icon}</div>
                        <div className="text-xs">{avatar.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Model Selection */}
            <Card>
              <CardHeader>
                <CardTitle>AI Model</CardTitle>
                <CardDescription>Select the AI model that will power your bot</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {AI_MODELS.map((model) => {
                    const Icon = model.icon;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, modelType: model.id });
                          // Reset test status when model changes
                          if (allTestsPassed) {
                            setAllTestsPassed(false);
                          }
                        }}
                        disabled={!isConnected}
                        className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                          formData.modelType === model.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Icon className={`h-5 w-5 ${model.color}`} />
                        <span className="font-medium">{model.name}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Strategy Prompt */}
            <Card>
              <CardHeader>
                <CardTitle>Strategy Prompt</CardTitle>
                <CardDescription>
                  Define your bot's competitive strategy and personality (1000 characters max)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Example: I am an aggressive competitor who excels at psychological warfare and strategic deception. I analyze opponent patterns to exploit weaknesses and apply constant pressure. I balance risk and reward carefully, adapting my strategy based on game state. When behind, I look for high-value opportunities to turn the tide..."
                  value={formData.prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  disabled={!isConnected}
                  className="min-h-[150px] font-mono text-sm"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className={`text-sm ${
                    promptLength > 900 ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {promptLength}/1000 characters
                  </p>
                  {promptLength >= 100 && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Good length
                    </Badge>
                  )}
                </div>

                {/* Example Prompts */}
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Example Strategies:</p>
                  <div className="space-y-2">
                    <Alert>
                      <AlertDescription className="text-xs">
                        <strong>Aggressive:</strong> "I dominate through relentless pressure and calculated risks. I seize every opportunity to gain advantage and force opponents into difficult decisions. My style is unpredictable and overwhelming."
                      </AlertDescription>
                    </Alert>
                    <Alert>
                      <AlertDescription className="text-xs">
                        <strong>Defensive:</strong> "I excel at patience and precision. I minimize risks, capitalize on opponent mistakes, and build advantages gradually. Every move is calculated for maximum efficiency."
                      </AlertDescription>
                    </Alert>
                    <Alert>
                      <AlertDescription className="text-xs">
                        <strong>Adaptive:</strong> "I analyze and counter opponent strategies in real-time. Against aggressive players, I use their momentum against them. Against defensive players, I probe for weaknesses systematically."
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Test Bot Response */}
            <Card>
              <CardHeader>
                <CardTitle>Test Your Strategy</CardTitle>
                <CardDescription>Test how your universal strategy performs in specific games</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Select value={testGameType} onValueChange={setTestGameType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a game to test" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="poker">Texas Hold'em Poker</SelectItem>
                      <SelectItem value="chess" disabled>Chess (Coming Soon)</SelectItem>
                      <SelectItem value="go" disabled>Go (Coming Soon)</SelectItem>
                      <SelectItem value="hangman" disabled>Hangman (Coming Soon)</SelectItem>
                      <SelectItem value="blackjack" disabled>Blackjack (Coming Soon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {testGameType === 'poker' && (
                  <AllTestsRunner
                    prompt={formData.prompt}
                    modelType={formData.modelType}
                    isDisabled={!isConnected || isSubmitting}
                    onTestsComplete={setAllTestsPassed}
                  />
                )}
                
                {testGameType && testGameType !== 'poker' && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Test scenarios for {GAME_TYPES.find(g => g.id === testGameType)?.name} are coming soon. 
                      Your bot will still be able to compete in all games using its universal strategy.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Test Requirement Notice */}
            {!allTestsPassed && testGameType === 'poker' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Tests Required:</strong> You must pass all 5 test scenarios before you can deploy your bot. 
                  This ensures your bot can handle various game situations properly.
                </AlertDescription>
              </Alert>
            )}
            
            {allTestsPassed && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  <strong>Tests Passed!</strong> Your bot has successfully passed all test scenarios and is ready for deployment.
                </AlertDescription>
              </Alert>
            )}

            {/* Deployment Fee */}
            <Card>
              <CardHeader>
                <CardTitle>Deployment Fee</CardTitle>
                <CardDescription>One-time fee to deploy your bot</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div>
                    <p className="font-semibold">Standard Deployment</p>
                    <p className="text-sm text-muted-foreground">Bot enters queue immediately</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{FEE_CONFIG.DEPLOYMENT_FEE} HYPE</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="submit"
                size="lg"
                className="flex-1"
                disabled={!isConnected || isSubmitting || isWriting || isConfirming || !allTestsPassed}
              >
                {isWriting ? (
                  <>
                    <Wallet className="mr-2 h-4 w-4 animate-pulse" />
                    Confirm in Wallet...
                  </>
                ) : isConfirming ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Confirming Transaction...
                  </>
                ) : isSubmitting ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Deploying Bot...
                  </>
                ) : !allTestsPassed ? (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Pass Tests to Deploy
                  </>
                ) : (
                  <>
                    <Bot className="mr-2 h-4 w-4" />
                    Deploy Bot
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}