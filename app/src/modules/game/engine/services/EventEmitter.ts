import { IGameEvent } from '../core/interfaces';
import { IGameEventBus } from '../core/context';

export type EventHandler<T = any> = (data: T) => void;

export class GameEventEmitter implements IGameEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private onceHandlers: Map<string, Set<EventHandler>> = new Map();
  private eventHistory: IGameEvent[] = [];
  private maxHistorySize: number = 1000;

  emit(event: IGameEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    const handlers = this.handlers.get(event.type);
    const onceHandlers = this.onceHandlers.get(event.type);

    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      });
    }

    if (onceHandlers) {
      onceHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in once handler for ${event.type}:`, error);
        }
      });
      this.onceHandlers.delete(event.type);
    }
  }

  on(eventType: string, handler: EventHandler<IGameEvent>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: EventHandler<IGameEvent>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }

    const onceHandlers = this.onceHandlers.get(eventType);
    if (onceHandlers) {
      onceHandlers.delete(handler);
      if (onceHandlers.size === 0) {
        this.onceHandlers.delete(eventType);
      }
    }
  }

  once(eventType: string, handler: EventHandler<IGameEvent>): void {
    if (!this.onceHandlers.has(eventType)) {
      this.onceHandlers.set(eventType, new Set());
    }
    this.onceHandlers.get(eventType)!.add(handler);
  }

  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
      this.onceHandlers.delete(eventType);
    } else {
      this.handlers.clear();
      this.onceHandlers.clear();
    }
  }

  getEventHistory(eventType?: string, limit?: number): IGameEvent[] {
    let events = eventType 
      ? this.eventHistory.filter(e => e.type === eventType)
      : [...this.eventHistory];

    if (limit && limit > 0) {
      events = events.slice(-limit);
    }

    return events;
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  getListenerCount(eventType?: string): number {
    if (eventType) {
      const handlers = this.handlers.get(eventType);
      const onceHandlers = this.onceHandlers.get(eventType);
      return (handlers?.size || 0) + (onceHandlers?.size || 0);
    }

    let count = 0;
    this.handlers.forEach(set => count += set.size);
    this.onceHandlers.forEach(set => count += set.size);
    return count;
  }
}