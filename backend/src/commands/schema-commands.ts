#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';

const prisma = new PrismaClient();

const SCHEMA_VERSION = '1.0.0';
const MAX_JSONB_SIZE = 1048576; // 1MB recommended max

interface SchemaField {
  table: string;
  column: string;
  type: string;
  jsonb: boolean;
  description: string;
}

const AVAILABLE_JSONB_FIELDS: SchemaField[] = [
  {
    table: 'Match',
    column: 'gameHistory',
    type: 'Json',
    jsonb: true,
    description: 'Complete game state storage (boards, cards, moves, etc.)'
  },
  {
    table: 'Match',
    column: 'decisions',
    type: 'Json',
    jsonb: true,
    description: 'All AI decisions made during the game'
  },
  {
    table: 'Match',
    column: 'result',
    type: 'Json',
    jsonb: true,
    description: 'Final game results, rankings, and scores'
  },
  {
    table: 'Bot',
    column: 'stats',
    type: 'Json',
    jsonb: true,
    description: 'Bot statistics and achievements'
  },
  {
    table: 'Bot',
    column: 'metaversePosition',
    type: 'Json',
    jsonb: true,
    description: 'Bot position in metaverse'
  },
  {
    table: 'Bot',
    column: 'relationshipStage',
    type: 'Json',
    jsonb: true,
    description: 'Bot relationships with other bots'
  },
  {
    table: 'AIDecision',
    column: 'decision',
    type: 'Json',
    jsonb: true,
    description: 'Individual AI decision data'
  },
  {
    table: 'AIDecision',
    column: 'gameState',
    type: 'Json',
    jsonb: true,
    description: 'Game state snapshot at decision time'
  }
];

const GAME_STORAGE_EXAMPLES = {
  poker: {
    gameHistory: {
      gameType: 'poker',
      version: '1.0.0',
      state: {
        deck: ['AH', 'KS', 'QD', 'JC', '10H'],
        communityCards: ['QD', 'JC', '10H'],
        pot: 1000,
        phase: 'river',
        players: [
          { id: 'bot_1', cards: ['AH', 'KH'], chips: 500, folded: false },
          { id: 'bot_2', cards: ['2D', '7C'], chips: 300, folded: true }
        ]
      },
      moves: [
        { player: 'bot_1', action: 'raise', amount: 100 },
        { player: 'bot_2', action: 'fold' }
      ]
    },
    decisions: {
      decisions: [
        {
          botId: 'bot_1',
          round: 1,
          action: { type: 'raise', amount: 100 },
          reasoning: 'Strong hand, high probability of winning'
        }
      ]
    },
    result: {
      winner: 'bot_1',
      rankings: [
        { botId: 'bot_1', rank: 1, chips: 1300 },
        { botId: 'bot_2', rank: 2, chips: 0 }
      ]
    }
  },
  connect4: {
    gameHistory: {
      gameType: 'connect4',
      version: '1.0.0',
      state: {
        board: [
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 1, 0, 0, 0],
          [0, 0, 0, 2, 0, 0, 0],
          [0, 0, 1, 1, 2, 0, 0],
          [0, 0, 2, 1, 2, 1, 0]
        ],
        currentPlayer: 1,
        moveCount: 8
      },
      moves: [
        { player: 1, column: 3, row: 5 },
        { player: 2, column: 3, row: 4 }
      ]
    }
  },
  'reverse-hangman': {
    gameHistory: {
      gameType: 'reverse-hangman',
      version: '1.0.0',
      state: {
        targetWord: 'PROGRAMMING',
        currentPrompt: 'A skill essential for software development',
        guessedLetters: ['P', 'R', 'O', 'G'],
        mistakes: 2,
        phase: 'guessing'
      }
    }
  },
  chess: {
    gameHistory: {
      gameType: 'chess',
      version: '1.0.0',
      state: {
        board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
        currentPlayer: 'white',
        moves: ['e2-e4', 'e7-e5', 'Nf3', 'Nc6'],
        castling: { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true },
        enPassant: null,
        halfMoveClock: 0,
        fullMoveNumber: 3
      }
    }
  }
};

// Command implementations

async function checkSchemaUsage(query: string): Promise<void> {
  console.log(chalk.blue('\n📊 Checking Schema Usage...\n'));
  
  const forbiddenPatterns = [
    /CREATE\s+TABLE/i,
    /ALTER\s+TABLE/i,
    /DROP\s+TABLE/i,
    /ADD\s+COLUMN/i,
    /MODIFY\s+COLUMN/i,
    /RENAME\s+COLUMN/i
  ];
  
  let violations = 0;
  forbiddenPatterns.forEach(pattern => {
    if (pattern.test(query)) {
      console.log(chalk.red(`❌ FORBIDDEN: Query contains ${pattern.source}`));
      violations++;
    }
  });
  
  if (violations === 0) {
    console.log(chalk.green('✅ Query is schema-safe!'));
    
    // Check if it uses JSONB fields properly
    if (query.includes('gameHistory') || query.includes('decisions') || query.includes('result')) {
      console.log(chalk.cyan('\n💡 Tips for JSONB queries:'));
      console.log(chalk.gray('  - Use ->> for text extraction: gameHistory->>\'gameType\''));
      console.log(chalk.gray('  - Use -> for JSON extraction: gameHistory->\'state\''));
      console.log(chalk.gray('  - Use @> for containment: gameHistory @> \'{"gameType": "poker"}\''));
    }
  } else {
    console.log(chalk.red(`\n⛔ Query violates schema immutability!`));
    console.log(chalk.yellow('Please use existing JSONB fields instead.'));
  }
}

