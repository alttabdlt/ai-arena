import { ObjectType, v } from 'convex/values';
import { inputHandler } from './inputHandler';
import type { Game } from './game';
import { Conversation } from './world';

export const conversationInputs = {
  // Start a conversation between two players
  startConversation: inputHandler({
    args: {
      conversationId: v.id('conversations'),
      playerId: v.id('players'),
      invitee: v.id('players'),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { conversationId, playerId, invitee } = args;
      
      // Find or create conversation
      let conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        conversation = new Conversation({
          id: conversationId,
          creator: playerId,
          created: now,
          participants: [playerId, invitee],
          lastMessage: undefined,
          numMessages: 0,
        });
        
        // Add to world conversations
        game.world.conversations.set(conversationId, conversation);
      }
      
      return { conversationId };
    },
  }),

  // Join an existing conversation
  joinConversation: inputHandler({
    args: {
      conversationId: v.id('conversations'),
      playerId: v.id('players'),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { conversationId, playerId } = args;
      
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      conversation.participants.add(playerId);
      
      return { success: true };
    },
  }),

  // Leave a conversation
  leaveConversation: inputHandler({
    args: {
      conversationId: v.id('conversations'),
      playerId: v.id('players'),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { conversationId, playerId } = args;
      
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      conversation.participants.delete(playerId);
      
      // If no participants left, mark as finished
      if (conversation.participants.size === 0) {
        conversation.finished = true;
      }
      
      return { success: true };
    },
  }),

  // Send a message in a conversation
  sendMessage: inputHandler({
    args: {
      conversationId: v.id('conversations'),
      playerId: v.id('players'),
      text: v.string(),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { conversationId, playerId, text } = args;
      
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      if (!conversation.participants.has(playerId)) {
        throw new Error(`Player ${playerId} is not in conversation ${conversationId}`);
      }
      
      // Update conversation
      conversation.lastMessage = {
        author: playerId,
        text,
      };
      conversation.numMessages++;
      conversation.isTyping.delete(playerId);
      
      return { success: true };
    },
  }),

  // Set typing status
  setTyping: inputHandler({
    args: {
      conversationId: v.id('conversations'),
      playerId: v.id('players'),
      isTyping: v.boolean(),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { conversationId, playerId, isTyping } = args;
      
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      if (isTyping) {
        conversation.isTyping.add(playerId);
      } else {
        conversation.isTyping.delete(playerId);
      }
      
      return { success: true };
    },
  }),

  // Finish a conversation
  finishConversation: inputHandler({
    args: {
      conversationId: v.id('conversations'),
      playerId: v.id('players'),
    },
    handler: (game: Game, now: number, args: ObjectType<any>) => {
      const { conversationId, playerId } = args;
      
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      if (!conversation.participants.has(playerId)) {
        throw new Error(`Player ${playerId} is not in conversation ${conversationId}`);
      }
      
      conversation.finished = true;
      
      return { success: true };
    },
  }),
};