#!/usr/bin/env ts-node

/**
 * Cross-Platform Integration Validator
 * 
 * This script validates that all components of the AI Arena platform
 * are properly integrated and synchronized.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string[];
}

class IntegrationValidator {
  private results: ValidationResult[] = [];
  private rootPath: string;

  constructor() {
    this.rootPath = path.join(__dirname, '..');
  }

  // Check if a game exists in both frontend and backend
  async validateGameIntegration(gameName: string): Promise<ValidationResult> {
    console.log(chalk.blue(`\n🎮 Validating game integration: ${gameName}`));
    
    const frontendPath = path.join(this.rootPath, 'app/src/modules/game/engine/games', gameName);
    const backendAdapter = path.join(this.rootPath, 'backend/src/services/gameEngineAdapter.ts');
    const gameManager = path.join(this.rootPath, 'backend/src/services/gameManagerService.ts');
    
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';
    
    // Check frontend exists
    if (!fs.existsSync(frontendPath)) {
      details.push(`❌ Frontend game not found at ${frontendPath}`);
      status = 'fail';
    } else {
      details.push(`✅ Frontend game found`);
    }
    
    // Check backend adapter
    if (fs.existsSync(backendAdapter)) {
      const adapterContent = fs.readFileSync(backendAdapter, 'utf-8');
      if (!adapterContent.includes(gameName)) {
        details.push(`⚠️ Game not registered in gameEngineAdapter.ts`);
        status = status === 'fail' ? 'fail' : 'warn';
      } else {
        details.push(`✅ Game registered in backend adapter`);
      }
    }
    
    // Check game manager
    if (fs.existsSync(gameManager)) {
      const managerContent = fs.readFileSync(gameManager, 'utf-8');
      if (!managerContent.includes(gameName)) {
        details.push(`⚠️ Game not registered in gameManagerService.ts`);
        status = status === 'fail' ? 'fail' : 'warn';
      } else {
        details.push(`✅ Game registered in game manager`);
      }
    }
    
    return {
      component: `Game: ${gameName}`,
      status,
      message: status === 'pass' ? 'Fully integrated' : 'Integration issues found',
      details
    };
  }

  // Validate bot synchronization between platforms
  async validateBotSync(): Promise<ValidationResult> {
    console.log(chalk.blue('\n🤖 Validating bot synchronization...'));
    
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';
    
    // Check bot sync service
    const botSyncPath = path.join(this.rootPath, 'backend/src/services/botSyncService.ts');
    if (!fs.existsSync(botSyncPath)) {
      details.push('❌ Bot sync service not found');
      status = 'fail';
    } else {
      const content = fs.readFileSync(botSyncPath, 'utf-8');
      
      // Check for required methods
      const requiredMethods = [
        'syncBotToMetaverse',
        'updateBotPosition',
        'syncBotStats'
      ];
      
      requiredMethods.forEach(method => {
        if (content.includes(method)) {
          details.push(`✅ ${method} found`);
        } else {
          details.push(`⚠️ ${method} not found`);
          status = 'warn';
        }
      });
    }
    
    // Check sprite mapping
    const spriteMappingPath = path.join(this.rootPath, 'backend/src/utils/spriteMapping.ts');
    if (!fs.existsSync(spriteMappingPath)) {
      details.push('⚠️ Sprite mapping not found');
      status = status === 'fail' ? 'fail' : 'warn';
    } else {
      details.push('✅ Sprite mapping configured');
    }
    
    return {
      component: 'Bot Synchronization',
      status,
      message: status === 'pass' ? 'Bot sync properly configured' : 'Bot sync needs attention',
      details
    };
  }

  // Validate GraphQL schema consistency
  async validateGraphQLSchema(): Promise<ValidationResult> {
    console.log(chalk.blue('\n📊 Validating GraphQL schema...'));
    
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';
    
    const schemaPath = path.join(this.rootPath, 'backend/src/graphql/schema');
    const queriesPath = path.join(this.rootPath, 'app/src/graphql/queries');
    
    // Check schema exists
    if (!fs.existsSync(schemaPath)) {
      details.push('❌ GraphQL schema directory not found');
      status = 'fail';
    } else {
      details.push('✅ GraphQL schema found');
      
      // Count schema files
      const schemaFiles = fs.readdirSync(schemaPath).filter(f => f.endsWith('.ts') || f.endsWith('.graphql'));
      details.push(`📁 ${schemaFiles.length} schema files found`);
    }
    
    // Check frontend queries
    if (!fs.existsSync(queriesPath)) {
      details.push('⚠️ Frontend queries directory not found');
      status = status === 'fail' ? 'fail' : 'warn';
    } else {
      const queryFiles = fs.readdirSync(queriesPath).filter(f => f.endsWith('.ts'));
      details.push(`📁 ${queryFiles.length} query files found`);
    }
    
    return {
      component: 'GraphQL Schema',
      status,
      message: status === 'pass' ? 'Schema properly configured' : 'Schema issues detected',
      details
    };
  }

  // Validate Metaverse integration
  async validateMetaverseIntegration(): Promise<ValidationResult> {
    console.log(chalk.blue('\n🌍 Validating metaverse integration...'));
    
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';
    
    const convexPath = path.join(this.rootPath, 'metaverse-game/convex');
    const convexService = path.join(this.rootPath, 'backend/src/services/convexService.ts');
    
    // Check Convex directory
    if (!fs.existsSync(convexPath)) {
      details.push('❌ Convex directory not found');
      status = 'fail';
    } else {
      details.push('✅ Convex configuration found');
      
      // Check for important files
      const requiredFiles = ['_generated', 'schema.ts', 'functions.ts'];
      requiredFiles.forEach(file => {
        const filePath = path.join(convexPath, file);
        if (fs.existsSync(filePath)) {
          details.push(`✅ ${file} exists`);
        } else {
          details.push(`⚠️ ${file} missing`);
          status = 'warn';
        }
      });
    }
    
    // Check backend Convex service
    if (!fs.existsSync(convexService)) {
      details.push('⚠️ Convex service not found in backend');
      status = status === 'fail' ? 'fail' : 'warn';
    } else {
      details.push('✅ Backend Convex service configured');
    }
    
    return {
      component: 'Metaverse Integration',
      status,
      message: status === 'pass' ? 'Metaverse properly integrated' : 'Metaverse integration needs work',
      details
    };
  }

  // Validate tournament system
  async validateTournamentSystem(): Promise<ValidationResult> {
    console.log(chalk.blue('\n🏆 Validating tournament system...'));
    
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';
    
    // Check queue service
    const queueService = path.join(this.rootPath, 'backend/src/services/queueService.ts');
    if (!fs.existsSync(queueService)) {
      details.push('❌ Queue service not found');
      status = 'fail';
    } else {
      const content = fs.readFileSync(queueService, 'utf-8');
      
      // Check for game types
      ['poker', 'connect4', 'reverse-hangman'].forEach(game => {
        if (content.includes(game)) {
          details.push(`✅ ${game} supported`);
        } else {
          details.push(`⚠️ ${game} not found in queue`);
          status = 'warn';
        }
      });
    }
    
    // Check lootbox system
    const economyService = path.join(this.rootPath, 'backend/src/services/economyService.ts');
    if (fs.existsSync(economyService)) {
      details.push('✅ Economy service configured');
    } else {
      details.push('⚠️ Economy service not found');
      status = 'warn';
    }
    
    return {
      component: 'Tournament System',
      status,
      message: status === 'pass' ? 'Tournament system operational' : 'Tournament system needs attention',
      details
    };
  }

  // Validate database schema compliance
  async validateDatabaseSchema(): Promise<ValidationResult> {
    console.log(chalk.blue('\n🗄️ Validating database schema...'));
    
    const details: string[] = [];
    let status: 'pass' | 'fail' | 'warn' = 'pass';
    
    const schemaPath = path.join(this.rootPath, 'backend/prisma/schema.prisma');
    const schemaDoc = path.join(this.rootPath, 'backend/SCHEMA.md');
    
    // Check schema file
    if (!fs.existsSync(schemaPath)) {
      details.push('❌ Prisma schema not found');
      status = 'fail';
    } else {
      const content = fs.readFileSync(schemaPath, 'utf-8');
      
      // Check for JSONB fields
      if (content.includes('Json')) {
        details.push('✅ JSONB fields configured');
      } else {
        details.push('⚠️ No JSONB fields found');
        status = 'warn';
      }
      
      // Check for game storage
      if (content.includes('gameHistory') && content.includes('decisions')) {
        details.push('✅ Game storage fields present');
      } else {
        details.push('⚠️ Game storage fields missing');
        status = 'warn';
      }
    }
    
    // Check schema documentation
    if (!fs.existsSync(schemaDoc)) {
      details.push('⚠️ Schema documentation not found');
      status = 'warn';
    } else {
      details.push('✅ Schema documentation exists');
    }
    
    return {
      component: 'Database Schema',
      status,
      message: status === 'pass' ? 'Schema compliant' : 'Schema needs review',
      details
    };
  }

  // Run all validations
  async runAll(): Promise<void> {
    console.log(chalk.cyan.bold('\n🔍 AI Arena Platform Integration Validator\n'));
    console.log(chalk.gray('=' .repeat(50)));
    
    // Run validations
    this.results.push(await this.validateDatabaseSchema());
    this.results.push(await this.validateGraphQLSchema());
    this.results.push(await this.validateBotSync());
    this.results.push(await this.validateMetaverseIntegration());
    this.results.push(await this.validateTournamentSystem());
    
    // Check specific games
    const games = ['poker', 'connect4', 'reverse-hangman'];
    for (const game of games) {
      this.results.push(await this.validateGameIntegration(game));
    }
    
    // Print summary
    this.printSummary();
  }

  private printSummary(): void {
    console.log(chalk.gray('\n' + '=' .repeat(50)));
    console.log(chalk.cyan.bold('\n📊 Validation Summary\n'));
    
    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;
    
    this.results.forEach(result => {
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
      
      if (result.status === 'pass') passCount++;
      else if (result.status === 'fail') failCount++;
      else warnCount++;
    });
    
    console.log(chalk.gray('\n' + '=' .repeat(50)));
    console.log(chalk.cyan('\n📈 Statistics:'));
    console.log(chalk.green(`  ✅ Passed: ${passCount}`));
    console.log(chalk.yellow(`  ⚠️ Warnings: ${warnCount}`));
    console.log(chalk.red(`  ❌ Failed: ${failCount}`));
    
    const totalScore = (passCount / this.results.length) * 100;
    const scoreColor = totalScore >= 80 ? chalk.green :
                      totalScore >= 60 ? chalk.yellow : chalk.red;
    
    console.log(chalk.cyan(`\n🎯 Integration Score: ${scoreColor(totalScore.toFixed(1) + '%')}`));
    
    if (failCount > 0) {
      console.log(chalk.red('\n⚠️ Critical issues found! Please fix failed components.'));
      process.exit(1);
    } else if (warnCount > 0) {
      console.log(chalk.yellow('\n⚠️ Some warnings detected. Consider addressing them.'));
    } else {
      console.log(chalk.green('\n✅ All systems operational!'));
    }
  }
}

// Run validator
const validator = new IntegrationValidator();
validator.runAll().catch(console.error);