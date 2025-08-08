import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { insertInput } from './aiTown/insertInput';
import { conversationId, playerId } from './aiTown/ids';

export const listMessages = query({
  args: {
    worldId: v.id('worlds'),
    conversationId,
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('messages')
      .withIndex('conversationId', (q) => q.eq('worldId', args.worldId).eq('conversationId', args.conversationId))
      .collect();
    const out = [];
    for (const message of messages) {
      const playerDescription = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', message.author))
        .first();
      
      let authorName: string;
      if (playerDescription) {
        authorName = playerDescription.name;
      } else {
        // Check if it's an archived player
        const archivedPlayer = await ctx.db
          .query('archivedPlayers')
          .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('id', message.author))
          .first();
        
        if (archivedPlayer) {
          // Try to get archived player's description
          const archivedDescription = await ctx.db
            .query('playerDescriptions')
            .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', archivedPlayer.id))
            .first();
          authorName = archivedDescription?.name || `Player ${message.author}`;
        } else {
          // Fallback for old players without descriptions
          console.warn(`No description found for player ${message.author}, using fallback name`);
          authorName = `Player ${message.author}`;
        }
      }
      
      out.push({ ...message, authorName });
    }
    return out;
  },
});

export const writeMessage = mutation({
  args: {
    worldId: v.id('worlds'),
    conversationId,
    messageUuid: v.string(),
    playerId,
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      author: args.playerId,
      messageUuid: args.messageUuid,
      text: args.text,
      worldId: args.worldId,
    });
    await insertInput(ctx, args.worldId, 'finishSendingMessage', {
      conversationId: args.conversationId,
      playerId: args.playerId,
      timestamp: Date.now(),
    });
  },
});
