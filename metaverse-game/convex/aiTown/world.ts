import { ObjectType, v } from 'convex/values';
import { Player, serializedPlayer } from './player';
import { Agent, serializedAgent } from './agent';
import { GameId, parseGameId, playerId, conversationId } from './ids';
import { parseMap } from '../util/object';

// Conversation type defined inline since conversation module was simplified
export const serializedConversation = {
  id: conversationId,
  creator: playerId,
  created: v.number(),
  participants: v.array(playerId),
  lastMessage: v.optional(v.object({
    author: playerId,
    text: v.string(),
  })),
  numMessages: v.number(),
};

export class Conversation {
  id: GameId<'conversations'>;
  creator: GameId<'players'>;
  created: number;
  participants: Set<GameId<'players'>>;
  lastMessage?: {
    author: GameId<'players'>;
    text: string;
  };
  numMessages: number;
  isTyping: Set<GameId<'players'>>;
  finished: boolean;

  constructor(serialized: ObjectType<typeof serializedConversation>) {
    const { id, creator, created, participants, lastMessage, numMessages } = serialized;
    this.id = parseGameId('conversations', id);
    this.creator = parseGameId('players', creator);
    this.created = created;
    this.participants = new Set(participants.map(p => parseGameId('players', p)));
    if (lastMessage) {
      this.lastMessage = {
        author: parseGameId('players', lastMessage.author),
        text: lastMessage.text,
      };
    }
    this.numMessages = numMessages;
    this.isTyping = new Set();
    this.finished = false;
  }

  tick() {}

  acceptInvite(playerId: GameId<'players'>) {
    this.participants.add(playerId);
  }

  rejectInvite(playerId: GameId<'players'>) {
    // Player rejects invitation - don't add them to participants
    // Could log this rejection if needed
  }

  leave(playerId: GameId<'players'>) {
    this.participants.delete(playerId);
    this.isTyping.delete(playerId);
    if (this.participants.size === 0) {
      this.finished = true;
    }
  }

  stop() {
    this.finished = true;
    this.isTyping.clear();
  }

  setIsTyping(playerId: GameId<'players'>, isTyping: boolean) {
    if (isTyping) {
      this.isTyping.add(playerId);
    } else {
      this.isTyping.delete(playerId);
    }
  }

  serialize(): ObjectType<typeof serializedConversation> {
    return {
      id: this.id,
      creator: this.creator,
      created: this.created,
      participants: [...this.participants],
      lastMessage: this.lastMessage,
      numMessages: this.numMessages,
    };
  }
}

export const historicalLocations = v.array(
  v.object({
    playerId,
    location: v.bytes(),
  }),
);

export const serializedWorld = {
  nextId: v.number(),
  conversations: v.array(v.object(serializedConversation)),
  players: v.array(v.object(serializedPlayer)),
  agents: v.array(v.object(serializedAgent)),
  historicalLocations: v.optional(historicalLocations),
};
export type SerializedWorld = ObjectType<typeof serializedWorld>;

export class World {
  nextId: number;
  conversations: Map<GameId<'conversations'>, Conversation>;
  players: Map<GameId<'players'>, Player>;
  agents: Map<GameId<'agents'>, Agent>;
  historicalLocations?: Map<GameId<'players'>, ArrayBuffer>;

  constructor(serialized: SerializedWorld) {
    const { nextId, historicalLocations } = serialized;

    this.nextId = nextId;
    this.conversations = parseMap(serialized.conversations, Conversation, (c) => c.id);
    this.players = parseMap(serialized.players, Player, (p) => p.id);
    this.agents = parseMap(serialized.agents, Agent, (a) => a.id);

    if (historicalLocations) {
      this.historicalLocations = new Map();
      for (const { playerId, location } of historicalLocations) {
        this.historicalLocations.set(parseGameId('players', playerId), location);
      }
    }
  }

  playerConversation(player: Player): Conversation | undefined {
    return [...this.conversations.values()].find((c) => c.participants.has(player.id));
  }

  serialize(): SerializedWorld {
    return {
      nextId: this.nextId,
      conversations: [...this.conversations.values()].map((c) => c.serialize()),
      players: [...this.players.values()].map((p) => p.serialize()),
      agents: [...this.agents.values()].map((a) => a.serialize()),
      historicalLocations:
        this.historicalLocations &&
        [...this.historicalLocations.entries()].map(([playerId, location]) => ({
          playerId,
          location,
        })),
    };
  }
}