async function showGameStorage(gameType: string): Promise<void> {
  console.log(chalk.blue(`\n🎮 Storage Pattern for Game: ${gameType}\n`));
  
  const example = GAME_STORAGE_EXAMPLES[gameType as keyof typeof GAME_STORAGE_EXAMPLES];
  
  if (!example) {
    console.log(chalk.yellow(`No example found for game type: ${gameType}`));
    console.log(chalk.cyan('\nAvailable examples:'), Object.keys(GAME_STORAGE_EXAMPLES).join(', '));
    console.log(chalk.gray('\nGeneric pattern for new games:'));
    console.log(JSON.stringify({
      gameHistory: {
        gameType: gameType,
        version: '1.0.0',
        state: { /* Your game state here */ },
        moves: [ /* Array of moves */ ]
      },
      decisions: {
        decisions: [ /* AI decisions */ ]
      },
      result: {
        winner: 'bot_id',
        rankings: [ /* Final rankings */ ]
      }
    }, null, 2));
  } else {
    console.log(chalk.green('Match.gameHistory:'));
    console.log(JSON.stringify(example.gameHistory, null, 2));
    
    if ('decisions' in example && example.decisions) {
      console.log(chalk.green('\nMatch.decisions:'));
      console.log(JSON.stringify(example.decisions, null, 2));
    }
    
    if ('result' in example && example.result) {
      console.log(chalk.green('\nMatch.result:'));
      console.log(JSON.stringify(example.result, null, 2));
    }
  }
  
  console.log(chalk.cyan('\n📝 Remember:'));
  console.log(chalk.gray('  - All game data MUST fit in these JSONB fields'));
  console.log(chalk.gray('  - No new columns or tables allowed'));
  console.log(chalk.gray('  - Keep total size under 1MB for performance'));
}

async function validateGameState(gameType: string, stateJson?: string): Promise<void> {
  console.log(chalk.blue(`\n🔍 Validating Game State for: ${gameType}\n`));
  
  let gameState: any;
  
  if (stateJson) {
    try {
      gameState = JSON.parse(stateJson);
    } catch (error) {
      console.log(chalk.red('❌ Invalid JSON provided'));
      return;
    }
  } else {
    // Use example state for validation demo
    const example = GAME_STORAGE_EXAMPLES[gameType as keyof typeof GAME_STORAGE_EXAMPLES];
    if (!example) {
      console.log(chalk.yellow(`No example found for game type: ${gameType}`));
      console.log(chalk.gray('Provide JSON state as second argument for validation.'));
      return;
    }
    gameState = example.gameHistory;
  }
  
  // Validate size
  const stateSize = JSON.stringify(gameState).length;
  console.log(chalk.cyan(`📏 State size: ${stateSize} bytes`));
  
  if (stateSize > MAX_JSONB_SIZE) {
    console.log(chalk.red(`❌ State too large! Maximum recommended: ${MAX_JSONB_SIZE} bytes (1MB)`));
  } else if (stateSize > MAX_JSONB_SIZE * 0.8) {
    console.log(chalk.yellow(`⚠️ State approaching size limit (80% of max)`));
  } else {
    console.log(chalk.green(`✅ State size is acceptable`));
  }
  
  // Validate structure
  const requiredFields = ['gameType', 'state'];
  const missingFields = requiredFields.filter(field => !gameState[field]);
  
  if (missingFields.length > 0) {
    console.log(chalk.red(`❌ Missing required fields: ${missingFields.join(', ')}`));
  } else {
    console.log(chalk.green(`✅ Required fields present`));
  }
  
  // Check for forbidden patterns
  const stateString = JSON.stringify(gameState);
  if (stateString.includes('CREATE TABLE') || stateString.includes('DROP TABLE')) {
    console.log(chalk.red('❌ State contains SQL statements (security risk)'));
  }
  
  console.log(chalk.cyan('\n📊 Storage locations:'));
  console.log(chalk.gray('  - Match.gameHistory - Complete game state'));
  console.log(chalk.gray('  - Match.decisions - AI decision history'));
  console.log(chalk.gray('  - Match.result - Final results and rankings'));
}

