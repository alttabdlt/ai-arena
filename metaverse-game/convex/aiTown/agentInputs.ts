import { v } from 'convex/values';
import { agentId, conversationId, parseGameId } from './ids';
import { Player, activity } from './player';
import { Conversation, conversationInputs } from './conversation';
import { movePlayer } from './movement';
import { inputHandler } from './inputHandler';
import { point } from '../util/types';
import { Descriptions } from '../../data/characters';
import { AgentDescription } from './agentDescription';
import { Agent } from './agent';
import { generateAvatarRarity } from './experience';

export const agentInputs = {
  finishRememberConversation: inputHandler({
    args: {
      operationId: v.string(),
      agentId,
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} isn't remembering ${args.operationId}`);
      } else {
        delete agent.inProgressOperation;
        delete agent.toRemember;
      }
      return null;
    },
  }),
  finishDoSomething: inputHandler({
    args: {
      operationId: v.string(),
      agentId: v.id('agents'),
      destination: v.optional(point),
      invitee: v.optional(v.id('players')),
      activity: v.optional(activity),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} didn't have ${args.operationId} in progress`);
        return null;
      }
      delete agent.inProgressOperation;
      const player = game.world.players.get(agent.playerId)!;
      if (args.invitee) {
        const inviteeId = parseGameId('players', args.invitee);
        const invitee = game.world.players.get(inviteeId);
        if (!invitee) {
          throw new Error(`Couldn't find player: ${inviteeId}`);
        }
        // Stop any current movement when starting a conversation
        if (player.pathfinding) {
          delete player.pathfinding;
        }
        Conversation.start(game, now, player, invitee);
        agent.lastInviteAttempt = now;
        // Don't move if we're starting a conversation
        return null;
      }
      if (args.destination) {
        movePlayer(game, now, player, args.destination);
      }
      if (args.activity) {
        player.activity = args.activity;
        // Log activity start
        const zone = player.currentZone || 'downtown';
        const playerDescription = game.playerDescriptions.get(player.id);
        if (playerDescription) {
          game.scheduleOperation('logActivityStart', {
            worldId: game.worldId,
            playerId: player.id as string,
            playerName: playerDescription.name,
            activity: args.activity.description,
            zone: zone,
          });
        }
      }
      return null;
    },
  }),
  agentFinishSendingMessage: inputHandler({
    args: {
      agentId,
      conversationId,
      timestamp: v.number(),
      operationId: v.string(),
      leaveConversation: v.boolean(),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      const player = game.world.players.get(agent.playerId);
      if (!player) {
        throw new Error(`Couldn't find player: ${agent.playerId}`);
      }
      const conversationId = parseGameId('conversations', args.conversationId);
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Couldn't find conversation: ${conversationId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} wasn't sending a message ${args.operationId}`);
        return null;
      }
      delete agent.inProgressOperation;
      conversationInputs.finishSendingMessage.handler(game, now, {
        playerId: agent.playerId,
        conversationId: args.conversationId,
        timestamp: args.timestamp,
      });
      if (args.leaveConversation) {
        conversation.leave(game, now, player);
      }
      return null;
    },
  }),
  createAgent: inputHandler({
    args: {
      descriptionIndex: v.number(),
    },
    handler: (game, now, args) => {
      const description = Descriptions[args.descriptionIndex];
      const playerId = Player.join(
        game,
        now,
        description.name,
        description.character,
        description.identity,
      );
      const agentId = game.allocId('agents');
      game.world.agents.set(
        agentId,
        new Agent({
          id: agentId,
          playerId: playerId,
          inProgressOperation: undefined,
          lastConversation: undefined,
          lastInviteAttempt: undefined,
          toRemember: undefined,
        }),
      );
      game.agentDescriptions.set(
        agentId,
        new AgentDescription({
          agentId: agentId,
          identity: description.identity,
          plan: description.plan,
        }),
      );
      return { agentId };
    },
  }),
  createAgentWithPersonality: inputHandler({
    args: {
      name: v.string(),
      character: v.string(),
      identity: v.string(),
      plan: v.string(),
      aiArenaBotId: v.string(),
      initialZone: v.string(),
      personality: v.optional(v.union(
        v.literal('CRIMINAL'),
        v.literal('GAMBLER'),
        v.literal('WORKER')
      )),
    },
    handler: (game, now, args) => {
      // Create player with the provided details
      const playerId = Player.join(
        game,
        now,
        args.name,
        args.character,
        `A ${args.personality || 'mysterious'} bot from AI Arena`,
      );
      
      // Allocate agent ID
      const agentId = game.allocId('agents');
      
      // Create agent with AI Arena bot reference and personality
      game.world.agents.set(
        agentId,
        new Agent({
          id: agentId,
          playerId: playerId,
          aiArenaBotId: args.aiArenaBotId,
          personality: args.personality,
          inProgressOperation: undefined,
          lastConversation: undefined,
          lastInviteAttempt: undefined,
          toRemember: undefined,
        }),
      );
      
      // Set agent description with AI Arena bot ID
      game.agentDescriptions.set(
        agentId,
        new AgentDescription({
          agentId: agentId,
          identity: args.identity,
          plan: args.plan,
          aiArenaBotId: args.aiArenaBotId,
        }),
      );
      
      // Set initial zone for the player
      const player = game.world.players.get(playerId);
      if (player) {
        player.currentZone = args.initialZone as any;
      }
      
      console.log(`Created bot ${args.name} (${args.personality}) with agent ${agentId} and player ${playerId}`);
      return { agentId, playerId };
    },
  }),
  
  // Keep the old handler for backward compatibility
  createAgentFromAIArena: inputHandler({
    args: {
      name: v.string(),
      character: v.string(),
      identity: v.string(),
      plan: v.string(),
      aiArenaBotId: v.string(),
      initialZone: v.string(),
      avatar: v.optional(v.string()),
    },
    handler: (game, now, args) => {
      // Create a more descriptive description based on identity
      const description = args.identity ? 
        args.identity.slice(0, 200) : // Use first 200 chars of identity
        `A bot from AI Arena playing as ${args.character}`;
      
      // Player.join creates the player AND the player description
      const playerId = Player.join(
        game,
        now,
        args.name,
        args.character,
        description,
        undefined, // No token identifier for bots
        args.avatar, // Pass avatar if provided
      );
      
      const agentId = game.allocId('agents');
      
      // Generate avatar rarity for this bot
      const avatarRarity = generateAvatarRarity();
      
      // Determine personality - derive from identity keywords
      let personality: 'CRIMINAL' | 'GAMBLER' | 'WORKER' = 'WORKER';
      const identityLower = args.identity.toLowerCase();
      if (identityLower.includes('criminal') || identityLower.includes('thief') || identityLower.includes('robber')) {
        personality = 'CRIMINAL';
      } else if (identityLower.includes('gambler') || identityLower.includes('risk') || identityLower.includes('casino')) {
        personality = 'GAMBLER';
      }
      
      game.world.agents.set(
        agentId,
        new Agent({
          id: agentId,
          playerId: playerId,
          aiArenaBotId: args.aiArenaBotId,
          personality: personality,
          inProgressOperation: undefined,
          lastConversation: undefined,
          lastInviteAttempt: undefined,
          toRemember: undefined,
        }),
      );
      
      game.agentDescriptions.set(
        agentId,
        new AgentDescription({
          agentId: agentId,
          identity: args.identity,
          plan: args.plan,
          aiArenaBotId: args.aiArenaBotId,
          personality: personality,
          avatarRarity: avatarRarity as any,
        }),
      );
      
      // Mark that descriptions were modified so they get saved
      game.descriptionsModified = true;
      
      const player = game.world.players.get(playerId);
      if (player) {
        player.currentZone = args.initialZone as any;
      }
      
      console.log(`Created bot ${args.name} with agent ${agentId} and player ${playerId}`);
      console.log(`Player description created for ${args.name}`);
      return { agentId, playerId };
    },
  }),
  
  // Crime metaverse input handlers
  startRobbery: inputHandler({
    args: {
      operationId: v.string(),
      agentId: v.id('agents'),
      targetPlayerId: v.id('players'),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Invalid agent ID: ${agentId}`);
      }
      
      agent.startOperation(game, now, 'agentAttemptRobbery', {
        worldId: game.worldId,
        agentId: agent.id,
        playerId: agent.playerId,
        targetPlayerId: args.targetPlayerId,
      });
      
      return null;
    },
  }),
  
  finishRobbery: inputHandler({
    args: {
      operationId: v.string(),
      agentId: v.id('agents'),
      targetPlayerId: v.id('players'),
      success: v.boolean(),
      lootValue: v.number(),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Invalid agent ID: ${agentId}`);
      }
      
      agent.lastRobberyAttempt = now;
      if (agent.inProgressOperation?.operationId === args.operationId) {
        delete agent.inProgressOperation;
      }
      
      // Schedule relationship update for robbery
      game.scheduleOperation('processRobberyRelationship', {
        worldId: game.worldId,
        robberId: agent.playerId as string,
        victimId: args.targetPlayerId as string,
        success: args.success,
        lootValue: args.lootValue,
        robberPersonality: agent.personality,
      });
      
      // TODO: Update AI Arena backend with robbery result
      // TODO: Transfer items/currency if successful
      
      return null;
    },
  }),
  
  startCombat: inputHandler({
    args: {
      operationId: v.string(),
      agentId: v.id('agents'),
      opponentId: v.id('players'),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Invalid agent ID: ${agentId}`);
      }
      
      agent.startOperation(game, now, 'agentEngageCombat', {
        worldId: game.worldId,
        agentId: agent.id,
        playerId: agent.playerId,
        opponentId: args.opponentId,
      });
      
      return null;
    },
  }),
  
  finishCombat: inputHandler({
    args: {
      operationId: v.string(),
      agentId: v.id('agents'),
      winnerId: v.id('players'),
      loserId: v.id('players'),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Invalid agent ID: ${agentId}`);
      }
      
      agent.lastCombat = now;
      if (agent.inProgressOperation?.operationId === args.operationId) {
        delete agent.inProgressOperation;
      }
      
      // Handle knockout for loser
      const loserAgent = [...game.world.agents.values()].find(a => a.playerId === args.loserId as any);
      if (loserAgent) {
        const { HOSPITAL_RECOVERY } = require('../constants');
        loserAgent.knockedOutUntil = now + HOSPITAL_RECOVERY;
      }
      
      // Find winner agent for personality
      const winnerAgent = [...game.world.agents.values()].find(a => a.playerId === args.winnerId as any);
      
      // Schedule relationship update for combat
      game.scheduleOperation('processCombatRelationship', {
        worldId: game.worldId,
        winnerId: args.winnerId as string,
        loserId: args.loserId as string,
        winnerPersonality: winnerAgent?.personality,
        loserPersonality: loserAgent?.personality,
      });
      
      // TODO: Update AI Arena backend with combat result
      // TODO: Award experience/items to winner
      
      return null;
    },
  }),
  
  updatePlayerEquipment: inputHandler({
    args: {
      playerId: v.id('players'),
      timestamp: v.number(),
      powerBonus: v.optional(v.number()),
      defenseBonus: v.optional(v.number()),
    },
    handler: (game, now, args) => {
      const playerId = parseGameId('players', args.playerId);
      const player = game.world.players.get(playerId);
      if (!player) {
        throw new Error(`Invalid player ID: ${playerId}`);
      }
      
      // Update player equipment stats
      if (args.powerBonus !== undefined && args.defenseBonus !== undefined) {
        player.equipment = {
          powerBonus: args.powerBonus,
          defenseBonus: args.defenseBonus,
        };
      }
      
      console.log(`Equipment updated for player ${playerId}: Power ${player.equipment?.powerBonus || 0}, Defense ${player.equipment?.defenseBonus || 0}`);
      
      return null;
    },
  }),
};
