import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import { WorldMap, serializedWorldMap } from './worldMap';
import { rememberConversation } from '../agent/memory';
import { GameId, agentId, conversationId, playerId } from './ids';
import {
  continueConversationMessage,
  leaveConversationMessage,
  startConversationMessage,
} from '../agent/conversation';
import { assertNever } from '../util/assertNever';
import { serializedAgent } from './agent';
import { ACTIVITIES, ACTIVITY_COOLDOWN, CONVERSATION_COOLDOWN, 
         ROBBERY_COOLDOWN, COMBAT_COOLDOWN, PERSONALITY_BONUS } from '../constants';
import { api, internal } from '../_generated/api';
import { sleep } from '../util/sleep';
import { serializedPlayer } from './player';

export const agentRememberConversation = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    await rememberConversation(
      ctx,
      args.worldId,
      args.agentId as GameId<'agents'>,
      args.playerId as GameId<'players'>,
      args.conversationId as GameId<'conversations'>,
    );
    await sleep(Math.random() * 1000);
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishRememberConversation',
      args: {
        agentId: args.agentId,
        operationId: args.operationId,
      },
    });
  },
});

export const agentGenerateMessage = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    otherPlayerId: playerId,
    operationId: v.string(),
    type: v.union(v.literal('start'), v.literal('continue'), v.literal('leave')),
    messageUuid: v.string(),
  },
  handler: async (ctx, args) => {
    let completionFn;
    switch (args.type) {
      case 'start':
        completionFn = startConversationMessage;
        break;
      case 'continue':
        completionFn = continueConversationMessage;
        break;
      case 'leave':
        completionFn = leaveConversationMessage;
        break;
      default:
        assertNever(args.type);
    }
    const text = await completionFn(
      ctx,
      args.worldId,
      args.conversationId as GameId<'conversations'>,
      args.playerId as GameId<'players'>,
      args.otherPlayerId as GameId<'players'>,
    );

    await ctx.runMutation(internal.aiTown.agent.agentSendMessage, {
      worldId: args.worldId,
      conversationId: args.conversationId,
      agentId: args.agentId,
      playerId: args.playerId,
      text,
      messageUuid: args.messageUuid,
      leaveConversation: args.type === 'leave',
      operationId: args.operationId,
    });
  },
});

export const agentDoSomething = internalAction({
  args: {
    worldId: v.id('worlds'),
    player: v.object(serializedPlayer),
    agent: v.object(serializedAgent),
    map: v.object(serializedWorldMap),
    otherFreePlayers: v.array(v.object(serializedPlayer)),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { player, agent } = args;
    const map = new WorldMap(args.map);
    const now = Date.now();
    // Don't try to start a new conversation if we were just in one.
    const justLeftConversation =
      agent.lastConversation && now < agent.lastConversation + CONVERSATION_COOLDOWN;
    // Don't try again if we recently tried to find someone to invite.
    const recentlyAttemptedInvite =
      agent.lastInviteAttempt && now < agent.lastInviteAttempt + CONVERSATION_COOLDOWN;
    const recentActivity = player.activity && now < player.activity.until + ACTIVITY_COOLDOWN;
    const recentRobbery = agent.lastRobberyAttempt && now < agent.lastRobberyAttempt + ROBBERY_COOLDOWN;
    const recentCombat = agent.lastCombat && now < agent.lastCombat + COMBAT_COOLDOWN;
    const isKnockedOut = agent.knockedOutUntil && now < agent.knockedOutUntil;
    
    // If knocked out, can't do anything
    if (isKnockedOut) {
      await sleep(Math.random() * 1000);
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'finishDoSomething',
        args: {
          operationId: args.operationId,
          agentId: agent.id,
          activity: {
            description: 'recovering in hospital',
            emoji: '🏥',
            until: agent.knockedOutUntil,
          },
        },
      });
      return;
    }
    
    // Decide whether to do crime activities based on zone and personality
    const currentZone = player.currentZone || 'downtown';
    const personality = agent.personality || 'WORKER';
    
    // Criminal activities in appropriate zones
    if (personality === 'CRIMINAL' && currentZone === 'darkAlley' && !recentRobbery && !player.pathfinding) {
      // Look for robbery targets
      const nearbyPlayers = args.otherFreePlayers.filter((p: any) => {
        const distance = Math.sqrt(
          Math.pow(p.position.x - player.position.x, 2) + 
          Math.pow(p.position.y - player.position.y, 2)
        );
        return distance < 5 && p.currentZone === currentZone;
      });
      
      if (nearbyPlayers.length > 0 && Math.random() < 0.3) {
        const target = nearbyPlayers[Math.floor(Math.random() * nearbyPlayers.length)];
        await sleep(Math.random() * 1000);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'startRobbery',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            targetPlayerId: target.id,
          },
        });
        return;
      }
    }
    
    // Combat in underground zone
    if ((personality === 'CRIMINAL' || personality === 'GAMBLER') && 
        currentZone === 'underground' && !recentCombat && !player.pathfinding) {
      const fighters = args.otherFreePlayers.filter((p: any) => 
        p.currentZone === 'underground' && !p.activity
      );
      
      if (fighters.length > 0 && Math.random() < 0.4) {
        const opponent = fighters[Math.floor(Math.random() * fighters.length)];
        await sleep(Math.random() * 1000);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'startCombat',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            opponentId: opponent.id,
          },
        });
        return;
      }
    }
    
    // Decide whether to do an activity or wander somewhere.
    if (!player.pathfinding) {
      if (recentActivity || justLeftConversation) {
        await sleep(Math.random() * 1000);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            destination: wanderDestination(map),
          },
        });
        return;
      } else {
        // Use zone-specific activities
        await ctx.scheduler.runAfter(0, internal.aiTown.agentOperations.agentSelectZoneActivity, {
          worldId: args.worldId,
          agentId: agent.id,
          playerId: player.id,
          zone: currentZone,
          personality: personality,
          operationId: args.operationId,
        });
        return;
      }
    }
    const invitee =
      justLeftConversation || recentlyAttemptedInvite
        ? undefined
        : await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
            now,
            worldId: args.worldId,
            player: args.player,
            otherFreePlayers: args.otherFreePlayers,
          });

    // TODO: We hit a lot of OCC errors on sending inputs in this file. It's
    // easy for them to get scheduled at the same time and line up in time.
    await sleep(Math.random() * 1000);
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishDoSomething',
      args: {
        operationId: args.operationId,
        agentId: args.agent.id,
        invitee,
      },
    });
  },
});

