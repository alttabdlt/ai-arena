import { BaseScoringSystem } from '../../../base/BaseScoringSystem';
import { IGameEvent, IScoreBreakdown } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { Connect4GameState, Connect4GamePlayer } from '../Connect4Types';

export class Connect4ScoringSystem extends BaseScoringSystem<Connect4GameState> {
  constructor(context: IGameContext) {
    super(context);
  }

  protected initializeRules(): void {
    // Initialize any game-specific scoring rules
  }

  protected calculateBasePoints(state: Connect4GameState, playerId: string): number {
    const player = state.players.find(p => p.id === playerId) as Connect4GamePlayer;
    if (!player) return 0;

    let score = 0;

    // Base score for participation
    score += 100;

    // Points for each move made
    score += player.totalMoves * 10;

    // Winning bonus
    if (state.winner === playerId) {
      score += 500;
    }

    // Draw bonus (better than losing)
    if (state.gamePhase === 'draw') {
      score += 200;
    }

    return score;
  }

  protected calculatePenaltyPoints(state: Connect4GameState, playerId: string): number {
    const player = state.players.find(p => p.id === playerId) as Connect4GamePlayer;
    if (!player) return 0;

    let penalty = 0;

    // Penalty for timeouts
    penalty += player.timeouts * 50;

    return penalty;
  }

  protected getPenaltyBreakdown(state: Connect4GameState, playerId: string): IScoreBreakdown[] {
    const player = state.players.find(p => p.id === playerId) as Connect4GamePlayer;
    if (!player) return [];

    const breakdown: IScoreBreakdown[] = [];

    if (player.timeouts > 0) {
      breakdown.push({
        category: 'penalty',
        description: `Timeouts (${player.timeouts})`,
        points: -player.timeouts * 50
      });
    }

    return breakdown;
  }

  protected isScorableEvent(event: IGameEvent): boolean {
    // Define which events should trigger score updates
    return event.type === 'action:executed' || 
           event.type === 'game:ended';
  }

  protected processScorableEvent(event: IGameEvent): void {
    // Process specific events that affect scoring
    if (event.type === 'action:executed' && event.data?.action) {
      const action = event.data.action;
      
      // Track style points for specific actions
      if (action.type === 'place' && action.column === 3) {
        // Center column play bonus
        const currentScore = this.scores.get(action.playerId) || 0;
        this.scores.set(action.playerId, currentScore + 5);
      }
    }
  }

  protected getEventBonus(event: IGameEvent): number {
    // Calculate bonus points for specific events
    if (event.type === 'game:ended' && event.data?.winners) {
      const state = event.data.finalState as Connect4GameState;
      
      // Fast win bonus
      if (state.moveCount < 10 && event.data.winners.length > 0) {
        return 100;
      }
      
      // Come from behind bonus
      // (would need to track who was ahead to implement properly)
    }
    
    return 0;
  }

  protected updateTrackerWithEvent(tracker: any, event: IGameEvent): void {
    // Update bonus trackers based on events
    if (event.type === 'action:executed') {
      tracker.actions++;
      
      if (event.data?.action?.type === 'place') {
        tracker.moves = (tracker.moves || 0) + 1;
        
        // Track center plays
        if (event.data.action.column === 3) {
          tracker.centerPlays = (tracker.centerPlays || 0) + 1;
        }
      }
    }
  }

  protected detectAchievements(event: IGameEvent): string[] {
    const achievements: string[] = [];
    
    if (event.type === 'game:ended' && event.data?.winners?.includes(event.playerId)) {
      const state = event.data.finalState as Connect4GameState;
      const tracker = this.bonusTrackers.get(event.playerId);
      
      // Perfect game - win without timeouts
      const player = state.players.find(p => p.id === event.playerId) as Connect4GamePlayer;
      if (player?.timeouts === 0) {
        achievements.push('perfect_game');
      }
      
      // Speed demon - win in under 10 moves
      if (state.moveCount < 10) {
        achievements.push('speed_demon');
      }
      
      // Center control - played center column 5+ times
      if (tracker?.centerPlays >= 5) {
        achievements.push('center_control');
      }
      
      // Diagonal master - win with diagonal line
      if (state.winningCells && this.isDiagonalWin(state.winningCells)) {
        achievements.push('diagonal_master');
      }
    }
    
    return achievements;
  }

  private isDiagonalWin(cells: Array<[number, number]>): boolean {
    if (cells.length < 4) return false;
    
    // Check if cells form a diagonal line
    const sorted = cells.sort((a, b) => a[0] - b[0]);
    const rowDiff = sorted[1][0] - sorted[0][0];
    const colDiff = sorted[1][1] - sorted[0][1];
    
    return Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1;
  }

  protected getPlayerName(playerId: string): string {
    // Could enhance this to get actual player names from context
    return `Player ${playerId}`;
  }
}