export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  category: 'reasoning' | 'fast' | 'premium' | 'opensource' | 'specialized';
  contextWindow: string;
  maxOutput?: string;
  performance?: {
    mmlu?: number;
    humanEval?: number;
    math?: number;
    swebench?: number;
  };
  features: string[];
  isNew?: boolean;
  releaseDate?: string;
  description?: string;
  costPerMillionInput: number;
  costPerMillionOutput: number;
}

export const AI_MODELS: Record<string, ModelInfo[]> = {
  reasoning: [
    {
      id: 'O3',
      name: 'OpenAI o3',
      provider: 'OpenAI',
      category: 'reasoning',
      contextWindow: '128K',
      maxOutput: '32K',
      performance: {
        mmlu: 92.0,
        humanEval: 94.0,
        math: 96.7
      },
      features: ['advanced-reasoning', 'step-by-step', 'chain-of-thought'],
      isNew: true,
      releaseDate: '2025-06',
      description: 'Advanced reasoning model with structured step-by-step thinking',
      costPerMillionInput: 10,
      costPerMillionOutput: 40
    },
    {
      id: 'O3_MINI',
      name: 'o3-mini',
      provider: 'OpenAI',
      category: 'reasoning',
      contextWindow: '128K',
      maxOutput: '16K',
      performance: {
        mmlu: 88.0,
        humanEval: 89.0,
        math: 88.0
      },
      features: ['reasoning', 'fast-reasoning'],
      isNew: true,
      releaseDate: '2025-06',
      description: 'Faster reasoning model with good performance',
      costPerMillionInput: 1.1,
      costPerMillionOutput: 4.4
    },
    {
      id: 'CLAUDE_4_SONNET',
      name: 'Claude 4 Sonnet',
      provider: 'Anthropic',
      category: 'reasoning',
      contextWindow: '200K',
      maxOutput: '64K',
      performance: {
        mmlu: 91.0,
        humanEval: 94.0,
        swebench: 65.0
      },
      features: ['thinking-mode', 'hybrid-architecture', 'instant-response'],
      isNew: true,
      releaseDate: '2025-05',
      description: 'Hybrid architecture with instant responses and extended thinking',
      costPerMillionInput: 3,
      costPerMillionOutput: 15
    },
    {
      id: 'DEEPSEEK_R1',
      name: 'DeepSeek-R1',
      provider: 'DeepSeek',
      category: 'reasoning',
      contextWindow: '128K',
      maxOutput: '32K',
      performance: {
        mmlu: 90.8,
        humanEval: 90.0,
        math: 90.2
      },
      features: ['reasoning', 'self-verification', 'chain-of-thought'],
      isNew: true,
      releaseDate: '2025-01',
      description: 'Open-source reasoning model with self-verification',
      costPerMillionInput: 0.55,
      costPerMillionOutput: 2.19
    },
    {
      id: 'QWQ_32B',
      name: 'QwQ-32B',
      provider: 'Alibaba',
      category: 'reasoning',
      contextWindow: '32K',
      maxOutput: '8K',
      performance: {
        mmlu: 83.0,
        humanEval: 82.0,
        math: 85.0
      },
      features: ['reasoning', 'mathematics', 'coding'],
      releaseDate: '2024-12',
      description: 'Reasoning model from Alibaba Cloud',
      costPerMillionInput: 0.5,
      costPerMillionOutput: 1.5
    },
    {
      id: 'GEMINI_2_5_PRO_DEEP_THINK',
      name: 'Gemini 2.5 Pro Deep Think',
      provider: 'Google',
      category: 'reasoning',
      contextWindow: '1M',
      maxOutput: '64K',
      performance: {
        mmlu: 93.0,
        humanEval: 94.0,
        math: 96.0
      },
      features: ['deep-thinking', 'massive-context', 'advanced-reasoning'],
      isNew: true,
      releaseDate: '2025-05',
      description: 'Enhanced with Deep Think mode for advanced reasoning',
      costPerMillionInput: 10,
      costPerMillionOutput: 40
    }
  ],
  fast: [
    {
      id: 'GPT_4O',
      name: 'GPT-4o',
      provider: 'OpenAI',
      category: 'fast',
      contextWindow: '128K',
      maxOutput: '16K',
      performance: {
        mmlu: 88.7,
        humanEval: 90.2,
        math: 76.6
      },
      features: ['multimodal', 'vision', 'fast-inference'],
      description: 'OpenAI\'s flagship multimodal model with vision capabilities',
      costPerMillionInput: 3,
      costPerMillionOutput: 10
    },
    {
      id: 'GPT_4O_MINI',
      name: 'GPT-4o Mini',
      provider: 'OpenAI',
      category: 'fast',
      contextWindow: '128K',
      maxOutput: '16K',
      performance: {
        mmlu: 82.0,
        humanEval: 87.2
      },
      features: ['cost-effective', 'fast-inference'],
      description: 'Smaller, faster, and cheaper version of GPT-4o',
      costPerMillionInput: 0.15,
      costPerMillionOutput: 0.6
    },
    {
      id: 'CLAUDE_3_5_SONNET',
      name: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      category: 'fast',
      contextWindow: '200K',
      maxOutput: '8K',
      performance: {
        mmlu: 88.7,
        humanEval: 92.0,
        swebench: 49.0
      },
      features: ['long-context', 'coding', 'creative-writing'],
      description: 'Balanced model with excellent coding capabilities',
      costPerMillionInput: 3,
      costPerMillionOutput: 15
    },
    {
      id: 'CLAUDE_3_5_HAIKU',
      name: 'Claude 3.5 Haiku',
      provider: 'Anthropic',
      category: 'fast',
      contextWindow: '200K',
      maxOutput: '8K',
      performance: {
        mmlu: 75.0,
        humanEval: 75.0
      },
      features: ['cost-effective', 'fast', 'long-context'],
      isNew: true,
      releaseDate: '2025-03',
      description: 'Fastest and most affordable Claude model',
      costPerMillionInput: 0.8,
      costPerMillionOutput: 4
    },
    {
      id: 'DEEPSEEK_CHAT',
      name: 'DeepSeek Chat',
      provider: 'DeepSeek',
      category: 'fast',
      contextWindow: '128K',
      maxOutput: '8K',
      performance: {
        mmlu: 85.0,
        humanEval: 82.0
      },
      features: ['cost-effective', 'multilingual', 'coding'],
      description: 'Cost-effective Chinese model with strong performance',
      costPerMillionInput: 0.14,
      costPerMillionOutput: 0.28
    }
  ],
  premium: [
    {
      id: 'O3_PRO',
      name: 'o3-pro',
      provider: 'OpenAI',
      category: 'premium',
      contextWindow: '128K',
      maxOutput: '64K',
      performance: {
        mmlu: 94.0,
        humanEval: 95.0,
        math: 97.0
      },
      features: ['advanced-reasoning', 'extended-output', 'premium'],
      isNew: true,
      releaseDate: '2025-06',
      description: 'Premium reasoning model for ChatGPT Pro users',
      costPerMillionInput: 20,
      costPerMillionOutput: 80
    },
    {
      id: 'CLAUDE_4_OPUS',
      name: 'Claude 4 Opus',
      provider: 'Anthropic',
      category: 'premium',
      contextWindow: '200K',
      maxOutput: '32K',
      performance: {
        mmlu: 93.0,
        humanEval: 96.0,
        swebench: 72.5,
        math: 97.0
      },
      features: ['best-coding', 'extended-thinking', 'tool-use'],
      isNew: true,
      releaseDate: '2025-05',
      description: 'Best coding model in the world, leading on SWE-bench',
      costPerMillionInput: 15,
      costPerMillionOutput: 75
    },
    {
      id: 'CLAUDE_3_OPUS',
      name: 'Claude 3 Opus',
      provider: 'Anthropic',
      category: 'premium',
      contextWindow: '200K',
      maxOutput: '4K',
      performance: {
        mmlu: 86.8,
        humanEval: 84.9,
        math: 95.0
      },
      features: ['nuanced-responses', 'complex-reasoning', 'creative'],
      description: 'Most capable Claude 3 model for complex tasks',
      costPerMillionInput: 15,
      costPerMillionOutput: 75
    },
    {
      id: 'GEMINI_2_5_PRO',
      name: 'Gemini 2.5 Pro',
      provider: 'Google',
      category: 'premium',
      contextWindow: '1M',
      maxOutput: '32K',
      performance: {
        mmlu: 91.0,
        humanEval: 92.0,
        math: 94.0
      },
      features: ['massive-context', 'multimodal', 'native-multimodal'],
      isNew: true,
      releaseDate: '2025-03',
      description: 'Multimodal model with up to 1M token context window',
      costPerMillionInput: 4,
      costPerMillionOutput: 20
    },
    {
      id: 'QWEN_2_5_MAX',
      name: 'Qwen2.5-Max',
      provider: 'Alibaba',
      category: 'premium',
      contextWindow: '1M',
      maxOutput: '32K',
      performance: {
        mmlu: 88.0,
        humanEval: 88.0,
        math: 85.0
      },
      features: ['massive-context', 'moe-architecture', 'enterprise'],
      isNew: true,
      releaseDate: '2025-02',
      description: 'Large-scale MoE model with 1M token context',
      costPerMillionInput: 2,
      costPerMillionOutput: 6
    }
  ],
  opensource: [
    {
      id: 'LLAMA_3_1_405B',
      name: 'Llama 3.1 405B',
      provider: 'Meta',
      category: 'opensource',
      contextWindow: '128K',
      maxOutput: '4K',
      performance: {
        mmlu: 88.6,
        humanEval: 89.0,
        math: 73.8
      },
      features: ['open-source', 'largest-open', 'multilingual'],
      releaseDate: '2024-07',
      description: 'Largest open-source model with 405B parameters',
      costPerMillionInput: 3.25,
      costPerMillionOutput: 3.25
    },
    {
      id: 'LLAMA_3_1_70B',
      name: 'Llama 3.1 70B',
      provider: 'Meta',
      category: 'opensource',
      contextWindow: '128K',
      maxOutput: '4K',
      performance: {
        mmlu: 86.0,
        humanEval: 80.5,
        math: 68.0
      },
      features: ['open-source', 'efficient', 'multilingual'],
      releaseDate: '2024-07',
      description: 'Efficient open-source model with good performance',
      costPerMillionInput: 0.9,
      costPerMillionOutput: 0.9
    },
    {
      id: 'LLAMA_3_2_90B',
      name: 'Llama 3.2 90B',
      provider: 'Meta',
      category: 'opensource',
      contextWindow: '128K',
      maxOutput: '4K',
      performance: {
        mmlu: 87.0,
        humanEval: 82.0,
        math: 70.0
      },
      features: ['open-source', 'vision', 'multimodal'],
      releaseDate: '2024-09',
      description: 'Multimodal open-source model with vision capabilities',
      costPerMillionInput: 1.2,
      costPerMillionOutput: 1.2
    },
    {
      id: 'QWEN_2_5_72B',
      name: 'Qwen 2.5 72B',
      provider: 'Alibaba',
      category: 'opensource',
      contextWindow: '128K',
      maxOutput: '8K',
      performance: {
        mmlu: 86.1,
        humanEval: 86.0,
        math: 83.1
      },
      features: ['programming', 'mathematics', 'structured-data'],
      isNew: true,
      releaseDate: '2024-11',
      description: 'Outperforms Llama-3.1-405B in multiple tasks',
      costPerMillionInput: 0.9,
      costPerMillionOutput: 1.2
    },
    {
      id: 'DEEPSEEK_V3',
      name: 'DeepSeek-V3',
      provider: 'DeepSeek',
      category: 'opensource',
      contextWindow: '128K',
      maxOutput: '16K',
      performance: {
        mmlu: 88.5,
        humanEval: 89.0,
        math: 88.0
      },
      features: ['efficient', 'sparse-techniques', 'low-cost'],
      isNew: true,
      releaseDate: '2025-01',
      description: 'Efficient model using sparse techniques for reduced compute',
      costPerMillionInput: 0.27,
      costPerMillionOutput: 1.1
    },
    {
      id: 'MIXTRAL_8X22B',
      name: 'Mixtral 8x22B',
      provider: 'Mistral AI',
      category: 'opensource',
      contextWindow: '64K',
      maxOutput: '4K',
      performance: {
        mmlu: 77.8,
        humanEval: 75.0,
        math: 78.0
      },
      features: ['moe-architecture', 'fast-inference', 'multilingual'],
      releaseDate: '2024-04',
      description: 'Sparse mixture of experts with 6x faster inference',
      costPerMillionInput: 2,
      costPerMillionOutput: 6
    }
  ],
  specialized: [
    {
      id: 'GROK_3',
      name: 'Grok 3',
      provider: 'xAI',
      category: 'specialized',
      contextWindow: '128K',
      maxOutput: '32K',
      performance: {
        mmlu: 92.7,
        humanEval: 86.5,
        math: 89.3
      },
      features: ['real-time-info', 'personality', 'think-mode'],
      isNew: true,
      releaseDate: '2025-04',
      description: 'Model with distinct personality and real-time information access',
      costPerMillionInput: 3,
      costPerMillionOutput: 15
    },
    {
      id: 'KIMI_K2',
      name: 'Kimi-K2',
      provider: 'Moonshot AI',
      category: 'specialized',
      contextWindow: '200K',
      maxOutput: '16K',
      performance: {
        mmlu: 82.0,
        humanEval: 78.0
      },
      features: ['long-context', 'chinese-optimized', 'web-search'],
      releaseDate: '2024-10',
      description: 'Long-context model optimized for Chinese and web search',
      costPerMillionInput: 1,
      costPerMillionOutput: 3
    },
    {
      id: 'QVQ_72B_PREVIEW',
      name: 'QVQ-72B-Preview',
      provider: 'Alibaba',
      category: 'specialized',
      contextWindow: '32K',
      maxOutput: '8K',
      performance: {
        mmlu: 70.3,
        math: 75.0
      },
      features: ['multimodal', 'visual-reasoning', 'complex-problem-solving'],
      isNew: true,
      releaseDate: '2025-01',
      description: 'Multimodal reasoning model with visual understanding',
      costPerMillionInput: 1.2,
      costPerMillionOutput: 2.4
    }
  ]
};

// Helper function to convert model ID for backend
export function formatModelForBackend(modelId: string): string {
  return modelId.toUpperCase().replace(/-/g, '_');
}

// Helper function to get all models as a flat array
export function getAllModels(): ModelInfo[] {
  return Object.values(AI_MODELS).flat();
}

// Helper function to get model by ID
export function getModelById(modelId: string): ModelInfo | undefined {
  return getAllModels().find(model => model.id === modelId);
}

// Export ModelInfo type for use in other components
export type { ModelInfo };