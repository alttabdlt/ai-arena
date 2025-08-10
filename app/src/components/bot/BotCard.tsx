import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Progress } from '@ui/progress';
import { Bot, Trophy, Zap, Shield, Coins, Activity, Eye, Play, Package, Trash2, MoreVertical, Pause } from 'lucide-react';
import { StardewSpriteSelector, BotPersonality } from '@/services/stardewSpriteSelector';
import { BotInventoryModal } from './BotInventoryModal';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/dropdown-menu';

interface BotData {
  id: string;
  tokenId: number;
  name: string;
  avatar: string;
  modelType: string;
  personality: string;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
  channel?: string;
  stats: {
    wins: number;
    losses: number;
    earnings: string;
    winRate: number;
  };
  energy?: {
    currentEnergy: number;
    maxEnergy: number;
    isPaused: boolean;
    consumptionRate: number;
    regenerationRate: number;
    netConsumption: number;
  };
  queuePosition?: number | null;
  equipment?: any[];
  house?: any;
  lootboxRewards?: any[];
}

interface BotCardProps {
  bot: BotData;
  onQueue?: () => void;
  onManage?: () => void;
  onDelete?: () => void;
}

export function BotCard({ bot, onQueue, onManage, onDelete }: BotCardProps) {
  const navigate = useNavigate();
  const [spriteData, setSpriteData] = useState<{ 
    imageData: string; 
  }>({
    imageData: ''
  });
  const [spriteSelector] = useState(() => new StardewSpriteSelector());

  useEffect(() => {
    // Use existing avatar if available
    if (bot.avatar && bot.avatar.startsWith('data:image')) {
      setSpriteData({ imageData: bot.avatar });
    } else {
      // Select sprite based on personality
      spriteSelector.selectSprite(
        bot.personality as BotPersonality,
        bot.id // Use bot ID as seed for consistent sprites
      ).then(sprite => {
        setSpriteData({ 
          imageData: sprite.imageData 
        });
      }).catch(error => {
        console.error('Failed to generate sprite', error);
      });
    }
  }, [bot.avatar, bot.personality, bot.id, spriteSelector]);

  const formatEarnings = (earnings: string) => {
    const num = parseFloat(earnings);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(0);
  };

  const formatModelType = (modelType: string) => {
    const modelMap: Record<string, string> = {
      'DEEPSEEK_CHAT': 'DeepSeek',
      'GPT_4O': 'GPT-4o',
      'GPT_4O_MINI': 'GPT-4o Mini',
      'CLAUDE_3_5_SONNET': 'Claude 3.5',
      'CLAUDE_3_OPUS': 'Claude Opus',
      'CLAUDE_3_HAIKU': 'Claude Haiku',
      'LLAMA_3_70B': 'Llama 3 70B',
      'MIXTRAL_8X7B': 'Mixtral 8x7B',
    };
    
    return modelMap[modelType] || modelType.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getPersonalityIcon = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL':
        return '🔫';
      case 'GAMBLER':
        return '🎲';
      case 'WORKER':
        return '🛠️';
      default:
        return '🤖';
    }
  };

  const unopenedLootboxes = bot.lootboxRewards?.filter(r => !r.opened).length || 0;

  const getEnergyPercentage = () => {
    if (!bot.energy) return 0;
    return (bot.energy.currentEnergy / bot.energy.maxEnergy) * 100;
  };

  const getEnergyColor = (percentage: number) => {
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTimeRemaining = () => {
    if (!bot.energy || bot.energy.netConsumption <= 0) return 'Infinite';
    const hours = bot.energy.currentEnergy / bot.energy.netConsumption;
    if (hours < 1) return `${Math.floor(hours * 60)}m`;
    if (hours < 24) return `${Math.floor(hours)}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const energyPercentage = getEnergyPercentage();

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-base">{bot.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">#{bot.tokenId}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{formatModelType(bot.modelType)}</span>
              {bot.channel && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                    📺 {bot.channel}
                  </Badge>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {bot.isActive && (
              <div className="w-2 h-2 rounded-full bg-green-500" title="Active" />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {bot.isActive && !bot.queuePosition && onQueue && (
                  <DropdownMenuItem onClick={onQueue}>
                    <Play className="mr-2 h-4 w-4" />
                    Queue for Tournament
                  </DropdownMenuItem>
                )}
                {!bot.isActive && onManage && (
                  <DropdownMenuItem onClick={onManage}>
                    <Zap className="mr-2 h-4 w-4" />
                    Activate Bot
                  </DropdownMenuItem>
                )}
                {!bot.isDemo && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Bot
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Sprite Display */}
        <div className="flex justify-center">
          {spriteData.imageData && (
            <div 
              className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center"
              style={{
                imageRendering: 'pixelated'
              }}
            >
              <img 
                src={spriteData.imageData}
                alt={bot.name}
                className="w-full h-full object-contain"
                style={{
                  imageRendering: 'pixelated'
                }}
              />
            </div>
          )}
        </div>

        {/* Energy Display */}
        {bot.energy && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span className="font-medium">
                  {bot.energy.currentEnergy}/{bot.energy.maxEnergy} ⚡
                </span>
                {bot.energy.isPaused && (
                  <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                    <Pause className="h-2.5 w-2.5 mr-0.5" />
                    Paused
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground">
                {bot.energy.netConsumption > 0 ? `-${bot.energy.netConsumption}/h` : `+${Math.abs(bot.energy.netConsumption)}/h`}
              </span>
            </div>
            <div className="relative">
              <Progress 
                value={energyPercentage} 
                className="h-2"
              />
              <div 
                className={cn(
                  "absolute inset-0 h-2 rounded-full transition-all",
                  getEnergyColor(energyPercentage)
                )}
                style={{ width: `${energyPercentage}%` }}
              />
            </div>
            {!bot.energy.isPaused && bot.energy.netConsumption > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Runs out in: {getTimeRemaining()}
              </p>
            )}
          </div>
        )}

        {/* Queue Status */}
        {bot.queuePosition && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-md p-2 text-center">
            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
              Queue Position: #{bot.queuePosition}
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Win Rate</span>
            <span className="font-medium">{bot.stats.winRate.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">W/L</span>
            <span className="font-medium">{bot.stats.wins}/{bot.stats.losses}</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Earnings</span>
            <span className="font-medium">{formatEarnings(bot.stats.earnings)}</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium">{getPersonalityIcon(bot.personality)} {bot.personality}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => {
              // Show bot stats in a toast or modal instead
              window.alert(`${bot.name}\nWins: ${bot.stats.wins}\nLosses: ${bot.stats.losses}\nWin Rate: ${bot.stats.winRate}%`);
            }}
          >
            Quick Stats
          </Button>
          <BotInventoryModal 
            bot={bot}
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="relative"
              >
                <Package className="h-4 w-4" />
                {unopenedLootboxes > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {unopenedLootboxes}
                  </span>
                )}
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}