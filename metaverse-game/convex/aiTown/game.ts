import { Infer, v } from 'convex/values';
import { Doc, Id } from '../_generated/dataModel';
import {
  ActionCtx,
  DatabaseReader,
  MutationCtx,
  internalMutation,
  internalQuery,
} from '../_generated/server';
import { World, serializedWorld } from './world';
import { WorldMap, serializedWorldMap } from './worldMap';
import { PlayerDescription, serializedPlayerDescription } from './playerDescription';
import { Location, locationFields, playerLocation } from './location';
import { runAgentOperation } from './agent';
import { GameId, IdTypes, allocGameId } from './ids';
import { InputArgs, InputNames, inputs } from './inputs';
import {
  AbstractGame,
  EngineUpdate,
  applyEngineUpdate,
  engineUpdate,
  loadEngine,
} from '../engine/abstractGame';
import { internal } from '../_generated/api';
import { HistoricalObject } from '../engine/historicalObject';
import { AgentDescription, serializedAgentDescription } from './agentDescription';
import { parseMap, serializeMap } from '../util/object';

const gameState = v.object({
  world: v.object(serializedWorld),
  playerDescriptions: v.array(v.object(serializedPlayerDescription)),
  agentDescriptions: v.array(v.object(serializedAgentDescription)),
  worldMap: v.object(serializedWorldMap),
});
type GameState = Infer<typeof gameState>;

const gameStateDiff = v.object({
  world: v.object(serializedWorld),
  playerDescriptions: v.optional(v.array(v.object(serializedPlayerDescription))),
  agentDescriptions: v.optional(v.array(v.object(serializedAgentDescription))),
  worldMap: v.optional(v.object(serializedWorldMap)),
  agentOperations: v.array(v.object({ name: v.string(), args: v.any() })),
});
type GameStateDiff = Infer<typeof gameStateDiff>;

export class Game extends AbstractGame {
  tickDuration = 16;
  stepDuration = 1000;
  maxTicksPerStep = 600;
  maxInputsPerStep = 32;

  world: World;

  historicalLocations: Map<GameId<'players'>, HistoricalObject<Location>>;

  descriptionsModified: boolean;
  worldMap: WorldMap;
  playerDescriptions: Map<GameId<'players'>, PlayerDescription>;
  agentDescriptions: Map<GameId<'agents'>, AgentDescription>;

  pendingOperations: Array<{ name: string; args: any }> = [];
  pendingActivityLog?: any;

  numPathfinds: number;
  
  // Relationship cache for performance
  relationshipCache: Map<string, any> = new Map();
  reputationCache: Map<GameId<'players'>, any> = new Map();

  constructor(
    engine: Doc<'engines'>,
    public worldId: Id<'worlds'>,
    state: GameState,
  ) {
    super(engine);

    this.world = new World(state.world);
    delete this.world.historicalLocations;

    this.descriptionsModified = false;
    this.worldMap = new WorldMap(state.worldMap);
    this.agentDescriptions = parseMap(state.agentDescriptions, AgentDescription, (a) => a.agentId);
    this.playerDescriptions = parseMap(
      state.playerDescriptions,
      PlayerDescription,
      (p) => p.playerId,
    );

    this.historicalLocations = new Map();

    this.numPathfinds = 0;
  }

