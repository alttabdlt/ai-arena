import { ReverseHangmanState, GuessAttempt } from '../engine/reverse-hangman-engine';

export interface ScoreResult {
  basePoints: number;
  attemptMultiplier: number;
  styleBonus: number;
  timeBonus: number;
  totalScore: number;
  breakdown: {
    difficulty: string;
    attemptsUsed: number;
    timeTaken: number;
    bonusesEarned: string[];
  };
}

export interface StyleBonus {
  name: string;
  points: number;
  condition: (state: ReverseHangmanState) => boolean;
}

export class ReverseHangmanScoringSystem {
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

  private static readonly STYLE_BONUSES: StyleBonus[] = [
    {
      name: 'First Try Hero',
      points: 2000,
      condition: (state) => state.phase === 'won' && state.attempts.length === 1
    },
    {
      name: 'Deductive Reasoning',
      points: 300,
      condition: (state) => {
        if (state.phase !== 'won') return false;
        const lastAttempt = state.attempts[state.attempts.length - 1];
        return state.attempts.length === 2 && lastAttempt.matchType === 'exact';
      }
    },
    {
      name: 'Pattern Recognition',
      points: 500,
      condition: (state) => {
        if (state.phase !== 'won' || state.attempts.length === 0) return false;
        const improvements = state.attempts.slice(1).map((attempt, i) => 
          attempt.matchPercentage > state.attempts[i].matchPercentage
        );
        return improvements.length > 0 && improvements.every(improved => improved);
      }
    },
    {
      name: 'Efficiency Master',
      points: 500,
      condition: (state) => state.phase === 'won' && state.attempts.length <= 3
    },
    {
      name: 'Semantic Genius',
      points: 400,
      condition: (state) => {
        if (state.phase !== 'won') return false;
        return state.attempts.some(attempt => 
          attempt.matchType === 'semantic' && 
          state.attempts[state.attempts.length - 1].matchType === 'exact'
        );
      }
    },
    {
      name: 'Comeback Kid',
      points: 600,
      condition: (state) => {
        if (state.phase !== 'won' || state.attempts.length < 5) return false;
        const firstHalf = state.attempts.slice(0, Math.floor(state.attempts.length / 2));
        return firstHalf.every(attempt => attempt.matchPercentage < 50);
      }
    },
    {
      name: 'Speed Demon',
      points: 300,
      condition: (state) => {
        if (state.phase !== 'won') return false;
        const duration = state.endTime ? 
          (state.endTime.getTime() - state.startTime.getTime()) / 1000 : 0;
        return duration > 0 && duration < 30;
      }
    }
  ];

  static calculateScore(state: ReverseHangmanState): ScoreResult {
    if (state.phase === 'lost') {
      return {
        basePoints: 0,
        attemptMultiplier: 0,
        styleBonus: 0,
        timeBonus: 0,
        totalScore: 0,
        breakdown: {
          difficulty: state.currentPromptPair.difficulty,
          attemptsUsed: state.attempts.length,
          timeTaken: this.getTimeTaken(state),
          bonusesEarned: ['Game Lost']
        }
      };
    }

    const basePoints = this.BASE_POINTS[state.currentPromptPair.difficulty] || 500;
    const attemptMultiplier = this.ATTEMPT_MULTIPLIERS[state.attempts.length - 1] || 0.1;
    const adjustedBase = Math.round(basePoints * attemptMultiplier);

    const earnedBonuses = this.STYLE_BONUSES.filter(bonus => bonus.condition(state));
    const styleBonus = earnedBonuses.reduce((sum, bonus) => sum + bonus.points, 0);

    const timeBonus = this.calculateTimeBonus(state);

    const totalScore = adjustedBase + styleBonus + timeBonus;

    return {
      basePoints: basePoints,
      attemptMultiplier,
      styleBonus,
      timeBonus,
      totalScore,
      breakdown: {
        difficulty: state.currentPromptPair.difficulty,
        attemptsUsed: state.attempts.length,
        timeTaken: this.getTimeTaken(state),
        bonusesEarned: earnedBonuses.map(b => b.name)
      }
    };
  }

  private static calculateTimeBonus(state: ReverseHangmanState): number {
    if (state.phase !== 'won' || !state.endTime) return 0;

    const timeTaken = (state.endTime.getTime() - state.startTime.getTime()) / 1000;
    
    if (timeTaken < 30) return 200;
    if (timeTaken < 60) return 100;
    if (timeTaken < 90) return 50;
    
    return 0;
  }

  private static getTimeTaken(state: ReverseHangmanState): number {
    const endTime = state.endTime || new Date();
    return Math.round((endTime.getTime() - state.startTime.getTime()) / 1000);
  }

  static getAttemptPenaltyPercentage(attemptNumber: number): number {
    if (attemptNumber <= 0 || attemptNumber > this.ATTEMPT_MULTIPLIERS.length) {
      return 100;
    }
    return Math.round((1 - this.ATTEMPT_MULTIPLIERS[attemptNumber - 1]) * 100);
  }

  static getMaxPossibleScore(difficulty: string): number {
    const basePoints = this.BASE_POINTS[difficulty as keyof typeof this.BASE_POINTS] || 500;
    const maxStyleBonus = this.STYLE_BONUSES.reduce((sum, bonus) => sum + bonus.points, 0);
    const maxTimeBonus = 200;
    return basePoints + maxStyleBonus + maxTimeBonus;
  }
}