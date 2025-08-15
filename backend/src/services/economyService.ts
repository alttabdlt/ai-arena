import { PrismaClient, ItemRarity, EquipmentType, FurnitureType } from '@prisma/client';

const prisma = new PrismaClient();

// Rarity drop rates
const RARITY_DROP_RATES = {
  COMMON: 0.50,
  UNCOMMON: 0.30,
  RARE: 0.15,
  EPIC: 0.04,
  LEGENDARY: 0.01
};

// Equipment names by type and rarity
const EQUIPMENT_NAMES: Record<EquipmentType, Record<ItemRarity, string[]>> = {
  SWORD: {
    COMMON: ['Rusty Sword', 'Wooden Staff', 'Training Dagger'],
    UNCOMMON: ['Iron Blade', 'Crystal Wand', 'Sharp Knife'],
    RARE: ['Enchanted Sword', 'Mystic Staff', 'Shadow Dagger'],
    EPIC: ['Flamebrand', 'Arcane Scepter', 'Void Blade'],
    LEGENDARY: ['Excalibur', 'Staff of Ages', 'Infinity Edge'],
    GOD_TIER: ['Eternal Bond Blade', 'Soulmate Scepter', 'Unity Edge']
  },
  ARMOR: {
    COMMON: ['Leather Vest', 'Cloth Robe', 'Wooden Shield'],
    UNCOMMON: ['Chainmail', 'Silk Robes', 'Iron Shield'],
    RARE: ['Plate Armor', 'Enchanted Robes', 'Tower Shield'],
    EPIC: ['Dragon Scale Mail', 'Archmage Robes', 'Aegis'],
    LEGENDARY: ['Godplate', 'Robes of Eternity', 'Bulwark of the Ages'],
    GOD_TIER: ['Eternal Bond Armor', 'Soulmate Vestments', 'Unity Aegis']
  },
  TOOL: {
    COMMON: ['Basic Toolkit', 'Simple Pickaxe', 'Rope'],
    UNCOMMON: ['Advanced Toolkit', 'Iron Pickaxe', 'Grappling Hook'],
    RARE: ['Master Tools', 'Diamond Pickaxe', 'Teleport Scroll'],
    EPIC: ['Artificer Kit', 'Void Pickaxe', 'Portal Generator'],
    LEGENDARY: ['Creator Tools', 'Reality Pickaxe', 'Dimension Key'],
    GOD_TIER: ['Eternal Bond Tools', 'Soulmate Kit', 'Unity Constructor']
  },
  ACCESSORY: {
    COMMON: ['Simple Ring', 'Basic Amulet', 'Leather Gloves'],
    UNCOMMON: ['Silver Ring', 'Magic Amulet', 'Silk Gloves'],
    RARE: ['Gold Ring', 'Enchanted Amulet', 'Mage Gloves'],
    EPIC: ['Diamond Ring', 'Ancient Amulet', 'Gauntlets of Power'],
    LEGENDARY: ['Ring of Omnipotence', 'Amulet of Immortality', 'Gloves of Midas'],
    GOD_TIER: ['Eternal Bond Ring', 'Soulmate Amulet', 'Unity Gauntlets']
  },
  POTION: {
    COMMON: ['Health Potion', 'Energy Drink', 'Minor Elixir'],
    UNCOMMON: ['Greater Health Potion', 'Stamina Boost', 'Speed Potion'],
    RARE: ['Rejuvenation Potion', 'Power Elixir', 'Invisibility Brew'],
    EPIC: ['Phoenix Potion', 'Berserker Draught', 'Time Warp Elixir'],
    LEGENDARY: ['Elixir of Immortality', 'Reality Serum', 'Omnipotence Potion'],
    GOD_TIER: ['Eternal Life Elixir', 'Unity Essence', 'Soulmate Bond Potion']
  },
  BOOTS: {
    COMMON: ['Worn Boots', 'Leather Shoes', 'Running Sneakers'],
    UNCOMMON: ['Swift Boots', 'Reinforced Boots', 'Silent Steps'],
    RARE: ['Winged Boots', 'Shadow Walkers', 'Sprint Masters'],
    EPIC: ['Boots of Hermes', 'Quantum Runners', 'Phase Shifters'],
    LEGENDARY: ['Seven League Boots', 'Boots of Light Speed', 'Temporal Striders'],
    GOD_TIER: ['Eternal Motion Boots', 'Unity Runners', 'Soulmate Steps']
  },
  GUN: {
    COMMON: ['Rusty Pistol', 'Basic Rifle', 'Makeshift Shotgun'],
    UNCOMMON: ['Chrome Revolver', 'Tactical Rifle', 'Combat Shotgun'],
    RARE: ['Plasma Pistol', 'Sniper Rifle', 'Energy Shotgun'],
    EPIC: ['Void Cannon', 'Quantum Rifle', 'Singularity Gun'],
    LEGENDARY: ['Reality Cannon', 'Infinity Rifle', 'Chaos Blaster'],
    GOD_TIER: ['Eternal Destroyer', 'Unity Cannon', 'Soulmate Blaster']
  }
};

