import React, { useState } from 'react';
import { 
  Package, Sword, Shield, Gem, Star, Sparkles, 
  Filter, Search, X, Info, TrendingUp, Zap
} from 'lucide-react';

type ItemRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
type ItemType = 'weapon' | 'armor' | 'consumable' | 'material' | 'special';

interface InventoryItem {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  quantity: number;
  icon?: string;
  description?: string;
  stats?: {
    power?: number;
    defense?: number;
    energy?: number;
    xpBonus?: number;
  };
  value?: number;
  equipped?: boolean;
}

interface InventoryPanelProps {
  items: InventoryItem[];
  maxSlots?: number;
  onItemClick?: (item: InventoryItem) => void;
  onEquip?: (item: InventoryItem) => void;
  className?: string;
}

export default function InventoryPanel({
  items,
  maxSlots = 50,
  onItemClick,
  onEquip,
  className = ''
}: InventoryPanelProps) {
  const [selectedRarity, setSelectedRarity] = useState<ItemRarity | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<ItemType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  const getRarityColor = (rarity: ItemRarity) => {
    switch (rarity) {
      case 'LEGENDARY': return 'text-orange-400 bg-orange-400/10 border-orange-400';
      case 'EPIC': return 'text-purple-400 bg-purple-400/10 border-purple-400';
      case 'RARE': return 'text-blue-400 bg-blue-400/10 border-blue-400';
      case 'UNCOMMON': return 'text-green-400 bg-green-400/10 border-green-400';
      case 'COMMON': return 'text-gray-400 bg-gray-400/10 border-gray-400';
    }
  };
  
  const getRarityGlow = (rarity: ItemRarity) => {
    switch (rarity) {
      case 'LEGENDARY': return 'shadow-orange-400/50';
      case 'EPIC': return 'shadow-purple-400/50';
      case 'RARE': return 'shadow-blue-400/50';
      case 'UNCOMMON': return 'shadow-green-400/50';
      case 'COMMON': return '';
    }
  };
  
  const getTypeIcon = (type: ItemType) => {
    switch (type) {
      case 'weapon': return <Sword className="w-4 h-4" />;
      case 'armor': return <Shield className="w-4 h-4" />;
      case 'consumable': return <Zap className="w-4 h-4" />;
      case 'material': return <Package className="w-4 h-4" />;
      case 'special': return <Star className="w-4 h-4" />;
    }
  };
  
  // Filter items
  const filteredItems = items.filter(item => {
    if (selectedRarity !== 'ALL' && item.rarity !== selectedRarity) return false;
    if (selectedType !== 'ALL' && item.type !== selectedType) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  
  // Sort items by rarity (highest first) then by equipped status
  const sortedItems = [...filteredItems].sort((a, b) => {
    const rarityOrder = { LEGENDARY: 5, EPIC: 4, RARE: 3, UNCOMMON: 2, COMMON: 1 };
    if (a.equipped && !b.equipped) return -1;
    if (!a.equipped && b.equipped) return 1;
    return rarityOrder[b.rarity] - rarityOrder[a.rarity];
  });
  
  // Calculate inventory stats
  const totalValue = items.reduce((sum, item) => sum + (item.value || 0) * item.quantity, 0);
  const usedSlots = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const rarityFilters: Array<ItemRarity | 'ALL'> = ['ALL', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
  const typeFilters: Array<ItemType | 'ALL'> = ['ALL', 'weapon', 'armor', 'consumable', 'material', 'special'];
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with stats */}
      <div className="mb-3 pb-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-300">Inventory</h3>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Package className="w-3 h-3 text-gray-400" />
              <span className="text-gray-400">{usedSlots}/{maxSlots}</span>
            </div>
            <div className="flex items-center gap-1">
              <Gem className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400">{totalValue.toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        {/* Search bar */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {/* Filters */}
        <div className="space-y-1">
          {/* Rarity filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-gray-500" />
            <div className="flex gap-1 flex-wrap">
              {rarityFilters.map(rarity => (
                <button
                  key={rarity}
                  onClick={() => setSelectedRarity(rarity)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    selectedRarity === rarity
                      ? rarity === 'ALL'
                        ? 'bg-gray-700 text-gray-200'
                        : getRarityColor(rarity as ItemRarity)
                      : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                  }`}
                >
                  {rarity === 'ALL' ? 'All' : rarity}
                </button>
              ))}
            </div>
          </div>
          
          {/* Type filter */}
          <div className="flex items-center gap-1">
            <span className="w-3" />
            <div className="flex gap-1 flex-wrap">
              {typeFilters.map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors flex items-center gap-1 ${
                    selectedType === type
                      ? 'bg-gray-700 text-gray-200'
                      : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                  }`}
                >
                  {type !== 'ALL' && getTypeIcon(type as ItemType)}
                  <span className="capitalize">{type === 'ALL' ? 'All' : type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Item grid */}
      <div className="flex-1 overflow-y-auto">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Package className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No items found</p>
            {searchQuery && (
              <p className="text-xs mt-1">Try adjusting your search</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5">
            {sortedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  onItemClick?.(item);
                }}
                className={`
                  relative aspect-square bg-gray-800 border rounded cursor-pointer
                  hover:bg-gray-700 transition-all group
                  ${getRarityColor(item.rarity).split(' ')[2]}
                  ${item.equipped ? 'ring-2 ring-yellow-400' : ''}
                  shadow-lg ${getRarityGlow(item.rarity)}
                `}
              >
                {/* Item icon */}
                <div className="flex items-center justify-center h-full">
                  {item.icon ? (
                    <img src={item.icon} alt={item.name} className="w-8 h-8" />
                  ) : (
                    <div className={getRarityColor(item.rarity).split(' ')[0]}>
                      {getTypeIcon(item.type)}
                    </div>
                  )}
                </div>
                
                {/* Quantity badge */}
                {item.quantity > 1 && (
                  <div className="absolute bottom-0.5 right-0.5 px-1 py-0 bg-gray-900/90 rounded text-[10px] font-bold text-gray-200">
                    {item.quantity}
                  </div>
                )}
                
                {/* Equipped indicator */}
                {item.equipped && (
                  <div className="absolute top-0.5 right-0.5">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  </div>
                )}
                
                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                  <div className="bg-gray-900 border border-gray-700 rounded p-1.5 text-[10px] whitespace-nowrap">
                    <div className={`font-bold ${getRarityColor(item.rarity).split(' ')[0]}`}>
                      {item.name}
                    </div>
                    {item.stats && (
                      <div className="text-gray-400 mt-0.5">
                        {item.stats.power && <div>+{item.stats.power} Power</div>}
                        {item.stats.defense && <div>+{item.stats.defense} Defense</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Empty slots */}
            {Array.from({ length: Math.max(0, Math.min(12, maxSlots - sortedItems.length)) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square bg-gray-800/30 border border-gray-700/30 rounded"
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Selected item details */}
      {selectedItem && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className={`text-sm font-bold ${getRarityColor(selectedItem.rarity).split(' ')[0]}`}>
                  {selectedItem.name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${getRarityColor(selectedItem.rarity)}`}>
                    {selectedItem.rarity}
                  </span>
                  <span className="text-[10px] text-gray-400 capitalize">
                    {selectedItem.type}
                  </span>
                  {selectedItem.equipped && (
                    <span className="text-[10px] text-yellow-400">Equipped</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            
            {selectedItem.description && (
              <p className="text-xs text-gray-400 mb-2">{selectedItem.description}</p>
            )}
            
            {selectedItem.stats && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                {selectedItem.stats.power && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Power</span>
                    <span className="text-red-400 font-medium">+{selectedItem.stats.power}</span>
                  </div>
                )}
                {selectedItem.stats.defense && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Defense</span>
                    <span className="text-blue-400 font-medium">+{selectedItem.stats.defense}</span>
                  </div>
                )}
                {selectedItem.stats.energy && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Energy</span>
                    <span className="text-yellow-400 font-medium">+{selectedItem.stats.energy}</span>
                  </div>
                )}
                {selectedItem.stats.xpBonus && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">XP Bonus</span>
                    <span className="text-purple-400 font-medium">+{selectedItem.stats.xpBonus}%</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs">
                <Gem className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-400">{selectedItem.value || 0}</span>
              </div>
              
              {onEquip && selectedItem.type !== 'consumable' && selectedItem.type !== 'material' && (
                <button
                  onClick={() => onEquip(selectedItem)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    selectedItem.equipped
                      ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {selectedItem.equipped ? 'Unequip' : 'Equip'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}