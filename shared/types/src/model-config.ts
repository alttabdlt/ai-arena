export type PricingTier = 'elite' | 'professional' | 'competitive' | 'starter';

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  category: 'reasoning' | 'fast' | 'premium' | 'opensource' | 'specialized';
  pricingTier: PricingTier;
  deploymentFeeHYPE: number; // Deployment fee in HYPE tokens
  estimatedMonthlyCost: { min: number; max: number }; // USD
  contextWindow: number;
  maxOutput: number;
  costPerMillionInput: number;
  costPerMillionOutput: number;
  features: string[];
  performance?: {
    mmlu?: number;
    humanEval?: number;
    math?: number;
    swebench?: number;
  };
  isNew?: boolean;
  releaseDate?: string;
  apiEndpoint?: string;
  requiresSpecialAccess?: boolean;
  description?: string;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // OpenAI Models
  GPT_4O: {
    id: 'GPT_4O',
    name: 'GPT-4o',
    provider: 'OpenAI',
    category: 'fast',
    pricingTier: 'professional',
    deploymentFeeHYPE: 2.5,
    estimatedMonthlyCost: { min: 150, max: 200 },
    contextWindow: 128000,
    maxOutput: 16384,
    costPerMillionInput: 3, // Updated based on research
    costPerMillionOutput: 10, // Updated based on research
    features: ['multimodal', 'vision', 'fast-inference'],
    performance: {
      mmlu: 88.7,
      humanEval: 90.2,
      math: 76.6
    },
    description: 'OpenAI\'s flagship multimodal model with vision capabilities'
  },
  GPT_4O_MINI: {
    id: 'GPT_4O_MINI',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    category: 'fast',
    pricingTier: 'starter',
    deploymentFeeHYPE: 0.5,
    estimatedMonthlyCost: { min: 8, max: 12 },
    contextWindow: 128000,
    maxOutput: 16384,
    costPerMillionInput: 0.15,
    costPerMillionOutput: 0.6,
    features: ['cost-effective', 'fast-inference'],
    performance: {
      mmlu: 82.0,
      humanEval: 87.2
    },
    description: 'Smaller, faster, and cheaper version of GPT-4o'
  },
  O3: {
    id: 'O3',
    name: 'OpenAI o3',
    provider: 'OpenAI',
    category: 'reasoning',
    pricingTier: 'elite',
    deploymentFeeHYPE: 5.0,
    estimatedMonthlyCost: { min: 500, max: 700 },
    contextWindow: 128000,
    maxOutput: 32768,
    costPerMillionInput: 10,
    costPerMillionOutput: 40,
    features: ['advanced-reasoning', 'step-by-step', 'chain-of-thought'],
    performance: {
      mmlu: 92.0,
      humanEval: 94.0,
      math: 96.7
    },
    isNew: true,
    releaseDate: '2025-06',
    description: 'Advanced reasoning model with structured step-by-step thinking'
  },
  O3_MINI: {
    id: 'O3_MINI',
    name: 'o3-mini',
    provider: 'OpenAI',
    category: 'reasoning',
    pricingTier: 'competitive',
    deploymentFeeHYPE: 1.5,
    estimatedMonthlyCost: { min: 50, max: 80 },
    contextWindow: 128000,
    maxOutput: 16384,
    costPerMillionInput: 1.1, // Updated based on research
    costPerMillionOutput: 4.4, // Updated based on research
    features: ['reasoning', 'fast-reasoning'],
    performance: {
      mmlu: 88.0,
      humanEval: 89.0,
      math: 88.0
    },
    isNew: true,
    releaseDate: '2025-06',
    description: 'Faster reasoning model with good performance'
  },
  O3_PRO: {
    id: 'O3_PRO',
    name: 'o3-pro',
    provider: 'OpenAI',
    category: 'premium',
    pricingTier: 'elite',
    deploymentFeeHYPE: 5.0,
    estimatedMonthlyCost: { min: 1000, max: 1500 },
    contextWindow: 128000,
    maxOutput: 65536,
    costPerMillionInput: 20,
    costPerMillionOutput: 80,
    features: ['advanced-reasoning', 'extended-output', 'premium'],
    performance: {
      mmlu: 94.0,
      humanEval: 95.0,
      math: 97.0
    },
    isNew: true,
    releaseDate: '2025-06',
    requiresSpecialAccess: true,
    description: 'Premium reasoning model for ChatGPT Pro users'
  },

  // Anthropic Claude Models
  CLAUDE_3_5_SONNET: {
    id: 'CLAUDE_3_5_SONNET',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    category: 'fast',
    pricingTier: 'competitive',
    deploymentFeeHYPE: 1.5,
    estimatedMonthlyCost: { min: 60, max: 90 },
    contextWindow: 200000,
    maxOutput: 8192,
    costPerMillionInput: 3,
    costPerMillionOutput: 15,
    features: ['long-context', 'coding', 'creative-writing'],
    performance: {
      mmlu: 88.7,
      humanEval: 92.0,
      swebench: 49.0
    },
    description: 'Balanced model with excellent coding capabilities'
  },
  CLAUDE_3_5_HAIKU: {
    id: 'CLAUDE_3_5_HAIKU',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    category: 'fast',
    pricingTier: 'starter',
    deploymentFeeHYPE: 0.5,
    estimatedMonthlyCost: { min: 15, max: 25 },
    contextWindow: 200000,
    maxOutput: 8192,
    costPerMillionInput: 0.8,
    costPerMillionOutput: 4,
    features: ['cost-effective', 'fast', 'long-context'],
    performance: {
      mmlu: 75.0,
      humanEval: 75.0
    },
    isNew: true,
    releaseDate: '2025-03',
    description: 'Fastest and most affordable Claude model'
  },
  CLAUDE_3_OPUS: {
    id: 'CLAUDE_3_OPUS',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    category: 'premium',
    pricingTier: 'professional',
    deploymentFeeHYPE: 2.5,
    estimatedMonthlyCost: { min: 200, max: 300 },
    contextWindow: 200000,
    maxOutput: 4096,
    costPerMillionInput: 15,
    costPerMillionOutput: 75,
    features: ['nuanced-responses', 'complex-reasoning', 'creative'],
    performance: {
      mmlu: 86.8,
      humanEval: 84.9,
      math: 95.0
    },
    description: 'Most capable Claude 3 model for complex tasks'
  },
  CLAUDE_4_OPUS: {
    id: 'CLAUDE_4_OPUS',
    name: 'Claude 4 Opus',
    provider: 'Anthropic',
    category: 'premium',
    pricingTier: 'elite',
    deploymentFeeHYPE: 5.0,
    estimatedMonthlyCost: { min: 800, max: 1200 },
    contextWindow: 200000,
    maxOutput: 32000,
    costPerMillionInput: 15,
    costPerMillionOutput: 75,
    features: ['best-coding', 'extended-thinking', 'tool-use'],
    performance: {
      mmlu: 93.0,
      humanEval: 96.0,
      swebench: 72.5,
      math: 97.0
    },
    isNew: true,
    releaseDate: '2025-05',
    description: 'Best coding model in the world, leading on SWE-bench'
  },
  CLAUDE_4_SONNET: {
    id: 'CLAUDE_4_SONNET',
    name: 'Claude 4 Sonnet',
    provider: 'Anthropic',
    category: 'reasoning',
    pricingTier: 'professional',
    deploymentFeeHYPE: 2.5,
    estimatedMonthlyCost: { min: 180, max: 250 },
    contextWindow: 200000,
    maxOutput: 64000,
    costPerMillionInput: 3,
    costPerMillionOutput: 15,
    features: ['thinking-mode', 'hybrid-architecture', 'instant-response'],
    performance: {
      mmlu: 91.0,
      humanEval: 94.0,
      swebench: 65.0
    },
    isNew: true,
    releaseDate: '2025-05',
    description: 'Hybrid architecture with instant responses and extended thinking'
  },

  // DeepSeek Models
  DEEPSEEK_CHAT: {
    id: 'DEEPSEEK_CHAT',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    category: 'opensource',
    pricingTier: 'starter',
    deploymentFeeHYPE: 0.5,
    estimatedMonthlyCost: { min: 5, max: 10 },
    contextWindow: 128000,
    maxOutput: 8192,
    costPerMillionInput: 0.14,
    costPerMillionOutput: 0.28,
    features: ['cost-effective', 'multilingual', 'coding'],
    performance: {
      mmlu: 85.0,
      humanEval: 82.0
    },
    description: 'Cost-effective Chinese model with strong performance'
  },
  DEEPSEEK_R1: {
    id: 'DEEPSEEK_R1',
    name: 'DeepSeek-R1',
    provider: 'DeepSeek',
    category: 'reasoning',
    pricingTier: 'competitive',
    deploymentFeeHYPE: 1.5,
    estimatedMonthlyCost: { min: 30, max: 40 },
    contextWindow: 128000,
    maxOutput: 32768,
    costPerMillionInput: 0.55, // Updated based on research
    costPerMillionOutput: 2.19, // Updated based on research
    features: ['reasoning', 'self-verification', 'chain-of-thought', 'reflection'],
    performance: {
      mmlu: 90.8,
      humanEval: 90.0,
      math: 90.2
    },
    isNew: true,
    releaseDate: '2025-01',
    description: 'Open-source reasoning model with self-verification'
  },
  DEEPSEEK_V3: {
    id: 'DEEPSEEK_V3',
    name: 'DeepSeek-V3',
    provider: 'DeepSeek',
    category: 'opensource',
    pricingTier: 'starter',
    deploymentFeeHYPE: 0.5,
    estimatedMonthlyCost: { min: 12, max: 20 },
    contextWindow: 128000,
    maxOutput: 16384,
    costPerMillionInput: 0.27, // Updated based on research
    costPerMillionOutput: 1.1, // Updated based on research
    features: ['efficient', 'sparse-techniques', 'low-cost'],
    performance: {
      mmlu: 88.5,
      humanEval: 89.0,
      math: 88.0
    },
    isNew: true,
    releaseDate: '2025-01',
    description: 'Efficient model using sparse techniques for reduced compute'
  },

  // Alibaba Qwen Models
  QWEN_2_5_72B: {
    id: 'QWEN_2_5_72B',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba',
    category: 'opensource',
    pricingTier: 'starter',
    deploymentFeeHYPE: 0.5,
    estimatedMonthlyCost: { min: 20, max: 30 },
    contextWindow: 131072,
    maxOutput: 8192,
    costPerMillionInput: 0.9,
    costPerMillionOutput: 1.2,
    features: ['programming', 'mathematics', 'structured-data'],
    performance: {
      mmlu: 86.1,
      humanEval: 86.0,
      math: 83.1
    },
    isNew: true,
    releaseDate: '2024-11',
    description: 'Outperforms Llama-3.1-405B in multiple tasks'
  },
  QWQ_32B: {
    id: 'QWQ_32B',
    name: 'QwQ-32B',
    provider: 'Alibaba',
    category: 'reasoning',
    pricingTier: 'competitive',
    deploymentFeeHYPE: 1.5,
    estimatedMonthlyCost: { min: 40, max: 60 },
    contextWindow: 32768,
    maxOutput: 8192,
    costPerMillionInput: 0.5,
    costPerMillionOutput: 1.5,
    features: ['reasoning', 'mathematics', 'coding'],
    performance: {
      mmlu: 83.0,
      humanEval: 82.0,
      math: 85.0
    },
    releaseDate: '2024-12',
    description: 'Reasoning model from Alibaba Cloud'
  },
  QVQ_72B_PREVIEW: {
    id: 'QVQ_72B_PREVIEW',
    name: 'QVQ-72B-Preview',
    provider: 'Alibaba',
    category: 'specialized',
    pricingTier: 'competitive',
    deploymentFeeHYPE: 1.5,
    estimatedMonthlyCost: { min: 45, max: 65 },
    contextWindow: 32768,
    maxOutput: 8192,
    costPerMillionInput: 1.2,
    costPerMillionOutput: 2.4,
    features: ['multimodal', 'visual-reasoning', 'complex-problem-solving'],
    performance: {
      mmlu: 70.3,
      math: 75.0
    },
    isNew: true,
    releaseDate: '2025-01',
    description: 'Multimodal reasoning model with visual understanding'
  },
  QWEN_2_5_MAX: {
    id: 'QWEN_2_5_MAX',
    name: 'Qwen2.5-Max',
    provider: 'Alibaba',
    category: 'premium',
    pricingTier: 'professional',
    deploymentFeeHYPE: 2.5,
    estimatedMonthlyCost: { min: 150, max: 220 },
    contextWindow: 1048576,
    maxOutput: 32768,
    costPerMillionInput: 2,
    costPerMillionOutput: 6,
    features: ['massive-context', 'moe-architecture', 'enterprise'],
    performance: {
      mmlu: 88.0,
      humanEval: 88.0,
      math: 85.0
    },
    isNew: true,
    releaseDate: '2025-02',
    description: 'Large-scale MoE model with 1M token context'
  },

  // xAI Models
  GROK_3: {
    id: 'GROK_3',
    name: 'Grok 3',
    provider: 'xAI',
    category: 'specialized',
    pricingTier: 'professional',
    deploymentFeeHYPE: 2.5,
    estimatedMonthlyCost: { min: 180, max: 250 },
    contextWindow: 131072,
    maxOutput: 32768,
    costPerMillionInput: 3, // Updated based on research
    costPerMillionOutput: 15, // Updated based on research
    features: ['real-time-info', 'personality', 'think-mode', 'deep-search'],
    performance: {
      mmlu: 92.7,
      humanEval: 86.5,
      math: 89.3
    },
    isNew: true,
    releaseDate: '2025-04',
    description: 'Model with distinct personality and real-time information access'
  },

  // Kimi Models
  KIMI_K2: {
    id: 'KIMI_K2',
    name: 'Kimi-K2',
    provider: 'Moonshot AI',
    category: 'specialized',
    pricingTier: 'competitive',
    deploymentFeeHYPE: 1.5,
    estimatedMonthlyCost: { min: 35, max: 50 },
    contextWindow: 200000,
    maxOutput: 16384,
    costPerMillionInput: 1,
    costPerMillionOutput: 3,
    features: ['long-context', 'chinese-optimized', 'web-search'],
    performance: {
      mmlu: 82.0,
      humanEval: 78.0
    },
    releaseDate: '2024-10',
    description: 'Long-context model optimized for Chinese and web search'
  },

  // Google Gemini Models
  GEMINI_2_5_PRO: {
    id: 'GEMINI_2_5_PRO',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    category: 'premium',
    pricingTier: 'professional',
    deploymentFeeHYPE: 2.5,
    estimatedMonthlyCost: { min: 200, max: 300 },
    contextWindow: 1000000,
    maxOutput: 32768,
    costPerMillionInput: 4, // Updated based on research
    costPerMillionOutput: 20, // Updated based on research
    features: ['massive-context', 'multimodal', 'native-multimodal'],
    performance: {
      mmlu: 91.0,
      humanEval: 92.0,
      math: 94.0
    },
    isNew: true,
    releaseDate: '2025-03',
    description: 'Multimodal model with up to 1M token context window'
  },
  GEMINI_2_5_PRO_DEEP_THINK: {
    id: 'GEMINI_2_5_PRO_DEEP_THINK',
    name: 'Gemini 2.5 Pro Deep Think',
    provider: 'Google',
    category: 'reasoning',
    pricingTier: 'elite',
    deploymentFeeHYPE: 5.0,
    estimatedMonthlyCost: { min: 600, max: 900 },
    contextWindow: 1000000,
    maxOutput: 65536,
    costPerMillionInput: 10,
    costPerMillionOutput: 40,
    features: ['deep-thinking', 'massive-context', 'advanced-reasoning'],
    performance: {
      mmlu: 93.0,
      humanEval: 94.0,
      math: 96.0
    },
    isNew: true,
    releaseDate: '2025-05',
    description: 'Enhanced with Deep Think mode for advanced reasoning'
  },

  // Meta Llama Models
  LLAMA_3_1_405B: {
    id: 'LLAMA_3_1_405B',
    name: 'Llama 3.1 405B',
    provider: 'Meta',
    category: 'opensource',
    pricingTier: 'competitive',
    deploymentFeeHYPE: 1.5,
    estimatedMonthlyCost: { min: 50, max: 80 },
    contextWindow: 128000,
    maxOutput: 4096,
    costPerMillionInput: 3.25, // Blended rate based on research
    costPerMillionOutput: 3.25,
    features: ['open-source', 'largest-open', 'multilingual'],
    performance: {
      mmlu: 88.6,
      humanEval: 89.0,
      math: 73.8
    },
    releaseDate: '2024-07',
    description: 'Largest open-source model with 405B parameters'
  },
  LLAMA_3_1_70B: {
    id: 'LLAMA_3_1_70B',
    name: 'Llama 3.1 70B',
    provider: 'Meta',
    category: 'opensource',
    pricingTier: 'starter',
    deploymentFeeHYPE: 0.5,
    estimatedMonthlyCost: { min: 20, max: 30 },
    contextWindow: 128000,
    maxOutput: 4096,
    costPerMillionInput: 0.9,
    costPerMillionOutput: 0.9,
    features: ['open-source', 'efficient', 'multilingual'],
    performance: {
      mmlu: 86.0,
      humanEval: 80.5,
      math: 68.0
    },
    releaseDate: '2024-07',
    description: 'Efficient open-source model with good performance'
  },
  LLAMA_3_2_90B: {
    id: 'LLAMA_3_2_90B',
    name: 'Llama 3.2 90B',
    provider: 'Meta',
    category: 'opensource',
    pricingTier: 'starter',
    deploymentFeeHYPE: 0.5,
    estimatedMonthlyCost: { min: 25, max: 35 },
    contextWindow: 128000,
    maxOutput: 4096,
    costPerMillionInput: 1.2,
    costPerMillionOutput: 1.2,
    features: ['open-source', 'vision', 'multimodal'],
    performance: {
      mmlu: 87.0,
      humanEval: 82.0,
      math: 70.0
    },
    releaseDate: '2024-09',
    description: 'Multimodal open-source model with vision capabilities'
  },

  // Mistral Models
  MIXTRAL_8X22B: {
    id: 'MIXTRAL_8X22B',
    name: 'Mixtral 8x22B',
    provider: 'Mistral AI',
    category: 'opensource',
    pricingTier: 'competitive',
    deploymentFeeHYPE: 1.5,
    estimatedMonthlyCost: { min: 45, max: 70 },
    contextWindow: 65536,
    maxOutput: 4096,
    costPerMillionInput: 2,
    costPerMillionOutput: 6,
    features: ['moe-architecture', 'fast-inference', 'multilingual', 'mathematics'],
    performance: {
      mmlu: 77.8,
      humanEval: 75.0,
      math: 78.0
    },
    releaseDate: '2024-04',
    description: 'Sparse mixture of experts with 6x faster inference'
  }
};

