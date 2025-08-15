export interface PotionItem {
  id: string;
  name: string;
  type: 'POTION';
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'GOD_TIER';
  healingPower?: number;
  energyRestore?: number;
  powerBoost?: number;
  defenseBoost?: number;
  speedBoost?: number;
  duration?: number; // Duration in seconds for buff potions
  stackable: boolean;
  maxStack: number;
  description: string;
  spritePosition: { row: number; col: number };
  value: number;
}

export const POTIONS: PotionItem[] = [
  // HEALTH POTIONS (Red)
  {
    id: 'potion_health_small',
    name: 'Small Health Potion',
    type: 'POTION',
    rarity: 'COMMON',
    healingPower: 20,
    stackable: true,
    maxStack: 10,
    description: 'Restores 20 health',
    spritePosition: { row: 0, col: 0 },
    value: 10,
  },
  {
    id: 'potion_health_medium',
    name: 'Health Potion',
    type: 'POTION',
    rarity: 'UNCOMMON',
    healingPower: 50,
    stackable: true,
    maxStack: 10,
    description: 'Restores 50 health',
    spritePosition: { row: 0, col: 0 },
    value: 25,
  },
  {
    id: 'potion_health_large',
    name: 'Large Health Potion',
    type: 'POTION',
    rarity: 'RARE',
    healingPower: 100,
    stackable: true,
    maxStack: 5,
    description: 'Restores 100 health',
    spritePosition: { row: 0, col: 0 },
    value: 60,
  },
  {
    id: 'potion_health_super',
    name: 'Super Health Potion',
    type: 'POTION',
    rarity: 'EPIC',
    healingPower: 200,
    stackable: true,
    maxStack: 3,
    description: 'Restores 200 health',
    spritePosition: { row: 0, col: 0 },
    value: 150,
  },
  {
    id: 'potion_health_max',
    name: 'Max Health Elixir',
    type: 'POTION',
    rarity: 'LEGENDARY',
    healingPower: 500,
    stackable: true,
    maxStack: 1,
    description: 'Fully restores health',
    spritePosition: { row: 0, col: 0 },
    value: 500,
  },

  // POISON POTIONS (Green)
  {
    id: 'potion_poison_weak',
    name: 'Weak Poison',
    type: 'POTION',
    rarity: 'COMMON',
    healingPower: -10,
    duration: 10,
    stackable: true,
    maxStack: 10,
    description: 'Deals 10 damage over 10 seconds',
    spritePosition: { row: 0, col: 1 },
    value: 15,
  },
  {
    id: 'potion_poison_standard',
    name: 'Poison Vial',
    type: 'POTION',
    rarity: 'UNCOMMON',
    healingPower: -25,
    duration: 15,
    stackable: true,
    maxStack: 10,
    description: 'Deals 25 damage over 15 seconds',
    spritePosition: { row: 0, col: 1 },
    value: 35,
  },
  {
    id: 'potion_poison_deadly',
    name: 'Deadly Poison',
    type: 'POTION',
    rarity: 'RARE',
    healingPower: -50,
    duration: 20,
    stackable: true,
    maxStack: 5,
    description: 'Deals 50 damage over 20 seconds',
    spritePosition: { row: 0, col: 1 },
    value: 80,
  },

  // ENERGY POTIONS (Blue)
  {
    id: 'potion_energy_small',
    name: 'Small Energy Potion',
    type: 'POTION',
    rarity: 'COMMON',
    energyRestore: 10,
    stackable: true,
    maxStack: 10,
    description: 'Restores 10 energy',
    spritePosition: { row: 0, col: 2 },
    value: 12,
  },
  {
    id: 'potion_energy_medium',
    name: 'Energy Potion',
    type: 'POTION',
    rarity: 'UNCOMMON',
    energyRestore: 25,
    stackable: true,
    maxStack: 10,
    description: 'Restores 25 energy',
    spritePosition: { row: 0, col: 2 },
    value: 30,
  },
  {
    id: 'potion_energy_large',
    name: 'Large Energy Potion',
    type: 'POTION',
    rarity: 'RARE',
    energyRestore: 50,
    stackable: true,
    maxStack: 5,
    description: 'Restores 50 energy',
    spritePosition: { row: 0, col: 2 },
    value: 70,
  },
  {
    id: 'potion_energy_max',
    name: 'Max Energy Elixir',
    type: 'POTION',
    rarity: 'EPIC',
    energyRestore: 100,
    stackable: true,
    maxStack: 3,
    description: 'Fully restores energy',
    spritePosition: { row: 0, col: 2 },
    value: 180,
  },

  // SPEED POTIONS (Orange)
  {
    id: 'potion_speed_minor',
    name: 'Minor Speed Potion',
    type: 'POTION',
    rarity: 'COMMON',
    speedBoost: 10,
    duration: 30,
    stackable: true,
    maxStack: 10,
    description: '+10% speed for 30 seconds',
    spritePosition: { row: 1, col: 0 },
    value: 20,
  },
  {
    id: 'potion_speed_standard',
    name: 'Speed Potion',
    type: 'POTION',
    rarity: 'UNCOMMON',
    speedBoost: 25,
    duration: 60,
    stackable: true,
    maxStack: 10,
    description: '+25% speed for 1 minute',
    spritePosition: { row: 1, col: 0 },
    value: 45,
  },
  {
    id: 'potion_speed_swift',
    name: 'Swiftness Elixir',
    type: 'POTION',
    rarity: 'RARE',
    speedBoost: 50,
    duration: 120,
    stackable: true,
    maxStack: 5,
    description: '+50% speed for 2 minutes',
    spritePosition: { row: 1, col: 0 },
    value: 100,
  },
  {
    id: 'potion_speed_lightning',
    name: 'Lightning Speed',
    type: 'POTION',
    rarity: 'EPIC',
    speedBoost: 100,
    duration: 180,
    stackable: true,
    maxStack: 3,
    description: 'Double speed for 3 minutes',
    spritePosition: { row: 1, col: 0 },
    value: 250,
  },

  // STRENGTH POTIONS (Purple)
  {
    id: 'potion_strength_minor',
    name: 'Minor Strength Potion',
    type: 'POTION',
    rarity: 'COMMON',
    powerBoost: 10,
    duration: 30,
    stackable: true,
    maxStack: 10,
    description: '+10 power for 30 seconds',
    spritePosition: { row: 1, col: 1 },
    value: 22,
  },
  {
    id: 'potion_strength_standard',
    name: 'Strength Potion',
    type: 'POTION',
    rarity: 'UNCOMMON',
    powerBoost: 25,
    duration: 60,
    stackable: true,
    maxStack: 10,
    description: '+25 power for 1 minute',
    spritePosition: { row: 1, col: 1 },
    value: 48,
  },
  {
    id: 'potion_strength_mighty',
    name: 'Might Elixir',
    type: 'POTION',
    rarity: 'RARE',
    powerBoost: 50,
    duration: 120,
    stackable: true,
    maxStack: 5,
    description: '+50 power for 2 minutes',
    spritePosition: { row: 1, col: 1 },
    value: 110,
  },
  {
    id: 'potion_strength_titan',
    name: 'Titan\'s Strength',
    type: 'POTION',
    rarity: 'EPIC',
    powerBoost: 100,
    duration: 180,
    stackable: true,
    maxStack: 3,
    description: '+100 power for 3 minutes',
    spritePosition: { row: 1, col: 1 },
    value: 280,
  },

  // DEFENSE POTIONS (Light Blue/Cyan)
  {
    id: 'potion_defense_minor',
    name: 'Minor Defense Potion',
    type: 'POTION',
    rarity: 'COMMON',
    defenseBoost: 10,
    duration: 30,
    stackable: true,
    maxStack: 10,
    description: '+10 defense for 30 seconds',
    spritePosition: { row: 1, col: 2 },
    value: 20,
  },
  {
    id: 'potion_defense_standard',
    name: 'Defense Potion',
    type: 'POTION',
    rarity: 'UNCOMMON',
    defenseBoost: 25,
    duration: 60,
    stackable: true,
    maxStack: 10,
    description: '+25 defense for 1 minute',
    spritePosition: { row: 1, col: 2 },
    value: 46,
  },
  {
    id: 'potion_defense_fortify',
    name: 'Fortification Elixir',
    type: 'POTION',
    rarity: 'RARE',
    defenseBoost: 50,
    duration: 120,
    stackable: true,
    maxStack: 5,
    description: '+50 defense for 2 minutes',
    spritePosition: { row: 1, col: 2 },
    value: 105,
  },
  {
    id: 'potion_defense_invincible',
    name: 'Invincibility Draught',
    type: 'POTION',
    rarity: 'EPIC',
    defenseBoost: 100,
    duration: 30,
    stackable: true,
    maxStack: 1,
    description: '+100 defense for 30 seconds',
    spritePosition: { row: 1, col: 2 },
    value: 350,
  },

  // LEGENDARY COMBO POTIONS
  {
    id: 'potion_combo_warrior',
    name: 'Warrior\'s Elixir',
    type: 'POTION',
    rarity: 'LEGENDARY',
    powerBoost: 75,
    defenseBoost: 75,
    duration: 300,
    stackable: false,
    maxStack: 1,
    description: '+75 power and defense for 5 minutes',
    spritePosition: { row: 2, col: 0 },
    value: 800,
  },
  {
    id: 'potion_combo_assassin',
    name: 'Assassin\'s Brew',
    type: 'POTION',
    rarity: 'LEGENDARY',
    speedBoost: 75,
    powerBoost: 50,
    duration: 300,
    stackable: false,
    maxStack: 1,
    description: '+75% speed and +50 power for 5 minutes',
    spritePosition: { row: 2, col: 1 },
    value: 750,
  },

  // GOD TIER POTIONS
  {
    id: 'potion_god_immortality',
    name: 'Immortality Elixir',
    type: 'POTION',
    rarity: 'GOD_TIER',
    healingPower: 9999,
    defenseBoost: 500,
    duration: 600,
    stackable: false,
    maxStack: 1,
    description: 'Near immortality for 10 minutes',
    spritePosition: { row: 2, col: 2 },
    value: 5000,
  },
  {
    id: 'potion_god_omnipotence',
    name: 'Omnipotence Draught',
    type: 'POTION',
    rarity: 'GOD_TIER',
    powerBoost: 500,
    speedBoost: 200,
    defenseBoost: 200,
    duration: 600,
    stackable: false,
    maxStack: 1,
    description: 'Godlike power for 10 minutes',
    spritePosition: { row: 2, col: 3 },
    value: 8000,
  },
];

// Helper function to get random potion by rarity
export function getRandomPotion(rarity?: string): PotionItem {
  const filtered = rarity 
    ? POTIONS.filter(p => p.rarity === rarity)
    : POTIONS;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Helper function to get potion by ID
export function getPotionById(id: string): PotionItem | undefined {
  return POTIONS.find(p => p.id === id);
}

// Helper function to get random potion by effect type
export function getRandomPotionByType(effectType: 'health' | 'poison' | 'energy' | 'speed' | 'strength' | 'defense'): PotionItem | undefined {
  const filtered = POTIONS.filter(p => {
    switch (effectType) {
      case 'health': return p.healingPower && p.healingPower > 0;
      case 'poison': return p.healingPower && p.healingPower < 0;
      case 'energy': return p.energyRestore;
      case 'speed': return p.speedBoost;
      case 'strength': return p.powerBoost && !p.defenseBoost;
      case 'defense': return p.defenseBoost && !p.powerBoost;
      default: return false;
    }
  });
  return filtered[Math.floor(Math.random() * filtered.length)];
}