import { IGameValidationResult, IGameConfig, IGameAction, IGameState } from '../core/interfaces';

export interface ValidationRule<T> {
  name: string;
  validate(value: T): IGameValidationResult;
}

export class GameValidator {
  private configRules: Map<string, ValidationRule<any>[]> = new Map();
  private actionRules: Map<string, ValidationRule<any>[]> = new Map();
  private stateRules: ValidationRule<any>[] = [];

  addConfigRule(gameId: string, rule: ValidationRule<IGameConfig>): void {
    if (!this.configRules.has(gameId)) {
      this.configRules.set(gameId, []);
    }
    this.configRules.get(gameId)!.push(rule);
  }

  addActionRule(gameId: string, rule: ValidationRule<IGameAction>): void {
    if (!this.actionRules.has(gameId)) {
      this.actionRules.set(gameId, []);
    }
    this.actionRules.get(gameId)!.push(rule);
  }

  addStateRule(rule: ValidationRule<IGameState>): void {
    this.stateRules.push(rule);
  }

  validateConfig(gameId: string, config: IGameConfig): IGameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const baseValidation = this.validateBaseConfig(config);
    errors.push(...(baseValidation.errors || []));
    warnings.push(...(baseValidation.warnings || []));

    const rules = this.configRules.get(gameId) || [];
    for (const rule of rules) {
      const result = rule.validate(config);
      errors.push(...(result.errors || []));
      warnings.push(...(result.warnings || []));
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  validateAction(gameId: string, action: IGameAction): IGameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const baseValidation = this.validateBaseAction(action);
    errors.push(...(baseValidation.errors || []));
    warnings.push(...(baseValidation.warnings || []));

    const rules = this.actionRules.get(gameId) || [];
    for (const rule of rules) {
      const result = rule.validate(action);
      errors.push(...(result.errors || []));
      warnings.push(...(result.warnings || []));
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  validateState(state: IGameState): IGameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const baseValidation = this.validateBaseState(state);
    errors.push(...(baseValidation.errors || []));
    warnings.push(...(baseValidation.warnings || []));

    for (const rule of this.stateRules) {
      const result = rule.validate(state);
      errors.push(...(result.errors || []));
      warnings.push(...(result.warnings || []));
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private validateBaseConfig(config: IGameConfig): IGameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push('Config is required');
      return { isValid: false, errors };
    }

    if (typeof config.thinkingTime !== 'number' || config.thinkingTime < 0) {
      errors.push('Thinking time must be a positive number');
    }

    if (!Array.isArray(config.playerConfigs)) {
      errors.push('Player configs must be an array');
    } else {
      if (config.playerConfigs.length === 0) {
        errors.push('At least one player is required');
      }

      const playerIds = new Set<string>();
      config.playerConfigs.forEach((player, index) => {
        if (!player.id) {
          errors.push(`Player at index ${index} missing ID`);
        } else if (playerIds.has(player.id)) {
          errors.push(`Duplicate player ID: ${player.id}`);
        } else {
          playerIds.add(player.id);
        }

        if (!player.name) {
          errors.push(`Player at index ${index} missing name`);
        }
      });
    }

    if (config.maxDuration !== undefined && config.maxDuration <= 0) {
      warnings.push('Max duration should be positive or undefined');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private validateBaseAction(action: IGameAction): IGameValidationResult {
    const errors: string[] = [];

    if (!action) {
      errors.push('Action is required');
      return { isValid: false, errors };
    }

    if (!action.playerId) {
      errors.push('Player ID is required');
    }

    if (!action.type) {
      errors.push('Action type is required');
    }

    if (!action.timestamp || !(action.timestamp instanceof Date)) {
      errors.push('Valid timestamp is required');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private validateBaseState(state: IGameState): IGameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!state) {
      errors.push('State is required');
      return { isValid: false, errors };
    }

    if (!state.gameId) {
      errors.push('Game ID is required');
    }

    if (!state.phase) {
      errors.push('Game phase is required');
    }

    if (!state.startTime || !(state.startTime instanceof Date)) {
      errors.push('Valid start time is required');
    }

    if (state.endTime && !(state.endTime instanceof Date)) {
      errors.push('End time must be a valid date');
    }

    if (state.endTime && state.startTime && state.endTime < state.startTime) {
      errors.push('End time cannot be before start time');
    }

    if (typeof state.turnCount !== 'number' || state.turnCount < 0) {
      errors.push('Turn count must be a non-negative number');
    }

    if (!Array.isArray(state.players)) {
      errors.push('Players must be an array');
    } else {
      if (state.players.length === 0) {
        warnings.push('No players in game state');
      }

      const activeCount = state.players.filter(p => p.isActive).length;
      if (activeCount === 0) {
        warnings.push('No active players');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

export const createNumberRangeRule = (
  name: string,
  getValue: (obj: any) => number,
  min: number,
  max: number
): ValidationRule<any> => ({
  name,
  validate: (obj: any) => {
    const value = getValue(obj);
    if (typeof value !== 'number') {
      return { isValid: false, errors: [`${name} must be a number`] };
    }
    if (value < min || value > max) {
      return { isValid: false, errors: [`${name} must be between ${min} and ${max}`] };
    }
    return { isValid: true };
  }
});

export const createRequiredFieldRule = (
  name: string,
  getValue: (obj: any) => any
): ValidationRule<any> => ({
  name,
  validate: (obj: any) => {
    const value = getValue(obj);
    if (value === null || value === undefined || value === '') {
      return { isValid: false, errors: [`${name} is required`] };
    }
    return { isValid: true };
  }
});

export const createEnumRule = <T>(
  name: string,
  getValue: (obj: any) => T,
  validValues: T[]
): ValidationRule<any> => ({
  name,
  validate: (obj: any) => {
    const value = getValue(obj);
    if (!validValues.includes(value)) {
      return { 
        isValid: false, 
        errors: [`${name} must be one of: ${validValues.join(', ')}`] 
      };
    }
    return { isValid: true };
  }
});