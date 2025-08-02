import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Progress } from '@ui/progress';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  Clock,
  Wallet,
  Upload,
  AlertCircle
} from 'lucide-react';
import { useChainId } from 'wagmi';

export type DeploymentState = 
  | 'idle'
  | 'wallet-signature'
  | 'transaction-pending'
  | 'transaction-confirming'
  | 'deploying-bot'
  | 'success'
  | 'error';

interface DeploymentStatusProps {
  state: DeploymentState;
  txHash?: string;
  error?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  onClose?: () => void;
  onRetry?: () => void;
  estimatedTime?: number; // in seconds
}

export function DeploymentStatus({ 
  state, 
  txHash, 
  error, 
  confirmations = 0,
  requiredConfirmations = 3,
  onClose,
  onRetry,
  estimatedTime = 30 
}: DeploymentStatusProps) {
  const chainId = useChainId();
  const [progress, setProgress] = useState(0);
  
  // Progress bar animation
  useEffect(() => {
    if (state === 'transaction-confirming') {
      // Calculate progress based on confirmations
      const confirmationProgress = (confirmations / requiredConfirmations) * 100;
      setProgress(confirmationProgress);
    } else if (state === 'success') {
      setProgress(100);
    } else if (state === 'idle' || state === 'error') {
      setProgress(0);
    }
  }, [state, confirmations, requiredConfirmations]);

  const getExplorerUrl = (hash: string) => {
    const baseUrl = chainId === 999 
      ? 'https://explorer.hyperliquid.xyz/tx/'
      : 'https://explorer.hyperliquid-testnet.xyz/tx/';
    return `${baseUrl}${hash}`;
  };

  const getStateConfig = () => {
    switch (state) {
      case 'wallet-signature':
        return {
          icon: Wallet,
          title: 'Confirm in Wallet',
          description: 'Please confirm the transaction in your wallet',
          color: 'text-blue-500',
          showProgress: false,
        };
      
      case 'transaction-pending':
        return {
          icon: Upload,
          title: 'Sending Transaction',
          description: 'Transaction is being sent to the network',
          color: 'text-orange-500',
          showProgress: false,
        };
      
      case 'transaction-confirming':
        return {
          icon: Clock,
          title: 'Confirming Transaction',
          description: `Waiting for blockchain confirmations (${confirmations}/${requiredConfirmations})`,
          color: 'text-yellow-500',
          showProgress: true,
        };
      
      case 'deploying-bot':
        return {
          icon: Loader2,
          title: 'Deploying Bot',
          description: 'Creating your bot on the platform',
          color: 'text-purple-500',
          showProgress: false,
        };
      
      case 'success':
        return {
          icon: CheckCircle2,
          title: 'Bot Deployed Successfully!',
          description: 'Your bot has been deployed and is ready to compete',
          color: 'text-green-500',
          showProgress: false,
        };
      
      case 'error':
        return {
          icon: XCircle,
          title: 'Deployment Failed',
          description: error || 'An error occurred during deployment',
          color: 'text-red-500',
          showProgress: false,
        };
      
      default:
        return null;
    }
  };

  const config = getStateConfig();
  
  if (!config || state === 'idle') return null;
  
  const Icon = config.icon;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Deployment Status</span>
          <Badge variant={state === 'success' ? 'default' : state === 'error' ? 'destructive' : 'secondary'}>
            {state.replace('-', ' ').toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className={`${config.color} animate-pulse`}>
            <Icon className={`h-8 w-8 ${state === 'deploying-bot' || state === 'transaction-confirming' ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">{config.title}</h4>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
        
        {config.showProgress && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            {state === 'transaction-confirming' && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Confirmations received</span>
                <span className="font-medium">{confirmations} / {requiredConfirmations}</span>
              </div>
            )}
          </div>
        )}
        
        {txHash && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="text-sm">
              <p className="text-muted-foreground">Transaction Hash</p>
              <p className="font-mono text-xs">{txHash.slice(0, 10)}...{txHash.slice(-8)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <a href={getExplorerUrl(txHash)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </a>
            </Button>
          </div>
        )}
        
        {state === 'error' && (
          <div className="flex items-start space-x-2 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="text-sm text-destructive">
              {error || 'Transaction failed. Please try again.'}
            </div>
          </div>
        )}
        
        {(state === 'success' || state === 'error') && (onClose || onRetry) && (
          <div className="flex gap-2">
            {onRetry && state === 'error' && (
              <Button 
                onClick={onRetry} 
                variant="default"
                className="flex-1"
              >
                Retry Deployment
              </Button>
            )}
            {onClose && (
              <Button 
                onClick={onClose} 
                variant={state === 'success' ? 'default' : 'outline'}
                className={onRetry && state === 'error' ? 'flex-1' : 'w-full'}
              >
                {state === 'success' ? 'View Your Bot' : 'Close'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}