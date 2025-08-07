import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ui/dialog';
import { Button } from '@ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Progress } from '@ui/progress';
import { Zap, Pause, Play, TrendingUp, Package } from 'lucide-react';
import { useEnergy, ENERGY_PACKS } from '@/hooks/useEnergy';
import { cn } from '@/lib/utils';
import { ENERGY_RATES } from '@/config/energy';

interface EnergyPurchaseModalProps {
  botId: string;
  botName: string;
  modelType: string;
  trigger?: React.ReactNode;
}

export function EnergyPurchaseModal({ 
  botId, 
  botName, 
  modelType,
  trigger 
}: EnergyPurchaseModalProps) {
  const [open, setOpen] = useState(false);
  const {
    energy,
    purchasing,
    purchasingPack,
    purchaseEnergy,
    pauseBot,
    resumeBot,
    getTimeRemaining,
    getEnergyPercentage,
    getEnergyColor,
  } = useEnergy(botId);

  const consumptionRate = ENERGY_RATES[modelType] || 1;
  const energyPercentage = getEnergyPercentage(energy);
  const timeRemaining = getTimeRemaining(energy);

  const handlePurchase = async (packType: 'small' | 'medium' | 'large' | 'mega') => {
    await purchaseEnergy(packType);
    if (!purchasing) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Zap className="h-4 w-4 mr-1" />
            Energy
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Energy Management - {botName}</DialogTitle>
          <DialogDescription>
            Purchase energy packs or manage your bot's energy consumption
          </DialogDescription>
        </DialogHeader>

        {energy && (
          <div className="space-y-4">
            {/* Current Energy Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Current Energy Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">
                      {energy.currentEnergy}/{energy.maxEnergy} ⚡
                    </span>
                    {energy.isPaused && (
                      <Badge variant="secondary" className="text-xs">
                        <Pause className="h-3 w-3 mr-1" />
                        Paused
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {energyPercentage.toFixed(0)}%
                  </span>
                </div>
                
                <div className="relative">
                  <Progress value={energyPercentage} className="h-3" />
                  <div 
                    className={cn(
                      "absolute inset-0 h-3 rounded-full transition-all",
                      energyPercentage > 50 ? 'bg-green-500' : 
                      energyPercentage > 20 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${energyPercentage}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consumption:</span>
                    <span className="font-medium">-{energy.consumptionRate} ⚡/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Regeneration:</span>
                    <span className="font-medium">+{energy.regenerationRate} ⚡/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Rate:</span>
                    <span className={cn(
                      "font-medium",
                      energy.netConsumption > 0 ? "text-red-600" : "text-green-600"
                    )}>
                      {energy.netConsumption > 0 ? '-' : '+'}{Math.abs(energy.netConsumption)} ⚡/h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time Remaining:</span>
                    <span className="font-medium">
                      {timeRemaining === Infinity ? 'Infinite' : 
                       typeof timeRemaining === 'number' ? 
                         timeRemaining < 1 ? `${Math.floor(timeRemaining * 60)}m` :
                         timeRemaining < 24 ? `${Math.floor(timeRemaining)}h` :
                         `${Math.floor(timeRemaining / 24)}d` : 
                       timeRemaining}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {energy.isPaused ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={resumeBot}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Resume Bot
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={pauseBot}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pause Bot
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Energy Packs */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Purchase Energy Packs</h4>
              <div className="grid grid-cols-2 gap-3">
                {ENERGY_PACKS.map((pack) => (
                  <Card 
                    key={pack.type}
                    className={cn(
                      "relative cursor-pointer transition-all hover:shadow-md",
                      purchasingPack === pack.type && "ring-2 ring-primary"
                    )}
                  >
                    {pack.discount && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 text-xs"
                      >
                        {pack.discount} OFF
                      </Badge>
                    )}
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Package className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs uppercase text-muted-foreground">
                            {pack.type}
                          </span>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{pack.energy} ⚡</p>
                          <p className="text-sm text-muted-foreground">
                            ~{Math.floor(pack.energy / consumptionRate)}h runtime
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handlePurchase(pack.type as any)}
                          disabled={purchasing}
                        >
                          {purchasingPack === pack.type ? (
                            "Processing..."
                          ) : (
                            `${pack.cost} HYPE`
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3" />
                <span className="font-medium">Energy Tips:</span>
              </p>
              <ul className="space-y-1 ml-4">
                <li>• Pausing your bot stops energy consumption</li>
                <li>• All bots regenerate 1 ⚡/hour for free</li>
                <li>• Tournament matches cost 10 ⚡ per game</li>
                <li>• Buy larger packs for better value</li>
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}