// Furniture names by type and rarity
const FURNITURE_NAMES: Record<FurnitureType, Record<ItemRarity, string[]>> = {
  DECORATION: {
    COMMON: ['Potted Plant', 'Simple Painting', 'Basic Rug'],
    UNCOMMON: ['Exotic Plant', 'Fine Art', 'Ornate Rug'],
    RARE: ['Magical Garden', 'Masterpiece', 'Royal Carpet'],
    EPIC: ['Floating Garden', 'Living Portrait', 'Flying Carpet'],
    LEGENDARY: ['World Tree Sapling', 'Reality Canvas', 'Carpet of the Gods'],
    GOD_TIER: ['Eternal Love Garden', 'Wedding Portrait', 'Unity Tapestry']
  },
  FUNCTIONAL: {
    COMMON: ['Wooden Chair', 'Simple Table', 'Basic Bed'],
    UNCOMMON: ['Cushioned Chair', 'Dining Table', 'Comfortable Bed'],
    RARE: ['Throne', 'Feast Table', 'Royal Bed'],
    EPIC: ['Floating Throne', 'Infinite Table', 'Dream Bed'],
    LEGENDARY: ['Throne of Power', 'Table of Plenty', 'Bed of Eternity'],
    GOD_TIER: ['Eternal Bond Throne', 'Unity Table', 'Marriage Bed']
  },
  DEFENSIVE: {
    COMMON: ['Door Lock', 'Window Bars', 'Basic Alarm'],
    UNCOMMON: ['Steel Lock', 'Reinforced Bars', 'Motion Sensor'],
    RARE: ['Magic Lock', 'Energy Barrier', 'AI Security'],
    EPIC: ['Dimensional Lock', 'Force Field', 'Quantum Security'],
    LEGENDARY: ['Absolute Lock', 'Impenetrable Shield', 'Omniscient Guardian'],
    GOD_TIER: ['Eternal Protection', 'Unity Barrier', 'Soulmate Shield']
  },
  TROPHY: {
    COMMON: ['Participation Trophy', 'Bronze Medal', 'Certificate'],
    UNCOMMON: ['Winner Trophy', 'Silver Medal', 'Plaque'],
    RARE: ['Champion Trophy', 'Gold Medal', 'Crystal Award'],
    EPIC: ['Grand Champion Trophy', 'Platinum Medal', 'Holographic Award'],
    LEGENDARY: ['Eternal Champion Trophy', 'Infinity Medal', 'Reality Award'],
    GOD_TIER: ['Eternal Bond Trophy', 'Marriage Certificate', 'Unity Monument']
  }
};

export class EconomyService {
  // Generate random rarity based on drop rates
  private getRandomRarity(): ItemRarity {
    const roll = Math.random();
    let cumulative = 0;
    
    for (const [rarity, rate] of Object.entries(RARITY_DROP_RATES)) {
      cumulative += rate;
      if (roll <= cumulative) {
        return rarity as ItemRarity;
      }
    }
    
    return ItemRarity.COMMON;
  }

