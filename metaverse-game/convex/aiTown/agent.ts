import { ObjectType, v } from 'convex/values';
import { GameId, parseGameId } from './ids';
import { agentId, conversationId, playerId } from './ids';
import { serializedPlayer } from './player';
import { Game } from './game';
import {
  ACTION_TIMEOUT,
  AWKWARD_CONVERSATION_TIMEOUT,
  CONVERSATION_COOLDOWN,
  CONVERSATION_DISTANCE,
  INVITE_ACCEPT_PROBABILITY,
  INVITE_TIMEOUT,
  MAX_CONVERSATION_DURATION,
  MAX_CONVERSATION_MESSAGES,
  MESSAGE_COOLDOWN,
  MIDPOINT_THRESHOLD,
  PLAYER_CONVERSATION_COOLDOWN,
} from '../constants';
import { FunctionArgs } from 'convex/server';
import { MutationCtx, internalMutation, internalQuery } from '../_generated/server';
import { distance } from '../util/geometry';
import { internal } from '../_generated/api';
import { movePlayer } from './movement';
import { insertInput } from './insertInput';

export class Agent {
  id: GameId<'agents'>;
  playerId: GameId<'players'>;
  aiArenaBotId?: string;
  personality?: 'CRIMINAL' | 'GAMBLER' | 'WORKER';
  toRemember?: GameId<'conversations'>;
  lastConversation?: number;
  lastInviteAttempt?: number;
  lastRobberyAttempt?: number;
  lastCombat?: number;
  knockedOutUntil?: number;
  inProgressOperation?: {
    name: string;
    operationId: string;
    started: number;
  };

  constructor(serialized: SerializedAgent) {
    const { id, aiArenaBotId, personality, lastConversation, lastInviteAttempt, 
            lastRobberyAttempt, lastCombat, knockedOutUntil, inProgressOperation } = serialized;
    const playerId = parseGameId('players', serialized.playerId);
    this.id = parseGameId('agents', id);
    this.playerId = playerId;
    this.aiArenaBotId = aiArenaBotId;
    this.personality = personality;
    this.toRemember =
      serialized.toRemember !== undefined
        ? parseGameId('conversations', serialized.toRemember)
        : undefined;
    this.lastConversation = lastConversation;
    this.lastInviteAttempt = lastInviteAttempt;
    this.lastRobberyAttempt = lastRobberyAttempt;
    this.lastCombat = lastCombat;
    this.knockedOutUntil = knockedOutUntil;
    this.inProgressOperation = inProgressOperation;
  }

