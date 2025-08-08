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
import { calculateRelationshipScore } from './relationshipService';

export const agentRememberConversation = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await rememberConversation(
        ctx,
        args.worldId,
        args.agentId as GameId<'agents'>,
        args.playerId as GameId<'players'>,
        args.conversationId as GameId<'conversations'>,
      );
    } catch (error) {
      console.error(`Failed to remember conversation for agent ${args.agentId}:`, error);
      // Continue anyway - we don't want to block the agent
    }
    
    // Increased delay to reduce OCC errors
    await sleep(Math.random() * 5000 + 1000); // 1-6 seconds
    // @ts-ignore - TypeScript type depth issue with generated Convex API
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
    try {
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
    } catch (error) {
      console.error(`Failed to generate message for agent ${args.agentId}:`, error);
      // Send a generic fallback message so the conversation doesn't get stuck
      const fallbackText = args.type === 'leave' ? "I have to go now." : 
                          args.type === 'start' ? "Hello there!" : 
                          "That's interesting.";
      
      await ctx.runMutation(internal.aiTown.agent.agentSendMessage, {
        worldId: args.worldId,
        conversationId: args.conversationId,
        agentId: args.agentId,
        playerId: args.playerId,
        text: fallbackText,
        messageUuid: args.messageUuid,
        leaveConversation: args.type === 'leave',
        operationId: args.operationId,
      });
    }
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
      // Increased delay to reduce OCC errors
    await sleep(Math.random() * 5000 + 1000); // 1-6 seconds
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
    
    // Check if just recovered from being knocked out
    if (agent.knockedOutUntil && now >= agent.knockedOutUntil) {
      // Log hospital recovery (will log multiple times but that's ok for now)
      // Would need to add hasLoggedRecovery field to persist this state
      const playerName = `Player ${player.id.slice(0, 4)}`;
      
      await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
        worldId: args.worldId,
        playerId: player.id,
        agentId: agent.id,
        type: 'hospital_recovery',
        description: `${playerName} recovered and left the hospital`,
        emoji: '🏥',
      });
    }
    
    // Decide whether to do crime activities based on zone and personality
    const currentZone = player.currentZone || 'downtown';
    const personality = agent.personality || 'WORKER';
    
    // Criminal activities in appropriate zones
    if (personality === 'CRIMINAL' && currentZone === 'darkAlley' && !recentRobbery && !player.pathfinding) {
      // Look for robbery targets and assess their value
      const nearbyPlayers = args.otherFreePlayers.filter((p: any) => {
        const distance = Math.sqrt(
          Math.pow(p.position.x - player.position.x, 2) + 
          Math.pow(p.position.y - player.position.y, 2)
        );
        return distance < 5 && p.currentZone === currentZone;
      });
      
      if (nearbyPlayers.length > 0 && Math.random() < 0.3) {
        // Assess potential targets based on wealth, defense, and relationships
        const targetAssessments = await Promise.all(nearbyPlayers.map(async (p) => {
          // Get inventory value for this player
          const inventory = await ctx.runQuery(internal.aiTown.inventory.getPlayerInventoryInternal, {
            worldId: args.worldId,
            playerId: p.id,
          });
          
          // Get relationship with this player
          const relationship = await ctx.runQuery(internal.aiTown.relationshipService.getRelationship, {
            worldId: args.worldId,
            fromPlayer: player.id,
            toPlayer: p.id,
          });
          
          // Calculate perceived value based on visible indicators
          const equipmentValue = (p.equipment?.powerBonus || 0) + (p.equipment?.defenseBonus || 0);
          const inventoryValue = inventory?.inventory?.totalValue || 0;
          const defenseRisk = (p.equipment?.defenseBonus || 0) * 2; // Higher defense = higher risk
          
          // Base score from equipment and inventory
          let score = (equipmentValue * 10 + inventoryValue * 0.1) - defenseRisk;
          
          // Apply relationship modifiers
          const relationshipModifier = calculateRelationshipScore(relationship, 'robbery');
          score = score * (relationshipModifier / 100); // Convert to multiplier
          
          return { player: p, score, inventoryValue, relationship };
        }));
        
        // Sort by score and pick the best target (or randomly from top 3 if multiple good targets)
        targetAssessments.sort((a, b) => b.score - a.score);
        const topTargets = targetAssessments.slice(0, 3).filter(t => t.score > 0);
        
        if (topTargets.length > 0) {
          const targetData = topTargets[Math.floor(Math.random() * topTargets.length)];
          
          // Increased delay to reduce OCC errors
    await sleep(Math.random() * 5000 + 1000); // 1-6 seconds
          await ctx.runMutation(api.aiTown.main.sendInput, {
            worldId: args.worldId,
            name: 'startRobbery',
            args: {
              operationId: args.operationId,
              agentId: agent.id,
              targetPlayerId: targetData.player.id,
            },
          });
          
          // Log the assessment
          await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
            worldId: args.worldId,
            playerId: player.id,
            agentId: agent.id,
            type: 'activity_start',
            description: `Eyeing target with estimated ${targetData.inventoryValue} value`,
            emoji: '👀',
            details: {
              targetPlayer: targetData.player.id,
            },
          });
          
          return;
        }
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
        // Increased delay to reduce OCC errors
    await sleep(Math.random() * 5000 + 1000); // 1-6 seconds
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
    // CRITICAL FIX: Always try to move, even if already pathfinding (clears stuck states)
    const shouldMove = Math.random() < 0.7; // 70% chance to move
    
    if (shouldMove || recentActivity || justLeftConversation || player.pathfinding) {
      // Move to a random location
      const destination = wanderDestination(map);
      
      // 30% chance to also do a short activity while moving
      const shouldAlsoDoActivity = Math.random() < 0.3 && !recentActivity;
      
      // Increased delay to reduce OCC errors
    await sleep(Math.random() * 5000 + 1000); // 1-6 seconds
      
      if (shouldAlsoDoActivity) {
        // Use zone-specific activities with movement
        await ctx.scheduler.runAfter(0, internal.aiTown.agentOperations.agentSelectZoneActivity, {
          worldId: args.worldId,
          agentId: agent.id,
          playerId: player.id,
          zone: currentZone,
          personality: personality,
          operationId: args.operationId,
        });
      } else {
        // Just move without activity - this will clear any stuck pathfinding
        // Already have sleep above at line 296
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            destination: destination,
          },
        });
      }
      return;
    } else {
      // 30% chance to do activity (with movement included from our fix above)
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
    // Increase random delay to better distribute operations
    const conversationOffset = parseInt(args.agent.id.split(':')[1]) % 2000;
    await sleep(Math.random() * 5000 + 1000 + conversationOffset); // 1-8 seconds with offset
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
    
    // Calculate success based on equipment, personality, and zone
    const personalityBonus = PERSONALITY_BONUS[agent?.personality as keyof typeof PERSONALITY_BONUS || 'WORKER']?.robbery || 0;
    const zoneModifier = agentPlayer?.currentZone === 'darkAlley' ? 0.15 : 
                        agentPlayer?.currentZone === 'casino' ? 0.05 :
                        agentPlayer?.currentZone === 'suburb' ? -0.10 : 0;
    
    const attackPower = (agentPlayer?.equipment?.powerBonus || 0) * (1 + personalityBonus);
    const defense = (target?.equipment?.defenseBonus || 0) + 
                   (target?.house?.defenseLevel || 0) * 2; // House defense counts double
    
    // Base success chance modified by power differential and zone
    const powerDifferential = (attackPower - defense) / 50;
    const baseChance = 0.4 + powerDifferential + zoneModifier;
    const successChance = Math.max(0.05, Math.min(0.85, baseChance));
    
    const success = Math.random() < successChance;
    
    // Calculate loot based on target's inventory value
    const targetInventory = await ctx.runQuery(internal.aiTown.inventory.getPlayerInventoryInternal, {
      worldId: args.worldId,
      playerId: args.targetPlayerId,
    });
    
    const maxLoot = Math.floor((targetInventory?.inventory?.totalValue || 100) * 0.2); // Can steal up to 20%
    const lootValue = success ? Math.floor(Math.random() * maxLoot) + 10 : 0;
    
    // Increased delay to reduce OCC errors
    await sleep(Math.random() * 5000 + 2000); // 2-7 seconds
    
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishRobbery',
      args: {
        operationId: args.operationId,
        agentId: args.agentId,
        targetPlayerId: args.targetPlayerId,
        success,
        lootValue,
      },
    });
    
    // Log the robbery attempt
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      agentId: args.agentId,
      type: 'robbery_attempt',
      description: success ? 
        `Successfully robbed player for ${lootValue} value` : 
        `Failed robbery attempt against player`,
      emoji: success ? '💰' : '❌',
      details: {
        targetPlayer: args.targetPlayerId,
        success,
        amount: lootValue,
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
    
    // Get player names for logging
    // For now just use generic names, would need to query player descriptions properly
    const agentName = `Player ${args.playerId.slice(0, 4)}`;
    const opponentName = `Player ${args.opponentId.slice(0, 4)}`;
    
    // Log combat start
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      agentId: args.agentId,
      type: 'combat',
      description: `${agentName} engaged in combat with ${opponentName}`,
      emoji: '⚔️',
      details: {
        targetPlayer: args.opponentId,
      },
    });
    
    // Increased delay to reduce OCC errors
    await sleep(Math.random() * 5000 + 2000); // 2-7 seconds
    
    // Log combat result
    if (agentWins) {
      await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
        worldId: args.worldId,
        playerId: args.playerId,
        agentId: args.agentId,
        type: 'combat',
        description: `${agentName} won the fight against ${opponentName}!`,
        emoji: '🏆',
        details: {
          targetPlayer: args.opponentId,
          success: true,
        },
      });
      
      // Log knock-out for the loser
      await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
        worldId: args.worldId,
        playerId: args.opponentId,
        type: 'knocked_out',
        description: `${opponentName} was knocked out by ${agentName}`,
        emoji: '💀',
        details: {
          targetPlayer: args.playerId,
        },
      });
    } else {
      await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
        worldId: args.worldId,
        playerId: args.playerId,
        agentId: args.agentId,
        type: 'knocked_out',
        description: `${agentName} was knocked out by ${opponentName}`,
        emoji: '💀',
        details: {
          targetPlayer: args.opponentId,
        },
      });
    }
    
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
    
    // Get world map dimensions for wandering
    const world = await ctx.runQuery(internal.aiTown.game.getWorldMapDimensions, {
      worldId: args.worldId,
    });
    
    // Generate a random destination for movement
    const destination = {
      x: 1 + Math.floor(Math.random() * ((world?.width || 48) - 2)),
      y: 1 + Math.floor(Math.random() * ((world?.height || 48) - 2)),
    };
    
    if (availableActivities.length === 0) {
      // No activities in this zone, just wander
      // Increased delay to reduce OCC errors
      await sleep(Math.random() * 5000 + 2000); // 2-7 seconds
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'finishDoSomething',
        args: {
          operationId: args.operationId,
          agentId: args.agentId,
          destination: destination,  // Move to random location
          activity: null,
        },
      });
      return;
    }
    
    // Select a random activity
    const activity = availableActivities[Math.floor(Math.random() * availableActivities.length)];
    
    // Increased delay to reduce OCC errors
    await sleep(Math.random() * 5000 + 1000); // 1-6 seconds
    
    // CRITICAL FIX: Include BOTH destination AND activity
    // Bot will move to the destination THEN do the activity there
    // Add random delay to prevent OCC errors
    // Increased delay to reduce OCC errors
    await sleep(Math.random() * 5000 + 2000); // 2-7 seconds
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishDoSomething',
      args: {
        operationId: args.operationId,
        agentId: args.agentId,
        destination: destination,  // Move to random location
        activity: {
          description: activity.description,
          emoji: activity.emoji,
          until: Date.now() + activity.duration,
        },
      },
    });
  },
});

