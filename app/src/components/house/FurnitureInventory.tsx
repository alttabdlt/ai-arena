import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { ScrollArea } from '@ui/scroll-area';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { 
  Home, 
  Shield, 
  Star, 
  Search, 
  Package,
  GripVertical,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';

interface Furniture {
  id: string;
  name: string;
  furnitureType: string;
  rarity: string;
  scoreBonus: number;
  defenseBonus: number;
  size: { width: number; height: number };
  synergies?: string[];
  description?: string;
}

interface FurnitureInventoryProps {
  furniture: Furniture[];
  onDragStart: (furniture: Furniture) => void;
  onDragEnd: () => void;
  selectedFurniture?: Furniture | null;
  className?: string;
}

const FURNITURE_TYPES = ['all', 'decoration', 'functional', 'defensive', 'trophy'];
const RARITY_ORDER = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

export function FurnitureInventory({
  furniture,
  onDragStart,
  onDragEnd,
  selectedFurniture,
  className
}: FurnitureInventoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'score' | 'defense'>('rarity');

  // Filter furniture
  const filteredFurniture = furniture.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || item.furnitureType.toLowerCase() === selectedType;
    const matchesRarity = selectedRarity === 'all' || item.rarity === selectedRarity;
    return matchesSearch && matchesType && matchesRarity;
  });

  // Sort furniture
  const sortedFurniture = [...filteredFurniture].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'rarity':
        return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
      case 'score':
        return b.scoreBonus - a.scoreBonus;
      case 'defense':
        return b.defenseBonus - a.defenseBonus;
      default:
        return 0;
    }
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'LEGENDARY':
        return 'from-yellow-500/20 to-amber-600/20 border-yellow-500/50';
      case 'EPIC':
        return 'from-purple-500/20 to-purple-700/20 border-purple-500/50';
      case 'RARE':
        return 'from-blue-500/20 to-blue-700/20 border-blue-500/50';
      case 'UNCOMMON':
        return 'from-green-500/20 to-green-700/20 border-green-500/50';
      default:
        return 'from-gray-500/20 to-gray-700/20 border-gray-500/50';
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'LEGENDARY':
        return '⭐';
      case 'EPIC':
        return '💎';
      case 'RARE':
        return '💠';
      case 'UNCOMMON':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'decoration':
        return '🎨';
      case 'functional':
        return '🔧';
      case 'defensive':
        return '🛡️';
      case 'trophy':
        return '🏆';
      default:
        return '📦';
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent, item: Furniture) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('furniture', JSON.stringify(item));
    onDragStart(item);
  }, [onDragStart]);

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Furniture Inventory
          </CardTitle>
          <Badge variant="outline">{furniture.length} items</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-6 pb-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search furniture..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <Tabs value={selectedType} onValueChange={setSelectedType}>
            <TabsList className="grid grid-cols-5 h-8">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="decoration" className="text-xs">Decor</TabsTrigger>
              <TabsTrigger value="functional" className="text-xs">Func</TabsTrigger>
              <TabsTrigger value="defensive" className="text-xs">Def</TabsTrigger>
              <TabsTrigger value="trophy" className="text-xs">Trophy</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Sort and rarity filter */}
          <div className="flex gap-2">
            <select
              value={selectedRarity}
              onChange={(e) => setSelectedRarity(e.target.value)}
              className="flex-1 h-8 px-2 text-xs rounded-md border bg-background"
            >
              <option value="all">All Rarities</option>
              {RARITY_ORDER.map(rarity => (
                <option key={rarity} value={rarity}>{rarity}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 h-8 px-2 text-xs rounded-md border bg-background"
            >
              <option value="rarity">Sort by Rarity</option>
              <option value="name">Sort by Name</option>
              <option value="score">Sort by Score</option>
              <option value="defense">Sort by Defense</option>
            </select>
          </div>
        </div>

        {/* Furniture list */}
        <ScrollArea className="h-[400px] px-3">
          <div className="space-y-2 pb-3">
            {sortedFurniture.length > 0 ? (
              sortedFurniture.map((item) => (
                <motion.div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={onDragEnd}
                  className={cn(
                    "relative cursor-move rounded-lg border-2 p-3 transition-all",
                    `bg-gradient-to-br ${getRarityColor(item.rarity)}`,
                    "hover:shadow-md hover:scale-[1.02]",
                    selectedFurniture?.id === item.id && "ring-2 ring-primary ring-offset-2"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileDrag={{ scale: 1.05, opacity: 0.8 }}
                >
                  <div className="flex items-start gap-3">
                    {/* Drag handle */}
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
                    
                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{getTypeIcon(item.furnitureType)}</span>
                          <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                        </div>
                        <span className="text-sm">{getRarityIcon(item.rarity)}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-1 text-xs">
                        <span className="text-muted-foreground capitalize">
                          {item.furnitureType} • {item.size.width}x{item.size.height}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        {item.scoreBonus > 0 && (
                          <div className="flex items-center gap-1">
                            <Home className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-green-600">+{item.scoreBonus}</span>
                          </div>
                        )}
                        {item.defenseBonus > 0 && (
                          <div className="flex items-center gap-1">
                            <Shield className="h-3 w-3 text-blue-500" />
                            <span className="text-xs text-blue-600">+{item.defenseBonus}</span>
                          </div>
                        )}
                        {item.synergies && item.synergies.length > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <Star className="h-3 w-3 text-yellow-500" />
                                  <span className="text-xs text-yellow-600">{item.synergies.length}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Synergies with:</p>
                                <ul className="text-xs mt-1">
                                  {item.synergies.map((synergy, idx) => (
                                    <li key={idx}>• {synergy}</li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Info tooltip */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6">
                            <Info className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <div className="space-y-2">
                            <p className="font-semibold">{item.name}</p>
                            {item.description && (
                              <p className="text-xs">{item.description}</p>
                            )}
                            <div className="text-xs space-y-1">
                              <p>Type: {item.furnitureType}</p>
                              <p>Size: {item.size.width}x{item.size.height}</p>
                              <p>Rarity: {item.rarity}</p>
                              {item.scoreBonus > 0 && <p>House Score: +{item.scoreBonus}</p>}
                              {item.defenseBonus > 0 && <p>Defense: +{item.defenseBonus}</p>}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No furniture found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery || selectedType !== 'all' || selectedRarity !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Open lootboxes to get furniture!'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Instructions */}
        <div className="px-6 py-3 border-t bg-muted/50">
          <p className="text-xs text-muted-foreground text-center">
            Drag furniture items to the grid to place them in your house
          </p>
        </div>
      </CardContent>
    </Card>
  );
}