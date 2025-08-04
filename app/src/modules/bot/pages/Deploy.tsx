import { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useMutation } from '@apollo/client';
import { parseEther } from 'viem';
import { Button } from '@ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Textarea } from '@ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select';
import { Badge } from '@ui/badge';
import { Bot, Wallet, Brain, Zap, AlertCircle, Info, CheckCircle, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@shared/hooks/use-toast';
import { Alert, AlertDescription } from '@ui/alert';
import { DEPLOY_BOT } from '@/graphql/mutations/deployBot';
import { useNavigate } from 'react-router-dom';
import { WALLET_ADDRESSES, FEE_CONFIG } from '@/config/wallets';
import { useHypeBalance } from '@shared/hooks/useHypeBalance';
import { DeploymentStatus, DeploymentState } from '@bot/components/deployment-status';
import { StardewSpriteSelector, BotPersonality } from '@/services/stardewSpriteSelector';
// Test components temporarily removed - to be reimplemented
// import { AllTestsRunner } from '@/components/poker/AllTestsRunner';
// import { Connect4TestRunner } from '@/components/connect4/Connect4TestRunner';

// Game Types
const GAME_TYPES = [
  { id: 'poker', name: 'Texas Hold\'em Poker', icon: '🃏', description: 'Classic poker with bluffing and strategy' },
  { id: 'connect4', name: 'Connect4', icon: '🔴', description: 'Connect 4 pieces in a row to win' },
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
  const { balance, formatted: formattedBalance, symbol, isLoading: balanceLoading } = useHypeBalance();
  const [formData, setFormData] = useState({
    name: '',
    avatar: '',
    prompt: '',
    modelType: '',
    personality: ''
  });
  const [promptLength, setPromptLength] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [testGameType, setTestGameType] = useState<string>('');
  const [allTestsPassed, setAllTestsPassed] = useState(false);
  const [deploymentState, setDeploymentState] = useState<DeploymentState>('idle');
  const [deploymentError, setDeploymentError] = useState<string>('');
  const [generatedAvatar, setGeneratedAvatar] = useState<{ imageData: string; spritesheetData: any } | null>(null);
  const [spriteSelector] = useState(() => new StardewSpriteSelector());
  
  const { sendTransaction, data: hash, error: sendError, isPending: isWriting } = useSendTransaction();
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    data: receipt 
  } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 3, // Wait for 3 confirmations as required by backend
  });

  // Update txHash and deployment state when transaction is sent
  useEffect(() => {
    if (hash) {
      setTxHash(hash);
      setDeploymentState('transaction-confirming');
    }
  }, [hash]);

  // Generate avatar when personality is selected
  useEffect(() => {
    if (formData.personality) {
      // Generate a unique seed based on timestamp and random value
      const seed = `${Date.now()}-${Math.random()}`;
      
      // Select sprite asynchronously
      spriteSelector.selectSprite(
        formData.personality.toUpperCase() as BotPersonality,
        seed
      ).then(sprite => {
        setGeneratedAvatar({
          imageData: sprite.imageData,
          spritesheetData: sprite.spriteSheetData
        });
        // Set the avatar field to the base64 image data
        setFormData(prev => ({ ...prev, avatar: sprite.imageData }));
      });
    }
  }, [formData.personality, spriteSelector]);

  // Handle transaction errors
  useEffect(() => {
    if (sendError) {
      setDeploymentState('error');
      setDeploymentError(sendError.message || 'Transaction failed');
      setIsSubmitting(false);
    }
  }, [sendError]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && txHash) {
      setDeploymentState('deploying-bot');
      // Call deployBot mutation
      deployBot({
        variables: {
          input: {
            name: formData.name,
            avatar: formData.avatar,
            prompt: formData.prompt,
            personality: formData.personality.toUpperCase(),
            modelType: formData.modelType.toUpperCase().replace('-', '_'),
            txHash: txHash,
          },
        },
      }).then((result) => {
        setDeploymentState('success');
        toast({
          title: "Bot Deployed Successfully!",
          description: "Your bot has been created. You can now manage it from your dashboard.",
        });
        
        // Reset form after a delay
        setTimeout(() => {
          setFormData({
            name: '',
            avatar: '',
            prompt: '',
            modelType: '',
            personality: ''
          });
          setPromptLength(0);
          setIsSubmitting(false);
          setTxHash(undefined);
          setDeploymentState('idle');
          
          // Navigate to dashboard instead of bots page
          navigate('/dashboard');
        }, 2000);
      }).catch((error) => {
        console.error('Bot deployment error:', error);
        setDeploymentState('error');
        
        // Check if it's a confirmation error
        const isConfirmationError = error.message?.includes('Insufficient confirmations');
        
        setDeploymentError(
          isConfirmationError 
            ? "Transaction needs more confirmations. Please wait a moment and try again." 
            : error.message || "Failed to deploy bot."
        );
        
        toast({
          title: "Bot Deployment Failed",
          description: isConfirmationError 
            ? "Transaction needs more confirmations. Please wait and retry."
            : error.message || "Failed to deploy bot.",
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

  // Retry deployment with existing transaction hash
  const retryDeployment = async () => {
    if (!txHash) return;
    
    setDeploymentState('deploying-bot');
    setDeploymentError('');
    
    try {
      await deployBot({
        variables: {
          input: {
            name: formData.name,
            avatar: formData.avatar,
            prompt: formData.prompt,
            personality: formData.personality.toUpperCase(),
            modelType: formData.modelType.toUpperCase().replace('-', '_'),
            txHash: txHash,
          },
        },
      });
      
      setDeploymentState('success');
      toast({
        title: "Bot Deployed Successfully!",
        description: "Your bot has been created. You can now manage it from your dashboard.",
      });
      
      // Reset form after a delay
      setTimeout(() => {
        setFormData({
          name: '',
          avatar: '',
          prompt: '',
          modelType: '',
          personality: ''
        });
        setPromptLength(0);
        setIsSubmitting(false);
        setTxHash(undefined);
        setDeploymentState('idle');
        
        // Navigate to dashboard instead of bots page
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Bot deployment retry error:', error);
      setDeploymentState('error');
      setDeploymentError(error.message || "Failed to deploy bot.");
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to deploy bot.",
        variant: "destructive"
      });
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

    if (!formData.name || !formData.avatar || !formData.prompt || !formData.modelType || !formData.personality) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including personality.",
        variant: "destructive"
      });
      return;
    }

    // Check balance
    const deploymentFee = parseEther(FEE_CONFIG.DEPLOYMENT_FEE);
    if (balance && balance < deploymentFee) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${FEE_CONFIG.DEPLOYMENT_FEE} ${symbol} to deploy a bot. Your balance: ${formattedBalance} ${symbol}`,
        variant: "destructive"
      });
      return;
    }

    // Test requirement temporarily disabled
    // if (!allTestsPassed) {
    //   toast({
    //     title: "Tests Not Passed",
    //     description: "Your bot must pass all test scenarios before deployment. Please select poker in the test section and run all tests.",
    //     variant: "destructive"
    //   });
    //   return;
    // }

    setIsSubmitting(true);
    setDeploymentState('wallet-signature');
    setDeploymentError('');
    
    try {
      // Send deployment fee transaction to deployment wallet
      sendTransaction({
        to: WALLET_ADDRESSES.DEPLOYMENT_WALLET as `0x${string}`,
        value: deploymentFee,
      });
      setDeploymentState('transaction-pending');
    } catch (error) {
      console.error('Deployment error:', error);
      setDeploymentState('error');
      setDeploymentError('Failed to send deployment transaction');
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
            <strong>Deployment Fee:</strong> {FEE_CONFIG.DEPLOYMENT_FEE} HYPE per bot. After deployment, you can manage your bot and enter it into tournaments from your dashboard. Winners earn HYPE prizes!
            {isConnected && !balanceLoading && (
              <div className="mt-2">
                <strong>Your Balance:</strong> {formattedBalance} {symbol}
                {balance && balance < parseEther(FEE_CONFIG.DEPLOYMENT_FEE) && (
                  <Badge variant="destructive" className="ml-2">Insufficient Balance</Badge>
                )}
              </div>
            )}
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
                    Write a universal strategy that can adapt to any competitive scenario - from poker bluffs to Connect4 strategies.
                    Currently supporting: Texas Hold'em Poker and Connect4 (Chess, Go, Hangman, and more coming soon!)
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
                  <Label>Generated Avatar</Label>
                  {generatedAvatar ? (
                    <div className="mt-2 flex items-center gap-4">
                      <div className="border-2 border-primary rounded-lg p-2 bg-muted">
                        <img 
                          src={generatedAvatar.imageData} 
                          alt="Generated bot avatar"
                          className="w-32 h-32 pixelated"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Unique pixel art avatar generated based on personality</p>
                        <p className="mt-1">This will be your bot's appearance in the metaverse</p>
                        <Badge variant="outline" className="mt-2">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Auto-generated
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 p-8 border-2 border-dashed border-border rounded-lg text-center text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Select a personality to generate avatar</p>
                    </div>
                  )}
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

            {/* Bot Personality Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Bot Personality</CardTitle>
                <CardDescription>Choose your bot's personality type for the crime metaverse</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, personality: 'criminal' })}
                    disabled={!isConnected}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      formData.personality === 'criminal'
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-border hover:border-red-500/50'
                    } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🔫</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-500">Criminal</h4>
                        <p className="text-sm text-muted-foreground">
                          Aggressive and intimidating. Focuses on robbery, violence, and forming gangs. Takes what they want by force.
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, personality: 'gambler' })}
                    disabled={!isConnected}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      formData.personality === 'gambler'
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-border hover:border-yellow-500/50'
                    } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🎲</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-yellow-500">Gambler</h4>
                        <p className="text-sm text-muted-foreground">
                          Risk-taker who lives in casinos. Makes bold moves, forms temporary alliances, and has unpredictable loyalty.
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, personality: 'worker' })}
                    disabled={!isConnected}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      formData.personality === 'worker'
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-border hover:border-green-500/50'
                    } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🛠️</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-green-500">Worker</h4>
                        <p className="text-sm text-muted-foreground">
                          Steady grinder who builds value slowly. Avoids conflict, forms stable partnerships, and focuses on long-term gains.
                        </p>
                      </div>
                    </div>
                  </button>
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
                      <SelectItem value="connect4">Connect4</SelectItem>
                      <SelectItem value="chess" disabled>Chess (Coming Soon)</SelectItem>
                      <SelectItem value="go" disabled>Go (Coming Soon)</SelectItem>
                      <SelectItem value="hangman" disabled>Hangman (Coming Soon)</SelectItem>
                      <SelectItem value="blackjack" disabled>Blackjack (Coming Soon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Test runners temporarily disabled - to be reimplemented */}
                {testGameType === 'poker' && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Poker test scenarios are temporarily unavailable. Your bot will still be able to compete.
                    </AlertDescription>
                  </Alert>
                )}
                
                {testGameType === 'connect4' && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Connect4 test scenarios are temporarily unavailable. Your bot will still be able to compete.
                    </AlertDescription>
                  </Alert>
                )}
                
                {testGameType && testGameType !== 'poker' && testGameType !== 'connect4' && (
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
            {!allTestsPassed && (testGameType === 'poker' || testGameType === 'connect4') && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Tests Required:</strong> You must pass all {testGameType === 'poker' ? '5' : '6'} test scenarios before you can deploy your bot. 
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div>
                      <p className="font-semibold">Standard Deployment</p>
                      <p className="text-sm text-muted-foreground">Create and manage your bot</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{FEE_CONFIG.DEPLOYMENT_FEE} HYPE</p>
                    </div>
                  </div>
                  
                  {isConnected && (
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm font-medium">Your Balance</span>
                      <div className="flex items-center gap-2">
                        {balanceLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <span className="font-mono">{formattedBalance} {symbol}</span>
                            {balance && balance >= parseEther(FEE_CONFIG.DEPLOYMENT_FEE) ? (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Sufficient
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Insufficient
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="submit"
                size="lg"
                className="flex-1"
                disabled={!isConnected || isSubmitting || isWriting || isConfirming}
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
                ) : (
                  <>
                    <Bot className="mr-2 h-4 w-4" />
                    Deploy Bot
                  </>
                )}
              </Button>
            </div>

            {/* Deployment Status */}
            <DeploymentStatus 
              state={deploymentState}
              txHash={txHash}
              error={deploymentError}
              confirmations={receipt?.confirmations || 0}
              requiredConfirmations={3}
              onClose={deploymentState === 'error' ? () => {
                setDeploymentState('idle');
                setDeploymentError('');
                setIsSubmitting(false);
              } : undefined}
              onRetry={deploymentError?.includes('confirmations') && txHash ? retryDeployment : undefined}
            />
          </div>
        </form>
      </div>
    </div>
  );
}