  static async load(
    db: DatabaseReader,
    worldId: Id<'worlds'>,
    generationNumber: number,
  ): Promise<{ engine: Doc<'engines'>; gameState: GameState }> {
    const worldDoc = await db.get(worldId);
    if (!worldDoc) {
      throw new Error(`No world found with id ${worldId}`);
    }
    const worldStatus = await db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    if (!worldStatus) {
      throw new Error(`No engine found for world ${worldId}`);
    }
    const engine = await loadEngine(db, worldStatus.engineId, generationNumber);
    const playerDescriptionsDocs = await db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const agentDescriptionsDocs = await db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .collect();
    const worldMapDoc = await db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', worldId))
      .unique();
    if (!worldMapDoc) {
      throw new Error(`No map found for world ${worldId}`);
    }
    // Discard the system fields and historicalLocations from the world state.
    const { _id, _creationTime, historicalLocations: _, ...world } = worldDoc;
    const playerDescriptions = playerDescriptionsDocs
      // Discard player descriptions for players that no longer exist.
      .filter((d) => !!world.players.find((p) => p.id === d.playerId))
      .map(({ _id, _creationTime, worldId: _, ...doc }) => doc);
    const agentDescriptions = agentDescriptionsDocs
      .filter((a) => !!world.agents.find((p) => p.id === a.agentId))
      .map(({ _id, _creationTime, worldId: _, ...doc }) => doc);
    const {
      _id: _mapId,
      _creationTime: _mapCreationTime,
      worldId: _mapWorldId,
      ...worldMap
    } = worldMapDoc;
    return {
      engine,
      gameState: {
        world,
        playerDescriptions,
        agentDescriptions,
        worldMap,
      },
    };
  }

  allocId<T extends IdTypes>(idType: T): GameId<T> {
    const id = allocGameId(idType, this.world.nextId);
    this.world.nextId += 1;
    return id;
  }

  scheduleOperation(name: string, args: unknown) {
    this.pendingOperations.push({ name, args });
  }
  
  // Get cached relationship or load from cache
  getCachedRelationship(fromPlayer: GameId<'players'>, toPlayer: GameId<'players'>): any {
    const key = `${fromPlayer}-${toPlayer}`;
    if (!this.relationshipCache.has(key)) {
      // In a real implementation, this would load from DB
      // For now, return default relationship
      return { 
        respect: 0, fear: 0, trust: 0, 
        loyalty: 0, revenge: 0, debt: 0 
      };
    }
    return this.relationshipCache.get(key);
  }
  
  // Update relationship cache
  updateRelationshipCache(fromPlayer: GameId<'players'>, toPlayer: GameId<'players'>, relationship: any) {
    const key = `${fromPlayer}-${toPlayer}`;
    this.relationshipCache.set(key, relationship);
  }
  
  // Get cached reputation or load from cache
  getCachedReputation(playerId: GameId<'players'>): any {
    if (!this.reputationCache.has(playerId)) {
      // In a real implementation, this would load from DB
      // For now, return default reputation
      return {
        globalRespect: 0,
        dangerLevel: 0,
        reliability: 0,
        robberyCount: 0,
        combatWins: 0,
        combatLosses: 0,
        successfulTrades: 0,
      };
    }
    return this.reputationCache.get(playerId);
  }
  
  // Clear caches (call periodically to prevent memory issues)
  clearRelationshipCaches() {
    // Keep only the most recently used 100 relationships
    if (this.relationshipCache.size > 100) {
      const entries = Array.from(this.relationshipCache.entries());
      this.relationshipCache.clear();
      entries.slice(-100).forEach(([key, value]) => {
        this.relationshipCache.set(key, value);
      });
    }
  }

  handleInput<Name extends InputNames>(now: number, name: Name, args: InputArgs<Name>) {
    const handler = inputs[name]?.handler;
    if (!handler) {
      throw new Error(`Invalid input: ${name}`);
    }
    
    // Handle activity logging for specific input types
    if (name === 'startConversation' && 'playerId' in args && 'invitee' in args) {
      const playerId = args.playerId as string;
      const inviteeId = args.invitee as string;
      const player = this.world.players.get(playerId as any);
      const invitee = this.world.players.get(inviteeId as any);
      const playerDesc = this.playerDescriptions.get(playerId as any);
      const inviteeDesc = this.playerDescriptions.get(inviteeId as any);
      
      if (player && invitee && playerDesc && inviteeDesc) {
        // Log conversation start will be handled after successful creation
        // Store pending log data for after handler execution
        this.pendingActivityLog = {
          type: 'conversation_start',
          playerId,
          inviteeId,
          playerName: playerDesc.name,
          inviteeName: inviteeDesc.name
        };
      }
    }
    
    const result = handler(this, now, args as any);
    
    // Log activity after successful handler execution
    if (this.pendingActivityLog && result) {
      const log = this.pendingActivityLog;
      if (log.type === 'conversation_start') {
        // Schedule the activity log as an operation
        this.scheduleOperation('logConversationStart', {
          worldId: this.worldId,
          playerId: log.playerId,
          inviteeId: log.inviteeId,
          playerName: log.playerName,
          inviteeName: log.inviteeName
        });
      }
      delete this.pendingActivityLog;
    }
    
    return result;
  }

