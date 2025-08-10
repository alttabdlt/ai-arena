import { ObjectType, v } from 'convex/values';
import { GameId, agentId, parseGameId, playerId } from './ids';
import { internalQuery } from '../_generated/server';

export class AgentDescription {
  agentId: GameId<'agents'>;
  identity: string;
  plan: string;
  aiArenaBotId?: string;
  personality?: 'CRIMINAL' | 'GAMBLER' | 'WORKER';
  avatarRarity?: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

  constructor(serialized: SerializedAgentDescription) {
    const { agentId, identity, plan, aiArenaBotId, personality, avatarRarity } = serialized;
    this.agentId = parseGameId('agents', agentId);
    this.identity = identity;
    this.plan = plan;
    this.aiArenaBotId = aiArenaBotId;
    this.personality = personality;
    this.avatarRarity = avatarRarity;
  }

  serialize(): SerializedAgentDescription {
    const { agentId, identity, plan, aiArenaBotId, personality, avatarRarity } = this;
    return { agentId, identity, plan, aiArenaBotId, personality, avatarRarity };
  }
}

export const serializedAgentDescription = {
  agentId,
  identity: v.string(),
  plan: v.string(),
  aiArenaBotId: v.optional(v.string()),
  personality: v.optional(v.union(v.literal('CRIMINAL'), v.literal('GAMBLER'), v.literal('WORKER'))),
  avatarRarity: v.optional(v.union(
    v.literal('COMMON'),
    v.literal('UNCOMMON'),
    v.literal('RARE'),
    v.literal('EPIC'),
    v.literal('LEGENDARY')
  )),
};
export type SerializedAgentDescription = ObjectType<typeof serializedAgentDescription>;

export const getAgentDescription = internalQuery({
  args: {
    worldId: v.id('worlds'),
    agentId: agentId,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => 
        q.eq('worldId', args.worldId).eq('agentId', args.agentId)
      )
      .first();
  },
});

export const getAgentDescriptionByPlayerId = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    // First find the agent with this playerId
    const world = await ctx.db.get(args.worldId);
    if (!world) return null;
    
    const agent = world.agents.find((a: any) => a.playerId === args.playerId);
    if (!agent) return null;
    
    // Then get the agent description
    return await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => 
        q.eq('worldId', args.worldId).eq('agentId', agent.id)
      )
      .first();
  },
});