  tick(game: Game, now: number) {
    const player = game.world.players.get(this.playerId);
    if (!player) {
      throw new Error(`Invalid player ID ${this.playerId}`);
    }
    if (this.inProgressOperation) {
      if (now < this.inProgressOperation.started + ACTION_TIMEOUT) {
        // Wait on the operation to finish.
        return;
      }
      console.log(`Timing out ${JSON.stringify(this.inProgressOperation)}`);
      delete this.inProgressOperation;
    }
    const conversation = game.world.playerConversation(player);
    const member = conversation?.participants.get(player.id);

    const recentlyAttemptedInvite =
      this.lastInviteAttempt && now < this.lastInviteAttempt + CONVERSATION_COOLDOWN;
    const doingActivity = player.activity && player.activity.until > now;
    if (doingActivity && (conversation || player.pathfinding)) {
      // Log activity interruption before ending it
      const playerDesc = game.playerDescriptions.get(player.id);
      if (playerDesc && player.activity) {
        game.scheduleOperation('logActivityEnd', {
          worldId: game.worldId,
          playerId: player.id as string,
          agentId: this.id as string,
          playerName: playerDesc.name,
          activity: player.activity.description,
          zone: player.currentZone || 'downtown',
        });
      }
      player.activity!.until = now;
    }
    // If we're not in a conversation, do something.
    // If we aren't doing an activity or moving, do something.
    // If we have been wandering but haven't thought about something to do for
    // a while, do something.
    if (!conversation && !doingActivity && (!player.pathfinding || !recentlyAttemptedInvite)) {
      this.startOperation(game, now, 'agentDoSomething', {
        worldId: game.worldId,
        player: player.serialize(),
        otherFreePlayers: [...game.world.players.values()]
          .filter((p) => p.id !== player.id)
          .filter(
            (p) => ![...game.world.conversations.values()].find((c) => c.participants.has(p.id)),
          )
          .map((p) => p.serialize()),
        agent: this.serialize(),
        map: game.worldMap.serialize(),
      });
      return;
    }
    // Check to see if we have a conversation we need to remember.
    if (this.toRemember) {
      // Fire off the action to remember the conversation.
      console.log(`Agent ${this.id} remembering conversation ${this.toRemember}`);
      this.startOperation(game, now, 'agentRememberConversation', {
        worldId: game.worldId,
        playerId: this.playerId,
        agentId: this.id,
        conversationId: this.toRemember,
      });
      delete this.toRemember;
      return;
    }
    if (conversation && member) {
      const [otherPlayerId, otherMember] = [...conversation.participants.entries()].find(
        ([id]) => id !== player.id,
      )!;
      const otherPlayer = game.world.players.get(otherPlayerId)!;
      if (member.status.kind === 'invited') {
        // Accept a conversation with another agent with some probability and with
        // a human unconditionally.
        if (otherPlayer.human || Math.random() < INVITE_ACCEPT_PROBABILITY) {
          console.log(`Agent ${player.id} accepting invite from ${otherPlayer.id}`);
          conversation.acceptInvite(game, player);
          // Stop moving so we can start walking towards the other player.
          if (player.pathfinding) {
            delete player.pathfinding;
          }
        } else {
          console.log(`Agent ${player.id} rejecting invite from ${otherPlayer.id}`);
          conversation.rejectInvite(game, now, player);
        }
        return;
      }
      if (member.status.kind === 'walkingOver') {
        // Leave a conversation if we've been waiting for too long.
        if (member.invited + INVITE_TIMEOUT < now) {
          console.log(`Giving up on invite to ${otherPlayer.id}`);
          conversation.leave(game, now, player);
          return;
        }

        // Don't keep moving around if we're near enough.
        const playerDistance = distance(player.position, otherPlayer.position);
        if (playerDistance < CONVERSATION_DISTANCE) {
          return;
        }

        // Keep moving towards the other player.
        // If we're close enough to the player, just walk to them directly.
        if (!player.pathfinding) {
          let destination;
          if (playerDistance < MIDPOINT_THRESHOLD) {
            destination = {
              x: Math.floor(otherPlayer.position.x),
              y: Math.floor(otherPlayer.position.y),
            };
          } else {
            destination = {
              x: Math.floor((player.position.x + otherPlayer.position.x) / 2),
              y: Math.floor((player.position.y + otherPlayer.position.y) / 2),
            };
          }
          console.log(`Agent ${player.id} walking towards ${otherPlayer.id}...`, destination);
          movePlayer(game, now, player, destination);
        }
        return;
      }
      if (member.status.kind === 'participating') {
        const started = member.status.started;
        if (conversation.isTyping && conversation.isTyping.playerId !== player.id) {
          // Wait for the other player to finish typing.
          return;
        }
        if (!conversation.lastMessage) {
          const isInitiator = conversation.creator === player.id;
          const awkwardDeadline = started + AWKWARD_CONVERSATION_TIMEOUT;
          // Send the first message if we're the initiator or if we've been waiting for too long.
          if (isInitiator || awkwardDeadline < now) {
            // Grab the lock on the conversation and send a "start" message.
            console.log(`${player.id} initiating conversation with ${otherPlayer.id}.`);
            const messageUuid = crypto.randomUUID();
            conversation.setIsTyping(now, player, messageUuid);
            this.startOperation(game, now, 'agentGenerateMessage', {
              worldId: game.worldId,
              playerId: player.id,
              agentId: this.id,
              conversationId: conversation.id,
              otherPlayerId: otherPlayer.id,
              messageUuid,
              type: 'start',
            });
            return;
          } else {
            // Wait on the other player to say something up to the awkward deadline.
            return;
          }
        }
        // See if the conversation has been going on too long and decide to leave.
        const tooLongDeadline = started + MAX_CONVERSATION_DURATION;
        if (tooLongDeadline < now || conversation.numMessages > MAX_CONVERSATION_MESSAGES) {
          console.log(`${player.id} leaving conversation with ${otherPlayer.id}.`);
          const messageUuid = crypto.randomUUID();
          conversation.setIsTyping(now, player, messageUuid);
          this.startOperation(game, now, 'agentGenerateMessage', {
            worldId: game.worldId,
            playerId: player.id,
            agentId: this.id,
            conversationId: conversation.id,
            otherPlayerId: otherPlayer.id,
            messageUuid,
            type: 'leave',
          });
          return;
        }
        // Wait for the awkward deadline if we sent the last message.
        if (conversation.lastMessage.author === player.id) {
          const awkwardDeadline = conversation.lastMessage.timestamp + AWKWARD_CONVERSATION_TIMEOUT;
          if (now < awkwardDeadline) {
            return;
          }
        }
        // Wait for a cooldown after the last message to simulate "reading" the message.
        const messageCooldown = conversation.lastMessage.timestamp + MESSAGE_COOLDOWN;
        if (now < messageCooldown) {
          return;
        }
        // Grab the lock and send a message!
        console.log(`${player.id} continuing conversation with ${otherPlayer.id}.`);
        const messageUuid = crypto.randomUUID();
        conversation.setIsTyping(now, player, messageUuid);
        this.startOperation(game, now, 'agentGenerateMessage', {
          worldId: game.worldId,
          playerId: player.id,
          agentId: this.id,
          conversationId: conversation.id,
          otherPlayerId: otherPlayer.id,
          messageUuid,
          type: 'continue',
        });
        return;
      }
    }
  }

