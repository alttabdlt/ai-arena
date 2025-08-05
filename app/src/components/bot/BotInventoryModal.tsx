import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { Package, Home, Shield, Coins, Sparkles, Box, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useInventory } from '@/modules/bot/hooks/useInventory';
import { useNavigate } from 'react-router-dom';
import { LootboxOpeningAnimation } from '@/components/lootbox/LootboxOpeningAnimation';

interface LootboxReward {
  id: string;
  lootboxRarity: string;
  opened: boolean;
  openedAt?: string;
  createdAt: string;
  equipmentRewards: any[];
  furnitureRewards: any[];
  currencyReward: number;
}

interface Equipment {
  id: string;
  name: string;
  equipmentType: string;
  rarity: string;
  powerBonus: number;
  defenseBonus: number;
  equipped: boolean;
}

interface BotInventoryModalProps {
  bot: {
    id: string;
    name: string;
    tokenId: number;
    lootboxRewards?: LootboxReward[];
    equipment?: Equipment[];
    house?: {
      houseScore: number;
      defenseLevel: number;
      furniture?: any[];
    };
  };
  trigger?: React.ReactNode;
  onOpenLootbox?: (lootboxId: string) => void;
  onEquipItem?: (itemId: string) => void;
}

export function BotInventoryModal({ bot, trigger, onOpenLootbox, onEquipItem }: BotInventoryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('lootboxes');
  const [openingLootbox, setOpeningLootbox] = useState<LootboxReward | null>(null);
  const [showLootboxAnimation, setShowLootboxAnimation] = useState(false);
  const navigate = useNavigate();
  
  // Use inventory hooks
  const { openLootbox, toggleEquipment, initializeHouse } = useInventory(bot.id);

  const unopenedLootboxes = bot.lootboxRewards?.filter(r => !r.opened) || [];
  const openedLootboxes = bot.lootboxRewards?.filter(r => r.opened) || [];
  const equippedItems = bot.equipment?.filter(e => e.equipped) || [];
  const unequippedItems = bot.equipment?.filter(e => !e.equipped) || [];

  const handleOpenLootbox = async (lootboxId: string) => {
    const lootbox = unopenedLootboxes.find(l => l.id === lootboxId);
    if (!lootbox) return;

    if (onOpenLootbox) {
      onOpenLootbox(lootboxId);
    } else {
      try {
        const result = await openLootbox.openLootbox(lootboxId);
        // Show the animation with the opened lootbox data
        if (result.data?.openLootbox) {
          setOpeningLootbox(result.data.openLootbox);
          setShowLootboxAnimation(true);
        }
      } catch (error) {
        console.error('Failed to open lootbox:', error);
      }
    }
  };

  const handleEquipItem = async (itemId: string, equipped: boolean) => {
    if (onEquipItem) {
      onEquipItem(itemId);
    } else {
      await toggleEquipment.toggleEquipment(itemId, equipped);
    }
  };

  const handleEditHouse = () => {
    navigate(`/bot/${bot.id}/house`);
    setIsOpen(false);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'LEGENDARY':
        return 'text-yellow-500 border-yellow-500';
      case 'EPIC':
        return 'text-purple-500 border-purple-500';
      case 'RARE':
        return 'text-blue-500 border-blue-500';
      case 'COMMON':
        return 'text-gray-500 border-gray-500';
      default:
        return 'text-muted-foreground border-border';
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
      case 'COMMON':
        return '🔹';
      default:
        return '▪️';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Package className="h-4 w-4 mr-1" />
            Inventory
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {bot.name}'s Inventory
            <Badge variant="outline" className="ml-2">
              #{bot.tokenId}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lootboxes" className="flex items-center gap-2">
              <Box className="h-4 w-4" />
              Lootboxes
              {unopenedLootboxes.length > 0 && (
                <Badge variant="default" className="ml-1">
                  {unopenedLootboxes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Equipment
            </TabsTrigger>
            <TabsTrigger value="house" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              House
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lootboxes" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {unopenedLootboxes.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold mb-2">Unopened Lootboxes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {unopenedLootboxes.map((lootbox) => (
                      <Card key={lootbox.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              {getRarityIcon(lootbox.lootboxRarity)}
                              {lootbox.lootboxRarity} Lootbox
                            </CardTitle>
                            <Badge variant="outline" className={getRarityColor(lootbox.lootboxRarity)}>
                              {lootbox.lootboxRarity}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground mb-3">
                            Earned {formatDistanceToNow(new Date(lootbox.createdAt), { addSuffix: true })}
                          </p>
                          <Button 
                            size="sm" 
                            className="w-full"
                            onClick={() => handleOpenLootbox(lootbox.id)}
                            disabled={openLootbox.loading}
                          >
                            {openLootbox.loading ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-1" />
                            )}
                            {openLootbox.loading ? 'Opening...' : 'Open Lootbox'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Box className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No unopened lootboxes</p>
                  <p className="text-sm text-muted-foreground mt-1">Win tournaments to earn lootboxes!</p>
                </div>
              )}

              {openedLootboxes.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="font-semibold mb-2">Opened Lootboxes History</h3>
                  <div className="space-y-2">
                    {openedLootboxes.map((lootbox) => (
                      <div key={lootbox.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{getRarityIcon(lootbox.lootboxRarity)}</span>
                          <div>
                            <p className="text-sm font-medium">{lootbox.lootboxRarity} Lootbox</p>
                            <p className="text-xs text-muted-foreground">
                              Opened {formatDistanceToNow(new Date(lootbox.openedAt!), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {lootbox.currencyReward > 0 && (
                            <p className="text-xs flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              +{lootbox.currencyReward} HYPE
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {lootbox.equipmentRewards.length + lootbox.furnitureRewards.length} items
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="equipment" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {equippedItems.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold mb-2">Equipped Items</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {equippedItems.map((item) => (
                      <Card key={item.id} className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{item.equipmentType}</p>
                            </div>
                            <Badge variant="outline" className={getRarityColor(item.rarity)}>
                              {item.rarity}
                            </Badge>
                          </div>
                          <div className="mt-2 flex gap-4 text-xs">
                            {item.powerBonus > 0 && (
                              <span className="text-red-500">+{item.powerBonus} Power</span>
                            )}
                            {item.defenseBonus > 0 && (
                              <span className="text-blue-500">+{item.defenseBonus} Defense</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full mt-3"
                            onClick={() => handleEquipItem(item.id, false)}
                            disabled={toggleEquipment.loading}
                          >
                            {toggleEquipment.loading ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : null}
                            {toggleEquipment.loading ? 'Unequipping...' : 'Unequip'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {unequippedItems.length > 0 && (
                <div className="space-y-4 mt-6">
                  <h3 className="font-semibold mb-2">Available Equipment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {unequippedItems.map((item) => (
                      <Card key={item.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{item.equipmentType}</p>
                            </div>
                            <Badge variant="outline" className={getRarityColor(item.rarity)}>
                              {item.rarity}
                            </Badge>
                          </div>
                          <div className="mt-2 flex gap-4 text-xs">
                            {item.powerBonus > 0 && (
                              <span className="text-red-500">+{item.powerBonus} Power</span>
                            )}
                            {item.defenseBonus > 0 && (
                              <span className="text-blue-500">+{item.defenseBonus} Defense</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-3"
                            onClick={() => handleEquipItem(item.id, true)}
                            disabled={toggleEquipment.loading}
                          >
                            {toggleEquipment.loading ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : null}
                            {toggleEquipment.loading ? 'Equipping...' : 'Equip'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {equippedItems.length === 0 && unequippedItems.length === 0 && (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No equipment yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Open lootboxes to get equipment!</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="house" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {bot.house ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">House Stats</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <span className="text-xs text-muted-foreground">House Score</span>
                          <div className="flex items-center gap-1">
                            <Home className="h-4 w-4" />
                            <span className="text-sm font-bold">{bot.house.houseScore}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <span className="text-xs text-muted-foreground">Defense Level</span>
                          <div className="flex items-center gap-1">
                            <Shield className="h-4 w-4" />
                            <span className="text-sm font-bold">{bot.house.defenseLevel}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {bot.house.furniture && bot.house.furniture.length > 0 ? (
                    <div>
                      <h3 className="font-semibold mb-3">Furniture Collection</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {bot.house.furniture.map((furniture: any) => (
                          <Card key={furniture.id}>
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium">{furniture.name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {furniture.furnitureType}
                                  </p>
                                </div>
                                <Badge variant="outline" className={getRarityColor(furniture.rarity)}>
                                  {furniture.rarity}
                                </Badge>
                              </div>
                              <div className="mt-2 flex gap-4 text-xs">
                                {furniture.scoreBonus > 0 && (
                                  <span className="text-green-500">+{furniture.scoreBonus} Score</span>
                                )}
                                {furniture.defenseBonus > 0 && (
                                  <span className="text-blue-500">+{furniture.defenseBonus} Defense</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Home className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">No furniture yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Open lootboxes to get furniture for your house!
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card className="border-dashed">
                      <CardContent className="py-6 text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          Arrange furniture in your house
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleEditHouse}
                        >
                          <Home className="h-4 w-4 mr-1" />
                          Edit House Layout
                        </Button>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-dashed">
                      <CardContent className="py-6 text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          Visit your house in the metaverse
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open('http://localhost:5173', '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Enter Metaverse
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No house yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Houses are automatically created when you join the metaverse!
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
      
      {/* Lootbox opening animation */}
      <LootboxOpeningAnimation
        isOpen={showLootboxAnimation}
        onClose={() => {
          setShowLootboxAnimation(false);
          setOpeningLootbox(null);
        }}
        reward={openingLootbox}
      />
    </Dialog>
  );
}