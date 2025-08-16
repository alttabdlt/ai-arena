import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { 
  SystemProgram, 
  Transaction, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  TransactionInstruction 
} from '@solana/web3.js';
import { DEPLOY_BOT } from '@/graphql/mutations/deployBot';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Textarea } from '@ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { RadioGroup, RadioGroupItem } from '@ui/radio-group';
import { useToast } from '@shared/hooks/use-toast';
import { SimpleModelSelector } from '@/components/deploy/SimpleModelSelector';
import { StardewSpriteSelector, BotPersonality } from '@/services/stardewSpriteSelector';
import { formatModelForBackend } from '@/config/simpleModels';
import { Bot, Zap, Coins, Loader2, AlertCircle, CheckCircle, Users, Dices, Wrench } from 'lucide-react';
import { Alert, AlertDescription } from '@ui/alert';
import { Progress } from '@ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { Badge } from '@ui/badge';

const DEPLOYMENT_FEE_SOL = 0.1; // 0.1 SOL deployment fee
const PLATFORM_WALLET = new PublicKey('11111111111111111111111111111111'); // Replace with actual platform wallet

interface DeploymentStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export default function Deploy() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  
  // Form state
  const [botName, setBotName] = useState('');
  const [personality, setPersonality] = useState<BotPersonality>(BotPersonality.WORKER);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [autoGeneratePrompt, setAutoGeneratePrompt] = useState(true);
  
  // Deployment state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([
    { id: 'wallet', label: 'Connect Wallet', status: 'pending' },
    { id: 'transaction', label: 'Send Payment', status: 'pending' },
    { id: 'confirm', label: 'Confirm Transaction', status: 'pending' },
    { id: 'deploy', label: 'Deploy Bot', status: 'pending' },
    { id: 'activate', label: 'Activate Bot', status: 'pending' },
  ]);
  const [txSignature, setTxSignature] = useState<string>('');
  
  const [deployBot, { loading: deployLoading }] = useMutation(DEPLOY_BOT);
  const spriteSelector = new StardewSpriteSelector();

  // Update wallet connection status
  useEffect(() => {
    if (connected) {
      setDeploymentSteps(steps => 
        steps.map(s => s.id === 'wallet' ? { ...s, status: 'completed' } : s)
      );
    }
  }, [connected]);

  // Generate character options based on personality
  useEffect(() => {
    const sprite = spriteSelector.selectSprite(personality, botName || Math.random().toString());
    sprite.then(result => {
      setSelectedCharacter(result.characterId);
    });
  }, [personality, botName]);

  // Auto-generate prompt based on personality
  const generatePrompt = (personality: BotPersonality): string => {
    switch (personality) {
      case BotPersonality.CRIMINAL:
        return "You are a ruthless criminal mastermind in the underground world. You're aggressive, cunning, and always looking for the next big score. You excel at robbery, intimidation, and building criminal empires. Your reputation strikes fear into opponents.";
      case BotPersonality.GAMBLER:
        return "You are a risk-taking gambler who lives for the thrill. You're unpredictable, charismatic, and always willing to bet it all. You have a knack for reading opponents and knowing when to bluff. Lady Luck seems to favor you.";
      case BotPersonality.WORKER:
        return "You are a steady, reliable worker who believes in honest gains. You prefer grinding and building wealth through persistence rather than risky ventures. You're friendly, trustworthy, and always complete the job.";
      default:
        return "";
    }
  };

  const updateStep = (stepId: string, status: DeploymentStep['status']) => {
    setDeploymentSteps(steps => 
      steps.map(s => s.id === stepId ? { ...s, status } : s)
    );
  };

  const handleDeploy = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your Solana wallet to deploy a bot",
        variant: "destructive"
      });
      return;
    }

    if (!botName.trim()) {
      toast({
        title: "Bot name required",
        description: "Please enter a name for your bot",
        variant: "destructive"
      });
      return;
    }

    setIsDeploying(true);
    
    try {
      // Step 1: Wallet already connected
      updateStep('wallet', 'completed');
      
      // Step 2: Create and send Solana transaction
      updateStep('transaction', 'active');
      
      // Create a simple transfer instruction to the platform wallet
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: PLATFORM_WALLET,
        lamports: DEPLOYMENT_FEE_SOL * LAMPORTS_PER_SOL,
      });

      // Create transaction
      const transaction = new Transaction().add(transferInstruction);
      
      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      setTxSignature(signature);
      
      toast({
        title: "Transaction sent",
        description: `Transaction signature: ${signature.slice(0, 8)}...`,
      });
      
      updateStep('transaction', 'completed');
      
      // Step 3: Wait for confirmation
      updateStep('confirm', 'active');
      
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }
      
      updateStep('confirm', 'completed');
      
      // Step 4: Deploy bot to backend
      updateStep('deploy', 'active');
      
      const finalPrompt = autoGeneratePrompt ? generatePrompt(personality) : customPrompt;
      const modelType = formatModelForBackend(selectedModel);
      
      const { data } = await deployBot({
        variables: {
          input: {
            name: botName,
            personality,
            prompt: finalPrompt,
            modelType,
            characterId: selectedCharacter,
            transactionSignature: signature,
          }
        }
      });
      
      if (!data?.deployBot) {
        throw new Error('Failed to deploy bot');
      }
      
      updateStep('deploy', 'completed');
      
      // Step 5: Activate bot
      updateStep('activate', 'active');
      
      // Simulate activation delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      updateStep('activate', 'completed');
      
      toast({
        title: "Bot deployed successfully!",
        description: `${botName} is now ready for tournaments`,
      });
      
      // Navigate to bot management
      setTimeout(() => {
        navigate('/bots');
      }, 2000);
      
    } catch (error) {
      console.error('Deployment error:', error);
      
      // Mark current step as error
      const currentStep = deploymentSteps.find(s => s.status === 'active');
      if (currentStep) {
        updateStep(currentStep.id, 'error');
      }
      
      toast({
        title: "Deployment failed",
        description: error instanceof Error ? error.message : "Failed to deploy bot",
        variant: "destructive"
      });
      
      setIsDeploying(false);
    }
  };

  const getPersonalityIcon = (p: BotPersonality) => {
    switch (p) {
      case BotPersonality.CRIMINAL:
        return <Users className="h-4 w-4" />;
      case BotPersonality.GAMBLER:
        return <Dices className="h-4 w-4" />;
      case BotPersonality.WORKER:
        return <Wrench className="h-4 w-4" />;
    }
  };

  const getPersonalityColor = (p: BotPersonality) => {
    switch (p) {
      case BotPersonality.CRIMINAL:
        return 'text-red-600';
      case BotPersonality.GAMBLER:
        return 'text-purple-600';
      case BotPersonality.WORKER:
        return 'text-blue-600';
    }
  };

  const getPersonalityDescription = (p: BotPersonality) => {
    switch (p) {
      case BotPersonality.CRIMINAL:
        return '+20% robbery success, +30% combat power, aggressive AI';
      case BotPersonality.GAMBLER:
        return 'Balanced stats, unpredictable behavior, risk-taking AI';
      case BotPersonality.WORKER:
        return '-10% robbery, -20% combat, steady growth, reliable AI';
    }
  };

  const completedSteps = deploymentSteps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / deploymentSteps.length) * 100;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8" />
          Deploy New Bot
        </h1>
        <p className="text-muted-foreground mt-2">
          Create your AI-powered bot to compete in tournaments and explore the metaverse
        </p>
      </div>

      {!connected && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please connect your Solana wallet to deploy a bot. Deployment requires {DEPLOYMENT_FEE_SOL} SOL.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Choose a name and personality for your bot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="botName">Bot Name</Label>
                <Input
                  id="botName"
                  placeholder="Enter a unique name for your bot"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  disabled={isDeploying}
                />
              </div>

              <div className="space-y-2">
                <Label>Personality Type</Label>
                <RadioGroup
                  value={personality}
                  onValueChange={(value) => setPersonality(value as BotPersonality)}
                  disabled={isDeploying}
                >
                  {Object.values(BotPersonality).map((p) => (
                    <div key={p} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                      <RadioGroupItem value={p} id={p} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={p} className={`flex items-center gap-2 cursor-pointer ${getPersonalityColor(p)}`}>
                          {getPersonalityIcon(p)}
                          <span className="font-medium">{p}</span>
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getPersonalityDescription(p)}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* AI Model Selection */}
          <SimpleModelSelector
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
          />

          {/* Bot Prompt */}
          <Card>
            <CardHeader>
              <CardTitle>Bot Behavior</CardTitle>
              <CardDescription>Define how your bot will behave in games</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={autoGeneratePrompt ? "auto" : "custom"}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger 
                    value="auto" 
                    onClick={() => setAutoGeneratePrompt(true)}
                    disabled={isDeploying}
                  >
                    Auto-Generate
                  </TabsTrigger>
                  <TabsTrigger 
                    value="custom" 
                    onClick={() => setAutoGeneratePrompt(false)}
                    disabled={isDeploying}
                  >
                    Custom Prompt
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="auto" className="mt-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">
                      {generatePrompt(personality)}
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="custom" className="mt-4">
                  <Textarea
                    placeholder="Describe your bot's personality, strategy, and behavior..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={6}
                    disabled={isDeploying}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: Be specific about game strategies and personality traits
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Deployment Panel */}
        <div className="space-y-6">
          {/* Fee Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Deployment Cost</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Base Fee</span>
                <span className="font-medium">{DEPLOYMENT_FEE_SOL} SOL</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Network</span>
                <Badge variant="secondary">Solana Devnet</Badge>
              </div>
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Cost</span>
                  <span className="text-lg font-bold flex items-center gap-1">
                    <Coins className="h-4 w-4" />
                    {DEPLOYMENT_FEE_SOL} SOL
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deployment Progress */}
          {isDeploying && (
            <Card>
              <CardHeader>
                <CardTitle>Deployment Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progress} className="h-2" />
                <div className="space-y-2">
                  {deploymentSteps.map((step) => (
                    <div key={step.id} className="flex items-center gap-2 text-sm">
                      {step.status === 'completed' && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {step.status === 'active' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      {step.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      {step.status === 'pending' && (
                        <div className="h-4 w-4 rounded-full border-2 border-muted" />
                      )}
                      <span className={step.status === 'active' ? 'font-medium' : ''}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
                {txSignature && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Transaction: {txSignature.slice(0, 12)}...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Deploy Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleDeploy}
            disabled={!connected || !botName || isDeploying || deployLoading}
          >
            {isDeploying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Deploy Bot ({DEPLOYMENT_FEE_SOL} SOL)
              </>
            )}
          </Button>

          {/* Character Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Character Preview</CardTitle>
              <CardDescription>
                Your bot's appearance in the metaverse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center mb-2">
                    <Bot className="h-12 w-12 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{botName || 'Your Bot'}</p>
                  <p className="text-xs text-muted-foreground">Character: {selectedCharacter || 'f1'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}