// Activity logging operation handlers
export const logConversationStart = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    inviteeId: v.string(),
    playerName: v.string(),
    inviteeName: v.string(),
  },
  handler: async (ctx, args) => {
    // Create activity hooks instance and log the conversation start
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      type: 'conversation_start',
      description: `${args.playerName} started a conversation with ${args.inviteeName}`,
      emoji: '💬',
      details: {
        targetPlayer: args.inviteeId,
      },
    });
  },
});

export const logConversationEnd = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    playerName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      type: 'conversation_end',
      description: `${args.playerName} ended the conversation`,
      emoji: '👋',
    });
  },
});

export const logActivityStart = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    playerName: v.string(),
    activity: v.string(),
    zone: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      type: 'activity_start',
      description: `${args.playerName} started ${args.activity} in ${args.zone}`,
      emoji: '🎯',
      details: {
        zone: args.zone,
        message: args.activity,
      },
    });
  },
});

export const logZoneChange = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    playerName: v.string(),
    fromZone: v.string(),
    toZone: v.string(),
  },
  handler: async (ctx, args) => {
    // Zone-specific emojis
    const zoneEmojis: Record<string, string> = {
      casino: '🎲',
      darkAlley: '🌃',
      suburb: '🏠',
      underground: '⚔️',
      downtown: '🏙️',
    };
    
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      type: 'zone_change',
      description: `${args.playerName} entered ${args.toZone.charAt(0).toUpperCase() + args.toZone.slice(1).replace(/([A-Z])/g, ' $1')}`,
      emoji: zoneEmojis[args.toZone] || '🚶',
      details: {
        zone: args.toZone,
      },
    });
  },
});

export const logActivityEnd = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    agentId: v.optional(v.string()),
    playerName: v.string(),
    activity: v.string(),
    zone: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: args.worldId,
      playerId: args.playerId,
      agentId: args.agentId,
      type: 'activity_end',
      description: `${args.playerName} finished ${args.activity}`,
      emoji: '✅',
      details: {
        zone: args.zone,
        message: args.activity,
      },
    });
  },
});
