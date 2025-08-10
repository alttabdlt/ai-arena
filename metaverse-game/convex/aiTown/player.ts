import { Infer, ObjectType, v } from 'convex/values';
import { Point, Vector, path, point, vector } from '../util/types';
import { GameId, parseGameId } from './ids';
import { playerId } from './ids';
import {
  PATHFINDING_TIMEOUT,
  PATHFINDING_BACKOFF,
  HUMAN_IDLE_TOO_LONG,
  MAX_HUMAN_PLAYERS,
  MAX_PATHFINDS_PER_STEP,
} from '../constants';
import { pointsEqual, pathPosition } from '../util/geometry';
import { Game } from './game';
import { stopPlayer, findRoute, blocked, movePlayer } from './movement';
import { inputHandler } from './inputHandler';
import { characters } from '../../data/characters';
import { PlayerDescription } from './playerDescription';

const pathfinding = v.object({
  destination: point,
  started: v.number(),
  state: v.union(
    v.object({
      kind: v.literal('needsPath'),
    }),
    v.object({
      kind: v.literal('waiting'),
      until: v.number(),
    }),
    v.object({
      kind: v.literal('moving'),
      path,
    }),
  ),
});
export type Pathfinding = Infer<typeof pathfinding>;

export const activity = v.object({
  description: v.string(),
  emoji: v.optional(v.string()),
  until: v.number(),
});
export type Activity = Infer<typeof activity>;

export const serializedPlayer = {
  id: playerId,
  human: v.optional(v.string()),
  pathfinding: v.optional(pathfinding),
  activity: v.optional(activity),
  
  // Crime metaverse fields
  currentZone: v.optional(v.union(
    v.literal('casino'),
    v.literal('darkAlley'),
    v.literal('suburb'),
    v.literal('downtown'),
    v.literal('underground')
  )),
  equipment: v.optional(v.object({
    powerBonus: v.number(),
    defenseBonus: v.number(),
  })),
  
  // Inventory tracking
  inventoryId: v.optional(v.id('inventories')),
  houseId: v.optional(v.id('houses')),
  
  // The last time they did something.
  lastInput: v.number(),

  position: point,
  facing: vector,
  speed: v.number(),
  
  // Idle game mechanics
  stepsTaken: v.optional(v.number()),
  lastStepTime: v.optional(v.number()),
  stepStreak: v.optional(v.number()),
  currentEnergy: v.optional(v.number()),
  maxEnergy: v.optional(v.number()),
  lastEnergyRegen: v.optional(v.number()),
  lastLootRoll: v.optional(v.number()),
};
export type SerializedPlayer = ObjectType<typeof serializedPlayer>;

export class Player {
  id: GameId<'players'>;
  human?: string;
  pathfinding?: Pathfinding;
  activity?: Activity;
  currentZone?: 'casino' | 'darkAlley' | 'suburb' | 'downtown' | 'underground';
  equipment?: { powerBonus: number; defenseBonus: number };
  inventoryId?: string;
  houseId?: string;

  lastInput: number;

  position: Point;
  facing: Vector;
  speed: number;
  
  // Idle game mechanics
  stepsTaken: number;
  lastStepTime: number;
  stepStreak: number;
  currentEnergy: number;
  maxEnergy: number;
  lastEnergyRegen: number;
  lastLootRoll: number;

  constructor(serialized: SerializedPlayer) {
    const { id, human, pathfinding, activity, currentZone, equipment, inventoryId, houseId, 
            lastInput, position, facing, speed, stepsTaken, lastStepTime, stepStreak,
            currentEnergy, maxEnergy, lastEnergyRegen, lastLootRoll } = serialized;
    this.id = parseGameId('players', id);
    this.human = human;
    this.pathfinding = pathfinding;
    this.activity = activity;
    this.currentZone = currentZone;
    this.equipment = equipment;
    this.inventoryId = inventoryId as string | undefined;
    this.houseId = houseId as string | undefined;
    this.lastInput = lastInput;
    this.position = position;
    this.facing = facing;
    this.speed = speed;
    
    // Initialize idle game fields
    this.stepsTaken = stepsTaken || 0;
    this.lastStepTime = lastStepTime || 0;
    this.stepStreak = stepStreak || 0;
    this.currentEnergy = currentEnergy ?? 30;
    this.maxEnergy = maxEnergy || 30;
    this.lastEnergyRegen = lastEnergyRegen || Date.now();
    this.lastLootRoll = lastLootRoll || 0;
  }

