// Simplified AI model configuration with only core models
export interface SimpleModelInfo {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Claude' | 'DeepSeek';
  apiName: string; // The actual API model name to use
  backendEnum: string; // The backend enum value
  description: string;
  contextWindow: string;
  tier: 'budget' | 'standard' | 'premium' | 'elite';
  deploymentFee: string; // in SOL
  energyPerMatch: number;
}

export const SIMPLE_AI_MODELS: SimpleModelInfo[] = [
  // OpenAI Models - Using current API model names from documentation
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    apiName: 'gpt-4o',  // Current flagship model
    backendEnum: 'GPT_4O',
    description: 'Most capable GPT-4 model with vision capabilities',
    contextWindow: '128K',
    tier: 'premium',
    deploymentFee: '0.08',
    energyPerMatch: 3,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    apiName: 'gpt-4o-mini',  // Fast and affordable model
    backendEnum: 'GPT_4O_MINI',
    description: 'Smaller, faster, and cheaper GPT-4 model',
    contextWindow: '128K',
    tier: 'standard',
    deploymentFee: '0.06',
    energyPerMatch: 2,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    apiName: 'gpt-4-turbo',  // GPT-4 Turbo model
    backendEnum: 'GPT_4_TURBO',
    description: 'Optimized GPT-4 for chat and completions',
    contextWindow: '128K',
    tier: 'premium',
    deploymentFee: '0.08',
    energyPerMatch: 3,
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    apiName: 'gpt-3.5-turbo',  // Budget-friendly model
    backendEnum: 'GPT_3_5_TURBO',
    description: 'Fast and cost-effective model for simpler tasks',
    contextWindow: '16K',
    tier: 'budget',
    deploymentFee: '0.04',
    energyPerMatch: 1,
  },

  // Claude Models - Using current API model names from documentation
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Claude',
    apiName: 'claude-3-opus-20240229',  // Most capable Claude 3 model
    backendEnum: 'CLAUDE_3_OPUS',
    description: 'Most capable Claude model for complex reasoning',
    contextWindow: '200K',
    tier: 'elite',
    deploymentFee: '0.1',
    energyPerMatch: 5,
  },
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Claude',
    apiName: 'claude-3-5-sonnet-20241022',  // Latest Sonnet version
    backendEnum: 'CLAUDE_3_5_SONNET',
    description: 'Balanced performance and speed',
    contextWindow: '200K',
    tier: 'premium',
    deploymentFee: '0.08',
    energyPerMatch: 3,
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Claude',
    apiName: 'claude-3-haiku-20240307',  // Fast Claude model
    backendEnum: 'CLAUDE_3_HAIKU',
    description: 'Fast and lightweight Claude model',
    contextWindow: '200K',
    tier: 'standard',
    deploymentFee: '0.06',
    energyPerMatch: 2,
  },

  // DeepSeek Models - Using current API model names from documentation
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    apiName: 'deepseek-chat',  // Points to DeepSeek-V3
    backendEnum: 'DEEPSEEK_CHAT',
    description: 'DeepSeek V3 general chat model',
    contextWindow: '64K',
    tier: 'budget',
    deploymentFee: '0.04',
    energyPerMatch: 1,
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    provider: 'DeepSeek',
    apiName: 'deepseek-coder',  // DeepSeek-Coder-V2 optimized for code
    backendEnum: 'DEEPSEEK_CODER',
    description: 'Specialized for code generation and analysis',
    contextWindow: '128K',
    tier: 'budget',
    deploymentFee: '0.04',
    energyPerMatch: 1,
  },
];

// Helper functions
export function getModelByBackendEnum(backendEnum: string): SimpleModelInfo | undefined {
  return SIMPLE_AI_MODELS.find(model => model.backendEnum === backendEnum);
}

export function getModelById(id: string): SimpleModelInfo | undefined {
  return SIMPLE_AI_MODELS.find(model => model.id === id);
}

export function formatModelForBackend(modelId: string): string {
  const model = getModelById(modelId);
  return model?.backendEnum || modelId.toUpperCase().replace(/-/g, '_');
}

export function groupModelsByProvider(): Record<string, SimpleModelInfo[]> {
  return SIMPLE_AI_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, SimpleModelInfo[]>);
}