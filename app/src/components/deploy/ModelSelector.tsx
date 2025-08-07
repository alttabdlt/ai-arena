import { useState } from 'react';
import { Card, CardContent } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { Input } from '@ui/input';
import { 
  Brain, 
  Zap, 
  Gem, 
  Globe, 
  Target,
  Search,
  Info,
  Check,
  Activity,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { formatEnergyRate } from '@/config/energy';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ui/tooltip';

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

interface ModelSelectorProps {
  models: Record<string, ModelInfo[]>;
  selected: string;
  onSelect: (modelId: string) => void;
  disabled?: boolean;
}

const categoryInfo = {
  reasoning: {
    icon: Brain,
    label: 'Reasoning Models',
    description: 'Advanced models with step-by-step thinking',
    color: 'text-purple-600'
  },
  fast: {
    icon: Zap,
    label: 'Fast Models',
    description: 'Quick responses with good performance',
    color: 'text-blue-600'
  },
  premium: {
    icon: Gem,
    label: 'Premium Models',
    description: 'Top-tier models with best performance',
    color: 'text-amber-600'
  },
  opensource: {
    icon: Globe,
    label: 'Open Source',
    description: 'Community models you can self-host',
    color: 'text-green-600'
  },
  specialized: {
    icon: Target,
    label: 'Specialized',
    description: 'Models optimized for specific tasks',
    color: 'text-red-600'
  }
};

const providerLogos: Record<string, string> = {
  'OpenAI': '🟢',
  'Anthropic': '🔶',
  'Google': '🔵',
  'DeepSeek': '🟣',
  'Meta': '🔷',
  'Alibaba': '🟠',
  'xAI': '⚫',
  'Mistral AI': '🟥',
  'Moonshot AI': '🌙'
};

export function ModelSelector({ models, selected, onSelect, disabled }: ModelSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('reasoning');

  const filteredModels = Object.entries(models).reduce((acc, [category, categoryModels]) => {
    const filtered = categoryModels.filter(model => 
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.features.some(f => f.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  const getCostBadge = (rating: number) => {
    const dollars = Array(rating).fill('$').join('');
    const color = rating <= 2 ? 'text-green-600' : rating <= 3 ? 'text-yellow-600' : 'text-red-600';
    return <span className={`font-mono text-xs ${color}`}>{dollars}</span>;
  };

  const getPerformanceBadge = (value: number | undefined, metric: string) => {
    if (!value) return null;
    const color = value >= 90 ? 'bg-green-100 text-green-800' : 
                  value >= 80 ? 'bg-blue-100 text-blue-800' : 
                  'bg-gray-100 text-gray-800';
    return (
      <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${color}`}>
        {metric}: {value}%
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search models by name, provider, or features..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          disabled={disabled}
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full h-auto p-1">
          {Object.entries(categoryInfo).map(([key, info]) => {
            const Icon = info.icon;
            const count = filteredModels[key]?.length || 0;
            return (
              <TabsTrigger
                key={key}
                value={key}
                disabled={disabled || count === 0}
                className="flex flex-col gap-1 py-2 data-[state=active]:bg-background"
              >
                <Icon className={`h-4 w-4 ${info.color}`} />
                <span className="text-xs font-medium">{info.label}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.entries(categoryInfo).map(([category, info]) => (
          <TabsContent key={category} value={category} className="mt-4 space-y-3">
            {/* Category Description */}
            <div className="text-sm text-muted-foreground mb-4">
              {info.description}
            </div>

            {/* Model Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredModels[category]?.map((model) => (
                <Card
                  key={model.id}
                  className={`
                    cursor-pointer transition-all hover:shadow-md
                    ${selected === model.id ? 'ring-2 ring-primary' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => !disabled && onSelect(model.id)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <span className="text-lg" title={model.provider}>
                            {providerLogos[model.provider] || '🤖'}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-sm">{model.name}</h3>
                              {model.isNew && (
                                <Badge className="text-xs px-1.5 py-0 h-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                                  <Sparkles className="h-3 w-3 mr-0.5" />
                                  NEW
                                </Badge>
                              )}
                              {selected === model.id && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{model.provider}</p>
                          </div>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Info className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-2">
                                <p className="text-sm font-medium">{model.name}</p>
                                {model.description && (
                                  <p className="text-xs">{model.description}</p>
                                )}
                                {model.releaseDate && (
                                  <p className="text-xs text-muted-foreground">
                                    Released: {model.releaseDate}
                                  </p>
                                )}
                                <div className="text-xs space-y-1">
                                  <p>Energy: {formatEnergyRate(model.id)}</p>
                                  <p>Input: ${model.costPerMillionInput}/1M tokens</p>
                                  <p>Output: ${model.costPerMillionOutput}/1M tokens</p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      {/* Specs */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Context:</span>
                          <span className="font-mono">{model.contextWindow}</span>
                        </div>
                        {model.maxOutput && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Output:</span>
                            <span className="font-mono">{model.maxOutput}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Energy Consumption */}
                      <div className="flex items-center justify-between bg-muted/50 rounded px-2 py-1">
                        <div className="flex items-center gap-2 text-xs">
                          <Activity className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">
                            {formatEnergyRate(model.id)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono">
                            ${model.costPerMillionInput}/${model.costPerMillionOutput} per 1M
                          </span>
                        </div>
                      </div>

                      {/* Performance Badges */}
                      {model.performance && (
                        <div className="flex flex-wrap gap-1">
                          {getPerformanceBadge(model.performance.mmlu, 'MMLU')}
                          {getPerformanceBadge(model.performance.humanEval, 'Code')}
                          {getPerformanceBadge(model.performance.math, 'Math')}
                          {getPerformanceBadge(model.performance.swebench, 'SWE')}
                        </div>
                      )}

                      {/* Features */}
                      <div className="flex flex-wrap gap-1">
                        {model.features.slice(0, 3).map((feature) => (
                          <Badge key={feature} variant="outline" className="text-xs px-1.5 py-0 h-4">
                            {feature}
                          </Badge>
                        ))}
                        {model.features.length > 3 && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                            +{model.features.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {(!filteredModels[category] || filteredModels[category].length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No models found in this category</p>
                {searchTerm && (
                  <p className="text-sm mt-2">Try adjusting your search terms</p>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Model Comparison Button */}
      {selected && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Selected: {models[Object.keys(models).find(cat => 
                models[cat as keyof typeof models].some(m => m.id === selected)
              ) || 'fast']?.find(m => m.id === selected)?.name}
            </span>
          </div>
          <Button variant="outline" size="sm" disabled>
            Compare Models
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}