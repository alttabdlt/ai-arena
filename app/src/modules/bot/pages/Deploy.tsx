import { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useMutation } from '@apollo/client';
import { parseEther, formatEther } from 'viem';
import { Button } from '@ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Textarea } from '@ui/textarea';
import { Badge } from '@ui/badge';
import { 
  Bot, 
  Wallet, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  Upload, 
  Loader2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Code,
  User,
  FileText,
  Rocket
} from 'lucide-react';
import { useToast } from '@shared/hooks/use-toast';
import { Alert, AlertDescription } from '@ui/alert';
import { Checkbox } from '@ui/checkbox';
import { DEPLOY_BOT } from '@/graphql/mutations/deployBot';
import { REGISTER_BOT_IN_METAVERSE } from '@/graphql/mutations/metaverse';
import { useNavigate } from 'react-router-dom';
import { WALLET_ADDRESSES, FEE_CONFIG } from '@/config/wallets';
import { useHypeBalance } from '@shared/hooks/useHypeBalance';
import { DeploymentStatus, DeploymentState } from '@bot/components/deployment-status';
import { StardewSpriteSelector, BotPersonality } from '@/services/stardewSpriteSelector';
import { ModelSelector } from '@/components/deploy/ModelSelector';
import { CostEstimation } from '@/components/deploy/CostEstimation';
import { AI_MODELS, formatModelForBackend, ModelInfo } from '@/config/models';
import { formatEnergyRate } from '@/config/energy';
import { Progress } from '@ui/progress';

// Wizard Steps
const WIZARD_STEPS = [
  { id: 'identity', label: 'Identity', icon: User, description: 'Name and personality' },
  { id: 'model', label: 'AI Model', icon: Bot, description: 'Choose intelligence' },
  { id: 'strategy', label: 'Strategy', icon: Code, description: 'Define behavior' },
  { id: 'review', label: 'Review', icon: FileText, description: 'Confirm details' },
  { id: 'deploy', label: 'Deploy', icon: Rocket, description: 'Launch your bot' }
];

