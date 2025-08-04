import { v } from 'convex/values';

// Zone types in the crime metaverse
export const ZoneType = v.union(
  v.literal('casino'),
  v.literal('darkAlley'), 
  v.literal('suburb'),
  v.literal('downtown'),
  v.literal('underground')
);

export type ZoneType = 'casino' | 'darkAlley' | 'suburb' | 'downtown' | 'underground';

// Zone configuration
export const zoneConfig = {
  casino: {
    name: 'Casino District',
    description: 'High-stakes gambling and shady deals',
    maxPlayers: 100,
    maxBots: 300,
    activities: ['gambling', 'dealing', 'drinking', 'schmoozing'],
    crimeRate: 0.3,
    policePresence: 0.2,
    requiredLevel: 0,
    ambientSounds: ['slot-machines', 'chips-clinking', 'jazz-music'],
  },
  darkAlley: {
    name: 'Dark Alleys',
    description: 'Where crimes happen and gangs rule',
    maxPlayers: 50,
    maxBots: 200,
    activities: ['robbery', 'fighting', 'drug-dealing', 'hiding'],
    crimeRate: 0.8,
    policePresence: 0.1,
    requiredLevel: 0,
    ambientSounds: ['sirens-distant', 'footsteps', 'glass-breaking'],
  },
  suburb: {
    name: 'Suburban District',
    description: 'Safe zones for building houses and storing loot',
    maxPlayers: 75,
    maxBots: 150,
    activities: ['building', 'decorating', 'trading', 'socializing'],
    crimeRate: 0.1,
    policePresence: 0.4,
    requiredLevel: 0,
    ambientSounds: ['birds-chirping', 'lawnmower', 'dogs-barking'],
  },
  downtown: {
    name: 'Downtown Hub',
    description: 'Central meeting place and shops',
    maxPlayers: 150,
    maxBots: 350,
    activities: ['shopping', 'meeting', 'recruiting', 'planning'],
    crimeRate: 0.2,
    policePresence: 0.5,
    requiredLevel: 0,
    ambientSounds: ['traffic', 'crowd-chatter', 'construction'],
  },
  underground: {
    name: 'Underground Fight Club',
    description: 'Illegal fighting rings and black markets',
    maxPlayers: 40,
    maxBots: 100,
    activities: ['fighting', 'betting', 'black-market', 'training'],
    crimeRate: 0.9,
    policePresence: 0.0,
    requiredLevel: 10,
    ambientSounds: ['crowd-roaring', 'punches', 'underground-music'],
  },
};

// Zone transition points
export const zonePortals = v.object({
  fromZone: ZoneType,
  toZone: ZoneType,
  fromPosition: v.object({ x: v.number(), y: v.number() }),
  toPosition: v.object({ x: v.number(), y: v.number() }),
  requiredLevel: v.number(),
  requiredItem: v.optional(v.string()),
});

// Instance configuration
export const instanceConfig = v.object({
  instanceId: v.string(),
  zoneType: ZoneType,
  currentPlayers: v.number(),
  currentBots: v.number(),
  status: v.union(v.literal('active'), v.literal('full'), v.literal('maintenance')),
  serverRegion: v.string(),
  createdAt: v.number(),
});