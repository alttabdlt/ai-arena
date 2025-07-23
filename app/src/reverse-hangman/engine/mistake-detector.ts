import { GuessAttempt, PromptPair } from './reverse-hangman-engine';

export type MistakeCategory = 
  | 'wild_guess'      // Completely unrelated to output
  | 'overthinking'    // Too complex for simple output
  | 'pattern_blind'   // Missing obvious clues
  | 'word_salad'      // Random words thrown together
  | 'off_topic'       // Wrong domain/category
  | 'repetitive'      // Keeps trying similar failed patterns
  | 'length_blind'    // Way off on word count

export interface Mistake {
  attemptNumber: number;
  category: MistakeCategory;
  guess: string;
  severity: 'minor' | 'major' | 'hilarious';
  description: string;
  timestamp: Date;
}

export class MistakeDetector {
  private static readonly COMMON_PROMPT_STARTERS = [
    'write', 'create', 'explain', 'list', 'describe', 'generate',
    'make', 'tell', 'show', 'provide', 'give', 'design'
  ];

  static detectMistakes(
    attempt: GuessAttempt,
    attemptNumber: number,
    promptPair: PromptPair,
    previousAttempts: GuessAttempt[]
  ): Mistake | null {
    const mistakes: Mistake[] = [];

    // Check for wild guess
    if (this.isWildGuess(attempt, promptPair)) {
      mistakes.push({
        attemptNumber,
        category: 'wild_guess',
        guess: attempt.guess,
        severity: 'hilarious',
        description: 'This guess came from another dimension!',
        timestamp: attempt.timestamp
      });
    }

    // Check for overthinking
    if (this.isOverthinking(attempt, promptPair)) {
      mistakes.push({
        attemptNumber,
        category: 'overthinking',
        guess: attempt.guess,
        severity: 'major',
        description: 'Making it way more complicated than it needs to be',
        timestamp: attempt.timestamp
      });
    }

    // Check for pattern blindness
    if (this.isPatternBlind(attempt, promptPair)) {
      mistakes.push({
        attemptNumber,
        category: 'pattern_blind',
        guess: attempt.guess,
        severity: 'major',
        description: 'Missing the obvious clues right in front of them',
        timestamp: attempt.timestamp
      });
    }

    // Check for word salad
    if (this.isWordSalad(attempt)) {
      mistakes.push({
        attemptNumber,
        category: 'word_salad',
        guess: attempt.guess,
        severity: 'hilarious',
        description: 'Did they just throw words in a blender?',
        timestamp: attempt.timestamp
      });
    }

    // Check for off-topic
    if (this.isOffTopic(attempt, promptPair)) {
      mistakes.push({
        attemptNumber,
        category: 'off_topic',
        guess: attempt.guess,
        severity: 'major',
        description: 'Wrong universe, wrong game!',
        timestamp: attempt.timestamp
      });
    }

    // Check for repetitive behavior
    if (this.isRepetitive(attempt, previousAttempts)) {
      mistakes.push({
        attemptNumber,
        category: 'repetitive',
        guess: attempt.guess,
        severity: 'minor',
        description: 'Stuck in a loop, trying the same thing again',
        timestamp: attempt.timestamp
      });
    }

    // Check for length blindness
    if (this.isLengthBlind(attempt, promptPair)) {
      mistakes.push({
        attemptNumber,
        category: 'length_blind',
        guess: attempt.guess,
        severity: 'minor',
        description: `Guessed ${attempt.guess.split(' ').length} words when the answer has ${promptPair.wordCount}`,
        timestamp: attempt.timestamp
      });
    }

    // Return the most severe mistake
    return mistakes.sort((a, b) => {
      const severityOrder = { hilarious: 0, major: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })[0] || null;
  }

  private static isWildGuess(attempt: GuessAttempt, promptPair: PromptPair): boolean {
    // If match percentage is below 10% and it's not the first attempt
    return attempt.matchPercentage < 10 && 
           !attempt.guess.toLowerCase().includes(promptPair.category.toLowerCase());
  }

  private static isOverthinking(attempt: GuessAttempt, promptPair: PromptPair): boolean {
    const guessWords = attempt.guess.split(' ').length;
    const outputWords = promptPair.output.split(' ').length;
    
    // If the guess is way more complex than the output suggests
    return guessWords > promptPair.wordCount * 2 && outputWords < 50;
  }

  private static isPatternBlind(attempt: GuessAttempt, promptPair: PromptPair): boolean {
    const guess = attempt.guess.toLowerCase();
    const hasCommonStarter = this.COMMON_PROMPT_STARTERS.some(starter => 
      guess.startsWith(starter)
    );
    
    // If they're not using common prompt patterns when they should
    return !hasCommonStarter && attempt.matchPercentage < 30;
  }

  private static isWordSalad(attempt: GuessAttempt): boolean {
    const words = attempt.guess.toLowerCase().split(' ');
    const uniqueWords = new Set(words);
    
    // If there's too much repetition or no clear structure
    return words.length > 10 && uniqueWords.size < words.length * 0.6;
  }

  private static isOffTopic(attempt: GuessAttempt, promptPair: PromptPair): boolean {
    const categoryKeywords = {
      'poetry': ['haiku', 'poem', 'verse', 'rhyme'],
      'cooking': ['recipe', 'cook', 'ingredient', 'food'],
      'science': ['explain', 'scientific', 'process', 'how'],
      'health': ['health', 'benefit', 'exercise', 'wellness'],
      'motivation': ['motivational', 'inspire', 'quote', 'success']
    };

    const keywords = categoryKeywords[promptPair.category as keyof typeof categoryKeywords] || [];
    const guess = attempt.guess.toLowerCase();
    
    // Check if guess contains none of the category keywords
    return keywords.length > 0 && !keywords.some(keyword => guess.includes(keyword));
  }

  private static isRepetitive(attempt: GuessAttempt, previousAttempts: GuessAttempt[]): boolean {
    if (previousAttempts.length === 0) return false;
    
    const currentWords = new Set(attempt.guess.toLowerCase().split(' '));
    
    // Check if this guess is too similar to a previous one
    return previousAttempts.some(prev => {
      const prevWords = new Set(prev.guess.toLowerCase().split(' '));
      const intersection = new Set([...currentWords].filter(x => prevWords.has(x)));
      return intersection.size / currentWords.size > 0.8;
    });
  }

  private static isLengthBlind(attempt: GuessAttempt, promptPair: PromptPair): boolean {
    const guessWordCount = attempt.guess.split(' ').length;
    const difference = Math.abs(guessWordCount - promptPair.wordCount);
    
    // If they're way off on word count
    return difference > promptPair.wordCount * 0.5;
  }

  static getMistakeEmoji(category: MistakeCategory): string {
    const emojis = {
      'wild_guess': '🎲',
      'overthinking': '🤯',
      'pattern_blind': '🙈',
      'word_salad': '🥗',
      'off_topic': '🛸',
      'repetitive': '🔄',
      'length_blind': '📏'
    };
    return emojis[category] || '❓';
  }
}