import { IGameTimer } from '../core/context';

export class GameTimer implements IGameTimer {
  private startTime: number | null = null;
  private pausedTime: number = 0;
  private pauseStartTime: number | null = null;
  private isPaused: boolean = false;
  private countdownTimer: NodeJS.Timeout | null = null;
  private countdownCallback: (() => void) | null = null;

  start(): void {
    if (this.startTime !== null) {
      throw new Error('Timer already started');
    }
    this.startTime = Date.now();
    this.pausedTime = 0;
    this.isPaused = false;
  }

  stop(): void {
    this.startTime = null;
    this.pausedTime = 0;
    this.pauseStartTime = null;
    this.isPaused = false;
    this.clearCountdown();
  }

  pause(): void {
    if (this.startTime === null) {
      throw new Error('Timer not started');
    }
    if (this.isPaused) {
      throw new Error('Timer already paused');
    }
    
    this.isPaused = true;
    this.pauseStartTime = Date.now();
    
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
    }
  }

  resume(): void {
    if (this.startTime === null) {
      throw new Error('Timer not started');
    }
    if (!this.isPaused) {
      throw new Error('Timer not paused');
    }
    
    if (this.pauseStartTime !== null) {
      this.pausedTime += Date.now() - this.pauseStartTime;
    }
    
    this.isPaused = false;
    this.pauseStartTime = null;
  }

  getElapsedTime(): number {
    if (this.startTime === null) {
      return 0;
    }
    
    let elapsed = Date.now() - this.startTime - this.pausedTime;
    
    if (this.isPaused && this.pauseStartTime !== null) {
      elapsed -= (Date.now() - this.pauseStartTime);
    }
    
    return Math.max(0, elapsed);
  }

  setCountdown(seconds: number, callback: () => void): void {
    this.clearCountdown();
    
    if (seconds <= 0) {
      callback();
      return;
    }
    
    this.countdownCallback = callback;
    
    if (!this.isPaused) {
      this.countdownTimer = setTimeout(() => {
        this.countdownCallback?.();
        this.countdownTimer = null;
        this.countdownCallback = null;
      }, seconds * 1000);
    }
  }

  clearCountdown(): void {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.countdownCallback = null;
  }

  getRemainingCountdown(): number {
    return 0;
  }
}

export class TurnTimer extends GameTimer {
  private turnDuration: number;
  private turnStartTime: number | null = null;
  private onTurnEnd: (() => void) | null = null;

  constructor(turnDuration: number) {
    super();
    this.turnDuration = turnDuration;
  }

  startTurn(onTurnEnd: () => void): void {
    this.turnStartTime = Date.now();
    this.onTurnEnd = onTurnEnd;
    this.setCountdown(this.turnDuration / 1000, onTurnEnd);
  }

  endTurn(): void {
    this.clearCountdown();
    this.turnStartTime = null;
    this.onTurnEnd = null;
  }

  getRemainingTurnTime(): number {
    if (this.turnStartTime === null) {
      return this.turnDuration;
    }
    
    const elapsed = Date.now() - this.turnStartTime;
    return Math.max(0, this.turnDuration - elapsed);
  }

  getTurnProgress(): number {
    if (this.turnStartTime === null) {
      return 0;
    }
    
    const elapsed = Date.now() - this.turnStartTime;
    return Math.min(1, elapsed / this.turnDuration);
  }
}