export class ModelConfigService {
  static getModelConfig(modelId: string): ModelConfig | undefined {
    return MODEL_CONFIGS[modelId];
  }

  static getModelsByCategory(category: ModelConfig['category']): ModelConfig[] {
    return Object.values(MODEL_CONFIGS).filter(model => model.category === category);
  }

  static getModelsByPricingTier(tier: PricingTier): ModelConfig[] {
    return Object.values(MODEL_CONFIGS).filter(model => model.pricingTier === tier);
  }

  static getAllModels(): ModelConfig[] {
    return Object.values(MODEL_CONFIGS);
  }

  static getModelCostEstimate(modelId: string, inputTokens: number, outputTokens: number): number {
    const config = MODEL_CONFIGS[modelId];
    if (!config) return 0;
    
    const inputCost = (inputTokens / 1000000) * config.costPerMillionInput;
    const outputCost = (outputTokens / 1000000) * config.costPerMillionOutput;
    return inputCost + outputCost;
  }

  static getCostRating(modelId: string): number {
    const config = MODEL_CONFIGS[modelId];
    if (!config) return 0;
    
    const totalCost = config.costPerMillionInput + config.costPerMillionOutput;
    
    if (totalCost < 1) return 1;
    if (totalCost < 5) return 2;
    if (totalCost < 20) return 3;
    if (totalCost < 50) return 4;
    return 5;
  }

  static formatContextWindow(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  }

  static getDeploymentFee(modelId: string): number {
    const config = MODEL_CONFIGS[modelId];
    return config?.deploymentFeeHYPE || 0.5; // Default to starter tier
  }

  static getTierInfo(tier: PricingTier): {
    name: string;
    fee: number;
    badge: string;
    description: string;
  } {
    const tierInfo = {
      elite: {
        name: 'Elite',
        fee: 5.0,
        badge: '🏆',
        description: 'Premium reasoning models with highest performance'
      },
      professional: {
        name: 'Professional',
        fee: 2.5,
        badge: '💎',
        description: 'High performance models with excellent capabilities'
      },
      competitive: {
        name: 'Competitive',
        fee: 1.5,
        badge: '⚡',
        description: 'Cost-effective models with good performance'
      },
      starter: {
        name: 'Starter',
        fee: 0.5,
        badge: '🎯',
        description: 'Entry-level models for budget-conscious users'
      }
    };
    
    return tierInfo[tier];
  }
}