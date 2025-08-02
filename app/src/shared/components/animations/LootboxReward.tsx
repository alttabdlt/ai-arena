import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Trophy, Sparkles, Star } from 'lucide-react';
import { LootboxReward, RARITY_COLORS } from '@shared/types/lootbox';

interface LootboxRewardDisplayProps {
  reward: LootboxReward | null;
  visible?: boolean;
  onContinue?: () => void;
}

export const LootboxRewardDisplay: React.FC<LootboxRewardDisplayProps> = ({ reward, visible = true, onContinue }) => {
  if (!reward || !visible) return null;

  const rarityColor = RARITY_COLORS[reward.item.rarity];
  const Icon = reward.item.rarity === 'legendary' ? Trophy : reward.item.rarity === 'epic' ? Sparkles : Star;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 15 }}
      className="absolute inset-0 flex items-center justify-center z-20"
    >
      <Card className="w-80 shadow-2xl" style={{ borderColor: rarityColor }}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Icon className="w-12 h-12" style={{ color: rarityColor }} />
          </div>
          <CardTitle className="text-2xl">{reward.item.name}</CardTitle>
          <CardDescription>{reward.item.type}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <Badge 
            variant="outline" 
            className="text-lg px-4 py-1"
            style={{ borderColor: rarityColor, color: rarityColor }}
          >
            {reward.item.rarity.toUpperCase()}
          </Badge>
          
          {reward.item.description && (
            <p className="text-sm text-muted-foreground">{reward.item.description}</p>
          )}
          
          {reward.item.value !== undefined && (
            <div className="text-2xl font-bold">
              Value: {reward.item.value}
            </div>
          )}
          
          {/* For future extensibility - items may have stats */}
          {(reward.item as any).stats && (
            <div className="space-y-1 text-sm">
              {Object.entries((reward.item as any).stats).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize">{key}:</span>
                  <span className="font-medium">+{String(value)}</span>
                </div>
              ))}
            </div>
          )}
          
          {onContinue && (
            <Button 
              onClick={onContinue}
              className="mt-4"
              variant="default"
            >
              Continue
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};