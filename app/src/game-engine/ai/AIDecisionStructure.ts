import { IGameAction, IGameDecision } from '../core/interfaces';

export interface AIModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'deepseek' | 'custom';
  model: string;
  apiKey?: string;
  endpoint?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface AIPromptTemplate {
  system: string;
  user: string;
  responseFormat?: 'json' | 'text';
  examples?: AIExample[];
}

export interface AIExample {
  input: any;
  output: any;
  explanation?: string;
}

export interface AIRequestOptions {
  includeGameHistory?: boolean;
  includePlayerStats?: boolean;
  includeValidActions?: boolean;
  customContext?: Record<string, any>;
}

export interface StandardAIResponse {
  action: any;
  confidence: number;
  reasoning: string;
  alternativeActions?: any[];
  expectedOutcome?: string;
  metadata?: {
    thinkingTime?: number;
    modelUsed?: string;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AIDecisionValidator<TAction extends IGameAction> {
  validate(response: StandardAIResponse, validActions: TAction[]): TAction | null;
  sanitize(response: any): StandardAIResponse;
  getDefaultAction(validActions: TAction[]): TAction;
}

export class StandardAIDecisionValidator<TAction extends IGameAction> 
  implements AIDecisionValidator<TAction> {
  
  validate(response: StandardAIResponse, validActions: TAction[]): TAction | null {
    if (!response || !response.action) {
      return null;
    }

    for (const validAction of validActions) {
      if (this.actionsMatch(response.action, validAction)) {
        return validAction;
      }
    }

    if (response.alternativeActions) {
      for (const altAction of response.alternativeActions) {
        for (const validAction of validActions) {
          if (this.actionsMatch(altAction, validAction)) {
            return validAction;
          }
        }
      }
    }

    return null;
  }

  sanitize(response: any): StandardAIResponse {
    const sanitized: StandardAIResponse = {
      action: response.action || response.move || response.decision || null,
      confidence: this.parseConfidence(response.confidence),
      reasoning: this.parseReasoning(response),
      alternativeActions: response.alternativeActions || response.alternatives || [],
      expectedOutcome: response.expectedOutcome || response.prediction || undefined,
      metadata: {}
    };

    if (response.metadata) {
      sanitized.metadata = response.metadata;
    }

    return sanitized;
  }

  getDefaultAction(validActions: TAction[]): TAction {
    if (validActions.length === 0) {
      throw new Error('No valid actions available');
    }
    return validActions[0];
  }

  private actionsMatch(a: any, b: any): boolean {
    if (a.type !== b.type) return false;
    
    const aKeys = Object.keys(a).filter(k => k !== 'timestamp' && k !== 'playerId');
    const bKeys = Object.keys(b).filter(k => k !== 'timestamp' && k !== 'playerId');
    
    if (aKeys.length !== bKeys.length) return false;
    
    for (const key of aKeys) {
      if (!bKeys.includes(key)) return false;
      
      const aVal = a[key];
      const bVal = b[key];
      
      if (typeof aVal !== typeof bVal) return false;
      
      if (typeof aVal === 'object' && aVal !== null) {
        if (!this.deepEqual(aVal, bVal)) return false;
      } else if (aVal !== bVal) {
        return false;
      }
    }
    
    return true;
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (a === null || b === null) return false;
    
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    
    for (const key of keys) {
      if (!this.deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }

  private parseConfidence(value: any): number {
    if (typeof value === 'number') {
      return Math.max(0, Math.min(1, value));
    }
    
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return Math.max(0, Math.min(1, num));
      }
      
      const percentMatch = value.match(/(\d+)%/);
      if (percentMatch) {
        return Math.max(0, Math.min(1, parseInt(percentMatch[1]) / 100));
      }
    }
    
    return 0.5;
  }

  private parseReasoning(response: any): string {
    if (response.reasoning) return String(response.reasoning);
    if (response.explanation) return String(response.explanation);
    if (response.rationale) return String(response.rationale);
    if (response.thinking) return String(response.thinking);
    
    return 'No reasoning provided';
  }
}