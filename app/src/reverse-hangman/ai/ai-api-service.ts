import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/apollo-client';
import { ReverseHangmanAIDecision } from './ai-decision-structure';

export interface ReverseHangmanGameStateAPI {
  game_type: string;
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
  game_phase: string;
  time_elapsed_seconds: number;
}

export interface ReverseHangmanPlayerStateAPI {
  player_id: string;
  current_round: number;
  total_rounds: number;
  current_score: number;
  rounds_won: number;
  rounds_lost: number;
}

export interface AIDecisionAPI {
  action: string;
  prompt_guess: string;
  reasoning: string;
  confidence: number;
  analysis?: {
    output_type: string;
    key_indicators: string[];
    word_count_estimate: number;
    difficulty_assessment: string;
    pattern_observations: string[];
  };
}

const GET_AI_REVERSE_HANGMAN_DECISION = gql`
  mutation GetAIReverseHangmanDecision(
    $botId: String!
    $model: String!
    $gameState: ReverseHangmanGameStateInput!
    $playerState: ReverseHangmanPlayerStateInput!
  ) {
    getAIReverseHangmanDecision(
      botId: $botId
      model: $model
      gameState: $gameState
      playerState: $playerState
    ) {
      action
      prompt_guess
      reasoning
      confidence
      analysis {
        output_type
        key_indicators
        word_count_estimate
        difficulty_assessment
        pattern_observations
      }
    }
  }
`;

export class ReverseHangmanAIApiService {
  static async getAIDecision(
    botId: string,
    model: string,
    gameState: ReverseHangmanGameStateAPI,
    playerState: ReverseHangmanPlayerStateAPI
  ): Promise<AIDecisionAPI> {
    try {
      console.log('🤖 AI Decision Request', {
        botId,
        model,
        gameState,
        playerState
      });

      const { data } = await apolloClient.mutate({
        mutation: GET_AI_REVERSE_HANGMAN_DECISION,
        variables: {
          botId,
          model,
          gameState,
          playerState
        }
      });

      if (!data || !data.getAIReverseHangmanDecision) {
        throw new Error('No AI decision received');
      }

      const decision = data.getAIReverseHangmanDecision;
      console.log('🎯 AI Decision Response', decision);

      return decision;
    } catch (error) {
      console.error('❌ AI API Error:', error);
      
      // Fallback for development
      return ReverseHangmanAIApiService.generateFallbackDecision(gameState);
    }
  }

  private static extractWordsFromOutput(output: string): string[] {
    // Simply extract all words and sort by frequency
    const words = output.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2); // Keep words with 3+ letters
    
    // Count word frequency
    const wordFrequency = new Map<string, number>();
    words.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
    
    // Sort by frequency and return unique words
    return Array.from(wordFrequency.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
      .map(([word]) => word);
  }

  private static generateFallbackDecision(gameState: ReverseHangmanGameStateAPI): AIDecisionAPI {
    const previousGuesses = gameState.previous_guesses.map(g => g.prompt_guess);
    
    // Extract words from output without any bias
    const outputWords = this.extractWordsFromOutput(gameState.output_shown);
    
    // Check if we have match details from previous attempts
    const lastAttempt = gameState.previous_guesses[gameState.previous_guesses.length - 1];
    let guess = '';
    
    if (lastAttempt?.match_details && lastAttempt.match_details.matched_words.length > 0) {
      // Build purely on what we know works
      const matchedWords = lastAttempt.match_details.matched_words || [];
      
      // Start with matched words
      let guessWords = [...matchedWords];
      
      // Add words from the output that aren't already matched
      const unmatchedOutputWords = outputWords.filter(w => !matchedWords.includes(w));
      
      // Add the most frequent unmatched words from the output
      const wordsToAdd = unmatchedOutputWords.slice(0, Math.max(0, 8 - guessWords.length));
      guessWords.push(...wordsToAdd);
      
      // Build the guess
      guess = guessWords.join(' ');
      
      // Ensure minimum word count by adding more output words
      if (guess.split(' ').length < 6 && unmatchedOutputWords.length > wordsToAdd.length) {
        const additionalWords = unmatchedOutputWords.slice(wordsToAdd.length, wordsToAdd.length + 3);
        guess = `${guess} ${additionalWords.join(' ')}`;
      }
    } else {
      // First attempt - just use the most frequent words from the output
      // Take more words to increase chances of matching something
      guess = outputWords.slice(0, 8).join(' ');
      
      // If we don't have enough words, repeat some
      if (guess.split(' ').length < 6) {
        guess = outputWords.slice(0, 6).join(' ');
      }
    }
    
    // Avoid repeating previous guesses by shuffling word order
    if (previousGuesses.includes(guess)) {
      // Try different combinations of the output words
      const shuffledWords = [...outputWords].sort(() => Math.random() - 0.5);
      guess = shuffledWords.slice(0, 8).join(' ');
    }

    const hasMatchDetails = lastAttempt?.match_details;
    const confidence = hasMatchDetails ? 0.4 + (lastAttempt.similarity_score * 0.4) : 0.3;
    
    return {
      action: 'guess_prompt',
      prompt_guess: guess,
      reasoning: hasMatchDetails 
        ? `Using ${lastAttempt.match_details.matched_words.length} confirmed words and adding frequent words from the output. No bias or assumptions about content type.`
        : `Extracted ${outputWords.length} unique words from output. Using most frequent words as initial guess without any content assumptions.`,
      confidence: confidence,
      analysis: {
        output_type: 'unknown',
        key_indicators: outputWords.slice(0, 5),
        word_count_estimate: Math.ceil(guess.split(' ').length),
        difficulty_assessment: gameState.constraints.difficulty,
        pattern_observations: hasMatchDetails
          ? [`Matched: ${lastAttempt.match_details.matched_words.join(', ')}`, `Output words: ${outputWords.slice(0, 5).join(', ')}`]
          : [`Most frequent words: ${outputWords.slice(0, 8).join(', ')}`]
      }
    };
  }
}