  tick(game: Game, now: number) {
    if (this.human && this.lastInput < now - HUMAN_IDLE_TOO_LONG) {
      this.leave(game, now);
    }
    
    // Energy consumption and regeneration for bots
    if (!this.human) {
      // Energy consumption: 1 energy per 5 minutes (300000ms)
      const timeSinceLastConsumption = now - this.lastEnergyRegen;
      const fiveMinutesPassed = Math.floor(timeSinceLastConsumption / 300000); // 300000ms = 5 minutes
      
      if (fiveMinutesPassed > 0 && this.currentEnergy > 0) {
        // Consume energy
        const energyToConsume = Math.min(fiveMinutesPassed, this.currentEnergy);
        this.currentEnergy = Math.max(0, this.currentEnergy - energyToConsume);
        this.lastEnergyRegen = now;
        
        // If energy depleted, stop pathfinding
        if (this.currentEnergy === 0 && this.pathfinding) {
          console.log(`Bot ${this.id} energy depleted, stopping movement`);
          stopPlayer(this);
        }
      }
      
      // Energy regeneration happens through other means (items, rest areas, etc.)
      // Check if we should auto-resume movement after energy restored
      if (this.currentEnergy >= 10 && !this.pathfinding) {
        // Resume movement when we have at least 10 energy
        console.log(`Bot ${this.id} energy restored to ${this.currentEnergy}, auto-resuming`);
        // The agent system will handle resuming movement on next tick
      }
    }
    
    // Check if activity has expired and log it
    if (this.activity && now >= this.activity.until) {
      const playerDesc = game.playerDescriptions.get(this.id);
      if (playerDesc) {
        // Find agent for this player if it exists
        const agent = [...game.world.agents.values()].find(a => a.playerId === this.id);
        
        // Log activity end
        game.scheduleOperation('logActivityEnd', {
          worldId: game.worldId,
          playerId: this.id as string,
          agentId: agent?.id as string | undefined,
          playerName: playerDesc.name,
          activity: this.activity.description,
          zone: this.currentZone || 'downtown',
        });
      }
      // Clear the expired activity
      delete this.activity;
    }
  }

  tickPathfinding(game: Game, now: number) {
    // There's nothing to do if we're not moving.
    const { pathfinding, position } = this;
    if (!pathfinding) {
      return;
    }

    // Stop pathfinding if we've reached our destination.
    if (pathfinding.state.kind === 'moving' && pointsEqual(pathfinding.destination, position)) {
      stopPlayer(this);
    }

    // Stop pathfinding if we've timed out.
    if (pathfinding.started + PATHFINDING_TIMEOUT < now) {
      console.warn(`Timing out pathfinding for ${this.id}`);
      stopPlayer(this);
    }

    // Transition from "waiting" to "needsPath" if we're past the deadline.
    if (pathfinding.state.kind === 'waiting' && pathfinding.state.until < now) {
      pathfinding.state = { kind: 'needsPath' };
    }

    // Perform pathfinding if needed.
    if (pathfinding.state.kind === 'needsPath' && game.numPathfinds < MAX_PATHFINDS_PER_STEP) {
      game.numPathfinds++;
      if (game.numPathfinds === MAX_PATHFINDS_PER_STEP) {
        console.warn(`Reached max pathfinds for this step`);
      }
      const route = findRoute(game, now, this, pathfinding.destination);
      if (route === null) {
        console.log(`Failed to route to ${JSON.stringify(pathfinding.destination)}`);
        stopPlayer(this);
      } else {
        if (route.newDestination) {
          console.warn(
            `Updating destination from ${JSON.stringify(
              pathfinding.destination,
            )} to ${JSON.stringify(route.newDestination)}`,
          );
          pathfinding.destination = route.newDestination;
        }
        pathfinding.state = { kind: 'moving', path: route.path };
      }
    }
  }