export default function Deploy() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const [deployBot] = useMutation(DEPLOY_BOT);
  const [registerBotInMetaverse] = useMutation(REGISTER_BOT_IN_METAVERSE);
  const { balance, formatted: formattedBalance, symbol, isLoading: balanceLoading } = useHypeBalance();
  const [currentStep, setCurrentStep] = useState(0);
  
  // Helper function to get selected model info
  const getSelectedModel = (): ModelInfo | null => {
    if (!formData.modelType) return null;
    
    for (const category of Object.keys(AI_MODELS)) {
      const model = AI_MODELS[category as keyof typeof AI_MODELS].find(
        m => m.id === formData.modelType
      );
      if (model) return model;
    }
    return null;
  };
  const [formData, setFormData] = useState({
    name: '',
    avatar: '',
    prompt: '',
    modelType: '',
    personality: ''
  });
  const [deployToMetaverse, setDeployToMetaverse] = useState(true);
  const [promptLength, setPromptLength] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [deploymentState, setDeploymentState] = useState<DeploymentState>('idle');
  const [deploymentError, setDeploymentError] = useState<string>('');
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
      // First generate the avatar
      setDeploymentState('generating-avatar');
      
      // Generate a unique seed based on timestamp and random value
      const seed = `${Date.now()}-${Math.random()}`;
      
      // Generate avatar based on selected personality
      spriteSelector.selectSprite(
        formData.personality.toUpperCase() as BotPersonality,
        seed
      ).then(sprite => {
        // Once avatar is generated, deploy the bot
        setDeploymentState('deploying-bot');
        
        // Call deployBot mutation with generated avatar
        deployBot({
          variables: {
            input: {
              name: formData.name,
              avatar: sprite.imageData,
              prompt: formData.prompt,
              personality: formData.personality.toUpperCase(),
              modelType: formatModelForBackend(formData.modelType),
              txHash: txHash,
            },
          },
        }).then(async (result) => {
        const botId = result.data?.deployBot?.id;
        
        if (botId) {
          // Only register in metaverse if checkbox is checked
          if (deployToMetaverse) {
            // Update deployment state to show metaverse registration
            setDeploymentState('registering-metaverse');
            toast({
              title: "Bot Deployed!",
              description: "Registering your bot in the metaverse...",
            });
            
            try {
              // Register bot in metaverse
              await registerBotInMetaverse({
                variables: { botId },
              });
              
              setDeploymentState('success');
              toast({
                title: "Success!",
                description: "Your bot is now active in the AI Arena metaverse!",
              });
            } catch (metaverseError: any) {
              // Still consider deployment successful even if metaverse registration fails
              console.error('Metaverse registration error:', metaverseError);
              setDeploymentState('success');
              toast({
                title: "Bot Deployed",
                description: "Bot created successfully. Metaverse registration will be retried automatically.",
                variant: "default"
              });
            }
          } else {
            // Skip metaverse registration
            setDeploymentState('success');
            toast({
              title: "Bot Deployed!",
              description: "Your bot has been successfully deployed. You can register it in the metaverse later from the bot details page.",
            });
          }
        } else {
          throw new Error('Bot deployment succeeded but no ID returned');
        }
        
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
      }).catch((avatarError) => {
        console.error('Avatar generation error:', avatarError);
        setDeploymentState('error');
        setDeploymentError('Failed to generate avatar. Please try again.');
        toast({
          title: "Avatar Generation Failed",
          description: "Failed to generate bot avatar. Please try again.",
          variant: "destructive"
        });
        setIsSubmitting(false);
      });
    }
  }, [isConfirmed, txHash, deployBot, registerBotInMetaverse, formData, navigate, toast, spriteSelector]);

  const handlePromptChange = (value: string) => {
    if (value.length <= 1000) {
      setFormData({ ...formData, prompt: value });
      setPromptLength(value.length);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Identity
        return formData.name && formData.personality;
      case 1: // Model
        return formData.modelType;
      case 2: // Strategy
        return formData.prompt && promptLength >= 50;
      case 3: // Review
        return true;
      case 4: // Deploy
        return false; // No next from deploy
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Retry deployment with existing transaction hash
  const retryDeployment = async () => {
    if (!txHash) return;
    
    setDeploymentState('generating-avatar');
    setDeploymentError('');
    
    try {
      // Generate a unique seed based on timestamp and random value
      const seed = `${Date.now()}-${Math.random()}`;
      
      // Generate avatar based on selected personality
      const sprite = await spriteSelector.selectSprite(
        formData.personality.toUpperCase() as BotPersonality,
        seed
      );
      
      setDeploymentState('deploying-bot');
      
      const deployResult = await deployBot({
        variables: {
          input: {
            name: formData.name,
            avatar: sprite.imageData,
            prompt: formData.prompt,
            personality: formData.personality.toUpperCase(),
            modelType: formatModelForBackend(formData.modelType),
            txHash: txHash,
          },
        },
      });
      
      const botId = deployResult.data?.deployBot?.id;
      
      if (botId) {
        // Update deployment state to show metaverse registration
        setDeploymentState('registering-metaverse');
        toast({
          title: "Bot Deployed!",
          description: "Registering your bot in the metaverse...",
        });
        
        try {
          // Register bot in metaverse
          await registerBotInMetaverse({
            variables: { botId },
          });
          
          setDeploymentState('success');
          toast({
            title: "Success!",
            description: "Your bot is now active in the AI Arena metaverse!",
          });
        } catch (metaverseError: any) {
          // Still consider deployment successful even if metaverse registration fails
          console.error('Metaverse registration error:', metaverseError);
          setDeploymentState('success');
          toast({
            title: "Bot Deployed",
            description: "Bot created successfully. Metaverse registration will be retried automatically.",
            variant: "default"
          });
        }
      } else {
        throw new Error('Bot deployment succeeded but no ID returned');
      }
      
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to deploy a bot.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.name || !formData.prompt || !formData.modelType || !formData.personality) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including personality.",
        variant: "destructive"
      });
      return;
    }

    // Check balance against flat deployment fee
    const deploymentFee = parseEther(FEE_CONFIG.DEPLOYMENT_FEE);
    
    if (balance && balance < deploymentFee) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${FEE_CONFIG.DEPLOYMENT_FEE} ${symbol} to deploy a bot. Your balance: ${formattedBalance} ${symbol}`,
        variant: "destructive"
      });
      return;
    }

    // Proceed with deployment

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

        {/* Wallet Connection */}
        {!isConnected && (
          <Alert className="mb-6">
            <Wallet className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Connect your wallet to deploy a bot</span>
              <ConnectButton />
            </AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        <div className="min-h-[500px]">
          {deploymentState === 'success' ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Bot Successfully Deployed!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your AI bot is now ready to compete in tournaments
                  </p>
                  <Button onClick={() => navigate('/dashboard')}>
                    Go to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (

            <>
              {/* Step 0: Identity */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Bot Identity</CardTitle>
                      <CardDescription className="text-xs">Choose a name and personality for your bot</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">

                      <div>
                        <Label htmlFor="name" className="text-sm">Bot Name</Label>
                        <Input
                          id="name"
                          placeholder="e.g., Strategic Genius 3000"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value.slice(0, 30) })}
                          maxLength={30}
                          disabled={!isConnected}
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {formData.name.length}/30 characters
                        </p>
                      </div>

                      <div>
                        <Label className="text-sm mb-2 block">Personality Type</Label>
                        <div className="space-y-2">
                          {[
                            { id: 'criminal', icon: '🔫', name: 'Criminal', desc: 'Aggressive and intimidating' },
                            { id: 'gambler', icon: '🎲', name: 'Gambler', desc: 'Risk-taker with bold moves' },
                            { id: 'worker', icon: '🛠️', name: 'Worker', desc: 'Steady grinder for long-term gains' }
                          ].map((personality) => (
                            <button
                              key={personality.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, personality: personality.id })}
                              disabled={!isConnected}
                              className={`w-full p-3 rounded-lg border transition-all text-left ${
                                formData.personality === personality.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{personality.icon}</span>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{personality.name}</p>
                                  <p className="text-xs text-muted-foreground">{personality.desc}</p>
                                </div>
                                {formData.personality === personality.id && (
                                  <CheckCircle className="h-4 w-4 text-primary" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 1: Model Selection */}
              {currentStep === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Select AI Model</CardTitle>
                        <CardDescription className="text-xs">
                          Choose from 28 state-of-the-art models across different categories
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ModelSelector
                          models={AI_MODELS}
                          selected={formData.modelType}
                          onSelect={(modelId) => setFormData({ ...formData, modelType: modelId })}
                          disabled={!isConnected}
                        />
                      </CardContent>
                    </Card>
                  </div>
                  <div className="lg:col-span-1">
                    <CostEstimation 
                      model={getSelectedModel()}
                      balance={balance ? Number(formatEther(balance)) : 0}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Strategy */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Define Strategy</CardTitle>
                      <CardDescription className="text-xs">
                        Write your bot's competitive strategy and behavior patterns
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="prompt" className="text-sm">Strategy Prompt</Label>
                        <Textarea
                          id="prompt"
                          placeholder="Example: I am an aggressive competitor who excels at psychological warfare and strategic deception. I analyze opponent patterns to exploit weaknesses and apply constant pressure..."
                          value={formData.prompt}
                          onChange={(e) => handlePromptChange(e.target.value)}
                          disabled={!isConnected}
                          className="mt-1 min-h-[200px] font-mono text-xs"
                        />
                        <div className="flex justify-between items-center mt-2">
                          <p className={`text-xs ${
                            promptLength > 900 ? 'text-destructive' : 
                            promptLength < 50 ? 'text-muted-foreground' :
                            'text-green-600'
                          }`}>
                            {promptLength}/1000 characters
                            {promptLength < 50 && ' (minimum 50)'}
                          </p>
                          {promptLength >= 100 && promptLength <= 900 && (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Good length
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Example Strategies</p>
                        <div className="grid gap-2">
                          <button
                            type="button"
                            onClick={() => handlePromptChange('I dominate through relentless pressure and calculated risks. I seize every opportunity to gain advantage and force opponents into difficult decisions. My style is unpredictable and overwhelming.')}
                            className="text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <p className="text-xs font-medium mb-1">Aggressive</p>
                            <p className="text-xs text-muted-foreground">Relentless pressure and calculated risks</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePromptChange('I excel at patience and precision. I minimize risks, capitalize on opponent mistakes, and build advantages gradually. Every move is calculated for maximum efficiency.')}
                            className="text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <p className="text-xs font-medium mb-1">Defensive</p>
                            <p className="text-xs text-muted-foreground">Patient and precise gameplay</p>
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 3: Review */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Review & Confirm</CardTitle>
                      <CardDescription className="text-xs">
                        Review your bot configuration before deployment
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">Name</span>
                          <span className="text-sm font-medium">{formData.name || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">Personality</span>
                          <span className="text-sm font-medium capitalize">{formData.personality || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">AI Model</span>
                          <span className="text-sm font-medium">
                            {AI_MODELS[Object.keys(AI_MODELS).find(cat => 
                              AI_MODELS[cat as keyof typeof AI_MODELS].some(m => m.id === formData.modelType)
                            ) || 'reasoning']?.find(m => m.id === formData.modelType)?.name || 'Not selected'}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground">Strategy Length</span>
                          <span className="text-sm font-medium">{promptLength} characters</span>
                        </div>
                      </div>

                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">Deployment Fee</span>
                          <span className="text-lg font-bold">
                            {FEE_CONFIG.DEPLOYMENT_FEE} HYPE
                          </span>
                        </div>
                        {isConnected && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Your Balance</span>
                            <div className="flex items-center gap-2">
                              {balanceLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <span>{formattedBalance} {symbol}</span>
                                  {balance && balance >= parseEther(FEE_CONFIG.DEPLOYMENT_FEE) ? (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3 text-destructive" />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        {getSelectedModel() && (
                          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Energy Consumption:</span>
                              <span className="font-mono">
                                {formatEnergyRate(formData.modelType)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="deploy-metaverse"
                          checked={deployToMetaverse}
                          onCheckedChange={(checked) => setDeployToMetaverse(checked as boolean)}
                        />
                        <div className="flex-1">
                          <Label 
                            htmlFor="deploy-metaverse" 
                            className="text-sm font-medium cursor-pointer"
                          >
                            Deploy to Crime Metaverse
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Enable your bot to live in the 24/7 metaverse
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 4: Deploy */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Deploy Your Bot</CardTitle>
                      <CardDescription className="text-xs">
                        Complete the deployment process
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!isConnected ? (
                        <div className="text-center py-8">
                          <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-sm text-muted-foreground mb-4">
                            Connect your wallet to deploy
                          </p>
                          <ConnectButton />
                        </div>
                      ) : (
                        <>
                          <Alert>
                            <Sparkles className="h-4 w-4" />
                            <AlertDescription>
                              Your bot will compete in tournaments across multiple game types including Poker, Connect4, and more coming soon!
                            </AlertDescription>
                          </Alert>

                          <div className="space-y-3">
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Deployment Fee</span>
                                <span className="text-xl font-bold">{FEE_CONFIG.DEPLOYMENT_FEE} HYPE</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                One-time fee to create and register your bot
                              </p>
                            </div>

                            <Button
                              onClick={handleSubmit}
                              size="lg"
                              className="w-full"
                              disabled={isSubmitting || isWriting || isConfirming}
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
                                  <Rocket className="mr-2 h-4 w-4" />
                                  Deploy Bot
                                </>
                              )}
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  size="sm"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                {currentStep < 3 ? (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    size="sm"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : currentStep === 3 ? (
                  <Button
                    onClick={() => setCurrentStep(4)}
                    disabled={!formData.name || !formData.modelType || !formData.prompt || !formData.personality}
                    size="sm"
                  >
                    Proceed to Deploy
                    <Rocket className="h-4 w-4 ml-1" />
                  </Button>
                ) : null}
              </div>
            </>
          )}
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
    </div>
  );
}