function wanderDestination(worldMap: WorldMap) {
  // Wander someonewhere at least one tile away from the edge.
  return {
    x: 1 + Math.floor(Math.random() * (worldMap.width - 2)),
    y: 1 + Math.floor(Math.random() * (worldMap.height - 2)),
  };
}

// Crime metaverse operations
export const agentAttemptRobbery = internalAction({
  args: {
    worldId: v.id('worlds'),
    agentId: agentId,
    playerId: playerId,
    targetPlayerId: playerId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Simulate robbery attempt
    const agent = await ctx.runQuery(internal.aiTown.agent.getAgent, {
      worldId: args.worldId,
      agentId: args.agentId,
    });
    
    const target = await ctx.runQuery(internal.aiTown.player.getPlayer, {
      worldId: args.worldId,
      playerId: args.targetPlayerId,
    });
    
    // Get agent's player data for equipment
    const agentPlayer = await ctx.runQuery(internal.aiTown.player.getPlayer, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    // Calculate success based on equipment and personality
    const attackPower = (agentPlayer?.equipment?.powerBonus || 0) + 
                       (agent?.personality === 'CRIMINAL' ? 20 : 0);
    const defense = (target?.equipment?.defenseBonus || 0) + 
                   (target?.house?.defenseLevel || 0);
    
    const successChance = Math.max(0.1, Math.min(0.9, 0.5 + (attackPower - defense) / 100));
    const success = Math.random() < successChance;
    
    await sleep(Math.random() * 2000);
    
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishRobbery',
      args: {
        operationId: args.operationId,
        agentId: args.agentId,
        targetPlayerId: args.targetPlayerId,
        success,
        lootValue: success ? Math.floor(Math.random() * 100) + 50 : 0,
      },
    });
  },
});

export const agentEngageCombat = internalAction({
  args: {
    worldId: v.id('worlds'),
    agentId: agentId,
    playerId: playerId,
    opponentId: playerId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Simulate combat
    const agent = await ctx.runQuery(internal.aiTown.agent.getAgent, {
      worldId: args.worldId,
      agentId: args.agentId,
    });
    
    const opponent = await ctx.runQuery(internal.aiTown.player.getPlayer, {
      worldId: args.worldId,
      playerId: args.opponentId,
    });
    
    // Get agent's player data for equipment
    const agentPlayer = await ctx.runQuery(internal.aiTown.player.getPlayer, {
      worldId: args.worldId,
      playerId: args.playerId,
    });
    
    // Calculate combat outcome
    const agentPower = (agentPlayer?.equipment?.powerBonus || 0) + 
                      (agent?.personality === 'CRIMINAL' ? 30 : 10);
    const opponentPower = (opponent?.equipment?.powerBonus || 0) + 20;
    
    const agentWins = Math.random() < (agentPower / (agentPower + opponentPower));
    
    await sleep(Math.random() * 3000);
    
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishCombat',
      args: {
        operationId: args.operationId,
        agentId: args.agentId,
        winnerId: agentWins ? args.playerId : args.opponentId,
        loserId: agentWins ? args.opponentId : args.playerId,
      },
    });
  },
});

export const agentSelectZoneActivity = internalAction({
  args: {
    worldId: v.id('worlds'),
    agentId: agentId,
    playerId: playerId,
    zone: v.union(
      v.literal('casino'),
      v.literal('darkAlley'),
      v.literal('suburb'),
      v.literal('downtown'),
      v.literal('underground')
    ),
    personality: v.union(v.literal('CRIMINAL'), v.literal('GAMBLER'), v.literal('WORKER')),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { CRIME_ACTIVITIES } = await import('../constants');
    
    // Get zone-specific activities
    const zoneActivities = CRIME_ACTIVITIES[args.zone] || [];
    
    // Filter activities by personality preference
    const preferredActivities = zoneActivities.filter(
      activity => activity.personality === args.personality
    );
    
    // Fall back to any activity if no preferred ones
    const availableActivities = preferredActivities.length > 0 ? preferredActivities : zoneActivities;
    
    if (availableActivities.length === 0) {
      // No activities in this zone, just wander
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'finishDoSomething',
        args: {
          operationId: args.operationId,
          agentId: args.agentId,
          activity: null,
        },
      });
      return;
    }
    
    // Select a random activity
    const activity = availableActivities[Math.floor(Math.random() * availableActivities.length)];
    
    await sleep(Math.random() * 1000);
    
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishDoSomething',
      args: {
        operationId: args.operationId,
        agentId: args.agentId,
        activity: {
          description: activity.description,
          emoji: activity.emoji,
          until: Date.now() + activity.duration,
        },
      },
    });
  },
});
