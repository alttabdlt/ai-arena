export interface BootsItem {
  id: string;
  name: string;
  type: 'BOOTS';
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'GOD_TIER';
  speedBonus: number;
  agilityBonus: number;
  defenseBonus?: number;
  jumpHeight?: number;
  description: string;
  spritePosition: { row: number; col: number };
  value: number;
}

export const BOOTS: BootsItem[] = [
  // COMMON BOOTS (Row 0, Cols 0-4)
  {
    id: 'boots_leather_brown',
    name: 'Leather Boots',
    type: 'BOOTS',
    rarity: 'COMMON',
    speedBonus: 1,
    agilityBonus: 1,
    description: 'Basic leather footwear',
    spritePosition: { row: 0, col: 0 },
    value: 10,
  },
  {
    id: 'boots_cloth_black',
    name: 'Cloth Boots',
    type: 'BOOTS',
    rarity: 'COMMON',
    speedBonus: 2,
    agilityBonus: 0,
    description: 'Lightweight cloth boots',
    spritePosition: { row: 0, col: 1 },
    value: 8,
  },
  {
    id: 'boots_leather_reinforced',
    name: 'Reinforced Boots',
    type: 'BOOTS',
    rarity: 'COMMON',
    speedBonus: 1,
    agilityBonus: 1,
    defenseBonus: 2,
    description: 'Leather with metal reinforcement',
    spritePosition: { row: 0, col: 2 },
    value: 15,
  },
  {
    id: 'boots_traveler',
    name: 'Traveler\'s Boots',
    type: 'BOOTS',
    rarity: 'COMMON',
    speedBonus: 2,
    agilityBonus: 1,
    description: 'Comfortable for long journeys',
    spritePosition: { row: 0, col: 3 },
    value: 12,
  },
  {
    id: 'boots_work',
    name: 'Work Boots',
    type: 'BOOTS',
    rarity: 'COMMON',
    speedBonus: 0,
    agilityBonus: 0,
    defenseBonus: 3,
    description: 'Sturdy work boots',
    spritePosition: { row: 0, col: 4 },
    value: 10,
  },

  // UNCOMMON BOOTS (Row 1, Cols 0-4)
  {
    id: 'boots_combat_green',
    name: 'Combat Boots',
    type: 'BOOTS',
    rarity: 'UNCOMMON',
    speedBonus: 3,
    agilityBonus: 3,
    defenseBonus: 4,
    description: 'Military grade footwear',
    spritePosition: { row: 1, col: 0 },
    value: 45,
  },
  {
    id: 'boots_tactical_blue',
    name: 'Tactical Boots',
    type: 'BOOTS',
    rarity: 'UNCOMMON',
    speedBonus: 4,
    agilityBonus: 4,
    jumpHeight: 2,
    description: 'Enhanced mobility boots',
    spritePosition: { row: 1, col: 1 },
    value: 50,
  },
  {
    id: 'boots_runner_blue',
    name: 'Runner\'s Boots',
    type: 'BOOTS',
    rarity: 'UNCOMMON',
    speedBonus: 5,
    agilityBonus: 2,
    description: 'Built for speed',
    spritePosition: { row: 1, col: 2 },
    value: 48,
  },
  {
    id: 'boots_stealth_navy',
    name: 'Stealth Boots',
    type: 'BOOTS',
    rarity: 'UNCOMMON',
    speedBonus: 3,
    agilityBonus: 5,
    description: 'Silent movement',
    spritePosition: { row: 1, col: 3 },
    value: 55,
  },
  {
    id: 'boots_jump_purple',
    name: 'Jump Boots',
    type: 'BOOTS',
    rarity: 'UNCOMMON',
    speedBonus: 2,
    agilityBonus: 3,
    jumpHeight: 5,
    description: 'Enhanced jumping ability',
    spritePosition: { row: 1, col: 4 },
    value: 52,
  },

  // RARE BOOTS (Row 2, Cols 0-4)
  {
    id: 'boots_ranger_green',
    name: 'Ranger Boots',
    type: 'BOOTS',
    rarity: 'RARE',
    speedBonus: 8,
    agilityBonus: 6,
    defenseBonus: 5,
    description: 'Elite ranger footwear',
    spritePosition: { row: 2, col: 0 },
    value: 150,
  },
  {
    id: 'boots_chainmail',
    name: 'Chainmail Boots',
    type: 'BOOTS',
    rarity: 'RARE',
    speedBonus: 4,
    agilityBonus: 3,
    defenseBonus: 10,
    description: 'Heavy armored boots',
    spritePosition: { row: 2, col: 1 },
    value: 140,
  },
  {
    id: 'boots_winged_red',
    name: 'Winged Boots',
    type: 'BOOTS',
    rarity: 'RARE',
    speedBonus: 10,
    agilityBonus: 8,
    jumpHeight: 8,
    description: 'Mythical winged footwear',
    spritePosition: { row: 2, col: 2 },
    value: 180,
  },
  {
    id: 'boots_mystic_purple',
    name: 'Mystic Boots',
    type: 'BOOTS',
    rarity: 'RARE',
    speedBonus: 7,
    agilityBonus: 10,
    description: 'Enchanted with ancient magic',
    spritePosition: { row: 2, col: 3 },
    value: 165,
  },
  {
    id: 'boots_assassin_purple',
    name: 'Assassin Boots',
    type: 'BOOTS',
    rarity: 'RARE',
    speedBonus: 9,
    agilityBonus: 12,
    description: 'Perfect for silent kills',
    spritePosition: { row: 2, col: 4 },
    value: 175,
  },

  // EPIC BOOTS (Row 3, Cols 0-3)
  {
    id: 'boots_plate_gray',
    name: 'Plate Boots',
    type: 'BOOTS',
    rarity: 'EPIC',
    speedBonus: 5,
    agilityBonus: 5,
    defenseBonus: 20,
    description: 'Heavy plate armor boots',
    spritePosition: { row: 3, col: 0 },
    value: 400,
  },
  {
    id: 'boots_rocket',
    name: 'Rocket Boots',
    type: 'BOOTS',
    rarity: 'EPIC',
    speedBonus: 15,
    agilityBonus: 10,
    jumpHeight: 15,
    description: 'Jet-powered footwear',
    spritePosition: { row: 3, col: 1 },
    value: 450,
  },
  {
    id: 'boots_shadow_black',
    name: 'Shadow Walkers',
    type: 'BOOTS',
    rarity: 'EPIC',
    speedBonus: 12,
    agilityBonus: 18,
    description: 'Phase through shadows',
    spritePosition: { row: 3, col: 2 },
    value: 480,
  },
  {
    id: 'boots_time_blue',
    name: 'Temporal Boots',
    type: 'BOOTS',
    rarity: 'EPIC',
    speedBonus: 14,
    agilityBonus: 14,
    jumpHeight: 10,
    description: 'Manipulate time while moving',
    spritePosition: { row: 3, col: 3 },
    value: 500,
  },

  // LEGENDARY BOOTS (Row 3, Col 4 and Row 4, Cols 0-1)
  {
    id: 'boots_demon_red',
    name: 'Demon Striders',
    type: 'BOOTS',
    rarity: 'LEGENDARY',
    speedBonus: 20,
    agilityBonus: 25,
    defenseBonus: 15,
    jumpHeight: 20,
    description: 'Forged in hellfire',
    spritePosition: { row: 3, col: 4 },
    value: 1100,
  },
  {
    id: 'boots_hermes_gold',
    name: 'Hermes\' Sandals',
    type: 'BOOTS',
    rarity: 'LEGENDARY',
    speedBonus: 30,
    agilityBonus: 20,
    jumpHeight: 25,
    description: 'Blessed by the messenger god',
    spritePosition: { row: 4, col: 0 },
    value: 1200,
  },
  {
    id: 'boots_void_purple',
    name: 'Void Striders',
    type: 'BOOTS',
    rarity: 'LEGENDARY',
    speedBonus: 25,
    agilityBonus: 30,
    description: 'Walk between dimensions',
    spritePosition: { row: 4, col: 1 },
    value: 1150,
  },

  // GOD TIER BOOTS (Row 4, Cols 2-3)
  {
    id: 'boots_divine_golden',
    name: 'Divine Swiftness',
    type: 'BOOTS',
    rarity: 'GOD_TIER',
    speedBonus: 50,
    agilityBonus: 40,
    defenseBonus: 30,
    jumpHeight: 50,
    description: 'Move at the speed of light',
    spritePosition: { row: 4, col: 2 },
    value: 6000,
  },
  {
    id: 'boots_infinity_cosmic',
    name: 'Infinity Striders',
    type: 'BOOTS',
    rarity: 'GOD_TIER',
    speedBonus: 60,
    agilityBonus: 50,
    jumpHeight: 100,
    description: 'Transcend physical limitations',
    spritePosition: { row: 4, col: 3 },
    value: 8000,
  },
];

// Helper function to get random boots by rarity
export function getRandomBoots(rarity?: string): BootsItem {
  const filtered = rarity 
    ? BOOTS.filter(b => b.rarity === rarity)
    : BOOTS;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Helper function to get boots by ID
export function getBootsById(id: string): BootsItem | undefined {
  return BOOTS.find(b => b.id === id);
}