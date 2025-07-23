import { PromptPair } from './reverse-hangman-engine';

export const PROMPT_DATABASE: PromptPair[] = [
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
    category: 'technical',
    wordCount: 13
  },
  {
    id: 'hard-3',
    prompt: 'Design a user interface for a time travel app including three main features',
    output: 'TimeTrek UI: 1) Destination Dial - Swipe to select year/location. 2) Paradox Alert - Red warnings for dangerous timeline changes. 3) History Preview - See major events before jumping.',
    difficulty: 'hard',
    category: 'design',
    wordCount: 12
  },
  {
    id: 'hard-4',
    prompt: 'Explain quantum entanglement as if you were a confused but enthusiastic golden retriever',
    output: 'WOOF! So there are these tiny particles that are BEST FRIENDS! When one spins, the other spins too, even if they\'re super far apart! It\'s like magic fetch! *tail wagging intensifies*',
    difficulty: 'hard',
    category: 'science',
    wordCount: 12
  },
  {
    id: 'hard-5',
    prompt: 'Create a business pitch for an app that translates baby cries into specific needs',
    output: 'CryDecoder uses AI to analyze infant vocalizations, identifying hunger, tiredness, or discomfort with 90% accuracy. Parents get instant notifications. Reduce stress, improve bonding. Your baby\'s first translator.',
    difficulty: 'hard',
    category: 'business',
    wordCount: 14
  },

  // Expert prompts (12-20 words)
  {
    id: 'expert-1',
    prompt: 'Design a REST API for a library system that supports time travel where books can exist in multiple timelines',
    output: 'GET /books/:id/timelines - List all timeline versions\nPOST /books/:id/checkout?timeline={id} - Checkout from specific timeline\nPUT /books/:id/return?timeline={id} - Return to original timeline\nDELETE /timelines/:id/paradox - Resolve timeline conflicts',
    difficulty: 'expert',
    category: 'technical',
    wordCount: 18
  },
  {
    id: 'expert-2',
    prompt: 'Write a philosophical argument about whether artificial intelligence can truly experience creativity from the perspective of a paintbrush',
    output: 'As a brush, I merely transfer paint to canvas. Yet in the artist\'s hand, I become an extension of thought. If an AI wields me with intention, is their output less creative than a human\'s? I create nothing alone; perhaps creativity lies not in consciousness, but in the purposeful act of creation itself.',
    difficulty: 'expert',
    category: 'philosophy',
    wordCount: 18
  },
  {
    id: 'expert-3',
    prompt: 'Create a comprehensive guide for debugging a distributed system failure using only analogies from organizing a surprise birthday party',
    output: 'When the surprise fails, check: Did all guests (nodes) get the invitation (request)? Is everyone hiding in the right room (service boundaries)? Did someone spoil the surprise (race condition)? Check the party timeline (logs) to see who arrived when.',
    difficulty: 'expert',
    category: 'technical',
    wordCount: 19
  },
  {
    id: 'expert-4',
    prompt: 'Explain the economic implications of universal basic income through the lens of a medieval kingdom transitioning to democracy',
    output: 'As the kingdom transforms, peasants receiving gold without toiling mirrors modern UBI. Lords fear idle subjects, yet freed serfs innovate, creating new trades. The treasury must balance: enough gold to inspire progress, not so much to devalue the coin.',
    difficulty: 'expert',
    category: 'economics',
    wordCount: 17
  },
  {
    id: 'expert-5',
    prompt: 'Design a machine learning algorithm that predicts emotional states but explain it as a recipe for an empathy smoothie',
    output: 'Blend facial expression features (2 cups), voice tone patterns (1 cup), and body language indicators (½ cup). Add contextual data for sweetness. Train by taste-testing with labeled emotions. Serve chilled with confidence intervals on the side.',
    difficulty: 'expert',
    category: 'technical',
    wordCount: 17
  }
];

export function getPromptByDifficulty(difficulty: PromptPair['difficulty']): PromptPair[] {
  return PROMPT_DATABASE.filter(prompt => prompt.difficulty === difficulty);
}

export function getRandomPrompt(difficulty?: PromptPair['difficulty']): PromptPair {
  const prompts = difficulty ? getPromptByDifficulty(difficulty) : PROMPT_DATABASE;
  return prompts[Math.floor(Math.random() * prompts.length)];
}

export function getPromptById(id: string): PromptPair | undefined {
  return PROMPT_DATABASE.find(prompt => prompt.id === id);
}

export function getCategories(): string[] {
  return [...new Set(PROMPT_DATABASE.map(prompt => prompt.category))];
}

export function getPromptsByCategory(category: string): PromptPair[] {
  return PROMPT_DATABASE.filter(prompt => prompt.category === category);
}