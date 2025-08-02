import { Card, PokerPhase } from '@game/engine/games/poker/PokerTypes';

export function formatChips(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
}

export function getCardColor(card: Card): 'red' | 'black' {
  const suit = card[1];
  return (suit === '♥' || suit === '♦') ? 'red' : 'black';
}

export function getCardDisplayValue(card: Card): { rank: string; suit: string } {
  return {
    rank: card[0],
    suit: card[1]
  };
}

// Convert card format for AI models (A♠ -> As)
export function convertCardForAI(card: Card): string {
  const rank = card[0];
  const suit = card[1];
  
  const suitMap: { [key: string]: string } = {
    '♠': 's', // spades
    '♥': 'h', // hearts
    '♦': 'd', // diamonds
    '♣': 'c'  // clubs
  };
  
  return rank + (suitMap[suit] || suit);
}

// Convert multiple cards for AI
export function convertCardsForAI(cards: Card[]): string[] {
  return cards.map(card => convertCardForAI(card));
}

export function getPlayerPosition(index: number, totalPlayers: number): string {
  // Calculate position on an elliptical table
  // Returns Tailwind CSS classes for absolute positioning
  
  // Predefined positions for different player counts
  const positions: { [key: number]: string[] } = {
    2: [
      "bottom-8 left-1/2 -translate-x-1/2",        // Bottom center (Player 1)
      "top-4 left-1/2 -translate-x-1/2"            // Top center (Player 2)
    ],
    3: [
      "bottom-8 left-1/2 -translate-x-1/2",        // Bottom center
      "top-4 left-16",                              // Top left
      "top-4 right-16"                              // Top right
    ],
    4: [
      "bottom-8 left-1/2 -translate-x-1/2",        // Bottom center
      "left-4 top-1/2 -translate-y-1/2",           // Left center
      "top-4 left-1/2 -translate-x-1/2",           // Top center
      "right-4 top-1/2 -translate-y-1/2"           // Right center
    ],
    5: [
      "bottom-8 left-1/2 -translate-x-1/2",        // Bottom center
      "bottom-8 left-12",                           // Bottom left
      "top-4 left-12",                              // Top left
      "top-4 right-12",                             // Top right
      "bottom-8 right-12"                           // Bottom right
    ],
    6: [
      "bottom-8 left-1/2 -translate-x-1/2",        // Bottom center
      "bottom-8 left-12",                           // Bottom left
      "left-4 top-1/2 -translate-y-1/2",           // Left center
      "top-4 left-1/2 -translate-x-1/2",           // Top center
      "right-4 top-1/2 -translate-y-1/2",          // Right center
      "bottom-8 right-12"                           // Bottom right
    ],
    7: [
      "bottom-8 left-1/2 -translate-x-1/2",        // Bottom center
      "bottom-6 left-8",                            // Bottom left
      "left-4 top-1/3",                             // Left upper
      "top-4 left-1/4",                             // Top left
      "top-4 right-1/4",                            // Top right
      "right-4 top-1/3",                            // Right upper
      "bottom-6 right-8"                            // Bottom right
    ],
    8: [
      "bottom-8 left-1/2 -translate-x-1/2",        // Bottom center
      "bottom-6 left-8",                            // Bottom left
      "left-4 bottom-1/3",                          // Left lower
      "left-4 top-1/3",                             // Left upper
      "top-4 left-1/2 -translate-x-1/2",           // Top center
      "right-4 top-1/3",                            // Right upper
      "right-4 bottom-1/3",                         // Right lower
      "bottom-6 right-8"                            // Bottom right
    ],
    9: [
      "bottom-8 left-1/2 -translate-x-1/2",        // Bottom center
      "bottom-6 left-10",                           // Bottom left
      "left-3 bottom-1/4",                          // Left bottom
      "left-3 top-1/2 -translate-y-1/2",           // Left center
      "left-3 top-1/4",                             // Left top
      "top-4 left-1/2 -translate-x-1/2",           // Top center
      "right-3 top-1/4",                            // Right top
      "right-3 top-1/2 -translate-y-1/2",          // Right center
      "bottom-6 right-10"                           // Bottom right
    ]
  };

  // Use predefined positions
  if (positions[totalPlayers] && positions[totalPlayers][index]) {
    return positions[totalPlayers][index];
  }

  // Fallback should not be needed now
  return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
}

export function getPhaseDisplayName(phase: PokerPhase): string {
  const phaseNames: { [key in PokerPhase]: string } = {
    'waiting': 'Waiting',
    'preflop': 'Pre-Flop',
    'flop': 'Flop',
    'turn': 'Turn',
    'river': 'River',
    'showdown': 'Showdown'
  };
  
  return phaseNames[phase] || phase;
}

export function getActionDisplayText(action: string, playerName: string): string {
  const actionTemplates: { [key: string]: string } = {
    'fold': `${playerName} folds`,
    'check': `${playerName} checks`,
    'call': `${playerName} calls`,
    'bet': `${playerName} bets`,
    'raise': `${playerName} raises`,
    'all-in': `${playerName} goes all-in!`
  };
  
  const baseAction = action.split(' ')[0];
  return actionTemplates[baseAction] || `${playerName} ${action}`;
}

export function shouldShowCard(
  cardIndex: number,
  phase: PokerPhase,
  totalCommunityCards: number
): boolean {
  // Determine if a community card should be visible based on game phase
  if (phase === 'preflop' || phase === 'waiting') return false;
  
  if (phase === 'flop' && cardIndex < 3) return true;
  if (phase === 'turn' && cardIndex < 4) return true;
  if (phase === 'river' && cardIndex < 5) return true;
  if (phase === 'showdown') return true;
  
  return false;
}

export function getHandStrengthDescription(handName: string): string {
  // Convert pokersolver hand names to user-friendly descriptions
  const descriptions: { [key: string]: string } = {
    'Royal Flush': '👑 Royal Flush - Unbeatable!',
    'Straight Flush': '🔥 Straight Flush',
    'Four of a Kind': '🎯 Four of a Kind',
    'Full House': '🏠 Full House',
    'Flush': '♠ Flush',
    'Straight': '📏 Straight',
    'Three of a Kind': '🎲 Three of a Kind',
    'Two Pair': '👯 Two Pair',
    'Pair': '👥 Pair',
    'High Card': '☝️ High Card'
  };
  
  for (const [key, value] of Object.entries(descriptions)) {
    if (handName.includes(key)) {
      return value;
    }
  }
  
  return handName;
}

export function calculatePotPercentage(playerBet: number, totalPot: number): number {
  if (totalPot === 0) return 0;
  return Math.round((playerBet / totalPot) * 100);
}

export function getPlayerStatusColor(
  isCurrentPlayer: boolean,
  isFolded: boolean,
  isAllIn: boolean,
  hasWon: boolean
): string {
  if (hasWon) return 'border-yellow-400 shadow-yellow-400/50 shadow-lg';
  if (isFolded) return 'opacity-50 grayscale';
  if (isAllIn) return 'border-red-500 shadow-red-500/50';
  if (isCurrentPlayer) return 'border-green-400 shadow-green-400/50 shadow-lg animate-pulse';
  return 'border-border';
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  return 'a while ago';
}