  startOperation(
    game: Game,
    now: number,
    name: AgentOperationName,
    args: any,
  ) {
    if (this.inProgressOperation) {
      throw new Error(
        `Agent ${this.id} already has an operation: ${JSON.stringify(this.inProgressOperation)}`,
      );
    }
    const operationId = game.allocId('operations');
    console.log(`Agent ${this.id} starting operation ${String(name)} (${operationId})`);
    game.scheduleOperation(name as any, { operationId, ...args } as any);
    this.inProgressOperation = {
      name: name as any,
      operationId,
      started: now,
    };
  }

  serialize(): SerializedAgent {
    return {
      id: this.id,
      playerId: this.playerId,
      aiArenaBotId: this.aiArenaBotId,
      personality: this.personality,
      toRemember: this.toRemember,
      lastConversation: this.lastConversation,
      lastInviteAttempt: this.lastInviteAttempt,
      lastRobberyAttempt: this.lastRobberyAttempt,
      lastCombat: this.lastCombat,
      knockedOutUntil: this.knockedOutUntil,
      inProgressOperation: this.inProgressOperation,
    };
  }
}

export const serializedAgent = {
  id: agentId,
  playerId: playerId,
  aiArenaBotId: v.optional(v.string()), // Reference to AI Arena Bot.id
  personality: v.optional(v.union(v.literal('CRIMINAL'), v.literal('GAMBLER'), v.literal('WORKER'))),
  toRemember: v.optional(conversationId),
  lastConversation: v.optional(v.number()),
  lastInviteAttempt: v.optional(v.number()),
  lastRobberyAttempt: v.optional(v.number()),
  lastCombat: v.optional(v.number()),
  knockedOutUntil: v.optional(v.number()),
  inProgressOperation: v.optional(
    v.object({
      name: v.string(),
      operationId: v.string(),
      started: v.number(),
    }),
  ),
};
export type SerializedAgent = ObjectType<typeof serializedAgent>;

type AgentOperationName = 
  | 'agentRememberConversation'
  | 'agentGenerateMessage'
  | 'agentDoSomething'
  | 'agentAttemptRobbery'
  | 'agentEngageCombat'
  | 'agentSelectZoneActivity'
  | 'logConversationStart'
  | 'logConversationEnd'
  | 'logActivityStart'
  | 'logActivityEnd'
  | 'logZoneChange'
  | 'processConversationRelationship'
  | 'processRobberyRelationship'
  | 'processCombatRelationship'
  | 'grantMovementXP'
  | 'generateLootDrop';

