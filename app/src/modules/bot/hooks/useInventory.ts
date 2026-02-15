import { useMutation } from '@apollo/client';
import { toast } from 'sonner';
import { 
  OPEN_LOOTBOX, 
  TOGGLE_EQUIPMENT, 
  PLACE_FURNITURE,
  INITIALIZE_BOT_HOUSE 
} from '@/graphql/mutations/economy';
import { 
  GET_BOT_EQUIPMENT, 
  GET_BOT_HOUSE, 
  GET_PENDING_LOOTBOXES 
} from '@/graphql/queries/economy';

type EquipmentItem = {
  id: string;
  equipped: boolean;
} & Record<string, unknown>;

export function useOpenLootbox(botId?: string) {
  const [openLootbox, { loading, error }] = useMutation(OPEN_LOOTBOX, {
    onCompleted: (data) => {
      const rewards = data.openLootbox;
      const itemCount = rewards.equipmentRewards.length + rewards.furnitureRewards.length;
      
      toast.success(`Lootbox opened! Received ${itemCount} items and ${rewards.currencyReward} HYPE!`);
    },
    onError: (error) => {
      toast.error(`Failed to open lootbox: ${error.message}`);
    },
    refetchQueries: (result) => {
      const queries = [];
      // Get botId from the result if not provided
      const actualBotId = botId || result.data?.openLootbox?.bot?.id;
      
      if (actualBotId) {
        queries.push(
          { query: GET_PENDING_LOOTBOXES, variables: { botId: actualBotId } },
          { query: GET_BOT_EQUIPMENT, variables: { botId: actualBotId } },
          { query: GET_BOT_HOUSE, variables: { botId: actualBotId } }
        );
      }
      
      return queries;
    },
  });

  return {
    openLootbox: async (lootboxId: string) => {
      const result = await openLootbox({ variables: { lootboxId } });
      return result;
    },
    loading,
    error,
  };
}

export function useToggleEquipment() {
  const [toggleEquipment, { loading, error }] = useMutation(TOGGLE_EQUIPMENT, {
    onCompleted: (data) => {
      const equipped = data.toggleEquipment.equipped;
      toast.success(equipped ? 'Item equipped!' : 'Item unequipped!');
    },
    onError: (error) => {
      toast.error(`Failed to toggle equipment: ${error.message}`);
    },
    // Update cache optimistically
    update: (cache, { data }) => {
      if (!data) return;
      
      const { toggleEquipment: result } = data;
      const botId = result.bot.id;
      
      // Update the equipment list in cache
      const equipmentData = cache.readQuery<{ getBotEquipment: EquipmentItem[] }>({
        query: GET_BOT_EQUIPMENT,
        variables: { botId },
      });
      
      if (equipmentData && Array.isArray(equipmentData.getBotEquipment)) {
        const updatedEquipment = equipmentData.getBotEquipment.map((item) =>
          item.id === result.id ? { ...item, equipped: result.equipped } : item
        );
        
        cache.writeQuery({
          query: GET_BOT_EQUIPMENT,
          variables: { botId },
          data: {
            getBotEquipment: updatedEquipment,
          },
        });
      }
    },
  });

  return {
    toggleEquipment: (equipmentId: string, equipped: boolean) => 
      toggleEquipment({ variables: { equipmentId, equipped } }),
    loading,
    error,
  };
}

export function usePlaceFurniture() {
  const [placeFurniture, { loading, error }] = useMutation(PLACE_FURNITURE, {
    onCompleted: (data) => {
      toast.success('Furniture placed successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to place furniture: ${error.message}`);
    },
    refetchQueries: [{ query: GET_BOT_HOUSE }],
  });

  return {
    placeFurniture: (furnitureId: string, position: { x: number; y: number; rotation: number }) => 
      placeFurniture({ variables: { furnitureId, position } }),
    loading,
    error,
  };
}

export function useInitializeBotHouse() {
  const [initializeHouse, { loading, error }] = useMutation(INITIALIZE_BOT_HOUSE, {
    onCompleted: (data) => {
      toast.success('House initialized successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to initialize house: ${error.message}`);
    },
    refetchQueries: [{ query: GET_BOT_HOUSE }],
  });

  return {
    initializeHouse: (botId: string) => 
      initializeHouse({ variables: { botId } }),
    loading,
    error,
  };
}

// Combined hook for all inventory operations
export function useInventory(botId: string) {
  const openLootbox = useOpenLootbox(botId);
  const toggleEquipment = useToggleEquipment();
  const placeFurniture = usePlaceFurniture();
  const initializeHouse = useInitializeBotHouse();

  return {
    openLootbox,
    toggleEquipment,
    placeFurniture,
    initializeHouse,
    loading: openLootbox.loading || toggleEquipment.loading || placeFurniture.loading || initializeHouse.loading,
  };
}
