import { BaseScoringSystem, ScoringRule } from '../../../base/BaseScoringSystem';
import { IGameEvent, IScoreBreakdown } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { ReverseHangmanGameState, ReverseHangmanPlayer, GuessAttempt } from '../ReverseHangmanTypes';

export interface ReverseHangmanStats {
  firstTryWins: number;
  perfectGames: number;
  patternRecognitions: number;
  semanticWins: number;
  comebackWins: number;
  speedWins: number;
  totalGuesses: number;
  successfulGuesses: number;
  averageAttemptsPerWin: number;
  bestStreak: number;
  currentStreak: number;
}

export class ReverseHangmanScoringSystem extends BaseScoringSystem<ReverseHangmanGameState> {
  private static readonly BASE_POINTS = {
    easy: 500,
    medium: 1000,
    hard: 2000,
    expert: 5000
  };

  private static readonly ATTEMPT_MULTIPLIERS = [
    1.00,  // 1st attempt - Full points
    0.75,  // 2nd attempt - 25% penalty
    0.50,  // 3rd attempt - 50% penalty
    0.30,  // 4th attempt - 70% penalty
    0.15,  // 5th attempt - 85% penalty
    0.08,  // 6th attempt - 92% penalty
    0.04   // 7th attempt - 96% penalty
  ];

  private playerStats: Map<string, ReverseHangmanStats> = new Map();
  private currentRoundStats: Map<string, {
    guessCount: number;
    firstGuessTime: number;
    lastGuessTime: number;
    matchProgression: number[];
  }> = new Map();

  constructor(context: IGameContext) {
    super(context);
  }

  protected initializeRules(): void {
    this.rules = [
      {
        id: 'first-try-hero',
        name: 'First Try Hero',
        category: 'style',
        evaluate: (state: ReverseHangmanGameState) => {
          if (state.phase === 'won' && state.attempts.length === 1) {
            return 2000;
          }
          return 0;
        },
        description: 'Guessed correctly on first attempt'
      },
      {
        id: 'deductive-reasoning',
        name: 'Deductive Reasoning',
        category: 'style',
        evaluate: (state: ReverseHangmanGameState) => {
          if (state.phase !== 'won') return 0;
          
          const lastAttempt = state.attempts[state.attempts.length - 1];
          if (state.attempts.length === 2 && lastAttempt.matchType === 'exact') {
            return 300;
          }
          return 0;
        },
        description: 'Guessed correctly on second attempt'
      },
      {
        id: 'pattern-recognition',
        name: 'Pattern Recognition',
        category: 'style',
        evaluate: (state: ReverseHangmanGameState) => {
          if (state.phase !== 'won' || state.attempts.length < 2) return 0;
          
          const improvements = state.attempts.slice(1).map((attempt, i) => 
            attempt.matchPercentage > state.attempts[i].matchPercentage
          );
          
          if (improvements.length > 0 && improvements.every(improved => improved)) {
            return 500;
          }
          return 0;
        },
        description: 'Improved match percentage with each guess'
      },
      {
        id: 'efficiency-master',
        name: 'Efficiency Master',
        category: 'style',
        evaluate: (state: ReverseHangmanGameState) => {
          if (state.phase === 'won' && state.attempts.length <= 3) {
            return 500;
          }
          return 0;
        },
        description: 'Won within 3 attempts'
      },
      {
        id: 'semantic-genius',
        name: 'Semantic Genius',
        category: 'style',
        evaluate: (state: ReverseHangmanGameState) => {
          if (state.phase !== 'won') return 0;
          
          const hasSemanticMatch = state.attempts.some(attempt => 
            attempt.matchType === 'semantic'
          );
          const wonExactly = state.attempts[state.attempts.length - 1].matchType === 'exact';
          
          if (hasSemanticMatch && wonExactly) {
            return 400;
          }
          return 0;
        },
        description: 'Used semantic understanding to find exact match'
      },
      {
        id: 'comeback-kid',
        name: 'Comeback Kid',
        category: 'style',
        evaluate: (state: ReverseHangmanGameState) => {
          if (state.phase !== 'won' || state.attempts.length < 5) return 0;
          
          const firstHalf = state.attempts.slice(0, Math.floor(state.attempts.length / 2));
          const allPoorMatches = firstHalf.every(attempt => attempt.matchPercentage < 50);
          
          if (allPoorMatches) {
            return 600;
          }
          return 0;
        },
        description: 'Won after poor initial guesses'
      },
      {
        id: 'speed-demon',
        name: 'Speed Demon',
        category: 'time',
        evaluate: (state: ReverseHangmanGameState) => {
          if (state.phase !== 'won' || !state.endTime) return 0;
          
          const duration = (state.endTime.getTime() - state.startTime.getTime()) / 1000;
          if (duration < 30) return 300;
          if (duration < 60) return 150;
          if (duration < 90) return 50;
          
          return 0;
        },
        description: 'Quick solution time'
      }
    ];
  }

