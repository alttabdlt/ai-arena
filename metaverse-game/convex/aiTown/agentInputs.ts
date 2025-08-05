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
        Conversation.start(game, now, player, invitee);
        agent.lastInviteAttempt = now;
      }
      if (args.destination) {
        movePlayer(game, now, player, args.destination);
      }
      if (args.activity) {
        player.activity = args.activity;
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
  createAgentFromAIArena: inputHandler({
    args: {
      name: v.string(),
      character: v.string(),
      identity: v.string(),
      plan: v.string(),
      aiArenaBotId: v.string(),
      initialZone: v.string(),
    },
    handler: (game, now, args) => {
      // Create player with the provided details
      const playerId = Player.join(
        game,
        now,
        args.name,
        args.character,
        args.identity,
      );
      
      // Allocate agent ID
      const agentId = game.allocId('agents');
      
      // Create agent with AI Arena bot reference
      game.world.agents.set(
        agentId,
        new Agent({
          id: agentId,
          playerId: playerId,
          aiArenaBotId: args.aiArenaBotId,
          inProgressOperation: undefined,
          lastConversation: undefined,
          lastInviteAttempt: undefined,
          toRemember: undefined,
        }),
      );
      
      // Set agent description
      game.agentDescriptions.set(
        agentId,
        new AgentDescription({
          agentId: agentId,
          identity: args.identity,
          plan: args.plan,
        }),
      );
      
      // TODO: Set initial zone position based on initialZone
      // This would involve placing the player in the appropriate zone
      
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
