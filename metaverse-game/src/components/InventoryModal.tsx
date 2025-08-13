import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Sword, Shield, Sparkles, Box, ChevronRight, Footprints, Crosshair, Beaker } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import LootboxOpening from './LootboxOpening';
import clsx from 'clsx';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldId: Id<'worlds'>;
  playerId: string;
  aiArenaBotId?: string;
}

type TabType = 'lootboxes' | 'potions' | 'swords' | 'armor' | 'boots' | 'guns' | 'all';

export default function InventoryModal({ isOpen, onClose, worldId, playerId, aiArenaBotId }: InventoryModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lootboxes');
  const [openingLootbox, setOpeningLootbox] = useState<any>(null);
  const [showLootboxAnimation, setShowLootboxAnimation] = useState(false);

  // Queries
  // @ts-ignore - Known Convex type depth issue
  const inventory = useQuery(api.aiTown.inventory.getPlayerInventory, 
    playerId ? { worldId, playerId } : 'skip'
  );
  
  const lootboxQueue = useQuery(api.aiTown.inventory.getPendingLootboxes,
    playerId ? { worldId, playerId } : 'skip'
  );

  const equipment = useQuery(api.aiTown.inventory.calculatePlayerEquipment,
    playerId ? { worldId, playerId } : 'skip'
  );

  // Mutations
  const processLootbox = useMutation(api.aiTown.inventory.processLootboxFromQueue);
  const equipItem = useMutation(api.aiTown.inventory.equipItem);
  // Removed test lootbox creation - use real lootbox system instead

  const handleOpenLootbox = async (lootboxId: Id<'lootboxQueue'>) => {
    const lootbox = lootboxQueue?.find(l => l._id === lootboxId);
    if (!lootbox) return;

    setOpeningLootbox(lootbox);
    setShowLootboxAnimation(true);

    try {
      await processLootbox({ worldId, lootboxQueueId: lootboxId });
    } catch (error) {
      console.error('Failed to process lootbox:', error);
    }
  };

  const handleEquipItem = async (itemId: Id<'items'>) => {
    try {
      await equipItem({ worldId, playerId, itemId });
    } catch (error) {
      console.error('Failed to equip item:', error);
    }
  };

  const handleCreateTestLootbox = async () => {
    if (!aiArenaBotId) return;
    try {
      // Test lootbox creation removed - integrate with real tournament rewards instead
      const result = { success: false, message: 'Test lootboxes disabled - earn them from tournaments!' };
      console.log('Test lootbox created:', result);
    } catch (error) {
      console.error('Failed to create test lootbox:', error);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'GOD_TIER':
        return 'border-red-600 bg-gradient-to-br from-red-900/30 to-yellow-900/30 text-red-400 animate-pulse';
      case 'LEGENDARY':
        return 'border-yellow-500 bg-yellow-500/10 text-yellow-400';
      case 'EPIC':
        return 'border-purple-500 bg-purple-500/10 text-purple-400';
      case 'RARE':
        return 'border-blue-500 bg-blue-500/10 text-blue-400';
      case 'UNCOMMON':
        return 'border-green-500 bg-green-500/10 text-green-400';
      default:
        return 'border-gray-500 bg-gray-500/10 text-gray-400';
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'SWORD':
        return <Sword className="w-5 h-5" />;
      case 'ARMOR':
        return <Shield className="w-5 h-5" />;
      case 'POTION':
        return <Beaker className="w-5 h-5" />;
      case 'BOOTS':
        return <Footprints className="w-5 h-5" />;
      case 'GUN':
        return <Crosshair className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  // Filter items by type
  const potions = inventory?.items?.filter(item => item.type === 'POTION') || [];
  const swords = inventory?.items?.filter(item => item.type === 'SWORD') || [];
  const armors = inventory?.items?.filter(item => item.type === 'ARMOR') || [];
  const boots = inventory?.items?.filter(item => item.type === 'BOOTS') || [];
  const guns = inventory?.items?.filter(item => item.type === 'GUN') || [];

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'lootboxes', label: 'Lootboxes', icon: <Box className="w-4 h-4" />, count: lootboxQueue?.length || 0 },
    { id: 'potions', label: 'Potions', icon: <Beaker className="w-4 h-4" />, count: potions.length },
    { id: 'swords', label: 'Swords', icon: <Sword className="w-4 h-4" />, count: swords.length },
    { id: 'armor', label: 'Armor', icon: <Shield className="w-4 h-4" />, count: armors.length },
    { id: 'boots', label: 'Boots', icon: <Footprints className="w-4 h-4" />, count: boots.length },
    { id: 'guns', label: 'Guns', icon: <Crosshair className="w-4 h-4" />, count: guns.length },
    { id: 'all', label: 'All', icon: <Package className="w-4 h-4" />, count: inventory?.items?.length || 0 },
  ];

  const equippedItems = inventory?.items?.filter(item => item.equipped) || [];
  const unequippedItems = inventory?.items?.filter(item => !item.equipped && item.type !== 'FURNITURE') || [];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-4xl h-[80vh] bg-gray-900 border border-red-900/50 rounded-lg shadow-2xl shadow-red-900/20"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-red-900/30">
                <div>
                  <h2 className="text-2xl font-bold text-red-400">Inventory</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Power: <span className="text-red-400">{equipment?.powerBonus || 0}</span> | 
                    Defense: <span className="text-blue-400 ml-2">{equipment?.defenseBonus || 0}</span>
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 p-6 pb-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      'flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all',
                      activeTab === tab.id
                        ? 'bg-red-900/30 text-red-400 border-b-2 border-red-500'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                    )}
                  >
                    {tab.icon}
                    <span className="font-medium">{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-6 h-[calc(100%-160px)] overflow-y-auto">
                {/* Lootboxes Tab */}
                {activeTab === 'lootboxes' && (
                  <div>
                    {/* Development Test Button */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-600/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-yellow-400 font-semibold">Development Mode</p>
                            <p className="text-sm text-gray-400">Generate test lootboxes for testing</p>
                          </div>
                          <button
                            onClick={handleCreateTestLootbox}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-black font-bold rounded-lg transition-colors"
                          >
                            Create Test Lootbox
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {lootboxQueue?.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-gray-500">
                        <Box className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No lootboxes to open</p>
                      </div>
                    ) : (
                      lootboxQueue?.map((lootbox) => (
                        <motion.div
                          key={lootbox._id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleOpenLootbox(lootbox._id)}
                          className={clsx(
                            'relative p-6 rounded-lg border-2 cursor-pointer transition-all',
                            getRarityColor(lootbox.rarity),
                            'hover:shadow-lg hover:shadow-current/20'
                          )}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <Box className="w-12 h-12" />
                            <span className="font-bold">{lootbox.rarity}</span>
                            <span className="text-xs opacity-75">
                              {lootbox.rewards.length} items
                            </span>
                          </div>
                          <motion.div
                            className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg opacity-0 hover:opacity-100 transition-opacity"
                          >
                            <span className="text-white font-bold">OPEN</span>
                          </motion.div>
                        </motion.div>
                      ))
                    )}
                    </div>
                  </div>
                )}

                {/* Potions Tab */}
                {activeTab === 'potions' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {potions.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-gray-500">
                        <Beaker className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No potions available</p>
                        <p className="text-sm mt-2">Earn potions from tournaments and lootboxes!</p>
                      </div>
                    ) : (
                      potions.map((item) => (
                        <ItemCard 
                          key={item._id} 
                          item={item}
                          onAction={() => {/* TODO: Use consumable */}}
                          actionLabel={item.quantity && item.quantity > 1 ? `Use (${item.quantity})` : "Use"}
                        />
                      ))
                    )}
                  </div>
                )}

                {/* Swords Tab */}
                {activeTab === 'swords' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {swords.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-gray-500">
                        <Sword className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No swords in inventory</p>
                      </div>
                    ) : (
                      swords.map((item) => (
                        <ItemCard 
                          key={item._id} 
                          item={item}
                          onAction={() => handleEquipItem(item._id)}
                          actionLabel={item.equipped ? "Unequip" : "Equip"}
                          equipped={item.equipped}
                        />
                      ))
                    )}
                  </div>
                )}

                {/* Armor Tab */}
                {activeTab === 'armor' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {armors.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-gray-500">
                        <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No armor pieces available</p>
                      </div>
                    ) : (
                      armors.map((item) => (
                        <ItemCard 
                          key={item._id} 
                          item={item}
                          onAction={() => handleEquipItem(item._id)}
                          actionLabel={item.equipped ? "Unequip" : "Equip"}
                          equipped={item.equipped}
                        />
                      ))
                    )}
                  </div>
                )}

                {/* Boots Tab */}
                {activeTab === 'boots' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {boots.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-gray-500">
                        <Footprints className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No boots available</p>
                        <p className="text-sm mt-2">Boots increase movement speed and agility!</p>
                      </div>
                    ) : (
                      boots.map((item) => (
                        <ItemCard 
                          key={item._id} 
                          item={item}
                          onAction={() => handleEquipItem(item._id)}
                          actionLabel={item.equipped ? "Unequip" : "Equip"}
                          equipped={item.equipped}
                        />
                      ))
                    )}
                  </div>
                )}

                {/* Guns Tab */}
                {activeTab === 'guns' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {guns.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-gray-500">
                        <Crosshair className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No guns in arsenal</p>
                        <p className="text-sm mt-2">Guns provide ranged combat advantages!</p>
                      </div>
                    ) : (
                      guns.map((item) => (
                        <ItemCard 
                          key={item._id} 
                          item={item}
                          onAction={() => handleEquipItem(item._id)}
                          actionLabel={item.equipped ? "Unequip" : "Equip"}
                          equipped={item.equipped}
                        />
                      ))
                    )}
                  </div>
                )}

                {/* All Items Tab */}
                {activeTab === 'all' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {inventory?.items?.length === 0 ? (
                      <div className="col-span-full text-center py-12 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No items in inventory</p>
                      </div>
                    ) : (
                      inventory?.items?.map((item) => (
                        <ItemCard 
                          key={item._id} 
                          item={item}
                          onAction={item.type === 'POTION' ? 
                            () => {/* TODO: Use consumable */} : 
                            () => handleEquipItem(item._id)
                          }
                          actionLabel={
                            item.type === 'POTION' ? 
                              (item.quantity && item.quantity > 1 ? `Use (${item.quantity})` : "Use") :
                              (item.equipped ? "Unequip" : "Equip")
                          }
                          equipped={item.equipped}
                        />
                      ))
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lootbox Opening Animation */}
      <LootboxOpening
        isOpen={showLootboxAnimation}
        onClose={() => {
          setShowLootboxAnimation(false);
          setOpeningLootbox(null);
        }}
        lootbox={openingLootbox}
      />
    </>
  );
}

