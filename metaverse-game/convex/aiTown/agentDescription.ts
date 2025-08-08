import { ObjectType, v } from 'convex/values';
import { GameId, agentId, parseGameId } from './ids';

export class AgentDescription {
  agentId: GameId<'agents'>;
  identity: string;
  plan: string;
  aiArenaBotId?: string;

  constructor(serialized: SerializedAgentDescription) {
    const { agentId, identity, plan, aiArenaBotId } = serialized;
    this.agentId = parseGameId('agents', agentId);
    this.identity = identity;
    this.plan = plan;
    this.aiArenaBotId = aiArenaBotId;
  }

  serialize(): SerializedAgentDescription {
    const { agentId, identity, plan, aiArenaBotId } = this;
    return { agentId, identity, plan, aiArenaBotId };
  }
}

export const serializedAgentDescription = {
  agentId,
  identity: v.string(),
  plan: v.string(),
  aiArenaBotId: v.optional(v.string()),
};
export type SerializedAgentDescription = ObjectType<typeof serializedAgentDescription>;
