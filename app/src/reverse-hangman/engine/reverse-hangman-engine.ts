import { PromptMatcher } from './prompt-matcher';

export interface PromptPair {
  id: string;
  prompt: string;
  output: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  category: string;
  wordCount: number;
}

export interface GuessAttempt {
  guess: string;
  timestamp: Date;
  isCorrect: boolean;
  matchPercentage: number;
  matchType: 'exact' | 'near' | 'partial' | 'semantic' | 'incorrect';
  matchDetails?: {
    wordMatches: number;
    totalWords: number;
    matchedWords: string[];
    missingWords: string[];
    extraWords: string[];
    semanticMatches: Array<{ original: string; matched: string }>;
  };
}

export interface ReverseHangmanState {
  gameId: string;
  currentPromptPair: PromptPair;
  attempts: GuessAttempt[];
  maxAttempts: number;
  phase: 'playing' | 'won' | 'lost';
  startTime: Date;
  endTime?: Date;
}

export class ReverseHangmanEngine {
  private state: ReverseHangmanState;
  private readonly MAX_ATTEMPTS = 7;
  private promptMatcher: PromptMatcher;

  constructor(promptPair: PromptPair) {
    this.state = {
      gameId: `rhg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      currentPromptPair: promptPair,
      attempts: [],
      maxAttempts: this.MAX_ATTEMPTS,
      phase: 'playing',
      startTime: new Date()
    };
    this.promptMatcher = new PromptMatcher();
  }

  getState(): ReverseHangmanState {
    return { ...this.state };
  }

  getOutput(): string {
    return this.state.currentPromptPair.output;
  }

  getAttemptsRemaining(): number {
    return this.MAX_ATTEMPTS - this.state.attempts.length;
  }

  makeGuess(guess: string): GuessAttempt {
    if (this.state.phase !== 'playing') {
      throw new Error('Game is already finished');
    }

    if (this.state.attempts.length >= this.MAX_ATTEMPTS) {
      throw new Error('Maximum attempts reached');
    }

    // Use PromptMatcher for detailed analysis
    const matchResult = this.promptMatcher.match(guess, this.state.currentPromptPair.prompt);
    
    const attempt: GuessAttempt = {
      guess,
      timestamp: new Date(),
      isCorrect: matchResult.type === 'exact',
      matchPercentage: matchResult.percentage,
      matchType: matchResult.type,
      matchDetails: matchResult.details
    };

    this.state.attempts.push(attempt);

    if (attempt.isCorrect) {
      this.state.phase = 'won';
      this.state.endTime = new Date();
    } else if (this.state.attempts.length >= this.MAX_ATTEMPTS) {
      this.state.phase = 'lost';
      this.state.endTime = new Date();
    }

    return attempt;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateMatch(guess: string, target: string): { percentage: number; type: GuessAttempt['matchType'] } {
    if (guess === target) {
      return { percentage: 100, type: 'exact' };
    }

    const guessWords = guess.split(' ');
    const targetWords = target.split(' ');
    
    let matchingWords = 0;
    const usedIndices = new Set<number>();

    for (const guessWord of guessWords) {
      for (let i = 0; i < targetWords.length; i++) {
        if (!usedIndices.has(i) && guessWord === targetWords[i]) {
          matchingWords++;
          usedIndices.add(i);
          break;
        }
      }
    }

    const percentage = (matchingWords / Math.max(guessWords.length, targetWords.length)) * 100;

    if (percentage >= 90) {
      return { percentage, type: 'near' };
    } else if (percentage >= 70) {
      return { percentage, type: 'partial' };
    } else if (percentage >= 30 && this.checkSemanticSimilarity(guess, target)) {
      return { percentage, type: 'semantic' };
    }

    return { percentage, type: 'incorrect' };
  }

  private checkSemanticSimilarity(guess: string, target: string): boolean {
    const semanticPairs = [
      ['write', 'create'],
      ['make', 'build'],
      ['explain', 'describe'],
      ['show', 'display'],
      ['poem', 'verse'],
      ['story', 'tale']
    ];

    for (const [word1, word2] of semanticPairs) {
      if ((guess.includes(word1) && target.includes(word2)) ||
          (guess.includes(word2) && target.includes(word1))) {
        return true;
      }
    }

    return false;
  }

  isGameOver(): boolean {
    return this.state.phase !== 'playing';
  }

  isWon(): boolean {
    return this.state.phase === 'won';
  }

  getRevealedPrompt(): string | null {
    if (this.isGameOver()) {
      return this.state.currentPromptPair.prompt;
    }
    return null;
  }

  getGameDuration(): number {
    const endTime = this.state.endTime || new Date();
    return endTime.getTime() - this.state.startTime.getTime();
  }
}