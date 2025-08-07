import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Coins, TrendingUp, Activity, Battery, AlertCircle } from 'lucide-react';
import { ModelInfo } from '@/config/models';
import { 
  formatEnergyRate, 
  getDailyEnergyConsumption, 
  getRuntime, 
  canRunFree,
  STARTING_ENERGY,
  TOURNAMENT_ENERGY_COST
} from '@/config/energy';
import { FEE_CONFIG } from '@/config/wallets';

interface CostEstimationProps {
  model: ModelInfo | null;
  balance?: number;
}


export function CostEstimation({ model, balance = 0 }: CostEstimationProps) {
  const deploymentFee = parseFloat(FEE_CONFIG.DEPLOYMENT_FEE);
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

  return (
    <div className="space-y-4">
      {/* Energy Consumption */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Energy Consumption
        </h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Rate</span>
            <span className="font-medium">{formatEnergyRate(model.id)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Daily usage</span>
            <span className="font-mono">{getDailyEnergyConsumption(model.id)} ⚡</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Runtime on 100⚡</span>
            <span className="font-mono">{getRuntime(100, model.id)} hours</span>
          </div>
          {canRunFree(model.id) && (
            <div className="p-2 bg-green-50 dark:bg-green-950 rounded-md">
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ This model can run 24/7 on free energy regeneration
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Deployment Cost */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Coins className="h-4 w-4" />
          Deployment Cost
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">One-time fee (all models)</span>
            <span className="font-mono font-semibold">{deploymentFee} HYPE</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Starting energy</span>
            <span className="font-mono">{STARTING_ENERGY} ⚡</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Your balance</span>
            <span className={`font-mono ${canAfford ? 'text-green-600' : 'text-red-600'}`}>
              {balance.toFixed(1)} HYPE
            </span>
          </div>
          {!canAfford && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded-md">
              <p className="text-xs text-red-600 dark:text-red-400">
                Insufficient balance. You need {(deploymentFee - balance).toFixed(1)} more HYPE.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Energy Packs */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Battery className="h-4 w-4" />
          Energy Packs
        </h4>
        <div className="space-y-2">
          {Object.entries(FEE_CONFIG.ENERGY_PACKS).map(([size, pack]) => (
            <div key={size} className="flex justify-between items-center py-1">
              <div>
                <span className="text-sm capitalize">{size}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({pack.energy} ⚡)
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm">{pack.cost} HYPE</span>
                <span className="text-xs text-muted-foreground block">
                  {(pack.cost / pack.energy * 1000).toFixed(1)} HYPE/1000⚡
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            <p>Free regeneration: 1 ⚡/hour (24 ⚡/day)</p>
            <p>Tournament cost: {TOURNAMENT_ENERGY_COST} ⚡ per match</p>
          </div>
        </div>
      </Card>

      {/* Tips */}
      <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Tips
        </h4>
        <div className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
          <p>• Start with free energy to test your bot</p>
          <p>• Premium models consume energy faster</p>
          <p>• Pause bots to save energy when not competing</p>
          <p>• Buy larger packs for better value</p>
        </div>
      </Card>
    </div>
  );
}