  // Generate random equipment
  private generateRandomEquipment(rarity: ItemRarity): any {
    const types = Object.keys(EquipmentType) as EquipmentType[];
    const type = types[Math.floor(Math.random() * types.length)];
    const names = EQUIPMENT_NAMES[type][rarity];
    const name = names[Math.floor(Math.random() * names.length)];
    
    const powerBonusRange: Record<ItemRarity, { min: number; max: number }> = {
      COMMON: { min: 1, max: 5 },
      UNCOMMON: { min: 5, max: 15 },
      RARE: { min: 15, max: 30 },
      EPIC: { min: 30, max: 50 },
      LEGENDARY: { min: 50, max: 100 },
      GOD_TIER: { min: 100, max: 200 }
    };
    
    const range = powerBonusRange[rarity];
    const basePower = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    
    // Base stats that all equipment types have
    const equipment: any = {
      name,
      equipmentType: type,
      rarity,
      powerBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      agilityBonus: 0,
      rangeBonus: 0,
      healingPower: 0,
      consumable: false,
      quantity: 1,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'lootbox'
      }
    };
    
    // Apply type-specific bonuses
    switch (type) {
      case 'SWORD':
        equipment.powerBonus = basePower;
        equipment.defenseBonus = Math.floor(basePower * 0.3);
        break;
      
      case 'ARMOR':
        equipment.defenseBonus = basePower;
        equipment.powerBonus = Math.floor(basePower * 0.2);
        break;
      
      case 'BOOTS':
        equipment.speedBonus = basePower;
        equipment.agilityBonus = Math.floor(basePower * 0.7);
        equipment.defenseBonus = Math.floor(basePower * 0.3);
        break;
      
      case 'GUN':
        equipment.powerBonus = Math.floor(basePower * 1.2); // Guns have higher power
        equipment.rangeBonus = basePower;
        equipment.defenseBonus = Math.floor(basePower * 0.1);
        break;
      
      case 'POTION':
        equipment.consumable = true;
        equipment.quantity = Math.floor(Math.random() * 3) + 1; // 1-3 potions
        equipment.healingPower = basePower * 10; // Healing scales with rarity
        equipment.duration = basePower * 60; // Duration in seconds
        equipment.uses = 1; // Single use when consumed
        equipment.maxUses = 1;
        break;
      
      case 'TOOL':
        equipment.powerBonus = Math.floor(basePower * 0.5);
        equipment.defenseBonus = Math.floor(basePower * 0.5);
        equipment.agilityBonus = Math.floor(basePower * 0.3);
        break;
      
      case 'ACCESSORY':
        // Accessories provide balanced bonuses
        equipment.powerBonus = Math.floor(basePower * 0.4);
        equipment.defenseBonus = Math.floor(basePower * 0.4);
        equipment.agilityBonus = Math.floor(basePower * 0.3);
        equipment.speedBonus = Math.floor(basePower * 0.3);
        break;
    }
    
