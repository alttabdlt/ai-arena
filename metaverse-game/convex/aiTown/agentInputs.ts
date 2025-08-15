import { ObjectType, v } from 'convex/values';
import { inputHandler } from './inputHandler';
import type { Game } from './game';
import { Agent } from './agent';

export const agentInputs = {
  // Agent decides to do something
  agentDoSomething: inputHandler({
    args: {
      agentId: v.id('agents'),
      activity: v.optional(v.string()),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { agentId, activity } = args;
      
      const agent = game.agentsByPlayerId.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      // Simple activity update - just return success
      // Activity handling is done through the game engine
      
      return { success: true };
    },
  }),

  // Agent sends a message
  agentSendMessage: inputHandler({
    args: {
      agentId: v.id('agents'),
      conversationId: v.id('conversations'),
      text: v.string(),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { agentId, conversationId, text } = args;
      
      const agent = game.agentsByPlayerId.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      // Update conversation
      conversation.lastMessage = {
        author: agent.playerId,
        text,
      };
      conversation.numMessages++;
      
      return { success: true };
    },
  }),

  // Agent changes zone
  agentChangeZone: inputHandler({
    args: {
      agentId: v.id('agents'),
      zone: v.string(),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { agentId, zone } = args;
      
      const agent = game.agentsByPlayerId.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      const player = game.world.players.get(agent.playerId);
      if (!player) {
        throw new Error(`Player ${agent.playerId} not found`);
      }
      
      // Update player's zone
      player.currentZone = zone as any;
      
      return { success: true };
    },
  }),

  // Agent interacts with another player
  agentInteract: inputHandler({
    args: {
      agentId: v.id('agents'),
      targetPlayerId: v.id('players'),
      interactionType: v.string(),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { agentId, targetPlayerId, interactionType } = args;
      
      const agent = game.agentsByPlayerId.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      const targetPlayer = game.world.players.get(targetPlayerId);
      if (!targetPlayer) {
        throw new Error(`Target player ${targetPlayerId} not found`);
      }
      
      // Handle different interaction types
      switch (interactionType) {
        case 'greet':
          // Simple greeting
          break;
        case 'trade':
          // Initiate trade
          break;
        case 'challenge':
          // Challenge to activity
          break;
        default:
          // Generic interaction
          break;
      }
      
      return { success: true };
    },
  }),

  // Agent performs zone activity
  agentZoneActivity: inputHandler({
    args: {
      agentId: v.id('agents'),
      activity: v.string(),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { agentId, activity } = args;
      
      const agent = game.agentsByPlayerId.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      // Activity handling is done through the game engine
      
      return { success: true };
    },
  }),

  // Agent finishes sending a message
  agentFinishSendingMessage: inputHandler({
    args: {
      conversationId: v.id('conversations'),
      agentId: v.id('agents'),
      timestamp: v.number(),
      leaveConversation: v.boolean(),
      operationId: v.string(),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { agentId, conversationId, leaveConversation, operationId } = args;
      
      const agent = game.agentsByPlayerId.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      const conversation = game.world.conversations.get(conversationId);
      if (conversation) {
        // Clear typing status
        conversation.setIsTyping(agent.playerId, false);
        
        // Leave conversation if requested
        if (leaveConversation) {
          conversation.leave(agent.playerId);
        }
      }
      
      // Clear agent's in-progress operation
      if (agent.inProgressOperation?.operationId === operationId) {
        delete agent.inProgressOperation;
      }
      
      return { success: true };
    },
  }),

  // Agent finishes doing something (CRITICAL: This was missing!)
  finishDoSomething: inputHandler({
    args: {
      agentId: v.id('agents'),
      operationId: v.string(),
      destination: v.optional(v.object({ x: v.number(), y: v.number() })),
      activity: v.optional(v.object({
        description: v.string(),
        emoji: v.string(),
        until: v.number(),
      })),
      invitee: v.optional(v.id('players')),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { agentId, operationId, destination, activity, invitee } = args;
      
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        console.error(`Agent ${agentId} not found for finishDoSomething`);
        return null;
      }
      
      const player = game.world.players.get(agent.playerId);
      if (!player) {
        console.error(`Player ${agent.playerId} not found for agent ${agentId}`);
        return null;
      }
      
      // Clear the in-progress operation
      if (agent.inProgressOperation?.operationId === operationId) {
        delete agent.inProgressOperation;
        console.log(`Cleared operation ${operationId} for agent ${agentId}`);
      }
      
      // Handle different outcomes
      if (invitee) {
        // Start a conversation with the invitee
        // Use world.Conversation directly to avoid circular import
        const { Conversation } = require('./world');
        const conversationId = game.allocId('conversations');
        const conversation = new Conversation({
          id: conversationId,
          creator: player.id,
          created: now,
          participants: [player.id, invitee],
          numMessages: 0,
        });
        game.world.conversations.set(conversationId, conversation);
        console.log(`Started conversation ${conversationId} between ${player.id} and ${invitee}`);
      } else if (destination) {
        // Move to destination
        const { movePlayer } = require('./movement');
        movePlayer(game, now, player, destination);
        console.log(`Agent ${agentId} moving to (${destination.x}, ${destination.y})`);
      }
      
      // Set activity if provided
      if (activity) {
        player.activity = activity;
        console.log(`Agent ${agentId} starting activity: ${activity.description}`);
      }
      
      // Update last action timestamps
      agent.lastInviteAttempt = invitee ? now : agent.lastInviteAttempt;
      
      return null;
    },
  }),
};