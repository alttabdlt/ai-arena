import { ReverseHangmanState } from '../engine/reverse-hangman-engine';

export interface ReverseHangmanAIData {
  game_type: 'reverse_hangman';
  output_shown: string;
  constraints: {
    max_word_count: number;
    exact_word_count: number;
    difficulty: string;
    category: string;
    max_attempts: number;
  };
  previous_guesses: Array<{
    attempt_number: number;
    prompt_guess: string;
    similarity_score: number;
    feedback: string;
    match_details?: {
      word_matches: number;
      total_words: number;
      matched_words: string[];
      missing_count: number;
      extra_count: number;
      semantic_matches: Array<{ original: string; matched: string }>;
    };
  }>;
  game_phase: 'playing' | 'won' | 'lost';
  time_elapsed_seconds: number;
}

export class ReverseHangmanAIDataCollector {
  static collectNeutralData(state: ReverseHangmanState): ReverseHangmanAIData {
    const timeElapsed = Math.floor((Date.now() - state.startTime.getTime()) / 1000);

    // Get word count estimate based on difficulty
    const maxWordCountByDifficulty = {
      easy: 8,
      medium: 12,
      hard: 15,
      expert: 20
    };

    return {
      game_type: 'reverse_hangman',
      output_shown: state.currentPromptPair.output,
      constraints: {
        max_word_count: maxWordCountByDifficulty[state.currentPromptPair.difficulty] || 12,
        exact_word_count: state.currentPromptPair.wordCount,
        difficulty: state.currentPromptPair.difficulty,
        category: state.currentPromptPair.category || 'general',
        max_attempts: state.maxAttempts
      },
      previous_guesses: state.attempts.map((attempt, index) => ({
        attempt_number: index + 1,
        prompt_guess: attempt.guess,
        similarity_score: attempt.matchPercentage / 100, // Convert to 0-1 range
        feedback: attempt.matchType,
        match_details: attempt.matchDetails ? {
          word_matches: attempt.matchDetails.wordMatches,
          total_words: attempt.matchDetails.totalWords,
          matched_words: attempt.matchDetails.matchedWords,
          missing_count: attempt.matchDetails.missingWords.length,
          extra_count: attempt.matchDetails.extraWords.length,
          semantic_matches: attempt.matchDetails.semanticMatches
        } : undefined
      })),
      game_phase: state.phase,
      time_elapsed_seconds: timeElapsed
    };
  }

  static formatForDisplay(data: ReverseHangmanAIData): string {
    return JSON.stringify(data, null, 2);
  }

  static validateGuess(guess: string): { valid: boolean; error?: string } {
    if (!guess || guess.trim().length === 0) {
      return { valid: false, error: 'Guess cannot be empty' };
    }

    const words = guess.trim().split(/\s+/);
    if (words.length < 6) {
      return { valid: false, error: 'Guess must contain at least 6 words' };
    }

    if (guess.length > 200) {
      return { valid: false, error: 'Guess is too long (max 200 characters)' };
    }

    return { valid: true };
  }
}