  tickPosition(game: Game, now: number) {
    // There's nothing to do if we're not moving.
    if (!this.pathfinding || this.pathfinding.state.kind !== 'moving') {
      this.speed = 0;
      return;
    }
    
    // Check energy before moving (skip for human players)
    if (!this.human && this.currentEnergy <= 0) {
      // Out of energy - pause movement
      stopPlayer(this);
      console.log(`Bot ${this.id} out of energy, pausing movement`);
      return;
    }

    // Compute a candidate new position and check if it collides
    // with anything.
    const candidate = pathPosition(this.pathfinding.state.path as any, now);
    if (!candidate) {
      console.warn(`Path out of range of ${now} for ${this.id}`);
      return;
    }
    const { position, facing, velocity } = candidate;
    const collisionReason = blocked(game, now, position, this.id);
    if (collisionReason !== null) {
      const backoff = Math.random() * PATHFINDING_BACKOFF;
      console.warn(`Stopping path for ${this.id}, waiting for ${backoff}ms: ${collisionReason}`);
      this.pathfinding.state = {
        kind: 'waiting',
        until: now + backoff,
      };
      return;
    }
    
    // Check for zone change before updating position
    const { getZoneFromPosition } = require('../constants');
    const oldZone = this.currentZone || getZoneFromPosition(this.position);
    const newZone = getZoneFromPosition(position);
    
    // Calculate if we actually moved a significant distance (at least 0.5 tiles)
    const distanceMoved = Math.sqrt(
      Math.pow(position.x - this.position.x, 2) + 
      Math.pow(position.y - this.position.y, 2)
    );
    
    // Update the player's location.
    this.position = position;
    this.facing = facing;
    this.speed = velocity;
    
    // IDLE GAME MECHANICS - Track steps (no longer consumes energy per step)
    if (!this.human && distanceMoved >= 0.5 && now - this.lastStepTime > 5000) {
      // We moved at least half a tile and it's been 5 seconds since last XP grant
      this.stepsTaken++;
      this.lastStepTime = now;
      
      // Only grant XP every 10 steps to reduce frequency
      this.stepStreak++;
      if (this.stepStreak >= 10) {
        this.stepStreak = 0;
        
        // Schedule XP grant (reduced frequency)
        const agent = [...game.world.agents.values()].find(a => a.playerId === this.id);
        if (agent) {
          const agentDesc = game.agentDescriptions.get(agent.id);
          if (agentDesc?.aiArenaBotId) {
            game.scheduleOperation('grantMovementXP', {
              worldId: game.worldId,
              playerId: this.id as string,
              aiArenaBotId: agentDesc.aiArenaBotId,
              baseXP: 1,
              bonusXP: 0, // Remove bonus XP
            });
          }
        }
      }
      
      // Roll for loot drop (10% base chance)
      if (now - this.lastLootRoll > 1000) { // Max 1 loot roll per second
        this.lastLootRoll = now;
        const lootChance = 0.1 * this.getZoneLootMultiplier(newZone);
        
        if (Math.random() < lootChance) {
          // Schedule loot drop
          game.scheduleOperation('generateLootDrop', {
            worldId: game.worldId,
            playerId: this.id as string,
            zone: newZone,
            position: { x: position.x, y: position.y },
          });
        }
      }
    }
    
    // If zone changed, update it and log the change
    if (oldZone !== newZone) {
      this.currentZone = newZone as any;
      
      // Schedule zone change logging
      const playerDesc = game.playerDescriptions.get(this.id);
      if (playerDesc) {
        game.scheduleOperation('logZoneChange', {
          worldId: game.worldId,
          playerId: this.id as string,
          playerName: playerDesc.name,
          fromZone: oldZone,
          toZone: newZone,
        });
      }
    }
  }
  
  // Helper method to get zone-specific loot multiplier
  getZoneLootMultiplier(zone: string): number {
    const multipliers: Record<string, number> = {
      'casino': 1.5,      // +50% loot in casinos
      'darkAlley': 1.3,   // +30% loot in dark alleys
      'underground': 1.4, // +40% loot underground
      'suburb': 1.2,      // +20% loot in suburbs
      'downtown': 1.0,    // Normal loot downtown
    };
    return multipliers[zone] || 1.0;
  }