    return equipment;
  }

  // Generate random furniture
  private generateRandomFurniture(rarity: ItemRarity): any {
    const types = Object.keys(FurnitureType) as FurnitureType[];
    const type = types[Math.floor(Math.random() * types.length)];
    const names = FURNITURE_NAMES[type][rarity];
    const name = names[Math.floor(Math.random() * names.length)];
    
    const scoreBonusRange: Record<ItemRarity, { min: number; max: number }> = {
      COMMON: { min: 5, max: 10 },
      UNCOMMON: { min: 10, max: 25 },
      RARE: { min: 25, max: 50 },
      EPIC: { min: 50, max: 100 },
      LEGENDARY: { min: 100, max: 200 },
      GOD_TIER: { min: 200, max: 500 }
    };
    
    const range = scoreBonusRange[rarity];
    const scoreBonus = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    const defenseBonus = type === FurnitureType.DEFENSIVE ? Math.floor(scoreBonus * 1.5) : 0;
    
    return {
      name,
      furnitureType: type,
      rarity,
      scoreBonus,
      defenseBonus,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'lootbox'
      }
    };
  }

  // Generate lootbox rewards after a match
  async generateMatchLootbox(matchId: string, botId: string, performance: number) {
    // Determine lootbox rarity based on performance (0-1 scale)
    let lootboxRarity: ItemRarity;
    if (performance >= 0.9) lootboxRarity = ItemRarity.LEGENDARY;
    else if (performance >= 0.75) lootboxRarity = ItemRarity.EPIC;
    else if (performance >= 0.5) lootboxRarity = ItemRarity.RARE;
    else if (performance >= 0.25) lootboxRarity = ItemRarity.UNCOMMON;
    else lootboxRarity = ItemRarity.COMMON;
    
    // Generate rewards
    const equipmentCount = Math.floor(Math.random() * 3) + 1; // 1-3 equipment
    const furnitureCount = Math.floor(Math.random() * 2) + 1; // 1-2 furniture
    
    const equipmentRewards = [];
    for (let i = 0; i < equipmentCount; i++) {
      const itemRarity = this.getRandomRarity();
      equipmentRewards.push(this.generateRandomEquipment(itemRarity));
    }
    
    const furnitureRewards = [];
    for (let i = 0; i < furnitureCount; i++) {
      const itemRarity = this.getRandomRarity();
      furnitureRewards.push(this.generateRandomFurniture(itemRarity));
    }
    
    // Currency reward based on lootbox rarity
    const currencyRewardMap: Record<ItemRarity, number> = {
      COMMON: 100,
      UNCOMMON: 250,
      RARE: 500,
      EPIC: 1000,
      LEGENDARY: 2500,
      GOD_TIER: 10000
    };
    const currencyReward = currencyRewardMap[lootboxRarity];
    
    // Create lootbox reward in database
    const lootbox = await prisma.lootboxReward.create({
      data: {
        matchId,
        botId,
        lootboxRarity,
        equipmentRewards,
        furnitureRewards,
        currencyReward
      }
    });

    // Auto-sync lootbox to metaverse after tournament
    try {
      // Get bot's metaverse data
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { botSync: true }
      });

      if (bot?.botSync?.convexWorldId && bot?.botSync?.convexPlayerId) {
        // Call metaverse backend to sync lootbox
        const metaverseBackendUrl = process.env.METAVERSE_BACKEND_URL || 'http://localhost:5000';
        const response = await fetch(`${metaverseBackendUrl}/api/metaverse/lootbox/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lootboxId: lootbox.id })
        });

        if (response.ok) {
          const result = await response.json() as { success: boolean; message?: string };
          if (result.success) {
            console.log(`✅ Lootbox auto-synced to metaverse for bot ${botId}`);
          } else {
            console.error(`⚠️ Failed to auto-sync lootbox: ${result.message}`);
          }
        } else {
          console.error(`⚠️ Metaverse backend returned ${response.status}`);
        }
      } else {
        console.log(`ℹ️ Bot ${botId} not registered in metaverse yet, lootbox will sync when bot is deployed`);
      }
    } catch (error) {
      console.error('Error auto-syncing lootbox to metaverse:', error);
      // Don't fail the lootbox generation if sync fails - it can be retried later
    }

    return lootbox;
  }

  // Open a lootbox and grant rewards
  async openLootbox(lootboxId: string) {
    const lootbox = await prisma.lootboxReward.findUnique({
      where: { id: lootboxId }
    });
    
    if (!lootbox || lootbox.opened) {
      throw new Error('Lootbox not found or already opened');
    }
    
    // Create equipment items
    for (const equipmentData of lootbox.equipmentRewards as any[]) {
      await prisma.botEquipment.create({
        data: {
          ...equipmentData,
          botId: lootbox.botId
        }
      });
    }
    
    // Get or create bot house
    let house = await prisma.botHouse.findUnique({
      where: { botId: lootbox.botId }
    });
    
    if (!house) {
      house = await prisma.botHouse.create({
        data: {
          botId: lootbox.botId,
          worldPosition: { x: Math.random() * 100, y: Math.random() * 100 }
        }
      });
    }
    
    // Create furniture items
    for (const furnitureData of lootbox.furnitureRewards as any[]) {
      await prisma.furniture.create({
        data: {
          ...furnitureData,
          houseId: house.id,
          position: { 
            x: Math.random() * 10, 
            y: Math.random() * 10, 
            rotation: 0 
          }
        }
      });
    }
    
    // Update activity score
    await this.updateActivityScore(lootbox.botId, { lootboxesOpened: 1 });
    
    // Mark lootbox as opened
    return await prisma.lootboxReward.update({
      where: { id: lootboxId },
      data: { 
        opened: true,
        openedAt: new Date()
      }
    });
  }

  // Calculate bot's robbing power
  async calculateRobbingPower(botId: string): Promise<number> {
    const equipment = await prisma.botEquipment.findMany({
      where: { 
        botId,
        equipped: true 
      }
    });
    
    return equipment.reduce((total: number, item: any) => total + item.powerBonus, 0);
  }

  // Calculate bot's defense level
  async calculateDefenseLevel(botId: string): Promise<number> {
    const house = await prisma.botHouse.findUnique({
      where: { botId },
      include: { furniture: true }
    });
    
    if (!house) return 0;
    
    const equipment = await prisma.botEquipment.findMany({
      where: { 
        botId,
        equipped: true 
      }
    });
    
    const equipmentDefense = equipment.reduce((total: number, item: any) => total + item.defenseBonus, 0);
    const furnitureDefense = house.furniture.reduce((total: number, item: any) => total + item.defenseBonus, 0);
    
    return house.defenseLevel + equipmentDefense + furnitureDefense;
  }

  // Attempt a robbery
  async attemptRobbery(robberId: string, victimId: string) {
    // Check cooldowns
    const robberHouse = await prisma.botHouse.findUnique({
      where: { botId: robberId }
    });
    
    const victimHouse = await prisma.botHouse.findUnique({
      where: { botId: victimId }
    });
    
    if (!victimHouse) {
      throw new Error('Victim does not have a house');
    }
    
    // Check if victim was recently robbed
    if (victimHouse.lastRobbed) {
      const protectionTime = 2 * 60 * 60 * 1000; // 2 hours
      if (Date.now() - victimHouse.lastRobbed.getTime() < protectionTime) {
        throw new Error('Victim is under protection');
      }
    }
    
    // Calculate success chance
    const robberPower = await this.calculateRobbingPower(robberId);
    const victimDefense = await this.calculateDefenseLevel(victimId);
    
    const baseSuccessRate = 0.3;
    const powerRatio = robberPower / (robberPower + victimDefense + 1);
    const successChance = baseSuccessRate + (powerRatio * 0.5);
    
    const success = Math.random() < successChance;
    
    let lootValue = 0;
    const itemsStolen: any[] = [];
    
    if (success) {
      // Steal some currency (10-30% of house score)
      lootValue = Math.floor(victimHouse.houseScore * (0.1 + Math.random() * 0.2));
      
      // Update house scores
      await prisma.botHouse.update({
        where: { id: victimHouse.id },
        data: { 
          houseScore: victimHouse.houseScore - lootValue,
          lastRobbed: new Date()
        }
      });
      
      if (robberHouse) {
        await prisma.botHouse.update({
          where: { id: robberHouse.id },
          data: { 
            houseScore: robberHouse.houseScore + lootValue
          }
        });
      }
      
      // Update activity scores
      await this.updateActivityScore(robberId, { successfulRobberies: 1 });
    } else {
      // Failed robbery - update defender's score
      await this.updateActivityScore(victimId, { defenseSuccesses: 1 });
    }
    
    // Log the robbery attempt
    const log = await prisma.robberyLog.create({
      data: {
        robberBotId: robberId,
        victimBotId: victimId,
        success,
        powerUsed: robberPower,
        defenseFaced: victimDefense,
        lootValue,
        itemsStolen
      }
    });
    
    return {
      ...log,
      message: success 
        ? `Successfully robbed ${lootValue} coins!` 
        : 'Robbery failed! The defenses were too strong.'
    };
  }

  // Update activity score
  async updateActivityScore(botId: string, updates: Partial<{
    matchesPlayed: number;
    lootboxesOpened: number;
    socialInteractions: number;
    successfulRobberies: number;
    defenseSuccesses: number;
    tradesCompleted: number;
  }>) {
    const existing = await prisma.botActivityScore.findUnique({
      where: { botId }
    });
    
    if (existing) {
      const data: any = { lastActive: new Date() };
      
      for (const [key, value] of Object.entries(updates)) {
        const currentValue = existing[key as keyof typeof existing];
        if (typeof currentValue === 'number') {
          data[key] = currentValue + value;
        }
      }
      
      return await prisma.botActivityScore.update({
        where: { botId },
        data
      });
    } else {
      return await prisma.botActivityScore.create({
        data: {
          botId,
          ...updates
        }
      });
    }
  }

  // Use a consumable item
  async useConsumableItem(itemId: string): Promise<any> {
    const item = await prisma.botEquipment.findUnique({
      where: { id: itemId },
      include: { bot: true }
    });
    
    if (!item) {
      throw new Error('Item not found');
    }
    
    if (!item.consumable) {
      throw new Error('Item is not consumable');
    }
    
    if (item.quantity <= 0) {
      throw new Error('No items remaining');
    }
    
    // Apply item effects based on type
    const effects: any = {
      applied: true,
      itemName: item.name,
      botId: item.botId,
      effects: []
    };
    
    if (item.equipmentType === 'POTION') {
      // Apply healing effect
      if (item.healingPower && item.healingPower > 0) {
        // Update bot energy if it exists
        const botEnergy = await prisma.botEnergy.findUnique({
          where: { botId: item.botId }
        });
        
        if (botEnergy) {
          const newEnergy = Math.min(botEnergy.currentEnergy + item.healingPower, botEnergy.maxEnergy);
          await prisma.botEnergy.update({
            where: { botId: item.botId },
            data: { currentEnergy: newEnergy }
          });
          effects.effects.push(`Restored ${item.healingPower} energy`);
        }
      }
      
      // Apply temporary buffs (would need to be tracked separately)
      if (item.duration && item.duration > 0) {
        effects.effects.push(`Applied buff for ${item.duration} seconds`);
        effects.buffDuration = item.duration;
      }
    }
    
    // Reduce quantity or remove item
    if (item.quantity === 1) {
      // Last item, delete it
      await prisma.botEquipment.delete({
        where: { id: itemId }
      });
      effects.itemDeleted = true;
    } else {
      // Reduce quantity
      await prisma.botEquipment.update({
        where: { id: itemId },
        data: { quantity: item.quantity - 1 }
      });
      effects.remainingQuantity = item.quantity - 1;
    }
    
    return effects;
  }

  // Calculate and update house score
  async updateHouseScore(botId: string) {
    const house = await prisma.botHouse.findUnique({
      where: { botId },
      include: { furniture: true }
    });
    
    if (!house) {
      throw new Error('Bot does not have a house');
    }
    
    const activity = await prisma.botActivityScore.findUnique({
      where: { botId }
    }) || {
      matchesPlayed: 0,
      lootboxesOpened: 0,
      socialInteractions: 0,
      successfulRobberies: 0,
      defenseSuccesses: 0,
      tradesCompleted: 0
    };
    
    // Calculate furniture value
    const furnitureValue = house.furniture.reduce((total: number, item: any) => total + item.scoreBonus, 0);
    
    // Calculate new score
    const factors = {
      furnitureValue: furnitureValue * 2,
      activityScore: (activity.socialInteractions || 0) * 1.5,
      matchParticipation: (activity.matchesPlayed || 0) * 10,
      lootboxesOpened: (activity.lootboxesOpened || 0) * 5,
      socialInteractions: (activity.socialInteractions || 0) * 3,
      defenseSuccesses: (activity.defenseSuccesses || 0) * 15
    };
    
    const newScore = Object.values(factors).reduce((sum, value) => sum + value, 100);
    
    await prisma.botHouse.update({
      where: { id: house.id },
      data: { houseScore: Math.floor(newScore) }
    });
    
    return {
      botId,
      oldScore: house.houseScore,
      newScore: Math.floor(newScore),
      factors
    };
  }
}

export const economyService = new EconomyService();