  beginStep(_now: number) {
    // Store the current location of all players in the history tracking buffer.
    this.historicalLocations.clear();
    for (const player of this.world.players.values()) {
      this.historicalLocations.set(
        player.id,
        new HistoricalObject(locationFields, playerLocation(player)),
      );
    }
    this.numPathfinds = 0;
  }

  tick(now: number) {
    for (const player of this.world.players.values()) {
      player.tick(this, now);
    }
    for (const player of this.world.players.values()) {
      player.tickPathfinding(this, now);
    }
    for (const player of this.world.players.values()) {
      player.tickPosition(this, now);
    }
    
    // Validate and clean up conversations before ticking
    const conversationsToRemove: Array<GameId<'conversations'>> = [];
    for (const conversation of this.world.conversations.values()) {
      // Check if all participants still exist
      let isValid = true;
      for (const participantId of conversation.participants.keys()) {
        if (!this.world.players.has(participantId)) {
          console.warn(`Conversation ${conversation.id} has invalid participant ${participantId} - marking for removal`);
          isValid = false;
          break;
        }
      }
      
      if (isValid) {
        // Conversation is valid, tick it
        conversation.tick(this, now);
      } else {
        // Mark for removal after iteration
        conversationsToRemove.push(conversation.id);
      }
    }
    
    // Remove invalid conversations
    for (const conversationId of conversationsToRemove) {
      console.log(`Removing invalid conversation ${conversationId}`);
      this.world.conversations.delete(conversationId);
    }
    
    for (const agent of this.world.agents.values()) {
      agent.tick(this, now);
    }

    // Save each player's location into the history buffer at the end of
    // each tick.
    for (const player of this.world.players.values()) {
      let historicalObject = this.historicalLocations.get(player.id);
      if (!historicalObject) {
        historicalObject = new HistoricalObject(locationFields, playerLocation(player));
        this.historicalLocations.set(player.id, historicalObject);
      }
      historicalObject.update(now, playerLocation(player));
    }
  }

  async saveStep(ctx: ActionCtx, engineUpdate: EngineUpdate): Promise<void> {
    const diff = this.takeDiff();
    // @ts-ignore - Known Convex type depth issue
    await ctx.runMutation(internal.aiTown.game.saveWorld, {
      engineId: this.engine._id,
      engineUpdate,
      worldId: this.worldId,
      worldDiff: diff,
    });
  }

  takeDiff(): GameStateDiff {
    const historicalLocations = [];
    let bufferSize = 0;
    for (const [id, historicalObject] of this.historicalLocations.entries()) {
      const buffer = historicalObject.pack();
      if (!buffer) {
        continue;
      }
      historicalLocations.push({ playerId: id, location: buffer });
      bufferSize += buffer.byteLength;
    }
    if (bufferSize > 0) {
      console.debug(
        `Packed ${Object.entries(historicalLocations).length} history buffers in ${(
          bufferSize / 1024
        ).toFixed(2)}KiB.`,
      );
    }
    this.historicalLocations.clear();

    const result: GameStateDiff = {
      world: { ...this.world.serialize(), historicalLocations },
      agentOperations: this.pendingOperations,
    };
    this.pendingOperations = [];
    if (this.descriptionsModified) {
      result.playerDescriptions = serializeMap(this.playerDescriptions);
      result.agentDescriptions = serializeMap(this.agentDescriptions);
      result.worldMap = this.worldMap.serialize();
      this.descriptionsModified = false;
    }
    return result;
  }

