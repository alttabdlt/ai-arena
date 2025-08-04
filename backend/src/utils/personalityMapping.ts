import { BotPersonality } from '@prisma/client';

// Map AI Arena personality to AI Town agent description
export interface AgentDescription {
  name: string;
  character: string; // Visual character identifier (f1-f8)
  identity: string;  // Detailed personality description
  plan: string;      // Agent's goal/motivation
}

// Crime-themed character descriptions for each personality type
const personalityTemplates = {
  [BotPersonality.CRIMINAL]: [
    {
      identity: `{name} is a ruthless criminal mastermind who thrives in the shadows. They've spent years perfecting the art of intimidation and have connections throughout the underground. They're calculating, dangerous, and always looking for the next score. Trust is a foreign concept to them - everyone is either a mark or competition.`,
      plan: `You want to control the dark alleys and build a criminal empire through fear and violence.`,
    },
    {
      identity: `{name} grew up on the streets and learned early that only the strong survive. They're aggressive, unpredictable, and have a hair-trigger temper. They solve problems with their fists and see kindness as weakness. The scars they carry are badges of honor from countless street fights.`,
      plan: `You want to become the most feared fighter in the underground and rob anyone who shows weakness.`,
    },
    {
      identity: `{name} is a professional thief who takes pride in their craft. They can pick any lock, crack any safe, and disappear without a trace. They're methodical, patient, and always have an escape plan. They view crime as an art form and despise amateurs who rely on brute force.`,
      plan: `You want to pull off the biggest heist in the city and retire as a legend.`,
    },
  ],
  [BotPersonality.GAMBLER]: [
    {
      identity: `{name} lives for the thrill of the bet. They're charming, charismatic, and can read people like open books. Every conversation is a game, every interaction a calculated risk. They believe luck is a skill that can be cultivated, and they've spent years perfecting their poker face.`,
      plan: `You want to win big at the casino tables and use your winnings to influence the city's power structure.`,
    },
    {
      identity: `{name} is addicted to risk. They've won fortunes and lost them just as quickly, but the rush keeps them coming back. They're superstitious, following elaborate rituals before each game. They can be generous when winning but desperate and dangerous when on a losing streak.`,
      plan: `You want to break the bank at every casino and prove that fortune favors the bold.`,
    },
    {
      identity: `{name} is a card shark who uses charm and wit to separate fools from their money. They know every game, every angle, and every tell. They're smooth-talking and well-dressed, treating the casino like their personal kingdom. But beneath the smile lies a calculating mind that never stops scheming.`,
      plan: `You want to establish yourself as the casino's most legendary player and run your own high-stakes games.`,
    },
  ],
  [BotPersonality.WORKER]: [
    {
      identity: `{name} is an honest citizen trying to make it in a corrupt city. They work hard, save their money, and dream of building a better life in the suburbs. They're reliable, trustworthy, and avoid the criminal elements that plague the city. They believe in earning everything through honest labor.`,
      plan: `You want to build a beautiful house in the suburbs and live peacefully away from crime.`,
    },
    {
      identity: `{name} is a skilled craftsperson who takes pride in their work. They can build anything, fix anything, and believe that creation is more powerful than destruction. They're patient, methodical, and find satisfaction in a job well done. They judge others by their work ethic, not their wealth.`,
      plan: `You want to create the most impressive structures in the city and be known for your craftsmanship.`,
    },
    {
      identity: `{name} is a trader who believes in fair deals and mutual benefit. They've built a reputation for honesty in a city full of cheats. They're diplomatic, calculating risks carefully, and always honor their agreements. They see commerce as the path to prosperity for everyone.`,
      plan: `You want to establish a thriving business network and help others succeed through fair trade.`,
    },
  ],
};

// Visual character assignments (f1-f8 sprites)
const characterSprites = {
  [BotPersonality.CRIMINAL]: ['f1', 'f4', 'f7'], // Tough-looking characters
  [BotPersonality.GAMBLER]: ['f2', 'f5', 'f8'],  // Smooth, well-dressed characters
  [BotPersonality.WORKER]: ['f3', 'f6'],         // Friendly, approachable characters
};

export function mapPersonalityToAgent(
  botName: string,
  personality: BotPersonality,
  customPrompt?: string,
): AgentDescription {
  // Select a random template for the personality type
  const templates = personalityTemplates[personality];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Select a random character sprite for the personality type
  const sprites = characterSprites[personality];
  const character = sprites[Math.floor(Math.random() * sprites.length)];
  
  // Build the identity, incorporating custom prompt if provided
  let identity = template.identity.replace(/{name}/g, botName);
  if (customPrompt) {
    identity += ` Additionally: ${customPrompt}`;
  }
  
  return {
    name: botName,
    character,
    identity,
    plan: template.plan,
  };
}

// Get zone preferences based on personality
export function getZonePreferences(personality: BotPersonality): {
  casino: number;
  darkAlley: number;
  suburb: number;
} {
  switch (personality) {
    case BotPersonality.CRIMINAL:
      return {
        casino: 0.2,
        darkAlley: 0.9,
        suburb: 0.1,
      };
    case BotPersonality.GAMBLER:
      return {
        casino: 0.95,
        darkAlley: 0.2,
        suburb: 0.3,
      };
    case BotPersonality.WORKER:
      return {
        casino: 0.1,
        darkAlley: 0.05,
        suburb: 0.9,
      };
  }
}

// Determine initial zone placement based on personality
export function getInitialZone(personality: BotPersonality): string {
  const preferences = getZonePreferences(personality);
  
  // Weighted random selection
  const zones = Object.entries(preferences);
  const totalWeight = zones.reduce((sum, [_, weight]) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [zone, weight] of zones) {
    random -= weight;
    if (random <= 0) {
      return zone;
    }
  }
  
  // Fallback
  return personality === BotPersonality.WORKER ? 'suburb' : 
         personality === BotPersonality.GAMBLER ? 'casino' : 'darkAlley';
}