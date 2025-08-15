export interface ArmorItem {
  id: string;
  name: string;
  type: 'ARMOR';
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'GOD_TIER';
  defenseBonus: number;
  powerBonus?: number;
  speedPenalty?: number;
  durability: number;
  description: string;
  spritePosition: { row: number; col: number };
  value: number;
}

export const ARMOR: ArmorItem[] = [
  // COMMON ARMOR (Row 0, Cols 0-4)
  {
    id: 'armor_leather_basic',
    name: 'Leather Vest',
    type: 'ARMOR',
    rarity: 'COMMON',
    defenseBonus: 3,
    durability: 50,
    description: 'Basic leather protection',
    spritePosition: { row: 0, col: 0 },
    value: 15,
  },
  {
    id: 'armor_cloth_tunic',
    name: 'Cloth Tunic',
    type: 'ARMOR',
    rarity: 'COMMON',
    defenseBonus: 2,
    durability: 30,
    description: 'Simple cloth armor',
    spritePosition: { row: 0, col: 1 },
    value: 10,
  },
  {
    id: 'armor_leather_reinforced',
    name: 'Reinforced Leather',
    type: 'ARMOR',
    rarity: 'COMMON',
    defenseBonus: 5,
    durability: 60,
    speedPenalty: -1,
    description: 'Leather with metal studs',
    spritePosition: { row: 0, col: 2 },
    value: 20,
  },
  {
    id: 'armor_padded',
    name: 'Padded Armor',
    type: 'ARMOR',
    rarity: 'COMMON',
    defenseBonus: 4,
    durability: 45,
    description: 'Thick padded protection',
    spritePosition: { row: 0, col: 3 },
    value: 18,
  },
  {
    id: 'armor_chainmail_basic',
    name: 'Basic Chainmail',
    type: 'ARMOR',
    rarity: 'COMMON',
    defenseBonus: 6,
    durability: 70,
    speedPenalty: -2,
    description: 'Simple chain links',
    spritePosition: { row: 0, col: 4 },
    value: 25,
  },

  // UNCOMMON ARMOR (Row 1, Cols 0-4)
  {
    id: 'armor_forest_green',
    name: 'Forest Ranger Armor',
    type: 'ARMOR',
    rarity: 'UNCOMMON',
    defenseBonus: 10,
    durability: 80,
    description: 'Camouflaged ranger gear',
    spritePosition: { row: 1, col: 0 },
    value: 60,
  },
  {
    id: 'armor_tactical_cyan',
    name: 'Tactical Vest',
    type: 'ARMOR',
    rarity: 'UNCOMMON',
    defenseBonus: 12,
    durability: 90,
    speedPenalty: -1,
    description: 'Modern tactical armor',
    spritePosition: { row: 1, col: 1 },
    value: 70,
  },
  {
    id: 'armor_marine_blue',
    name: 'Marine Armor',
    type: 'ARMOR',
    rarity: 'UNCOMMON',
    defenseBonus: 14,
    durability: 95,
    speedPenalty: -2,
    description: 'Standard marine protection',
    spritePosition: { row: 1, col: 2 },
    value: 75,
  },
  {
    id: 'armor_scout_blue',
    name: 'Scout Armor',
    type: 'ARMOR',
    rarity: 'UNCOMMON',
    defenseBonus: 11,
    durability: 75,
    description: 'Light but effective',
    spritePosition: { row: 1, col: 3 },
    value: 65,
  },
  {
    id: 'armor_mystic_purple',
    name: 'Mystic Robes',
    type: 'ARMOR',
    rarity: 'UNCOMMON',
    defenseBonus: 9,
    powerBonus: 5,
    durability: 70,
    description: 'Enchanted cloth armor',
    spritePosition: { row: 1, col: 4 },
    value: 68,
  },

  // RARE ARMOR (Row 2, Cols 0-4)
  {
    id: 'armor_golden_plate',
    name: 'Golden Plate',
    type: 'ARMOR',
    rarity: 'RARE',
    defenseBonus: 22,
    durability: 120,
    speedPenalty: -3,
    description: 'Ornate golden armor',
    spritePosition: { row: 2, col: 0 },
    value: 200,
  },
  {
    id: 'armor_knight_steel',
    name: 'Knight\'s Armor',
    type: 'ARMOR',
    rarity: 'RARE',
    defenseBonus: 25,
    durability: 150,
    speedPenalty: -4,
    description: 'Heavy knight protection',
    spritePosition: { row: 2, col: 1 },
    value: 220,
  },
  {
    id: 'armor_crimson_warrior',
    name: 'Crimson Warrior Plate',
    type: 'ARMOR',
    rarity: 'RARE',
    defenseBonus: 24,
    powerBonus: 8,
    durability: 130,
    speedPenalty: -3,
    description: 'Blood-red warrior armor',
    spritePosition: { row: 2, col: 2 },
    value: 210,
  },
  {
    id: 'armor_shadow_purple',
    name: 'Shadow Armor',
    type: 'ARMOR',
    rarity: 'RARE',
    defenseBonus: 20,
    durability: 110,
    description: 'Armor that blends with shadows',
    spritePosition: { row: 2, col: 3 },
    value: 190,
  },
  {
    id: 'armor_emerald_scale',
    name: 'Emerald Scale Mail',
    type: 'ARMOR',
    rarity: 'RARE',
    defenseBonus: 23,
    durability: 125,
    speedPenalty: -2,
    description: 'Dragon scale armor',
    spritePosition: { row: 2, col: 4 },
    value: 205,
  },

  // EPIC ARMOR (Row 3, Cols 0-3)
  {
    id: 'armor_obsidian_plate',
    name: 'Obsidian Plate',
    type: 'ARMOR',
    rarity: 'EPIC',
    defenseBonus: 40,
    durability: 200,
    speedPenalty: -5,
    description: 'Volcanic glass armor',
    spritePosition: { row: 3, col: 0 },
    value: 500,
  },
  {
    id: 'armor_titanium',
    name: 'Titanium Armor',
    type: 'ARMOR',
    rarity: 'EPIC',
    defenseBonus: 45,
    durability: 250,
    speedPenalty: -3,
    description: 'Ultra-light titanium alloy',
    spritePosition: { row: 3, col: 1 },
    value: 550,
  },
  {
    id: 'armor_demon_black',
    name: 'Demon Plate',
    type: 'ARMOR',
    rarity: 'EPIC',
    defenseBonus: 42,
    powerBonus: 15,
    durability: 220,
    speedPenalty: -4,
    description: 'Forged from demon hide',
    spritePosition: { row: 3, col: 2 },
    value: 520,
  },
  {
    id: 'armor_void_black',
    name: 'Void Armor',
    type: 'ARMOR',
    rarity: 'EPIC',
    defenseBonus: 38,
    durability: 180,
    description: 'Absorbs incoming damage',
    spritePosition: { row: 3, col: 3 },
    value: 480,
  },

  // LEGENDARY ARMOR (Row 3, Col 4 and Row 4, Cols 0-1)
  {
    id: 'armor_dragon_red',
    name: 'Dragon Lord Armor',
    type: 'ARMOR',
    rarity: 'LEGENDARY',
    defenseBonus: 80,
    powerBonus: 20,
    durability: 500,
    speedPenalty: -4,
    description: 'Ancient dragon scale plate',
    spritePosition: { row: 3, col: 4 },
    value: 1500,
  },
  {
    id: 'armor_celestial_white',
    name: 'Celestial Plate',
    type: 'ARMOR',
    rarity: 'LEGENDARY',
    defenseBonus: 85,
    durability: 600,
    speedPenalty: -2,
    description: 'Blessed by the heavens',
    spritePosition: { row: 4, col: 0 },
    value: 1600,
  },
  {
    id: 'armor_infernal_orange',
    name: 'Infernal Armor',
    type: 'ARMOR',
    rarity: 'LEGENDARY',
    defenseBonus: 75,
    powerBonus: 30,
    durability: 450,
    speedPenalty: -3,
    description: 'Wreathed in eternal flames',
    spritePosition: { row: 4, col: 1 },
    value: 1400,
  },

  // GOD TIER ARMOR (Row 4, Cols 2-3)
  {
    id: 'armor_divine_golden',
    name: 'Divine Aegis',
    type: 'ARMOR',
    rarity: 'GOD_TIER',
    defenseBonus: 150,
    powerBonus: 50,
    durability: 1000,
    description: 'Armor of the gods',
    spritePosition: { row: 4, col: 2 },
    value: 7000,
  },
  {
    id: 'armor_infinity_cosmic',
    name: 'Infinity Plate',
    type: 'ARMOR',
    rarity: 'GOD_TIER',
    defenseBonus: 200,
    durability: 9999,
    description: 'Indestructible cosmic armor',
    spritePosition: { row: 4, col: 3 },
    value: 10000,
  },
];

// Helper function to get random armor by rarity
export function getRandomArmor(rarity?: string): ArmorItem {
  const filtered = rarity 
    ? ARMOR.filter(a => a.rarity === rarity)
    : ARMOR;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Helper function to get armor by ID
export function getArmorById(id: string): ArmorItem | undefined {
  return ARMOR.find(a => a.id === id);
}