// Item Card Component
function ItemCard({ 
  item, 
  onAction, 
  actionLabel, 
  equipped = false 
}: { 
  item: any; 
  onAction?: () => void; 
  actionLabel?: string;
  equipped?: boolean;
}) {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'LEGENDARY':
        return 'border-yellow-500 bg-yellow-500/10';
      case 'EPIC':
        return 'border-purple-500 bg-purple-500/10';
      case 'RARE':
        return 'border-blue-500 bg-blue-500/10';
      case 'UNCOMMON':
        return 'border-green-500 bg-green-500/10';
      default:
        return 'border-gray-600 bg-gray-800/50';
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'SWORD':
        return <Sword className="w-5 h-5" />;
      case 'ARMOR':
        return <Shield className="w-5 h-5" />;
      case 'POTION':
        return <Beaker className="w-5 h-5" />;
      case 'BOOTS':
        return <Footprints className="w-5 h-5" />;
      case 'GUN':
        return <Crosshair className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  return (
    <div className={clsx(
      'relative p-4 rounded-lg border transition-all',
      getRarityColor(item.rarity),
      equipped && 'ring-2 ring-yellow-400'
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {getItemIcon(item.type)}
          <span className="font-medium text-gray-200">{item.name}</span>
        </div>
        {equipped && (
          <Sparkles className="w-4 h-4 text-yellow-400" />
        )}
      </div>
      
      <div className="text-sm text-gray-400 space-y-1">
        <p className="capitalize">{item.type.toLowerCase()}</p>
        <div className="flex flex-wrap gap-2">
          {item.powerBonus > 0 && (
            <span className="text-red-400">+{item.powerBonus} Power</span>
          )}
          {item.defenseBonus > 0 && (
            <span className="text-blue-400">+{item.defenseBonus} Defense</span>
          )}
          {item.scoreBonus > 0 && (
            <span className="text-yellow-400">+{item.scoreBonus} Score</span>
          )}
          {item.speedBonus > 0 && (
            <span className="text-green-400">+{item.speedBonus} Speed</span>
          )}
          {item.agilityBonus > 0 && (
            <span className="text-purple-400">+{item.agilityBonus} Agility</span>
          )}
          {item.rangeBonus > 0 && (
            <span className="text-orange-400">+{item.rangeBonus} Range</span>
          )}
          {item.healingPower > 0 && (
            <span className="text-pink-400">+{item.healingPower} Healing</span>
          )}
          {item.duration && item.duration > 0 && (
            <span className="text-cyan-400">{item.duration}s Duration</span>
          )}
          {item.consumable && item.quantity && (
            <span className="text-gray-300">x{item.quantity}</span>
          )}
        </div>
      </div>

      {onAction && (
        <button
          onClick={onAction}
          className="mt-3 w-full py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded transition-colors text-sm font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}