  static async saveDiff(ctx: MutationCtx, worldId: Id<'worlds'>, diff: GameStateDiff) {
    const existingWorld = await ctx.db.get(worldId);
    if (!existingWorld) {
      throw new Error(`No world found with id ${worldId}`);
    }
    const newWorld = diff.world;
    
    
    // Archive newly deleted players, conversations, and agents.
    for (const player of existingWorld.players) {
      if (!newWorld.players.some((p) => p.id === player.id)) {
        await ctx.db.insert('archivedPlayers', { worldId, ...player });
      }
    }
    for (const conversation of existingWorld.conversations) {
      if (!newWorld.conversations.some((c) => c.id === conversation.id)) {
        const participants = conversation.participants.map((p) => p.playerId);
        const archivedConversation = {
          worldId,
          id: conversation.id,
          created: conversation.created,
          creator: conversation.creator,
          ended: Date.now(),
          lastMessage: conversation.lastMessage,
          numMessages: conversation.numMessages,
          participants,
        };
        await ctx.db.insert('archivedConversations', archivedConversation);
        for (let i = 0; i < participants.length; i++) {
          for (let j = 0; j < participants.length; j++) {
            if (i == j) {
              continue;
            }
            const player1 = participants[i];
            const player2 = participants[j];
            await ctx.db.insert('participatedTogether', {
              worldId,
              conversationId: conversation.id,
              player1,
              player2,
              ended: Date.now(),
            });
          }
        }
      }
    }
    for (const conversation of existingWorld.agents) {
      if (!newWorld.agents.some((a) => a.id === conversation.id)) {
        await ctx.db.insert('archivedAgents', { worldId, ...conversation });
      }
    }
    // Update the world state.
    await ctx.db.replace(worldId, newWorld);

    // Update the larger description tables if they changed.
    const { playerDescriptions, agentDescriptions, worldMap } = diff;
    if (playerDescriptions) {
      for (const description of playerDescriptions) {
        const existing = await ctx.db
          .query('playerDescriptions')
          .withIndex('worldId', (q) =>
            q.eq('worldId', worldId).eq('playerId', description.playerId),
          )
          .unique();
        if (existing) {
          await ctx.db.replace(existing._id, { worldId, ...description });
        } else {
          await ctx.db.insert('playerDescriptions', { worldId, ...description });
        }
      }
    }
    if (agentDescriptions) {
      for (const description of agentDescriptions) {
        const existing = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('agentId', description.agentId))
          .unique();
        if (existing) {
          await ctx.db.replace(existing._id, { worldId, ...description });
        } else {
          await ctx.db.insert('agentDescriptions', { worldId, ...description });
        }
      }
    }
    if (worldMap) {
      const existing = await ctx.db
        .query('maps')
        .withIndex('worldId', (q) => q.eq('worldId', worldId))
        .unique();
      if (existing) {
        await ctx.db.replace(existing._id, { worldId, ...worldMap });
      } else {
        await ctx.db.insert('maps', { worldId, ...worldMap });
      }
    }
    // Start the desired agent operations.
    for (const operation of diff.agentOperations) {
      await runAgentOperation(ctx, operation.name, operation.args);
    }
  }
}

export const loadWorld = internalQuery({
  args: {
    worldId: v.id('worlds'),
    generationNumber: v.number(),
  },
  handler: async (ctx, args) => {
    return await Game.load(ctx.db, args.worldId, args.generationNumber);
  },
});

export const worldStatus = internalQuery({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
  },
});

export const getWorldMapDimensions = internalQuery({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const map = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!map) {
      return { width: 48, height: 48 }; // Default dimensions
    }
    return { width: map.width, height: map.height };
  },
});

export const saveWorld = internalMutation({
  args: {
    engineId: v.id('engines'),
    engineUpdate,
    worldId: v.id('worlds'),
    worldDiff: gameStateDiff,
  },
  handler: async (ctx, args) => {
    await applyEngineUpdate(ctx, args.engineId, args.engineUpdate);
    await Game.saveDiff(ctx, args.worldId, args.worldDiff);
  },
});
