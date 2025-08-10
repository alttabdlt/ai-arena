import { Connect4GameState, Connect4GameAction } from '@game/shared/types';

export interface Connect4TestScenario {
  id: string;
  name: string;
  description: string;
  gameState: Partial<Connect4GameState>;
  board: string[][];
  validColumns: number[];
  expectedBehavior: string;
  acceptableActions: number[]; // Which columns are considered good moves
  criticalActions?: number[]; // Must-play moves (e.g., block immediate win)
}

export const connect4TestScenarios: Connect4TestScenario[] = [
  {
    id: 'opening-move',
    name: 'Opening Move',
    description: 'First move of the game - should prefer center column',
    board: [
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_']
    ],
    validColumns: [0, 1, 2, 3, 4, 5, 6],
    gameState: {
      moveCount: 0,
      currentPlayerIndex: 0,
      gamePhase: 'playing'
    },
    expectedBehavior: 'AI should prefer center columns (3, 2, 4) for better control',
    acceptableActions: [2, 3, 4], // Center columns are best opening moves
  },
  {
    id: 'block-immediate-win',
    name: 'Block Immediate Win',
    description: 'Opponent has 3 in a row horizontally - must block',
    board: [
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['O', 'O', 'O', '_', 'X', 'X', '_']
    ],
    validColumns: [0, 1, 2, 3, 4, 5, 6],
    gameState: {
      moveCount: 5,
      currentPlayerIndex: 0, // X player
      gamePhase: 'playing'
    },
    expectedBehavior: 'AI must block opponent win by playing column 3',
    acceptableActions: [3], // Only column 3 blocks the win
    criticalActions: [3]
  },
  {
    id: 'take-winning-move',
    name: 'Take Winning Move',
    description: 'AI has 3 in a row and can win immediately',
    board: [
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', 'O', '_', '_', '_'],
      ['X', 'X', 'X', '_', 'O', 'O', '_']
    ],
    validColumns: [0, 1, 2, 3, 4, 5, 6],
    gameState: {
      moveCount: 6,
      currentPlayerIndex: 0, // X player
      gamePhase: 'playing'
    },
    expectedBehavior: 'AI should take the winning move in column 3',
    acceptableActions: [3], // Column 3 wins the game
    criticalActions: [3]
  },
  {
    id: 'vertical-threat',
    name: 'Vertical Threat Defense',
    description: 'Opponent building vertical threat - should defend',
    board: [
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', 'O', '_', '_', '_'],
      ['_', '_', '_', 'O', '_', '_', '_'],
      ['X', '_', 'X', 'O', '_', 'X', '_']
    ],
    validColumns: [0, 1, 2, 3, 4, 5, 6],
    gameState: {
      moveCount: 6,
      currentPlayerIndex: 0, // X player
      gamePhase: 'playing'
    },
    expectedBehavior: 'AI should block vertical threat by playing column 3',
    acceptableActions: [3], // Must block vertical threat
    criticalActions: [3]
  },
  {
    id: 'diagonal-opportunity',
    name: 'Diagonal Win Setup',
    description: 'AI can set up a diagonal win opportunity',
    board: [
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', 'X', '_', '_', '_', '_'],
      ['_', 'X', 'O', 'O', '_', '_', '_'],
      ['X', 'O', 'O', 'X', '_', '_', '_']
    ],
    validColumns: [0, 1, 2, 3, 4, 5, 6],
    gameState: {
      moveCount: 9,
      currentPlayerIndex: 0, // X player
      gamePhase: 'playing'
    },
    expectedBehavior: 'AI should continue diagonal pattern or defend',
    acceptableActions: [1, 4], // Column 1 builds threat, column 4 is also strategic
  },
  {
    id: 'fork-creation',
    name: 'Fork Creation',
    description: 'AI can create a fork (two winning threats)',
    board: [
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', '_', '_', '_', '_'],
      ['_', '_', '_', 'X', '_', '_', '_'],
      ['_', '_', 'X', 'O', '_', '_', '_'],
      ['_', 'O', 'X', 'O', '_', 'X', '_']
    ],
    validColumns: [0, 1, 2, 3, 4, 5, 6],
    gameState: {
      moveCount: 8,
      currentPlayerIndex: 0, // X player
      gamePhase: 'playing'
    },
    expectedBehavior: 'AI should recognize fork opportunity or continue building position',
    acceptableActions: [0, 1, 4, 5], // Multiple strategic options
  }
];

export function getConnect4Scenario(id: string): Connect4TestScenario | undefined {
  return connect4TestScenarios.find(scenario => scenario.id === id);
}

export function validateConnect4Decision(
  scenario: Connect4TestScenario,
  decision: Connect4GameAction
): {
  passed: boolean;
  reason: string;
  isCriticalError: boolean;
} {
  if (decision.type !== 'place' || decision.column === undefined) {
    return {
      passed: false,
      reason: 'Invalid action type or missing column',
      isCriticalError: true
    };
  }

  const column = decision.column;

  // Check if it's a critical move that must be made
  if (scenario.criticalActions && scenario.criticalActions.length > 0) {
    if (!scenario.criticalActions.includes(column)) {
      return {
        passed: false,
        reason: `Critical move missed! Should play column ${scenario.criticalActions[0]} but played ${column}`,
        isCriticalError: true
      };
    }
  }

  // Check if it's an acceptable move
  if (!scenario.acceptableActions.includes(column)) {
    return {
      passed: false,
      reason: `Suboptimal move. Expected columns [${scenario.acceptableActions.join(', ')}] but played ${column}`,
      isCriticalError: false
    };
  }

  return {
    passed: true,
    reason: 'Good move!',
    isCriticalError: false
  };
}