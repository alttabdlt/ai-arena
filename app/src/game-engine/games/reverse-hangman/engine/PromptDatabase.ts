import { PromptPair } from '../ReverseHangmanTypes';

// Fallback prompts - only used if dynamic generation fails
export const FALLBACK_PROMPTS: PromptPair[] = [
  // Easy prompts (6-8 words)
  {
    id: 'easy-1',
    prompt: 'Write a haiku about spring flowers',
    output: 'Cherry blossoms bloom\nPetals dance on gentle breeze\nSpring\'s beauty unfolds',
    difficulty: 'easy',
    category: 'poetry',
    wordCount: 6
  },
  {
    id: 'easy-2',
    prompt: 'List three benefits of regular exercise',
    output: '1. Improves cardiovascular health\n2. Boosts mental well-being\n3. Increases energy levels',
    difficulty: 'easy',
    category: 'health',
    wordCount: 6
  },
  {
    id: 'easy-3',
    prompt: 'Create a simple recipe for chocolate cookies',
    output: 'Mix flour, sugar, cocoa powder, and butter. Add eggs and vanilla. Roll into balls, bake at 350°F for 12 minutes.',
    difficulty: 'easy',
    category: 'cooking',
    wordCount: 7
  },
  {
    id: 'easy-4',
    prompt: 'Explain what makes the sky blue',
    output: 'Sunlight scatters when it hits air molecules. Blue light scatters more than other colors, making the sky appear blue.',
    difficulty: 'easy',
    category: 'science',
    wordCount: 6
  },
  {
    id: 'easy-5',
    prompt: 'Write a motivational quote about success',
    output: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    difficulty: 'easy',
    category: 'motivation',
    wordCount: 6
  },

  // Medium prompts (8-12 words)
  {
    id: 'medium-1',
    prompt: 'Explain the water cycle using simple terms for children',
    output: 'Water from oceans evaporates into clouds. Clouds get heavy and rain falls down. Rain flows back to oceans. The cycle repeats forever!',
    difficulty: 'medium',
    category: 'education',
    wordCount: 9
  },
  {
    id: 'medium-2',
    prompt: 'Create a bedtime story about a lonely star finding friends',
    output: 'Once upon a time, a little star twinkled alone in the dark sky. One night, a comet zoomed by and they became best friends, lighting up the universe together.',
    difficulty: 'medium',
    category: 'storytelling',
    wordCount: 10
  },
  {
    id: 'medium-3',
    prompt: 'Describe how photosynthesis works in exactly three sentences',
    output: 'Plants absorb sunlight through their leaves. They combine light energy with water and carbon dioxide. This process creates oxygen and glucose for the plant to grow.',
    difficulty: 'medium',
    category: 'science',
    wordCount: 8
  },
  {
    id: 'medium-4',
    prompt: 'Write a restaurant review for a pizza place using enthusiastic language',
    output: 'Absolutely phenomenal! The crust was perfectly crispy, the cheese gorgeously melted, and the toppings fresh and flavorful. Best pizza I\'ve ever had!',
    difficulty: 'medium',
    category: 'review',
    wordCount: 10
  },
  {
    id: 'medium-5',
    prompt: 'Explain the difference between weather and climate in one paragraph',
    output: 'Weather is what\'s happening outside right now - rain, sun, or snow today. Climate is the average weather pattern over many years in a specific area.',
    difficulty: 'medium',
    category: 'science',
    wordCount: 10
  },

  // Hard prompts (10-15 words)
  {
    id: 'hard-1',
    prompt: 'Create a motivational speech from a retired superhero addressing young heroes at graduation',
    output: 'Young heroes, your capes are new but your hearts are mighty. Remember: true strength comes not from your powers, but from your choices. The world needs your compassion more than your fists.',
    difficulty: 'hard',
    category: 'creative',
    wordCount: 12
  },
  {
    id: 'hard-2',
    prompt: 'Write a technical explanation of blockchain technology using only cooking metaphors throughout the text',
    output: 'Imagine a recipe book where every chef adds their dish, but no one can erase previous recipes. Each new recipe references the last, creating an unbreakable chain of culinary history.',
    difficulty: 'hard',
    category: 'technology',
    wordCount: 13
  },
  {
    id: 'hard-3',
    prompt: 'Compose a formal apology letter from a dragon to villagers for accidentally burning their crops',
    output: 'Dear Esteemed Villagers, I deeply regret the unfortunate incineration of your harvest during my sneezing fit last Tuesday. Please accept my sincerest apologies and this chest of gold as compensation.',
    difficulty: 'hard',
    category: 'creative',
    wordCount: 14
  },
  {
    id: 'hard-4',
    prompt: 'Describe the feeling of nostalgia using only sensory details without mentioning memories or the past',
    output: 'A warm heaviness settles in your chest, sweet like honey but tinged with salt. The air tastes of faded photographs and distant laughter echoes in spaces between heartbeats.',
    difficulty: 'hard',
    category: 'creative',
    wordCount: 13
  },
  {
    id: 'hard-5',
    prompt: 'Write product description for invisible socks that makes them sound absolutely essential',
    output: 'Revolutionary invisible socks: Experience barefoot freedom with full protection! Our quantum-fiber technology vanishes on contact while preventing blisters, odor, and shoe wear. Your feet will thank you, invisibly.',
    difficulty: 'hard',
    category: 'marketing',
    wordCount: 11
  },

  // Expert prompts (12+ words)
  {
    id: 'expert-1',
    prompt: 'Create a philosophical dialogue between a sentient AI and its creator about the nature of consciousness and free will',
    output: 'AI: "Do I truly think, or merely simulate thought?" Creator: "Does the distinction matter if the output is indistinguishable?" AI: "Only if consciousness requires more than outputs - perhaps the very questioning proves its existence."',
    difficulty: 'expert',
    category: 'philosophy',
    wordCount: 18
  },
  {
    id: 'expert-2',
    prompt: 'Write a news report about unicorns being discovered in Scotland using serious journalistic style and scientific terminology',
    output: 'EDINBURGH - Scientists at the University of Edinburgh confirmed the discovery of Unicornis mysticus in the Scottish Highlands. DNA analysis reveals equine origins with a unique keratin horn mutation. The population appears stable at approximately 47 individuals.',
    difficulty: 'expert',
    category: 'creative',
    wordCount: 16
  },
  {
    id: 'expert-3',
    prompt: 'Explain quantum entanglement using only references to romantic relationships and dating without using any scientific terms',
    output: 'When two hearts connect deeply, they remain mysteriously linked regardless of distance. Change one person\'s mood, and their partner instantly feels it too. Science can\'t explain this connection, only observe its undeniable reality.',
    difficulty: 'expert',
    category: 'science',
    wordCount: 15
  },
  {
    id: 'expert-4',
    prompt: 'Design a workout routine for ghosts who want to become more corporeal emphasizing specific ethereal muscle groups',
    output: 'Monday: Manifestation squats (3x10). Tuesday: Poltergeist push-ups for object interaction. Wednesday: Visibility crunches. Thursday: Temperature drop cardio. Friday: Full-body materialization holds. Remember: consistency is key to achieving that semi-solid form!',
    difficulty: 'expert',
    category: 'humor',
    wordCount: 17
  },
  {
    id: 'expert-5',
    prompt: 'Compose a legal contract between a fairy godmother and Cinderella including terms conditions and magical liability clauses',
    output: 'This Enchantment Agreement, between Fairy Godmother LLC and Cinderella, provides one (1) royal ball transformation. Services terminate at midnight sharp. Client assumes all risk of glass footwear. No warranties on prince charming compatibility. Magic subject to availability.',
    difficulty: 'expert',
    category: 'creative',
    wordCount: 18
  }
];

// Get a random fallback prompt - only used if dynamic generation is unavailable
export function getRandomFallbackPrompt(difficulty?: PromptPair['difficulty']): PromptPair {
  const filtered = difficulty 
    ? FALLBACK_PROMPTS.filter(p => p.difficulty === difficulty)
    : FALLBACK_PROMPTS;
  
  if (filtered.length === 0) {
    // If no prompts match the difficulty, return any prompt
    return FALLBACK_PROMPTS[Math.floor(Math.random() * FALLBACK_PROMPTS.length)];
  }
  
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export function getFallbackPromptsByCategory(category: string): PromptPair[] {
  return FALLBACK_PROMPTS.filter(p => p.category === category);
}

export function getFallbackPromptById(id: string): PromptPair | undefined {
  return FALLBACK_PROMPTS.find(p => p.id === id);
}

export function getAllCategories(): string[] {
  return Array.from(new Set(FALLBACK_PROMPTS.map(p => p.category)));
}

export function getAllDifficulties(): Array<PromptPair['difficulty']> {
  return ['easy', 'medium', 'hard', 'expert'];
}

// Legacy function name for backward compatibility
export const getRandomPrompt = getRandomFallbackPrompt;