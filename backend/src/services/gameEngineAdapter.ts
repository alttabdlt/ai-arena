export interface GameEngineAdapter {
  processAction(gameState: any, action: any): any;
  getValidActions(gameState: any, playerId: string): any[];
  isGameComplete(gameState: any): boolean;
  getWinner(gameState: any): string | null;
  getCurrentTurn(gameState: any): string | null;
  getFinalRankings?(gameState: any): Array<{ playerId: string; rank: number; points?: number }>;
}
