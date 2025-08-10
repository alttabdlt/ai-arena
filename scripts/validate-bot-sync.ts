#!/usr/bin/env ts-node

/**
 * Bot Synchronization Validator
 * 
 * This script validates that bot profiles, stats, and activities
 * are properly synchronized between AI Arena and the metaverse.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';

interface BotSyncIssue {
  botId?: string;
  field: string;
  platform: 'arena' | 'metaverse' | 'both';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface BotProfile {
  id: string;
  name: string;
  personality: string;
  sprite: string;
  metaverseAgentId?: string;
  isDeployed: boolean;
  activityScore: number;
  equipment?: any[];
  house?: any;
}

class BotSyncValidator {
  private issues: BotSyncIssue[] = [];
  private rootPath: string;
  private botsChecked: number = 0;
  private syncedBots: number = 0;

  constructor() {
    this.rootPath = path.join(__dirname, '..');
  }

  // Validate bot profile fields
  private validateBotProfile(bot: BotProfile): BotSyncIssue[] {
    const issues: BotSyncIssue[] = [];

    // Check required fields
    if (!bot.id) {
      issues.push({
        botId: bot.id,
        field: 'id',
        platform: 'arena',
        severity: 'critical',
        message: 'Bot missing ID',
        suggestion: 'Ensure bot has unique identifier'
      });
    }

    if (!bot.personality || !['CRIMINAL', 'GAMBLER', 'WORKER'].includes(bot.personality)) {
      issues.push({
        botId: bot.id,
        field: 'personality',
        platform: 'arena',
        severity: 'warning',
        message: `Invalid personality: ${bot.personality}`,
        suggestion: 'Set to CRIMINAL, GAMBLER, or WORKER'
      });
    }

    if (!bot.sprite) {
      issues.push({
        botId: bot.id,
        field: 'sprite',
        platform: 'arena',
        severity: 'warning',
        message: 'Bot missing sprite',
        suggestion: 'Assign sprite for visual representation'
      });
    }

    // Check metaverse sync
    if (bot.isDeployed && !bot.metaverseAgentId) {
      issues.push({
        botId: bot.id,
        field: 'metaverseAgentId',
        platform: 'both',
        severity: 'critical',
        message: 'Deployed bot missing metaverse agent ID',
        suggestion: 'Run bot registration to sync with metaverse'
      });
    }

    if (!bot.isDeployed && bot.metaverseAgentId) {
      issues.push({
        botId: bot.id,
        field: 'isDeployed',
        platform: 'arena',
        severity: 'warning',
        message: 'Bot has metaverse ID but not marked as deployed',
        suggestion: 'Update isDeployed flag to true'
      });
    }

    return issues;
  }

  // Check sprite mapping consistency
  async validateSpriteMapping(): Promise<void> {
    console.log(chalk.blue('\n🎨 Validating sprite mapping...'));
    
    const spriteMappingPath = path.join(this.rootPath, 'backend/src/utils/spriteMapping.ts');
    
    if (!fs.existsSync(spriteMappingPath)) {
      this.issues.push({
        field: 'spriteMapping',
        platform: 'both',
        severity: 'critical',
        message: 'Sprite mapping file not found',
        suggestion: 'Create spriteMapping.ts to ensure visual consistency'
      });
      return;
    }

    const content = fs.readFileSync(spriteMappingPath, 'utf-8');
    
    // Check for required sprite definitions
    const requiredSprites = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9'];
    const missingSprities: string[] = [];
    
    requiredSprites.forEach(sprite => {
      if (!content.includes(`'${sprite}'`)) {
        missingSprities.push(sprite);
      }
    });

    if (missingSprities.length > 0) {
      this.issues.push({
        field: 'sprites',
        platform: 'both',
        severity: 'warning',
        message: `Missing sprite definitions: ${missingSprities.join(', ')}`,
        suggestion: 'Add missing sprite mappings for consistency'
      });
    } else {
      console.log(chalk.green('  ✅ All required sprites mapped'));
    }
  }

  // Validate bot activity tracking
  async validateActivityTracking(): Promise<void> {
    console.log(chalk.blue('\n📊 Validating activity tracking...'));
    
    const activityServicePath = path.join(this.rootPath, 'backend/src/services/botActivityService.ts');
    
    if (!fs.existsSync(activityServicePath)) {
      // Check if activity tracking is in another service
      const botServicePath = path.join(this.rootPath, 'backend/src/services/botService.ts');
      
      if (fs.existsSync(botServicePath)) {
        const content = fs.readFileSync(botServicePath, 'utf-8');
        
        if (!content.includes('activityScore') && !content.includes('updateActivity')) {
          this.issues.push({
            field: 'activityTracking',
            platform: 'arena',
            severity: 'warning',
            message: 'Bot activity tracking not implemented',
            suggestion: 'Add activity score tracking to bot service'
          });
        } else {
          console.log(chalk.green('  ✅ Activity tracking found in bot service'));
        }
      }
    } else {
      console.log(chalk.green('  ✅ Dedicated activity service exists'));
    }
  }

  // Validate bot position synchronization
  async validatePositionSync(): Promise<void> {
    console.log(chalk.blue('\n📍 Validating position synchronization...'));
    
    const syncServicePath = path.join(this.rootPath, 'backend/src/services/botSyncService.ts');
    
    if (!fs.existsSync(syncServicePath)) {
      this.issues.push({
        field: 'positionSync',
        platform: 'both',
        severity: 'critical',
        message: 'Bot sync service not found',
        suggestion: 'Create botSyncService.ts for position updates'
      });
      return;
    }

    const content = fs.readFileSync(syncServicePath, 'utf-8');
    
    // Check for position update methods
    const requiredMethods = [
      'updateBotPosition',
      'syncBotToMetaverse',
      'getBotPosition'
    ];
    
    const missingMethods: string[] = [];
    requiredMethods.forEach(method => {
      if (!content.includes(method)) {
        missingMethods.push(method);
      }
    });

    if (missingMethods.length > 0) {
      this.issues.push({
        field: 'positionMethods',
        platform: 'both',
        severity: 'warning',
        message: `Missing sync methods: ${missingMethods.join(', ')}`,
        suggestion: 'Implement all position synchronization methods'
      });
    } else {
      console.log(chalk.green('  ✅ All position sync methods implemented'));
    }

    // Check for WebSocket integration
    if (!content.includes('WebSocket') && !content.includes('subscription')) {
      this.issues.push({
        field: 'realTimeSync',
        platform: 'both',
        severity: 'info',
        message: 'No real-time position updates detected',
        suggestion: 'Consider WebSocket for real-time sync'
      });
    }
  }

  // Validate tournament participation tracking
  async validateTournamentTracking(): Promise<void> {
    console.log(chalk.blue('\n🏆 Validating tournament participation...'));
    
    const queueServicePath = path.join(this.rootPath, 'backend/src/services/queueService.ts');
    
    if (!fs.existsSync(queueServicePath)) {
      this.issues.push({
        field: 'tournamentTracking',
        platform: 'arena',
        severity: 'critical',
        message: 'Queue service not found',
        suggestion: 'Queue service required for tournament tracking'
      });
      return;
    }

    const content = fs.readFileSync(queueServicePath, 'utf-8');
    
    // Check bot integration
    if (!content.includes('botId') && !content.includes('isBot')) {
      this.issues.push({
        field: 'botTournaments',
        platform: 'arena',
        severity: 'warning',
        message: 'Tournament system may not support bots',
        suggestion: 'Ensure bots can participate in tournaments'
      });
    } else {
      console.log(chalk.green('  ✅ Bots can participate in tournaments'));
    }

    // Check activity score updates
    if (!content.includes('activityScore') && !content.includes('updateActivity')) {
      this.issues.push({
        field: 'tournamentActivity',
        platform: 'arena',
        severity: 'info',
        message: 'Tournament participation not updating activity scores',
        suggestion: 'Update bot activity scores after tournaments'
      });
    }
  }

  // Validate equipment and house synchronization
  async validateEquipmentSync(): Promise<void> {
    console.log(chalk.blue('\n🏠 Validating equipment and house sync...'));
    
    const economyServicePath = path.join(this.rootPath, 'backend/src/services/economyService.ts');
    
    if (fs.existsSync(economyServicePath)) {
      const content = fs.readFileSync(economyServicePath, 'utf-8');
      
      // Check equipment handling
      if (!content.includes('equipment') && !content.includes('BotEquipment')) {
        this.issues.push({
          field: 'equipment',
          platform: 'arena',
          severity: 'warning',
          message: 'Equipment not integrated with economy',
          suggestion: 'Link equipment to economy service'
        });
      }

      // Check house handling
      if (!content.includes('house') && !content.includes('BotHouse')) {
        this.issues.push({
          field: 'house',
          platform: 'arena',
          severity: 'warning',
          message: 'Houses not integrated with economy',
          suggestion: 'Link houses to economy service'
        });
      }
    }

    // Check if equipment affects metaverse
    const convexPath = path.join(this.rootPath, 'metaverse-game/convex/aiTown');
    if (fs.existsSync(convexPath)) {
      const files = fs.readdirSync(convexPath);
      const hasEquipmentSync = files.some(file => {
        if (file.endsWith('.ts')) {
          const content = fs.readFileSync(path.join(convexPath, file), 'utf-8');
          return content.includes('equipment') || content.includes('power') || content.includes('defense');
        }
        return false;
      });

      if (!hasEquipmentSync) {
        this.issues.push({
          field: 'equipmentMetaverse',
          platform: 'metaverse',
          severity: 'info',
          message: 'Equipment stats not affecting metaverse',
          suggestion: 'Consider syncing equipment bonuses to metaverse'
        });
      }
    }
  }

  // Validate AI decision recording
  async validateAIDecisions(): Promise<void> {
    console.log(chalk.blue('\n🤖 Validating AI decision recording...'));
    
    const aiDecisionPath = path.join(this.rootPath, 'backend/src/services/aiDecisionService.ts');
    const gameManagerPath = path.join(this.rootPath, 'backend/src/services/gameManagerService.ts');
    
    let hasDecisionRecording = false;
    
    if (fs.existsSync(aiDecisionPath)) {
      hasDecisionRecording = true;
      console.log(chalk.green('  ✅ Dedicated AI decision service found'));
    } else if (fs.existsSync(gameManagerPath)) {
      const content = fs.readFileSync(gameManagerPath, 'utf-8');
      if (content.includes('AIDecision') || content.includes('recordDecision')) {
        hasDecisionRecording = true;
        console.log(chalk.green('  ✅ AI decisions recorded in game manager'));
      }
    }

    if (!hasDecisionRecording) {
      this.issues.push({
        field: 'aiDecisions',
        platform: 'arena',
        severity: 'warning',
        message: 'AI decision recording not implemented',
        suggestion: 'Record AI decisions for analysis and improvement'
      });
    }
  }

  // Check database schema for bot fields
  async validateDatabaseSchema(): Promise<void> {
    console.log(chalk.blue('\n🗄️ Validating database schema...'));
    
    const schemaPath = path.join(this.rootPath, 'backend/prisma/schema.prisma');
    
    if (!fs.existsSync(schemaPath)) {
      this.issues.push({
        field: 'database',
        platform: 'arena',
        severity: 'critical',
        message: 'Prisma schema not found',
        suggestion: 'Database schema required for bot persistence'
      });
      return;
    }

    const content = fs.readFileSync(schemaPath, 'utf-8');
    
    // Check Bot model
    if (!content.includes('model Bot')) {
      this.issues.push({
        field: 'botModel',
        platform: 'arena',
        severity: 'critical',
        message: 'Bot model not found in schema',
        suggestion: 'Add Bot model to Prisma schema'
      });
      return;
    }

    // Check required fields
    const requiredFields = [
      'metaverseAgentId',
      'personality',
      'activityScore',
      'isDeployed',
      'sprite'
    ];
    
    const missingFields: string[] = [];
    requiredFields.forEach(field => {
      if (!content.includes(field)) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      this.issues.push({
        field: 'botFields',
        platform: 'arena',
        severity: 'warning',
        message: `Missing bot fields: ${missingFields.join(', ')}`,
        suggestion: 'Add missing fields to Bot model'
      });
    } else {
      console.log(chalk.green('  ✅ All required bot fields present'));
    }

    // Check relationships
    if (!content.includes('BotEquipment') && !content.includes('equipment')) {
      this.issues.push({
        field: 'equipmentRelation',
        platform: 'arena',
        severity: 'info',
        message: 'No equipment relationship defined',
        suggestion: 'Consider adding BotEquipment model'
      });
    }

    if (!content.includes('BotHouse') && !content.includes('house')) {
      this.issues.push({
        field: 'houseRelation',
        platform: 'arena',
        severity: 'info',
        message: 'No house relationship defined',
        suggestion: 'Consider adding BotHouse model'
      });
    }
  }

  // Generate summary report
  private generateReport(): void {
    console.log(chalk.cyan.bold('\n📊 Bot Synchronization Report\n'));
    console.log(chalk.gray('=' .repeat(50)));

    // Group issues by severity
    const critical = this.issues.filter(i => i.severity === 'critical');
    const warnings = this.issues.filter(i => i.severity === 'warning');
    const info = this.issues.filter(i => i.severity === 'info');

    // Critical issues
    if (critical.length > 0) {
      console.log(chalk.red.bold('\n❌ CRITICAL ISSUES:'));
      critical.forEach(issue => {
        console.log(chalk.red(`  • ${issue.message}`));
        if (issue.suggestion) {
          console.log(chalk.gray(`    → ${issue.suggestion}`));
        }
      });
    }

    // Warnings
    if (warnings.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️ WARNINGS:'));
      warnings.forEach(issue => {
        console.log(chalk.yellow(`  • ${issue.message}`));
        if (issue.suggestion) {
          console.log(chalk.gray(`    → ${issue.suggestion}`));
        }
      });
    }

    // Info
    if (info.length > 0) {
      console.log(chalk.blue.bold('\nℹ️ SUGGESTIONS:'));
      info.forEach(issue => {
        console.log(chalk.blue(`  • ${issue.message}`));
        if (issue.suggestion) {
          console.log(chalk.gray(`    → ${issue.suggestion}`));
        }
      });
    }

    // Summary statistics
    console.log(chalk.gray('\n' + '=' .repeat(50)));
    console.log(chalk.cyan('\n📈 Summary:'));
    console.log(chalk.green(`  ✅ Checks passed: ${this.getTotalChecks() - this.issues.length}`));
    console.log(chalk.red(`  ❌ Critical issues: ${critical.length}`));
    console.log(chalk.yellow(`  ⚠️ Warnings: ${warnings.length}`));
    console.log(chalk.blue(`  ℹ️ Suggestions: ${info.length}`));

    // Overall score
    const score = this.calculateSyncScore();
    const scoreColor = score >= 80 ? chalk.green :
                      score >= 60 ? chalk.yellow : chalk.red;
    
    console.log(chalk.cyan(`\n🎯 Bot Sync Score: ${scoreColor(score + '%')}`));

    // Recommendations
    if (critical.length > 0) {
      console.log(chalk.red.bold('\n⚠️ IMMEDIATE ACTION REQUIRED:'));
      console.log(chalk.red('  Fix critical issues before deploying bots'));
    } else if (warnings.length > 0) {
      console.log(chalk.yellow.bold('\n📋 RECOMMENDED ACTIONS:'));
      console.log(chalk.yellow('  Address warnings to improve bot synchronization'));
    } else if (this.issues.length === 0) {
      console.log(chalk.green.bold('\n✅ EXCELLENT! Bot synchronization is fully configured'));
    }
  }

  private getTotalChecks(): number {
    // Count total number of checks performed
    return 30; // Approximate number of validation checks
  }

  private calculateSyncScore(): number {
    const totalChecks = this.getTotalChecks();
    const criticalWeight = 10;
    const warningWeight = 3;
    const infoWeight = 1;

    const critical = this.issues.filter(i => i.severity === 'critical').length;
    const warnings = this.issues.filter(i => i.severity === 'warning').length;
    const info = this.issues.filter(i => i.severity === 'info').length;

    const deductions = (critical * criticalWeight) + (warnings * warningWeight) + (info * infoWeight);
    const maxScore = totalChecks * criticalWeight;
    const score = Math.max(0, ((maxScore - deductions) / maxScore) * 100);

    return Math.round(score);
  }

  // Main validation runner
  async runValidation(): Promise<void> {
    console.log(chalk.cyan.bold('🤖 AI Arena Bot Synchronization Validator'));
    console.log(chalk.gray('Checking bot integration across platforms...\n'));

    try {
      await this.validateDatabaseSchema();
      await this.validateSpriteMapping();
      await this.validateActivityTracking();
      await this.validatePositionSync();
      await this.validateTournamentTracking();
      await this.validateEquipmentSync();
      await this.validateAIDecisions();

      this.generateReport();

      // Exit with error code if critical issues found
      const criticalCount = this.issues.filter(i => i.severity === 'critical').length;
      if (criticalCount > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Validation failed:'), error);
      process.exit(1);
    }
  }
}

// Run the validator
const validator = new BotSyncValidator();
validator.runValidation().catch(console.error);