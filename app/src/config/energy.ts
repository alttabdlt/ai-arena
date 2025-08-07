// Energy consumption rates for different AI models
// Energy is consumed per hour when bot is active in metaverse

export const ENERGY_RATES: Record<string, number> = {
  // Basic tier - 1 energy/hour
  GPT_4O_MINI: 1,
  DEEPSEEK_CHAT: 1,
  CLAUDE_3_5_HAIKU: 1,
  LLAMA_3_1_70B: 1,
  LLAMA_3_2_90B: 1,
  QWEN_2_5_72B: 1,
  DEEPSEEK_V3: 1,
  
  // Standard tier - 2 energy/hour
  GPT_4O: 2,
  CLAUDE_3_5_SONNET: 2,
  GEMINI_2_5_PRO: 2,
  LLAMA_3_1_405B: 2,
  KIMI_K2: 2,
  MIXTRAL_8X22B: 2,
  
  // Advanced tier - 3 energy/hour
  CLAUDE_4_SONNET: 3,
  O3_MINI: 3,
  DEEPSEEK_R1: 3,
  QWQ_32B: 3,
  CLAUDE_3_OPUS: 3,
  QWEN_2_5_MAX: 3,
  QVQ_72B_PREVIEW: 3,
  GROK_3: 3,
  
  // Premium tier - 5 energy/hour
  O3: 5,
  O3_PRO: 5,
  CLAUDE_4_OPUS: 5,
  GEMINI_2_5_PRO_DEEP_THINK: 5,
};

// Energy regeneration rate (free)
export const ENERGY_REGEN_RATE = 1; // 1 energy per hour

// Maximum energy capacity
export const MAX_ENERGY = 100;

// Starting energy for new bots
export const STARTING_ENERGY = 100;

// Tournament participation cost
export const TOURNAMENT_ENERGY_COST = 10;

// Get energy rate for a model
export function getEnergyRate(modelId: string): number {
  return ENERGY_RATES[modelId] || 1;
}

// Calculate daily energy consumption
export function getDailyEnergyConsumption(modelId: string): number {
  return getEnergyRate(modelId) * 24;
}

// Calculate how long a bot can run with given energy
export function getRuntime(energy: number, modelId: string): number {
  const rate = getEnergyRate(modelId);
  return Math.floor(energy / rate);
}

// Format energy rate for display
export function formatEnergyRate(modelId: string): string {
  const rate = getEnergyRate(modelId);
  return `${rate} ⚡/hour`;
}

// Calculate net energy consumption (with regeneration)
export function getNetEnergyConsumption(modelId: string): number {
  const consumption = getEnergyRate(modelId);
  const regeneration = ENERGY_REGEN_RATE;
  return Math.max(0, consumption - regeneration);
}

// Check if model can run 24/7 on free energy
export function canRunFree(modelId: string): boolean {
  return getNetEnergyConsumption(modelId) === 0;
}