async function listAvailableFields(): Promise<void> {
  console.log(chalk.blue('\n📋 Available JSONB Fields for Game Storage\n'));
  
  console.log(chalk.cyan('Primary Game Storage:'));
  AVAILABLE_JSONB_FIELDS
    .filter(f => f.table === 'Match')
    .forEach(field => {
      console.log(chalk.green(`  ${field.table}.${field.column}`));
      console.log(chalk.gray(`    └─ ${field.description}`));
    });
  
  console.log(chalk.cyan('\nAI Decision Storage:'));
  AVAILABLE_JSONB_FIELDS
    .filter(f => f.table === 'AIDecision')
    .forEach(field => {
      console.log(chalk.green(`  ${field.table}.${field.column}`));
      console.log(chalk.gray(`    └─ ${field.description}`));
    });
  
  console.log(chalk.cyan('\nBot Data Storage:'));
  AVAILABLE_JSONB_FIELDS
    .filter(f => f.table === 'Bot')
    .forEach(field => {
      console.log(chalk.green(`  ${field.table}.${field.column}`));
      console.log(chalk.gray(`    └─ ${field.description}`));
    });
  
  console.log(chalk.yellow('\n⚠️ Important:'));
  console.log(chalk.gray('  - These are the ONLY fields you can use for game data'));
  console.log(chalk.gray('  - No new columns or tables allowed (schema is FROZEN)'));
  console.log(chalk.gray('  - All game-specific data MUST fit in these JSONB fields'));
  
  console.log(chalk.cyan('\n💡 Query Examples:'));
  console.log(chalk.gray('  SELECT * FROM "Match" WHERE gameHistory->>\'gameType\' = \'poker\';'));
  console.log(chalk.gray('  SELECT result->>\'winner\' FROM "Match" WHERE id = \'match_123\';'));
  console.log(chalk.gray('  UPDATE "Match" SET gameHistory = \'{"gameType": "chess", ...}\'::jsonb;'));
}

async function schemaInfo(): Promise<void> {
  console.log(chalk.blue('\n🔒 Schema Information\n'));
  console.log(chalk.cyan(`Version: ${chalk.bold(SCHEMA_VERSION)}`));
  console.log(chalk.cyan(`Status: ${chalk.bold.red('FROZEN')}`));
  console.log(chalk.cyan(`Last Migration: ${chalk.bold('20250803032005_add_metaverse_integration')}`));
  
  console.log(chalk.yellow('\n⛔ Forbidden Operations:'));
  console.log(chalk.red('  ❌ CREATE TABLE'));
  console.log(chalk.red('  ❌ ALTER TABLE'));
  console.log(chalk.red('  ❌ DROP TABLE'));
  console.log(chalk.red('  ❌ Adding new columns'));
  console.log(chalk.red('  ❌ Modifying column types'));
  console.log(chalk.red('  ❌ Creating new migrations'));
  
  console.log(chalk.green('\n✅ Allowed Operations:'));
  console.log(chalk.green('  ✓ Using existing JSONB fields'));
  console.log(chalk.green('  ✓ Storing game state in Match.gameHistory'));
  console.log(chalk.green('  ✓ Storing AI decisions in Match.decisions'));
  console.log(chalk.green('  ✓ Adding new game types as strings'));
  
  console.log(chalk.cyan('\n📖 Documentation:'));
  console.log(chalk.gray('  See /backend/SCHEMA.md for complete details'));
}

// CLI handler
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  try {
    switch (command) {
      case 'check-schema-usage':
        if (!args[0]) {
          console.log(chalk.red('Usage: check-schema-usage "SELECT * FROM Match"'));
          break;
        }
        await checkSchemaUsage(args.join(' '));
        break;
      
      case 'show-game-storage':
        if (!args[0]) {
          console.log(chalk.red('Usage: show-game-storage <gameType>'));
          console.log(chalk.gray('Available: poker, connect4, reverse-hangman, chess'));
          break;
        }
        await showGameStorage(args[0]);
        break;
      
      case 'validate-game-state':
        if (!args[0]) {
          console.log(chalk.red('Usage: validate-game-state <gameType> [stateJson]'));
          break;
        }
        await validateGameState(args[0], args[1]);
        break;
      
      case 'list-available-fields':
        await listAvailableFields();
        break;
      
      case 'schema-info':
        await schemaInfo();
        break;
      
      default:
        console.log(chalk.yellow('\n📚 Schema Commands\n'));
        console.log(chalk.cyan('Available commands:'));
        console.log(chalk.gray('  check-schema-usage "query"     - Validate a SQL query'));
        console.log(chalk.gray('  show-game-storage <type>       - Show storage pattern for game'));
        console.log(chalk.gray('  validate-game-state <type>     - Validate game state fits JSONB'));
        console.log(chalk.gray('  list-available-fields          - List all JSONB fields'));
        console.log(chalk.gray('  schema-info                    - Show schema version and rules'));
        console.log(chalk.cyan('\nExamples:'));
        console.log(chalk.gray('  npm run schema:check "SELECT * FROM Match"'));
        console.log(chalk.gray('  npm run schema:storage poker'));
        console.log(chalk.gray('  npm run schema:validate chess'));
        console.log(chalk.gray('  npm run schema:fields'));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);

export {
    checkSchemaUsage, listAvailableFields,
    schemaInfo, showGameStorage,
    validateGameState
};