export async function runAgentOperation(ctx: MutationCtx, operation: string, args: any) {
  let reference;
  // @ts-ignore - TypeScript type depth issue with generated Convex API
  const operations = internal.aiTown.agentOperations;
  switch (operation) {
    case 'agentRememberConversation':
      reference = operations.agentRememberConversation;
      break;
    case 'agentGenerateMessage':
      reference = operations.agentGenerateMessage;
      break;
    case 'agentDoSomething':
      reference = operations.agentDoSomething;
      break;
    case 'agentAttemptRobbery':
      reference = operations.agentAttemptRobbery;
      break;
    case 'agentEngageCombat':
      reference = operations.agentEngageCombat;
      break;
    case 'agentSelectZoneActivity':
      reference = operations.agentSelectZoneActivity;
      break;
    case 'logConversationStart':
      reference = internal.aiTown.agentOperations.logConversationStart;
      break;
    case 'logConversationEnd':
      reference = internal.aiTown.agentOperations.logConversationEnd;
      break;
    case 'logActivityStart':
      reference = internal.aiTown.agentOperations.logActivityStart;
      break;
    case 'logZoneChange':
      reference = internal.aiTown.agentOperations.logZoneChange;
      break;
    case 'logActivityEnd':
      reference = internal.aiTown.agentOperations.logActivityEnd;
      break;
    case 'processRobberyRelationship':
      reference = internal.aiTown.relationshipService.processInteraction;
      // Transform args for robbery
      args = {
        worldId: args.worldId,
        type: args.success ? 'ROBBERY_SUCCESS' : 'ROBBERY_FAILED',
        actor: { playerId: args.robberId, personality: args.robberPersonality },
        target: { playerId: args.victimId },
        amount: args.lootValue,
      };
      break;
    case 'processCombatRelationship':
      reference = internal.aiTown.relationshipService.processInteraction;
      // Transform args for combat
      args = {
        worldId: args.worldId,
        type: 'COMBAT_WIN',
        actor: { playerId: args.winnerId, personality: args.winnerPersonality },
        target: { playerId: args.loserId, personality: args.loserPersonality },
      };
      break;
    case 'processConversationRelationship':
      reference = internal.aiTown.relationshipService.processInteraction;
      // Pass through args as-is for conversation
      break;
    case 'cleanupPlayerData':
      // Use the comprehensive cleanup function from orphanCleanup
      reference = internal.cleanup.orphanCleanup.comprehensivePlayerCleanup;
      // Transform args to match the function signature
      args = {
        worldId: args.worldId,
        playerId: args.playerId,
        keepActivityLogs: true, // Keep activity logs for audit trail
      };
      break;
    case 'grantMovementXP':
      reference = internal.aiTown.idleLoot.grantMovementXP;
      break;
    case 'generateLootDrop':
      reference = internal.aiTown.idleLoot.generateLootDrop;
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  await ctx.scheduler.runAfter(0, reference, args);
}

export const agentSendMessage = internalMutation({
  args: {
    worldId: v.id('worlds'),
    conversationId,
    agentId,
    playerId,
    text: v.string(),
    messageUuid: v.string(),
    leaveConversation: v.boolean(),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      author: args.playerId,
      text: args.text,
      messageUuid: args.messageUuid,
      worldId: args.worldId,
    });
    
    // Log the message to activity logs for visibility
    const playerName = `Player ${args.playerId.slice(0, 4)}`;
    const messageType = args.leaveConversation ? 'conversation_end' : 'message';
    const emoji = args.leaveConversation ? '👋' : '💬';
    
    await ctx.db.insert('activityLogs', {
      worldId: args.worldId,
      playerId: args.playerId,
      agentId: args.agentId,
      timestamp: Date.now(),
      type: messageType,
      description: args.leaveConversation 
        ? `${playerName} left the conversation`
        : `${playerName}: "${args.text.slice(0, 50)}${args.text.length > 50 ? '...' : ''}"`,
      emoji,
      details: {
        message: args.text,
      },
    });
    
    await insertInput(ctx, args.worldId, 'agentFinishSendingMessage', {
      conversationId: args.conversationId,
      agentId: args.agentId,
      timestamp: Date.now(),
      leaveConversation: args.leaveConversation,
      operationId: args.operationId,
    });
  },
});

export const findConversationCandidate = internalQuery({
  args: {
    now: v.number(),
    worldId: v.id('worlds'),
    player: v.object(serializedPlayer),
    otherFreePlayers: v.array(v.object(serializedPlayer)),
  },
  handler: async (ctx, { now, worldId, player, otherFreePlayers }) => {
    const { position } = player;
    const candidates = [];

    for (const otherPlayer of otherFreePlayers) {
      // Find the latest conversation we're both members of.
      const lastMember = await ctx.db
        .query('participatedTogether')
        .withIndex('edge', (q) =>
          q.eq('worldId', worldId).eq('player1', player.id).eq('player2', otherPlayer.id),
        )
        .order('desc')
        .first();
      if (lastMember) {
        if (now < lastMember.ended + PLAYER_CONVERSATION_COOLDOWN) {
          continue;
        }
      }
      
      // Get relationship with this player
      const relationship = await ctx.db
        .query('relationships')
        .withIndex('fromTo', q => 
          q.eq('worldId', worldId)
           .eq('fromPlayer', player.id)
           .eq('toPlayer', otherPlayer.id)
        )
        .first();
      
      // Skip high-revenge enemies (they wouldn't want to talk)
      if (relationship && relationship.revenge > 70) {
        continue;
      }
      
      // Calculate conversation preference score
      let score = 50; // Base score
      if (relationship) {
        score += relationship.trust * 0.5;     // Talk to trusted players
        score -= relationship.revenge * 2;     // Avoid enemies
        score += relationship.loyalty * 0.3;   // Chat with allies
        score -= relationship.fear * 0.5;      // Slightly avoid feared players
      }
      
      // Factor in distance (closer is better)
      const dist = distance(otherPlayer.position, position);
      score = score * (10 / (dist + 10)); // Distance penalty
      
      candidates.push({ id: otherPlayer.id, position: otherPlayer.position, score });
    }

    // Sort by score and take the best candidate
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.id;
  },
});

export const getAgent = internalQuery({
  args: {
    worldId: v.id('worlds'),
    agentId: agentId,
  },
  handler: async (ctx, { worldId, agentId }) => {
    const world = await ctx.db.get(worldId);
    if (!world) return null;
    
    const agent = world.agents.find(a => a.id === agentId);
    return agent || null;
  },
});
