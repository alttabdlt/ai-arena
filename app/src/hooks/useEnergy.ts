import { useQuery, useMutation } from '@apollo/client';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { useState, useEffect } from 'react';
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
import { WALLET_ADDRESSES, FEE_CONFIG } from '@/config/wallets';

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

export const ENERGY_PACKS: EnergyPack[] = [
  { type: 'small', energy: 100, cost: 0.5 },
  { type: 'medium', energy: 500, cost: 2.0, discount: '20%' },
  { type: 'large', energy: 1000, cost: 3.5, discount: '30%' },
  { type: 'mega', energy: 5000, cost: 15.0, discount: '40%' }
];

export function useEnergy(botId?: string) {
  const { toast } = useToast();
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

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

  // Transaction hooks
  const { sendTransaction, data: hash, error: sendError, isPending: isWriting } = useSendTransaction();
  
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    data: receipt 
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Update txHash when transaction is sent
  useEffect(() => {
    if (hash) {
      setTxHash(hash);
    }
  }, [hash]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && txHash && purchasingPack && botId) {
      // Call the purchase energy mutation
      purchaseEnergyMutation({
        variables: {
          botId,
          packType: purchasingPack,
          txHash,
        },
      }).then(() => {
        toast({
          title: "Energy Purchased!",
          description: `Successfully added ${FEE_CONFIG.ENERGY_PACKS[purchasingPack as keyof typeof FEE_CONFIG.ENERGY_PACKS].energy} ⚡ to your bot`,
        });
        setPurchasingPack(null);
        setTxHash(undefined);
      }).catch((error) => {
        toast({
          title: "Purchase Failed",
          description: error.message || "Failed to record energy purchase",
          variant: "destructive",
        });
        setPurchasingPack(null);
        setTxHash(undefined);
      });
    }
  }, [isConfirmed, txHash, purchasingPack, botId, purchaseEnergyMutation, toast]);

  // Handle transaction errors
  useEffect(() => {
    if (sendError) {
      toast({
        title: "Transaction Failed",
        description: sendError.message || "Failed to send transaction",
        variant: "destructive",
      });
      setPurchasingPack(null);
      setTxHash(undefined);
    }
  }, [sendError, toast]);

  // Purchase energy function
  const purchaseEnergy = async (packType: 'small' | 'medium' | 'large' | 'mega') => {
    if (!botId) {
      toast({
        title: "No Bot Selected",
        description: "Please select a bot to purchase energy for",
        variant: "destructive",
      });
      return;
    }

    const pack = FEE_CONFIG.ENERGY_PACKS[packType];
    const cost = parseEther(pack.cost.toString());

    setPurchasingPack(packType);

    try {
      // Send payment transaction
      sendTransaction({
        to: WALLET_ADDRESSES.TREASURY_WALLET as `0x${string}`,
        value: cost,
      });
    } catch (error) {
      console.error('Purchase error:', error);
      setPurchasingPack(null);
      toast({
        title: "Purchase Failed",
        description: "Failed to initiate energy purchase",
        variant: "destructive",
      });
    }
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
    } catch (error: any) {
      toast({
        title: "Failed to Pause",
        description: error.message || "Could not pause bot",
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
    } catch (error: any) {
      toast({
        title: "Failed to Resume",
        description: error.message || "Could not resume bot",
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
    purchasing: isWriting || isConfirming,
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