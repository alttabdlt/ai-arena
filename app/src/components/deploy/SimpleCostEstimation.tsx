import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Coins, Activity, AlertCircle } from 'lucide-react';
import { SimpleModelInfo } from '@/config/simpleModels';
import { FEE_CONFIG } from '@/config/wallets';

interface SimpleCostEstimationProps {
  model: SimpleModelInfo | null;
  balance?: number;
}

export function SimpleCostEstimation({ model, balance = 0 }: SimpleCostEstimationProps) {
  const deploymentFee = model ? parseFloat(model.deploymentFee) : 0;
  const canAfford = balance >= deploymentFee;

  if (!model) {
    return (
      <Card className="p-4 border-dashed">
        <div className="text-center text-muted-foreground">
          <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a model to see cost estimation</p>
        </div>
      </Card>
    );
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'budget':
        return 'text-green-600 dark:text-green-400';
      case 'standard':
        return 'text-blue-600 dark:text-blue-400';
      case 'premium':
        return 'text-purple-600 dark:text-purple-400';
      case 'elite':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Model Tier */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Model Details
        </h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tier</span>
            <Badge className={getTierColor(model.tier)} variant="outline">
              {model.tier.charAt(0).toUpperCase() + model.tier.slice(1)}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Energy per match</span>
            <span className="font-medium">{model.energyPerMatch} ⚡</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Starting energy</span>
            <Badge variant="secondary">100 ⚡</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Energy regenerates at 1 per hour (24 ⚡/day)
          </div>
        </div>
      </Card>

      {/* Deployment Cost */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Coins className="h-4 w-4" />
          Deployment Cost
        </h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Model fee</span>
            <span className="font-medium">{model.deploymentFee} HYPE</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Your balance</span>
            <Badge variant={canAfford ? "secondary" : "destructive"}>
              {balance.toFixed(2)} HYPE
            </Badge>
          </div>
          {!canAfford && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>Need {(deploymentFee - balance).toFixed(2)} more HYPE</span>
            </div>
          )}
        </div>
      </Card>

      {/* Tier Benefits */}
      <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Tier Benefits
        </h4>
        <div className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
          {model.tier === 'budget' && (
            <>
              <p>• Most cost-effective option</p>
              <p>• Low energy consumption</p>
              <p>• Great for testing strategies</p>
            </>
          )}
          {model.tier === 'standard' && (
            <>
              <p>• Balanced performance</p>
              <p>• Moderate energy usage</p>
              <p>• Good competitive capability</p>
            </>
          )}
          {model.tier === 'premium' && (
            <>
              <p>• Advanced reasoning</p>
              <p>• Superior game analysis</p>
              <p>• Tournament ready</p>
            </>
          )}
          {model.tier === 'elite' && (
            <>
              <p>• Top-tier intelligence</p>
              <p>• Championship performance</p>
              <p>• Maximum win potential</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}