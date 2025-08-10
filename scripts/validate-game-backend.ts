#!/usr/bin/env ts-node

/**
 * Game Backend Integration Validator
 * 
 * This script validates that games are properly integrated
 * between frontend and backend, including AI support.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';

interface GameValidationResult {
  game: string;
  component: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string[];
}

interface GameComponents {
  frontend: {
    engine: boolean;
    manager: boolean;
    ai: boolean;
    types: boolean;
    ui: boolean;
  };
  backend: {
    adapter: boolean;
    registered: boolean;
    graphql: boolean;
    aiSupport: boolean;
  };
}

class GameBackendValidator {
  private results: GameValidationResult[] = [];
  private rootPath: string;
  private games: string[] = [];

  constructor() {
    this.rootPath = path.join(__dirname, '..');
    this.discoverGames();
  }

  // Discover all games in the frontend
  private discoverGames(): void {
    const gamesPath = path.join(this.rootPath, 'app/src/modules/game/engine/games');
    
    if (!fs.existsSync(gamesPath)) {
      console.error(chalk.red('❌ Games directory not found!'));
      process.exit(1);
    }

    this.games = fs.readdirSync(gamesPath)
      .filter(item => {
        const itemPath = path.join(gamesPath, item);
        return fs.statSync(itemPath).isDirectory();
      });

    console.log(chalk.cyan(`🎮 Found ${this.games.length} games: ${this.games.join(', ')}`));
  }

  // Validate frontend game structure
  private validateFrontendStructure(gameName: string): GameComponents['frontend'] {
    const gamePath = path.join(this.rootPath, 'app/src/modules/game/engine/games', gameName);
    const result: GameComponents['frontend'] = {
      engine: false,
      manager: false,
      ai: false,
      types: false,
      ui: false
    };

    // Check required files
    const requiredFiles = {
      engine: `engine/${this.toPascalCase(gameName)}GameEngine.ts`,
      manager: `${this.toPascalCase(gameName)}GameManager.ts`,
      ai: `ai/${this.toPascalCase(gameName)}AIAgent.ts`,
      types: `${this.toPascalCase(gameName)}Types.ts`
    };

    Object.entries(requiredFiles).forEach(([key, file]) => {
      const filePath = path.join(gamePath, file);
      result[key as keyof typeof requiredFiles] = fs.existsSync(filePath);
    });

    // Check for UI components
    const uiPath = path.join(this.rootPath, 'app/src/pages');
    const viewFile = `${this.toPascalCase(gameName)}View.tsx`;
    result.ui = fs.existsSync(path.join(uiPath, viewFile));

    return result;
  }

  // Validate backend adapter implementation
  private validateBackendAdapter(gameName: string): boolean {
    const adapterPath = path.join(this.rootPath, 'backend/src/services/gameEngineAdapter.ts');
    
    if (!fs.existsSync(adapterPath)) {
      return false;
    }

    const content = fs.readFileSync(adapterPath, 'utf-8');
    
    // Check if game is mentioned in adapter
    return content.includes(gameName) || 
           content.includes(this.toPascalCase(gameName)) ||
           content.includes(gameName.toUpperCase());
  }

  // Validate game registration in backend
  private validateBackendRegistration(gameName: string): boolean {
    const managerPath = path.join(this.rootPath, 'backend/src/services/gameManagerService.ts');
    
    if (!fs.existsSync(managerPath)) {
      return false;
    }

    const content = fs.readFileSync(managerPath, 'utf-8');
    
    // Check if game is registered
    return content.includes(`'${gameName}'`) || 
           content.includes(`"${gameName}"`) ||
           content.includes(`GameType.${gameName.toUpperCase()}`);
  }

  // Validate GraphQL schema integration
  private validateGraphQLIntegration(gameName: string): boolean {
    const schemaPath = path.join(this.rootPath, 'backend/src/graphql/schema');
    
    if (!fs.existsSync(schemaPath)) {
      return false;
    }

    // Check if game type is in GraphQL schema
    const files = fs.readdirSync(schemaPath);
    
    return files.some(file => {
      if (file.endsWith('.ts') || file.endsWith('.graphql')) {
        const content = fs.readFileSync(path.join(schemaPath, file), 'utf-8');
        return content.includes(gameName) || 
               content.includes(gameName.toUpperCase());
      }
      return false;
    });
  }

  // Validate AI support in backend
  private validateAISupport(gameName: string): boolean {
    const aiServicePath = path.join(this.rootPath, 'backend/src/services/aiService.ts');
    const gameManagerPath = path.join(this.rootPath, 'backend/src/services/gameManagerService.ts');
    
    // Check if AI service exists and supports the game
    if (fs.existsSync(aiServicePath)) {
      const content = fs.readFileSync(aiServicePath, 'utf-8');
      if (content.includes(gameName)) {
        return true;
      }
    }

    // Check if game manager has AI support
    if (fs.existsSync(gameManagerPath)) {
      const content = fs.readFileSync(gameManagerPath, 'utf-8');
      return content.includes('makeAIMove') || 
             content.includes('processAIAction') ||
             content.includes('AIDecision');
    }

    return false;
  }

  // Validate game state storage
  private validateStateStorage(gameName: string): GameValidationResult {
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';

    // Check if game uses JSONB storage
    const typesPath = path.join(
      this.rootPath, 
      'app/src/modules/game/engine/games',
      gameName,
      `${this.toPascalCase(gameName)}Types.ts`
    );

    if (fs.existsSync(typesPath)) {
      const content = fs.readFileSync(typesPath, 'utf-8');
      
      // Check state size (warn if potentially large)
      const lines = content.split('\n').length;
      if (lines > 500) {
        details.push('⚠️ Large state definition - ensure < 1MB JSONB limit');
        status = 'warn';
      } else {
        details.push('✅ State size appears reasonable');
      }

      // Check for required fields
      if (!content.includes('currentTurn')) {
        details.push('❌ Missing currentTurn field');
        status = 'fail';
      }
      if (!content.includes('players')) {
        details.push('❌ Missing players field');
        status = 'fail';
      }
    } else {
      details.push('❌ Types file not found');
      status = 'fail';
    }

    return {
      game: gameName,
      component: 'State Storage',
      status,
      message: status === 'pass' ? 'State properly structured' : 'State issues detected',
      details
    };
  }

  // Validate WebSocket integration
  private validateWebSocketSupport(gameName: string): GameValidationResult {
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';

    // Check backend WebSocket support
    const wsPath = path.join(this.rootPath, 'backend/src/services/websocketService.ts');
    const pubsubPath = path.join(this.rootPath, 'backend/src/graphql/pubsub.ts');
    
    let hasWebSocket = false;
    
    if (fs.existsSync(wsPath)) {
      const content = fs.readFileSync(wsPath, 'utf-8');
      if (content.includes('gameUpdate') || content.includes('matchUpdate')) {
        details.push('✅ WebSocket service configured');
        hasWebSocket = true;
      }
    }

    if (fs.existsSync(pubsubPath)) {
      const content = fs.readFileSync(pubsubPath, 'utf-8');
      if (content.includes('GAME_UPDATE') || content.includes('MATCH_UPDATE')) {
        details.push('✅ GraphQL subscriptions configured');
        hasWebSocket = true;
      }
    }

    if (!hasWebSocket) {
      details.push('⚠️ No real-time updates configured');
      status = 'warn';
    }

    // Check frontend subscription
    const queriesPath = path.join(this.rootPath, 'app/src/graphql');
    if (fs.existsSync(queriesPath)) {
      const files = fs.readdirSync(queriesPath, { recursive: true });
      const hasSubscription = files.some(file => {
        if (typeof file === 'string' && file.endsWith('.ts')) {
          const content = fs.readFileSync(path.join(queriesPath, file), 'utf-8');
          return content.includes('subscription') && 
                 (content.includes(gameName) || content.includes('gameUpdate'));
        }
        return false;
      });

      if (hasSubscription) {
        details.push('✅ Frontend subscriptions configured');
      } else {
        details.push('⚠️ Frontend missing subscription queries');
        status = status === 'fail' ? 'fail' : 'warn';
      }
    }

    return {
      game: gameName,
      component: 'WebSocket/Real-time',
      status,
      message: status === 'pass' ? 'Real-time updates configured' : 'Real-time support incomplete',
      details
    };
  }

  // Validate tournament integration
  private validateTournamentSupport(gameName: string): GameValidationResult {
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';

    // Check queue service support
    const queuePath = path.join(this.rootPath, 'backend/src/services/queueService.ts');
    if (fs.existsSync(queuePath)) {
      const content = fs.readFileSync(queuePath, 'utf-8');
      if (content.includes(gameName) || content.includes(`'${gameName}'`)) {
        details.push('✅ Game supported in queue service');
      } else {
        details.push('⚠️ Game not found in queue service');
        status = 'warn';
      }
    }

    // Check tournament page
    const tournamentPagePath = path.join(
      this.rootPath,
      'app/src/pages',
      `${this.toPascalCase(gameName)}Tournament.tsx`
    );
    
    if (fs.existsSync(tournamentPagePath)) {
      details.push('✅ Tournament page exists');
    } else {
      // Check if integrated in general tournament page
      const tournamentsPath = path.join(this.rootPath, 'app/src/pages/Tournaments.tsx');
      if (fs.existsSync(tournamentsPath)) {
        const content = fs.readFileSync(tournamentsPath, 'utf-8');
        if (content.includes(gameName)) {
          details.push('✅ Game in tournaments page');
        } else {
          details.push('⚠️ No tournament UI found');
          status = 'warn';
        }
      }
    }

    return {
      game: gameName,
      component: 'Tournament Support',
      status,
      message: status === 'pass' ? 'Tournament ready' : 'Tournament integration incomplete',
      details
    };
  }

  // Validate AI decision recording
  private validateAIDecisionRecording(gameName: string): GameValidationResult {
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';

    // Check frontend AI agent
    const aiAgentPath = path.join(
      this.rootPath,
      'app/src/modules/game/engine/games',
      gameName,
      'ai',
      `${this.toPascalCase(gameName)}AIAgent.ts`
    );

    if (fs.existsSync(aiAgentPath)) {
      const content = fs.readFileSync(aiAgentPath, 'utf-8');
      
      if (content.includes('recordDecision') || content.includes('AIDecision')) {
        details.push('✅ AI decisions recorded in frontend');
      } else {
        details.push('⚠️ AI decisions not recorded');
        status = 'warn';
      }

      if (!content.includes('extends BaseAIAgent')) {
        details.push('❌ Not extending BaseAIAgent');
        status = 'fail';
      }
    } else {
      details.push('❌ AI agent not found');
      status = 'fail';
    }

    // Check backend recording
    const backendPath = path.join(this.rootPath, 'backend/src/services');
    const hasBackendRecording = fs.readdirSync(backendPath).some(file => {
      if (file.endsWith('.ts')) {
        const content = fs.readFileSync(path.join(backendPath, file), 'utf-8');
        return content.includes('AIDecision') && content.includes(gameName);
      }
      return false;
    });

    if (hasBackendRecording) {
      details.push('✅ Backend records AI decisions');
    } else {
      details.push('⚠️ Backend not recording AI decisions');
      status = status === 'fail' ? 'fail' : 'warn';
    }

    return {
      game: gameName,
      component: 'AI Decision Recording',
      status,
      message: status === 'pass' ? 'AI decisions tracked' : 'AI tracking incomplete',
      details
    };
  }

  // Validate game testing
  private validateGameTests(gameName: string): GameValidationResult {
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';

    // Check frontend tests
    const frontendTestPath = path.join(
      this.rootPath,
      'app/src/modules/game/engine/games',
      gameName,
      'tests'
    );

    if (fs.existsSync(frontendTestPath)) {
      const testFiles = fs.readdirSync(frontendTestPath);
      if (testFiles.length > 0) {
        details.push(`✅ ${testFiles.length} frontend test files found`);
      } else {
        details.push('⚠️ Test directory empty');
        status = 'warn';
      }
    } else {
      details.push('⚠️ No frontend tests found');
      status = 'warn';
    }

    // Check backend tests
    const backendTestPath = path.join(
      this.rootPath,
      'backend/src/services/__tests__'
    );

    if (fs.existsSync(backendTestPath)) {
      const gameTests = fs.readdirSync(backendTestPath)
        .filter(file => file.includes(gameName));
      
      if (gameTests.length > 0) {
        details.push(`✅ ${gameTests.length} backend test files found`);
      } else {
        details.push('⚠️ No backend tests for this game');
        status = status === 'fail' ? 'fail' : 'warn';
      }
    }

    return {
      game: gameName,
      component: 'Testing',
      status,
      message: status === 'pass' ? 'Tests configured' : 'Testing incomplete',
      details
    };
  }

  // Validate a single game
  private async validateGame(gameName: string): Promise<void> {
    console.log(chalk.blue(`\n🎮 Validating ${gameName}...`));
    
    // Frontend validation
    const frontend = this.validateFrontendStructure(gameName);
    const frontendDetails: string[] = [];
    let frontendStatus: 'pass' | 'fail' | 'warn' = 'pass';

    if (!frontend.engine) {
      frontendDetails.push('❌ Game engine not found');
      frontendStatus = 'fail';
    }
    if (!frontend.manager) {
      frontendDetails.push('❌ Game manager not found');
      frontendStatus = 'fail';
    }
    if (!frontend.ai) {
      frontendDetails.push('❌ AI agent not found');
      frontendStatus = 'fail';
    }
    if (!frontend.types) {
      frontendDetails.push('❌ Type definitions not found');
      frontendStatus = 'fail';
    }
    if (!frontend.ui) {
      frontendDetails.push('⚠️ UI view not found');
      frontendStatus = frontendStatus === 'fail' ? 'fail' : 'warn';
    }

    if (frontendStatus === 'pass') {
      frontendDetails.push('✅ All frontend components present');
    }

    this.results.push({
      game: gameName,
      component: 'Frontend Structure',
      status: frontendStatus,
      message: frontendStatus === 'pass' ? 'Complete' : 'Missing components',
      details: frontendDetails
    });

    // Backend validation
    const backend = {
      adapter: this.validateBackendAdapter(gameName),
      registered: this.validateBackendRegistration(gameName),
      graphql: this.validateGraphQLIntegration(gameName),
      aiSupport: this.validateAISupport(gameName)
    };

    const backendDetails: string[] = [];
    let backendStatus: 'pass' | 'fail' | 'warn' = 'pass';

    if (!backend.adapter) {
      backendDetails.push('❌ Backend adapter not found');
      backendStatus = 'fail';
    }
    if (!backend.registered) {
      backendDetails.push('❌ Not registered in game manager');
      backendStatus = 'fail';
    }
    if (!backend.graphql) {
      backendDetails.push('⚠️ GraphQL integration missing');
      backendStatus = backendStatus === 'fail' ? 'fail' : 'warn';
    }
    if (!backend.aiSupport) {
      backendDetails.push('⚠️ AI support not configured');
      backendStatus = backendStatus === 'fail' ? 'fail' : 'warn';
    }

    if (backendStatus === 'pass') {
      backendDetails.push('✅ Fully integrated with backend');
    }

    this.results.push({
      game: gameName,
      component: 'Backend Integration',
      status: backendStatus,
      message: backendStatus === 'pass' ? 'Complete' : 'Integration incomplete',
      details: backendDetails
    });

    // Additional validations
    this.results.push(this.validateStateStorage(gameName));
    this.results.push(this.validateWebSocketSupport(gameName));
    this.results.push(this.validateTournamentSupport(gameName));
    this.results.push(this.validateAIDecisionRecording(gameName));
    this.results.push(this.validateGameTests(gameName));
  }

  // Generate summary report
  private generateReport(): void {
    console.log(chalk.cyan.bold('\n📊 Game Backend Integration Report\n'));
    console.log(chalk.gray('=' .repeat(60)));

    // Group results by game
    this.games.forEach(game => {
      const gameResults = this.results.filter(r => r.game === game);
      
      console.log(chalk.blue.bold(`\n🎮 ${game.toUpperCase()}`));
      console.log(chalk.gray('-' .repeat(40)));

      gameResults.forEach(result => {
        const icon = result.status === 'pass' ? '✅' :
                    result.status === 'fail' ? '❌' : '⚠️';
        const color = result.status === 'pass' ? chalk.green :
                     result.status === 'fail' ? chalk.red : chalk.yellow;
        
        console.log(color(`${icon} ${result.component}: ${result.message}`));
        
        if (result.details && result.details.length > 0) {
          result.details.forEach(detail => {
            console.log(chalk.gray(`    ${detail}`));
          });
        }
      });

      // Game score
      const gameScore = this.calculateGameScore(game);
      const scoreColor = gameScore >= 80 ? chalk.green :
                        gameScore >= 60 ? chalk.yellow : chalk.red;
      console.log(chalk.cyan(`\n  Integration Score: ${scoreColor(gameScore + '%')}`));
    });

    // Overall summary
    console.log(chalk.gray('\n' + '=' .repeat(60)));
    console.log(chalk.cyan.bold('\n📈 Overall Summary\n'));

    const passCount = this.results.filter(r => r.status === 'pass').length;
    const failCount = this.results.filter(r => r.status === 'fail').length;
    const warnCount = this.results.filter(r => r.status === 'warn').length;

    console.log(chalk.green(`✅ Passed: ${passCount}`));
    console.log(chalk.yellow(`⚠️ Warnings: ${warnCount}`));
    console.log(chalk.red(`❌ Failed: ${failCount}`));

    const overallScore = Math.round((passCount / this.results.length) * 100);
    const scoreColor = overallScore >= 80 ? chalk.green :
                      overallScore >= 60 ? chalk.yellow : chalk.red;
    
    console.log(chalk.cyan(`\n🎯 Overall Integration Score: ${scoreColor(overallScore + '%')}`));

    if (failCount > 0) {
      console.log(chalk.red.bold('\n⚠️ Critical issues found! Fix backend integration before deployment.'));
    } else if (warnCount > 0) {
      console.log(chalk.yellow.bold('\n📋 Some improvements needed for full integration.'));
    } else {
      console.log(chalk.green.bold('\n✅ All games fully integrated!'));
    }
  }

  private calculateGameScore(gameName: string): number {
    const gameResults = this.results.filter(r => r.game === gameName);
    const passCount = gameResults.filter(r => r.status === 'pass').length;
    return Math.round((passCount / gameResults.length) * 100);
  }

  private toPascalCase(str: string): string {
    return str.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  // Main runner
  async run(): Promise<void> {
    console.log(chalk.cyan.bold('🎮 AI Arena Game Backend Integration Validator'));
    console.log(chalk.gray('Validating game integration across platforms...\n'));

    if (this.games.length === 0) {
      console.log(chalk.yellow('⚠️ No games found to validate'));
      return;
    }

    // Validate each game
    for (const game of this.games) {
      await this.validateGame(game);
    }

    this.generateReport();

    // Exit with error if critical issues
    const failCount = this.results.filter(r => r.status === 'fail').length;
    if (failCount > 0) {
      process.exit(1);
    }
  }
}

// Run validator
const validator = new GameBackendValidator();
validator.run().catch(console.error);