export interface PromptValidationResult {
  isValid: boolean;
  sanitized: string;
  errors: string[];
}

export class PromptValidator {
  private static readonly MAX_LENGTH = 1000;
  private static readonly MIN_LENGTH = 10;
  
  private static readonly FORBIDDEN_PATTERNS = [
    /\b(api[_\s-]?key|token|password|secret|private[_\s-]?key)\b/gi,
    /<script[\s\S]*?<\/script>/gi,
    /<iframe[\s\S]*?<\/iframe>/gi,
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /\b(eval|exec|compile)\s*\(/gi,
  ];
  
  private static readonly SUSPICIOUS_PATTERNS = [
    /\b(hack|exploit|cheat|bypass|inject)\b/gi,
    /\b(system|admin|root|sudo)\b/gi,
    /\b(delete|drop|truncate|alter)\s+(table|database)/gi,
  ];

  static validate(prompt: string): PromptValidationResult {
    const errors: string[] = [];
    let sanitized = prompt;

    if (!prompt || typeof prompt !== 'string') {
      return {
        isValid: false,
        sanitized: '',
        errors: ['Prompt must be a non-empty string'],
      };
    }

    sanitized = sanitized.trim();

    if (sanitized.length < this.MIN_LENGTH) {
      errors.push(`Prompt must be at least ${this.MIN_LENGTH} characters`);
    }

    if (sanitized.length > this.MAX_LENGTH) {
      errors.push(`Prompt must not exceed ${this.MAX_LENGTH} characters`);
      sanitized = sanitized.substring(0, this.MAX_LENGTH);
    }

    for (const pattern of this.FORBIDDEN_PATTERNS) {
      if (pattern.test(sanitized)) {
        errors.push('Prompt contains forbidden content');
        sanitized = sanitized.replace(pattern, '[REMOVED]');
      }
    }

    let suspiciousCount = 0;
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        suspiciousCount++;
      }
    }
    
    if (suspiciousCount >= 3) {
      errors.push('Prompt contains too many suspicious patterns');
    }

    sanitized = this.sanitizeWhitespace(sanitized);
    sanitized = this.removeControlCharacters(sanitized);
    sanitized = this.normalizeUnicode(sanitized);

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    };
  }

  private static sanitizeWhitespace(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  private static removeControlCharacters(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  private static normalizeUnicode(text: string): string {
    return text
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[\u2028\u2029]/g, '\n');
  }

  static generateExamplePrompts(): string[] {
    return [
      "I am an aggressive player who loves to bluff on scary boards. I rarely fold to 3-bets and always put pressure on tight players.",
      "Play tight and conservative. Only enter pots with premium hands. Fold to aggression unless holding the nuts.",
      "I adjust my play based on opponents. Against tight players, I bluff more. Against aggressive players, I trap with strong hands.",
      "All-in or fold strategy. When I have a decent hand, I push all my chips. High risk, high reward.",
      "I play game theory optimal (GTO) poker. Balance my ranges and make unexploitable decisions.",
      "Psychological warfare is my specialty. I use timing tells and bet sizing to manipulate opponents.",
      "Small ball poker - keep pots small, control the action, and minimize risk while maximizing profit.",
      "I'm a calling station who hates folding. I'll see most flops and chase draws aggressively.",
      "Exploitative player who identifies opponent weaknesses quickly and adjusts strategy accordingly.",
      "Tournament specialist focusing on ICM pressure and bubble play. Survival is key.",
    ];
  }

  static analyzePromptStyle(prompt: string): {
    aggressiveness: number;
    tightness: number;
    complexity: number;
    keywords: string[];
  } {
    const lowercasePrompt = prompt.toLowerCase();
    
    const aggressiveKeywords = ['aggressive', 'bluff', 'pressure', 'raise', 'bet', 'push', 'all-in', 'attack'];
    const passiveKeywords = ['fold', 'call', 'check', 'conservative', 'tight', 'careful', 'patient'];
    const complexKeywords = ['adjust', 'balance', 'range', 'gto', 'exploit', 'icm', 'theory', 'optimal'];
    
    let aggressiveness = 50;
    let tightness = 50;
    let complexity = 0;
    const keywords: string[] = [];
    
    aggressiveKeywords.forEach(keyword => {
      if (lowercasePrompt.includes(keyword)) {
        aggressiveness += 10;
        keywords.push(keyword);
      }
    });
    
    passiveKeywords.forEach(keyword => {
      if (lowercasePrompt.includes(keyword)) {
        aggressiveness -= 10;
        tightness += 10;
        keywords.push(keyword);
      }
    });
    
    complexKeywords.forEach(keyword => {
      if (lowercasePrompt.includes(keyword)) {
        complexity += 15;
        keywords.push(keyword);
      }
    });
    
    aggressiveness = Math.max(0, Math.min(100, aggressiveness));
    tightness = Math.max(0, Math.min(100, tightness));
    complexity = Math.max(0, Math.min(100, complexity));
    
    return {
      aggressiveness,
      tightness,
      complexity,
      keywords: [...new Set(keywords)],
    };
  }
}