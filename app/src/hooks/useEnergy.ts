import { useQuery, useMutation } from '@apollo/client';
import { useState } from 'react';
import { useToast } from '@shared/hooks/use-toast';
import { 
  GET_BOT_ENERGY, 
  GET_USER_BOTS_ENERGY 
} from '@/graphql/queries/energy';
import { 
  PURCHASE_ENERGY, 
  PAUSE_BOT, 
  RESUME_BOT 
} from '@/graphql/mutations/energy';

export interface BotEnergy {
  currentEnergy: number;
  maxEnergy: number;
  isPaused: boolean;
  consumptionRate: number;
  regenerationRate: number;
  netConsumption: number;
}

export interface EnergyPack {
  type: 'small' | 'medium' | 'large' | 'mega';
  energy: number;
  cost: number;
  discount?: string;
}

// Energy packs priced in SOL for Solana
export const ENERGY_PACKS: EnergyPack[] = [
  { type: 'small', energy: 100, cost: 0.01 },
  { type: 'medium', energy: 500, cost: 0.04, discount: '20%' },
  { type: 'large', energy: 1000, cost: 0.08, discount: '30%' },
  { type: 'mega', energy: 5000, cost: 0.35, discount: '40%' }
];

export function useEnergy(botId?: string) {
  const { toast } = useToast();
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null);

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error';
  };

  // Query bot energy
  const { data: energyData, loading: energyLoading, refetch: refetchEnergy } = useQuery(GET_BOT_ENERGY, {
    variables: { botId },
    skip: !botId,
    pollInterval: 60000, // Poll every minute for energy updates
  });

  // Query all user bots energy
  const { data: allBotsEnergyData, loading: allBotsLoading, refetch: refetchAllBots } = useQuery(GET_USER_BOTS_ENERGY, {
    pollInterval: 60000,
  });

  // Mutations
  const [purchaseEnergyMutation] = useMutation(PURCHASE_ENERGY, {
    refetchQueries: ['GetBotEnergy', 'GetUserBotsEnergy'],
  });

  const [pauseBotMutation] = useMutation(PAUSE_BOT, {
    refetchQueries: ['GetBotEnergy', 'GetUserBotsEnergy'],
  });

  const [resumeBotMutation] = useMutation(RESUME_BOT, {
    refetchQueries: ['GetBotEnergy', 'GetUserBotsEnergy'],
  });

  // Purchase energy function (simplified for Solana)
  const purchaseEnergy = async (packType: 'small' | 'medium' | 'large' | 'mega') => {
    if (!botId) {
      toast({
        title: "No Bot Selected",
        description: "Please select a bot to purchase energy for",
        variant: "destructive",
      });
      return;
    }

    const pack = ENERGY_PACKS.find(p => p.type === packType);
    if (!pack) return;

    setPurchasingPack(packType);

    // Placeholder for Solana transaction
    toast({
      title: "Energy Purchase",
      description: `Energy purchase with Solana will be available soon. Cost: ${pack.cost} SOL`,
    });
    
    setPurchasingPack(null);
  };

  // Pause bot function
  const pauseBot = async () => {
    if (!botId) return;

    try {
      await pauseBotMutation({ variables: { botId } });
      toast({
        title: "Bot Paused",
        description: "Your bot has been paused to save energy",
      });
    } catch (error: unknown) {
      toast({
        title: "Failed to Pause",
        description: getErrorMessage(error) || "Could not pause bot",
        variant: "destructive",
      });
    }
  };

  // Resume bot function
  const resumeBot = async () => {
    if (!botId) return;

    try {
      await resumeBotMutation({ variables: { botId } });
      toast({
        title: "Bot Resumed",
        description: "Your bot is now active again",
      });
    } catch (error: unknown) {
      toast({
        title: "Failed to Resume",
        description: getErrorMessage(error) || "Could not resume bot",
        variant: "destructive",
      });
    }
  };

  // Calculate time remaining with current energy
  const getTimeRemaining = (energy?: BotEnergy) => {
    if (!energy || energy.netConsumption <= 0) return Infinity;
    const hours = energy.currentEnergy / energy.netConsumption;
    return hours;
  };

  // Get energy status color
  const getEnergyColor = (percentage: number): string => {
    if (percentage > 50) return 'green';
    if (percentage > 20) return 'yellow';
    return 'red';
  };

  // Calculate energy percentage
  const getEnergyPercentage = (energy?: BotEnergy): number => {
    if (!energy) return 0;
    return (energy.currentEnergy / energy.maxEnergy) * 100;
  };

  return {
    // Data
    energy: energyData?.botEnergy as BotEnergy | undefined,
    allBotsEnergy: allBotsEnergyData?.userBotsEnergy || [],
    energyPacks: ENERGY_PACKS,
    
    // Loading states
    loading: energyLoading || allBotsLoading,
    purchasing: false,
    purchasingPack,
    
    // Actions
    purchaseEnergy,
    pauseBot,
    resumeBot,
    refetchEnergy,
    refetchAllBots,
    
    // Helpers
    getTimeRemaining,
    getEnergyColor,
    getEnergyPercentage,
  };
}