  protected calculateBasePoints(state: ReverseHangmanGameState, playerId: string): number {
    const player = state.players.find(p => p.id === playerId) as ReverseHangmanPlayer;
    if (!player) return 0;

    // Base points from rounds won
    let basePoints = 0;
    
    // If current round is won, calculate points for it
    if (state.phase === 'won' && state.currentTurn === playerId) {
      const difficulty = state.currentPromptPair?.difficulty || 'easy';
      const difficultyPoints = ReverseHangmanScoringSystem.BASE_POINTS[difficulty as keyof typeof ReverseHangmanScoringSystem.BASE_POINTS] || 500;
      const attemptMultiplier = ReverseHangmanScoringSystem.ATTEMPT_MULTIPLIERS[state.attempts.length - 1] || 0.04;
      basePoints = Math.round(difficultyPoints * attemptMultiplier);
    }

    // Add accumulated score from previous rounds
    basePoints += player.totalScore;

    return basePoints;
  }

  protected calculatePenaltyPoints(state: ReverseHangmanGameState, playerId: string): number {
    const player = state.players.find(p => p.id === playerId) as ReverseHangmanPlayer;
    if (!player) return 0;

    let penalties = 0;

    // Penalty for skipping
    const skipCount = player.guessHistory.filter(g => g.guess === '[SKIPPED]').length;
    penalties += skipCount * 100;

    // Penalty for very poor guesses (< 20% match)
    const poorGuesses = player.guessHistory.filter(g => g.matchPercentage < 20).length;
    penalties += poorGuesses * 50;

    return penalties;
  }

  protected getPenaltyBreakdown(state: ReverseHangmanGameState, playerId: string): IScoreBreakdown[] {
    const player = state.players.find(p => p.id === playerId) as ReverseHangmanPlayer;
    if (!player) return [];

    const breakdown: IScoreBreakdown[] = [];

    const skipCount = player.guessHistory.filter(g => g.guess === '[SKIPPED]').length;
    if (skipCount > 0) {
      breakdown.push({
        category: 'penalty',
        description: `Skipped ${skipCount} turn(s)`,
        points: -skipCount * 100
      });
    }

    const poorGuesses = player.guessHistory.filter(g => g.matchPercentage < 20).length;
    if (poorGuesses > 0) {
      breakdown.push({
        category: 'penalty',
        description: `Poor guesses (< 20% match)`,
        points: -poorGuesses * 50
      });
    }

    return breakdown;
  }

  protected isScorableEvent(event: IGameEvent): boolean {
    return ['guess:made', 'round:won', 'round:lost'].includes(event.type);
  }

