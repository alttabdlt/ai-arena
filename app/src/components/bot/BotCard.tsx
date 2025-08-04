import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Bot, Trophy, Zap, Shield, Coins, Activity, Eye, Play, Package } from 'lucide-react';
import { StardewSpriteSelector, BotPersonality } from '@/services/stardewSpriteSelector';
import { BotInventoryModal } from './BotInventoryModal';

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
  stats: {
    wins: number;
    losses: number;
    earnings: string;
    winRate: number;
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
}

export function BotCard({ bot, onQueue, onManage }: BotCardProps) {
  const navigate = useNavigate();
  const [spriteData, setSpriteData] = useState<{ 
    imageData: string; 
  }>({
    imageData: ''
  });
  const [spriteSelector] = useState(() => new StardewSpriteSelector());
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    console.log('BotCard: Sprite generation effect triggered', { 
      botId: bot.id, 
      personality: bot.personality,
      hasAvatar: !!bot.avatar,
      avatarPrefix: bot.avatar?.substring(0, 50)
    });
    
    // Use existing avatar if available
    if (bot.avatar && bot.avatar.startsWith('data:image')) {
      console.log('BotCard: Using existing avatar');
      setSpriteData({ imageData: bot.avatar });
    } else {
      // Select sprite based on personality
      console.log('BotCard: Generating new sprite');
      spriteSelector.selectSprite(
        bot.personality as BotPersonality,
        bot.id // Use bot ID as seed for consistent sprites
      ).then(sprite => {
        console.log('BotCard: Sprite generated', { 
          imageDataLength: sprite.imageData.length,
          imageDataPrefix: sprite.imageData.substring(0, 50)
        });
        setSpriteData({ 
          imageData: sprite.imageData 
        });
      }).catch(error => {
        console.error('BotCard: Failed to generate sprite', error);
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

  const getPersonalityColor = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL':
        return 'text-red-500 border-red-500';
      case 'GAMBLER':
        return 'text-yellow-500 border-yellow-500';
      case 'WORKER':
        return 'text-green-500 border-green-500';
      default:
        return 'text-muted-foreground border-border';
    }
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

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden"
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      onClick={() => navigate(`/bot/${bot.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg truncate">{bot.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                #{bot.tokenId}
              </Badge>
              <Badge variant="outline" className={`text-xs ${getPersonalityColor(bot.personality)}`}>
                {getPersonalityIcon(bot.personality)} {bot.personality}
              </Badge>
            </div>
          </div>
          {bot.isActive ? (
            <Badge variant="default" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Sprite Display */}
        <div className="flex justify-center">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            {spriteData.imageData && (
              <div 
                className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center"
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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              W/L
            </span>
            <span className="font-medium">
              {bot.stats.wins}/{bot.stats.losses}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Rate
            </span>
            <span className="font-medium">
              {bot.stats.winRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground flex items-center gap-1">
              <Coins className="h-3 w-3" />
              Earned
            </span>
            <span className="font-medium">
              {formatEarnings(bot.stats.earnings)}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <span className="text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Model
            </span>
            <span className="font-medium text-xs">
              {bot.modelType}
            </span>
          </div>
        </div>

        {/* Queue Status */}
        {bot.queuePosition && (
          <div className="flex items-center justify-center p-2 bg-primary/10 rounded-lg">
            <Badge variant="outline" className="text-xs">
              Queue Position: #{bot.queuePosition}
            </Badge>
          </div>
        )}

        {/* Inventory Preview */}
        {(bot.lootboxRewards?.length || bot.equipment?.length) && (
          <div className="flex items-center justify-between p-2 bg-muted rounded">
            <span className="text-xs text-muted-foreground">
              {bot.lootboxRewards?.filter(r => !r.opened).length || 0} unopened lootboxes
            </span>
            <span className="text-xs text-muted-foreground">
              {bot.equipment?.length || 0} items equipped
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/bot/${bot.id}`);
              }}
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
            <BotInventoryModal 
              bot={bot}
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <Package className="h-3 w-3 mr-1" />
                  Inventory
                  {bot.lootboxRewards?.filter(r => !r.opened).length ? (
                    <Badge variant="default" className="ml-1 h-4 px-1">
                      {bot.lootboxRewards.filter(r => !r.opened).length}
                    </Badge>
                  ) : null}
                </Button>
              }
            />
          </div>
          {bot.isActive && !bot.queuePosition && (
            <Button
              size="sm"
              variant="default"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onQueue?.();
              }}
            >
              <Play className="h-3 w-3 mr-1" />
              Queue for Tournament
            </Button>
          )}
          {!bot.isActive && (
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onManage?.();
              }}
            >
              <Bot className="h-3 w-3 mr-1" />
              Activate Bot
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}