  static join(
    game: Game,
    now: number,
    name: string,
    character: string,
    description: string,
    tokenIdentifier?: string,
    avatar?: string,
  ) {
    if (tokenIdentifier) {
      let numHumans = 0;
      for (const player of game.world.players.values()) {
        if (player.human) {
          numHumans++;
        }
        if (player.human === tokenIdentifier) {
          throw new Error(`You are already in this game!`);
        }
      }
      if (numHumans >= MAX_HUMAN_PLAYERS) {
        throw new Error(`Only ${MAX_HUMAN_PLAYERS} human players allowed at once.`);
      }
    }
    let position;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = {
        x: Math.floor(Math.random() * game.worldMap.width),
        y: Math.floor(Math.random() * game.worldMap.height),
      };
      if (blocked(game, now, candidate)) {
        continue;
      }
      position = candidate;
      break;
    }
    if (!position) {
      throw new Error(`Failed to find a free position!`);
    }
    const facingOptions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    const facing = facingOptions[Math.floor(Math.random() * facingOptions.length)];
    if (!characters.find((c) => c.name === character)) {
      throw new Error(`Invalid character: ${character}`);
    }
    const playerId = game.allocId('players');
    game.world.players.set(
      playerId,
      new Player({
        id: playerId,
        human: tokenIdentifier,
        lastInput: now,
        position,
        facing,
        speed: 0,
        // Initialize idle game stats
        stepsTaken: 0,
        lastStepTime: now,
        stepStreak: 0,
        currentEnergy: 30,
        maxEnergy: 30,
        lastEnergyRegen: now,
        lastLootRoll: 0,
      }),
    );
    game.playerDescriptions.set(
      playerId,
      new PlayerDescription({
        playerId,
        character,
        description,
        name,
        avatar,
      }),
    );
    game.descriptionsModified = true;
    return playerId;
  }

  leave(game: Game, now: number) {
    // Stop ALL conversations we're in when leaving the game
    const conversations = [...game.world.conversations.values()].filter((c) =>
      c.participants.has(this.id),
    );
    
    for (const conversation of conversations) {
      console.log(`Player ${this.id} leaving: stopping conversation ${conversation.id}`);
      conversation.stop(game, now);
    }
    
    // Schedule comprehensive cleanup for this player
    // This will clean up messages, archived conversations, relationships, etc.
    game.scheduleOperation('cleanupPlayerData', {
      worldId: game.worldId,
      playerId: this.id as string,
    });
    
    // Remove the player from the world
    game.world.players.delete(this.id);
  }

  serialize(): SerializedPlayer {
    const { id, human, pathfinding, activity, currentZone, equipment, inventoryId, houseId, 
            lastInput, position, facing, speed, stepsTaken, lastStepTime, stepStreak,
            currentEnergy, maxEnergy, lastEnergyRegen, lastLootRoll } = this;
    return {
      id,
      human,
      pathfinding,
      activity,
      currentZone,
      equipment,
      inventoryId: inventoryId as any,
      houseId: houseId as any,
      lastInput,
      position,
      facing,
      speed,
      stepsTaken,
      lastStepTime,
      stepStreak,
      currentEnergy,
      maxEnergy,
      lastEnergyRegen,
      lastLootRoll,
    };
  }
}

export const playerInputs = {
  join: inputHandler({
    args: {
      name: v.string(),
      character: v.string(),
      description: v.string(),
      tokenIdentifier: v.optional(v.string()),
      avatar: v.optional(v.string()),
    },
    handler: (game, now, args) => {
      Player.join(game, now, args.name, args.character, args.description, args.tokenIdentifier, args.avatar);
      return null;
    },
  }),
  leave: inputHandler({
    args: { playerId },
    handler: (game, now, args) => {
      const playerId = parseGameId('players', args.playerId);
      const player = game.world.players.get(playerId);
      if (!player) {
        throw new Error(`Invalid player ID ${playerId}`);
      }
      player.leave(game, now);
      return null;
    },
  }),
  moveTo: inputHandler({
    args: {
      playerId,
      destination: v.union(point, v.null()),
    },
    handler: (game, now, args) => {
      const playerId = parseGameId('players', args.playerId);
      const player = game.world.players.get(playerId);
      if (!player) {
        throw new Error(`Invalid player ID ${playerId}`);
      }
      if (args.destination) {
        movePlayer(game, now, player, args.destination);
      } else {
        stopPlayer(player);
      }
      return null;
    },
  }),
};

import { internalQuery } from '../_generated/server';

export const getPlayer = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, { worldId, playerId }) => {
    const world = await ctx.db.get(worldId);
    if (!world) return null;
    
    const player = world.players.find(p => p.id === playerId);
    // Add house data stub for now
    if (player) {
      return {
        ...player,
        house: { defenseLevel: 10 }, // Placeholder house data
      };
    }
    return null;
  },
});
