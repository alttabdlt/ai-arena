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
      // First try to get player description
      const playerDescription = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', message.author))
        .first();
      
      let authorName: string;
      if (playerDescription?.name) {
        authorName = playerDescription.name;
      } else {
        // Simplified fallback - look for agent with this playerId
        const world = await ctx.db.get(args.worldId);
        if (world) {
          const agent = (world as any).agents?.find((a: any) => a.playerId === message.author);
          if (agent) {
            // Try to find the agent description for the actual bot name
            const agentDesc = await ctx.db
              .query('agentDescriptions')
              .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', agent.id))
              .first();
            
            // Check if there's a bot name stored in the agent's data
            if (agentDesc) {
              // Look up the actual bot name from AI Arena
              // The name should have been stored when the bot was registered
              const botName = agentDesc.identity?.split(' from AI Arena')[0] || 
                            agentDesc.identity?.match(/named (\w+)/)?.[1] || 
                            agentDesc.identity?.match(/^(\w+)/)?.[1];
              
              if (botName && botName !== 'A' && botName !== 'Bot') {
                authorName = botName;
              } else if (agentDesc.aiArenaBotId) {
                // Use a more readable format with the bot ID
                authorName = `Bot #${agentDesc.aiArenaBotId.slice(-4)}`;
              } else {
                authorName = `Bot #${agent.id.slice(-4)}`;
              }
            } else {
              authorName = `Bot #${message.author.slice(-4)}`;
            }
          } else {
            // No agent found - maybe it's an archived player
            const archivedPlayer = await ctx.db
              .query('archivedPlayers')
              .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
              .filter((q) => q.eq(q.field('id'), message.author))
              .first();
            
            if (archivedPlayer) {
              authorName = `Bot (archived)`;
            } else {
              authorName = `Bot #${message.author.slice(-4)}`;
            }
          }
        } else {
          authorName = `Unknown Bot`;
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
    
    // Log the message to activity logs
    const world = await ctx.db.get(args.worldId);
    if (world) {
      const agent = (world as any).agents?.find((a: any) => a.playerId === args.playerId);
      const playerDescription = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
        .first();
      
      const playerName = playerDescription?.name || `Bot #${args.playerId.slice(-4)}`;
      
      await ctx.db.insert('activityLogs', {
        worldId: args.worldId,
        playerId: args.playerId,
        agentId: agent?.id,
        aiArenaBotId: agent?.aiArenaBotId,
        type: 'message' as const,
        description: `${playerName}: ${args.text.substring(0, 100)}${args.text.length > 100 ? '...' : ''}`,
        emoji: '💬',
        timestamp: Date.now(),
        details: {
          message: args.text,
        },
      });
    }
    
    await insertInput(ctx, args.worldId, 'finishSendingMessage', {
      conversationId: args.conversationId as any,
      timestamp: Date.now(),
    });
  },
});
