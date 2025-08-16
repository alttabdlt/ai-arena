import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
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

export type DeploymentState = 
  | 'idle'
  | 'wallet-signature'
  | 'transaction-pending'
  | 'transaction-confirming'
  | 'generating-avatar'
  | 'deploying-bot'
  | 'registering-metaverse'
  | 'success'
  | 'error';

interface DeploymentStatusProps {
  state: DeploymentState;
  error?: string;
  txHash?: string;
  botId?: string;
}

export function DeploymentStatus({ state, error, txHash, botId }: DeploymentStatusProps) {
  const getStatusColor = () => {
    switch (state) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'idle':
        return 'bg-gray-400';
      default:
        return 'bg-blue-500 animate-pulse';
    }
  };

  const getStatusIcon = () => {
    switch (state) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'idle':
        return <Clock className="h-4 w-4" />;
      case 'wallet-signature':
        return <Wallet className="h-4 w-4" />;
      case 'generating-avatar':
      case 'deploying-bot':
      case 'registering-metaverse':
        return <Upload className="h-4 w-4" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'idle':
        return 'Ready to deploy';
      case 'wallet-signature':
        return 'Awaiting wallet signature...';
      case 'transaction-pending':
        return 'Sending transaction...';
      case 'transaction-confirming':
        return 'Confirming transaction...';
      case 'generating-avatar':
        return 'Generating avatar...';
      case 'deploying-bot':
        return 'Deploying bot...';
      case 'registering-metaverse':
        return 'Registering in metaverse...';
      case 'success':
        return 'Deployment complete!';
      case 'error':
        return error || 'Deployment failed';
      default:
        return 'Processing...';
    }
  };

  const getProgress = () => {
    switch (state) {
      case 'idle':
        return 0;
      case 'wallet-signature':
        return 10;
      case 'transaction-pending':
        return 25;
      case 'transaction-confirming':
        return 40;
      case 'generating-avatar':
        return 55;
      case 'deploying-bot':
        return 70;
      case 'registering-metaverse':
        return 85;
      case 'success':
        return 100;
      default:
        return 0;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Deployment Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${getStatusColor()}`} />
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${getProgress()}%` }}
            />
          </div>

          {txHash && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
              <p className="text-xs font-mono break-all">{txHash}</p>
              <a
                href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {botId && state === 'success' && (
            <Badge variant="outline" className="w-fit">
              Bot ID: {botId}
            </Badge>
          )}

          {error && state === 'error' && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Error</span>
              </div>
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}