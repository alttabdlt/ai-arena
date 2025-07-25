export interface MatchResult {
  percentage: number;
  type: 'exact' | 'near' | 'partial' | 'semantic' | 'incorrect';
  details: {
    wordMatches: number;
    totalWords: number;
    matchedWords: string[];
    matchedWordPositions: Array<{ word: string; position: number }>;
    missingWords: string[];
    extraWords: string[];
    semanticMatches: Array<{ original: string; matched: string; position: number }>;
    positionTemplate: string;
  };
}

export class PromptMatcher {
  private readonly semanticEquivalents: Map<string, string[]> = new Map([
    ['write', ['create', 'compose', 'draft', 'make', 'generate', 'produce']],
    ['explain', ['describe', 'clarify', 'elaborate', 'detail', 'illustrate']],
    ['list', ['enumerate', 'itemize', 'name', 'specify', 'outline']],
    ['design', ['create', 'build', 'develop', 'construct', 'architect']],
    ['story', ['tale', 'narrative', 'account', 'fiction', 'plot']],
    ['poem', ['verse', 'poetry', 'rhyme', 'sonnet', 'haiku']],
    ['simple', ['easy', 'basic', 'straightforward', 'elementary', 'uncomplicated']],
    ['using', ['with', 'through', 'via', 'employing', 'utilizing']]
  ]);

  match(guess: string, target: string): MatchResult {
    const normalizedGuess = this.normalize(guess);
    const normalizedTarget = this.normalize(target);

    if (normalizedGuess === normalizedTarget) {
      return this.createExactMatch(guess, target);
    }

    const guessWords = normalizedGuess.split(' ');
    const targetWords = normalizedTarget.split(' ');

    const matchDetails = this.analyzeWordMatches(guessWords, targetWords);
    const matchPercentage = this.calculateMatchPercentage(matchDetails, guessWords.length, targetWords.length);
    const matchType = this.determineMatchType(matchPercentage, matchDetails);

    return {
      percentage: matchPercentage,
      type: matchType,
      details: matchDetails
    };
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private createExactMatch(guess: string, target: string): MatchResult {
    const words = this.normalize(target).split(' ');
    const matchedWordPositions = words.map((word, index) => ({ word, position: index }));
    
    return {
      percentage: 100,
      type: 'exact',
      details: {
        wordMatches: words.length,
        totalWords: words.length,
        matchedWords: words,
        matchedWordPositions,
        missingWords: [],
        extraWords: [],
        semanticMatches: [],
        positionTemplate: words.join(' ')
      }
    };
  }

  private analyzeWordMatches(guessWords: string[], targetWords: string[]): MatchResult['details'] {
    const matchedWords: string[] = [];
    const matchedWordPositions: Array<{ word: string; position: number }> = [];
    const semanticMatches: Array<{ original: string; matched: string; position: number }> = [];
    const usedTargetIndices = new Set<number>();

    // First pass: exact word matches
    for (let i = 0; i < guessWords.length; i++) {
      for (let j = 0; j < targetWords.length; j++) {
        if (!usedTargetIndices.has(j) && guessWords[i] === targetWords[j]) {
          matchedWords.push(guessWords[i]);
          matchedWordPositions.push({ word: guessWords[i], position: j });
          usedTargetIndices.add(j);
          break;
        }
      }
    }

    // Second pass: semantic matches
    for (let i = 0; i < guessWords.length; i++) {
      if (!matchedWords.includes(guessWords[i])) {
        for (let j = 0; j < targetWords.length; j++) {
          if (!usedTargetIndices.has(j) && this.areSemanticallySimilar(guessWords[i], targetWords[j])) {
            semanticMatches.push({ original: targetWords[j], matched: guessWords[i], position: j });
            usedTargetIndices.add(j);
            break;
          }
        }
      }
    }

    const missingWords = targetWords.filter((_, index) => !usedTargetIndices.has(index));
    const extraWords = guessWords.filter(word => 
      !matchedWords.includes(word) && 
      !semanticMatches.some(sm => sm.matched === word)
    );

    // Build position template (hangman-style)
    const positionTemplate = this.buildPositionTemplate(targetWords, usedTargetIndices);

    return {
      wordMatches: matchedWords.length + semanticMatches.length,
      totalWords: targetWords.length,
      matchedWords,
      matchedWordPositions,
      missingWords,
      extraWords,
      semanticMatches,
      positionTemplate
    };
  }

  private areSemanticallySimilar(word1: string, word2: string): boolean {
    const equivalents1 = this.semanticEquivalents.get(word1) || [];
    const equivalents2 = this.semanticEquivalents.get(word2) || [];

    return equivalents1.includes(word2) || 
           equivalents2.includes(word1) ||
           this.checkStemSimilarity(word1, word2);
  }

  private checkStemSimilarity(word1: string, word2: string): boolean {
    // Simple stemming check
    const stem1 = word1.replace(/ing$|ed$|s$|es$/, '');
    const stem2 = word2.replace(/ing$|ed$|s$|es$/, '');
    
    return stem1 === stem2 && stem1.length >= 3;
  }

  private calculateMatchPercentage(
    details: MatchResult['details'], 
    guessLength: number, 
    targetLength: number
  ): number {
    const exactMatchWeight = 1.0;
    const semanticMatchWeight = 0.7;
    
    const exactScore = details.matchedWords.length * exactMatchWeight;
    const semanticScore = details.semanticMatches.length * semanticMatchWeight;
    const totalScore = exactScore + semanticScore;
    
    // Base percentage on target length (what we're trying to match)
    const basePercentage = (totalScore / targetLength) * 100;
    
    // Smaller penalty for wrong word count to avoid harsh drops
    const wordCountDiff = Math.abs(guessLength - targetLength);
    const wordCountPenalty = Math.min(wordCountDiff * 2, 10);
    
    return Math.max(0, Math.min(100, basePercentage - wordCountPenalty));
  }

  private determineMatchType(percentage: number, details: MatchResult['details']): MatchResult['type'] {
    if (percentage === 100) {
      return 'exact';
    } else if (percentage >= 90) {
      return 'near';
    } else if (percentage >= 70) {
      return 'partial';
    } else if (percentage >= 30 && details.semanticMatches.length > 0) {
      return 'semantic';
    }
    return 'incorrect';
  }

  private buildPositionTemplate(targetWords: string[], usedIndices: Set<number>): string {
    const template: string[] = [];
    
    for (let i = 0; i < targetWords.length; i++) {
      if (usedIndices.has(i)) {
        template.push(targetWords[i]);
      } else {
        template.push('_');
      }
    }
    
    return template.join(' ');
  }
}