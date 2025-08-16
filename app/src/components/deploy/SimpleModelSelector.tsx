import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/select';
import { Badge } from '@ui/badge';
import { Bot, Brain, Zap } from 'lucide-react';
import { SIMPLE_AI_MODELS, groupModelsByProvider, type SimpleModelInfo } from '@/config/simpleModels';

interface SimpleModelSelectorProps {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
}

export function SimpleModelSelector({ selectedModel, onModelSelect }: SimpleModelSelectorProps) {
  const modelGroups = groupModelsByProvider();
  const selectedModelInfo = SIMPLE_AI_MODELS.find(m => m.id === selectedModel);

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'OpenAI':
        return <Brain className="h-4 w-4 text-green-500" />;
      case 'Claude':
        return <Zap className="h-4 w-4 text-purple-500" />;
      case 'DeepSeek':
        return <Bot className="h-4 w-4 text-blue-500" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'OpenAI':
        return 'text-green-600';
      case 'Claude':
        return 'text-purple-600';
      case 'DeepSeek':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Select AI Model
        </CardTitle>
        <CardDescription>
          Choose the AI model that will power your bot's intelligence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simple Dropdown Selection */}
        <div className="space-y-2">
          <Select value={selectedModel} onValueChange={onModelSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose an AI model" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(modelGroups).map(([provider, models]) => (
                <div key={provider}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    {getProviderIcon(provider)}
                    {provider}
                  </div>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span>{model.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {model.contextWindow}
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Model Details */}
        {selectedModelInfo && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getProviderIcon(selectedModelInfo.provider)}
                <span className={`font-medium ${getProviderColor(selectedModelInfo.provider)}`}>
                  {selectedModelInfo.name}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {selectedModelInfo.provider}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedModelInfo.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Context: {selectedModelInfo.contextWindow}</span>
              <span>Tier: {selectedModelInfo.tier}</span>
              <span>Energy: {selectedModelInfo.energyPerMatch}/match</span>
            </div>
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded">
              <div className="flex justify-between items-center text-xs">
                <span className="text-blue-800 dark:text-blue-200">Deployment Fee</span>
                <span className="font-medium text-blue-900 dark:text-blue-100">{selectedModelInfo.deploymentFee} SOL</span>
              </div>
            </div>
          </div>
        )}

        {/* Provider Information */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• <span className="text-green-600">OpenAI</span>: GPT models with strong general intelligence</p>
          <p>• <span className="text-purple-600">Claude</span>: Anthropic's models with excellent reasoning</p>
          <p>• <span className="text-blue-600">DeepSeek</span>: Cost-effective open models with good performance</p>
        </div>
      </CardContent>
    </Card>
  );
}