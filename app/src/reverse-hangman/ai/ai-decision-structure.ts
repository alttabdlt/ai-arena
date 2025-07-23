export interface ReverseHangmanAIDecision {
  action: 'guess_prompt';
  prompt_guess: string;
  confidence: number; // 0-1
  reasoning: string;
  analysis: {
    output_type: string; // 'poem', 'explanation', 'list', 'story', etc.
    key_indicators: string[];
    word_count_estimate: number;
    difficulty_assessment: string;
    pattern_observations: string[];
  };
}

export interface ReverseHangmanAIResponse {
  decision: ReverseHangmanAIDecision;
  thinking_time_ms: number;
  model: string;
  error?: string;
}

export function parseAIResponse(response: any): ReverseHangmanAIDecision | null {
  try {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const decision = response.decision || response;

    if (decision.action !== 'guess_prompt' || !decision.prompt_guess) {
      return null;
    }

    return {
      action: 'guess_prompt',
      prompt_guess: String(decision.prompt_guess).trim(),
      confidence: Math.max(0, Math.min(1, Number(decision.confidence) || 0.5)),
      reasoning: String(decision.reasoning || ''),
      analysis: {
        output_type: String(decision.analysis?.output_type || 'unknown'),
        key_indicators: Array.isArray(decision.analysis?.key_indicators) 
          ? decision.analysis.key_indicators.map(String) 
          : [],
        word_count_estimate: Number(decision.analysis?.word_count_estimate) || 0,
        difficulty_assessment: String(decision.analysis?.difficulty_assessment || 'unknown'),
        pattern_observations: Array.isArray(decision.analysis?.pattern_observations)
          ? decision.analysis.pattern_observations.map(String)
          : []
      }
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return null;
  }
}

export function createExampleAIPrompt(): string {
  return `You are playing a reverse engineering game. You see an AI-generated output and must guess the exact prompt that created it.

Example decision format:
{
  "action": "guess_prompt",
  "prompt_guess": "Write a haiku about spring flowers",
  "confidence": 0.8,
  "reasoning": "The output is a three-line poem with 5-7-5 syllable structure about cherry blossoms, indicating a haiku prompt about spring or flowers.",
  "analysis": {
    "output_type": "poem",
    "key_indicators": ["haiku structure", "nature theme", "cherry blossoms mentioned"],
    "word_count_estimate": 6,
    "difficulty_assessment": "easy",
    "pattern_observations": ["follows traditional haiku format", "seasonal reference"]
  }
}`;
}