  protected processScorableEvent(event: IGameEvent): void {
    if (!event.playerId) return;

    const stats = this.getOrCreatePlayerStats(event.playerId);
    const roundStats = this.getOrCreateRoundStats(event.playerId);

    switch (event.type) {
      case 'guess:made':
        stats.totalGuesses++;
        roundStats.guessCount++;
        
        if (!roundStats.firstGuessTime) {
          roundStats.firstGuessTime = Date.now();
        }
        roundStats.lastGuessTime = Date.now();
        
        if (event.data.attempt.isCorrect) {
          stats.successfulGuesses++;
          stats.currentStreak++;
          if (stats.currentStreak > stats.bestStreak) {
            stats.bestStreak = stats.currentStreak;
          }
        }
        
        roundStats.matchProgression.push(event.data.attempt.matchPercentage);
        break;

      case 'round:won':
        if (roundStats.guessCount === 1) {
          stats.firstTryWins++;
        }
        
        const avgAttempts = stats.successfulGuesses > 0 
          ? (stats.totalGuesses / stats.successfulGuesses)
          : 0;
        stats.averageAttemptsPerWin = avgAttempts;

        const duration = (roundStats.lastGuessTime - roundStats.firstGuessTime) / 1000;
        if (duration < 30) {
          stats.speedWins++;
        }

        // Check for pattern recognition
        if (this.hasConsistentImprovement(roundStats.matchProgression)) {
          stats.patternRecognitions++;
        }

        this.currentRoundStats.delete(event.playerId);
        break;

      case 'round:lost':
        stats.currentStreak = 0;
        this.currentRoundStats.delete(event.playerId);
        break;
    }

    this.playerStats.set(event.playerId, stats);
  }

  protected getEventBonus(event: IGameEvent): number {
    // Event bonuses are handled by the rules system
    return 0;
  }

  protected updateTrackerWithEvent(tracker: any, event: IGameEvent): void {
    if (event.type === 'guess:made') {
      tracker.actions++;
      if (event.data.attempt.isCorrect) {
        tracker.successes++;
        tracker.streaks.current++;
        if (tracker.streaks.current > tracker.streaks.best) {
          tracker.streaks.best = tracker.streaks.current;
        }
      } else {
        tracker.failures++;
        tracker.streaks.current = 0;
      }
    }
  }

  protected detectAchievements(event: IGameEvent): string[] {
    const achievements: string[] = [];
    
    if (!event.playerId) return achievements;
    
    const stats = this.playerStats.get(event.playerId);
    if (!stats) return achievements;

    // Check for achievement conditions
    if (stats.firstTryWins >= 5) {
      achievements.push('first-try-master');
    }

    if (stats.bestStreak >= 10) {
      achievements.push('streak-champion');
    }

    if (stats.patternRecognitions >= 10) {
      achievements.push('pattern-expert');
    }

    if (stats.speedWins >= 10) {
      achievements.push('speed-champion');
    }

    if (stats.averageAttemptsPerWin <= 2.5 && stats.successfulGuesses >= 10) {
      achievements.push('efficiency-expert');
    }

    return achievements;
  }

  private getOrCreatePlayerStats(playerId: string): ReverseHangmanStats {
    if (!this.playerStats.has(playerId)) {
      this.playerStats.set(playerId, {
        firstTryWins: 0,
        perfectGames: 0,
        patternRecognitions: 0,
        semanticWins: 0,
        comebackWins: 0,
        speedWins: 0,
        totalGuesses: 0,
        successfulGuesses: 0,
        averageAttemptsPerWin: 0,
        bestStreak: 0,
        currentStreak: 0
      });
    }
    return this.playerStats.get(playerId)!;
  }

  private getOrCreateRoundStats(playerId: string) {
    if (!this.currentRoundStats.has(playerId)) {
      this.currentRoundStats.set(playerId, {
        guessCount: 0,
        firstGuessTime: 0,
        lastGuessTime: 0,
        matchProgression: []
      });
    }
    return this.currentRoundStats.get(playerId)!;
  }

  private hasConsistentImprovement(progression: number[]): boolean {
    if (progression.length < 2) return false;
    
    for (let i = 1; i < progression.length; i++) {
      if (progression[i] <= progression[i - 1]) {
        return false;
      }
    }
    return true;
  }

  getPlayerStats(playerId: string): ReverseHangmanStats | undefined {
    return this.playerStats.get(playerId);
  }
}