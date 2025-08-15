import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { ActionCtx, internalQuery } from '../_generated/server';
import { api, internal } from '../_generated/api';
import { GameId, conversationId, playerId } from '../aiTown/ids';

// @ts-ignore - Known Convex type depth issue
const selfInternal = internal.agent.conversation;

// Simple personality-based conversation starters
const CRIMINAL_STARTERS = [
  "Your loot. Now.",
  "This is my turf!",
  "You look like you've got something valuable...",
  "Hand over your best gear.",
  "Wrong neighborhood, pal."
];

const GAMBLER_STARTERS = [
  "Wanna bet on something?",
  "Feeling lucky today?",
  "I'll trade you for that... if you're brave enough.",
  "High risk, high reward - interested?",
  "Let's make this interesting..."
];

const WORKER_STARTERS = [
  "Just trying to make a living...",
  "Please, I don't want any trouble.",
  "Want to trade fairly?",
  "I've got some items if you're interested.",
  "Can we work something out?"
];

// Simple personality-based conversation responses
const CRIMINAL_RESPONSES = [
  "I said hand it over!",
  "Don't make me repeat myself.",
  "You're wasting my time.",
  "Last chance before things get ugly.",
  "This can go easy or hard - your choice."
];

const GAMBLER_RESPONSES = [
  "Come on, live a little!",
  "The odds are in your favor... maybe.",
  "What've you got to lose?",
  "Trust me, this is a good deal.",
  "You miss 100% of the bets you don't take."
];

const WORKER_RESPONSES = [
  "I really need to go...",
  "Please, I have nothing valuable.",
  "Can we just trade and move on?",
  "I'm just trying to survive here.",
  "Take what you want, just leave me alone."
];

// Simple personality-based conversation exits
const CRIMINAL_EXITS = [
  "We're done here.",
  "Don't let me catch you again.",
  "Get lost.",
  "Remember this next time.",
  "Stay out of my way."
];

const GAMBLER_EXITS = [
  "Your loss!",
  "Maybe next time you'll take the bet.",
  "See you at the tables.",
  "Lady Luck awaits!",
  "The house always wins."
];

const WORKER_EXITS = [
  "I need to go...",
  "Thank you for letting me leave.",
  "Goodbye.",
  "I'll be on my way.",
  "Please don't follow me."
];

// Internal wrapper to avoid deep type instantiation
export const getConversationMessages = internalQuery({
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
      if (playerDescription) {
        out.push({ ...message, authorName: playerDescription.name });
      }
    }
    return out;
  },
});

export async function startConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { agent } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  
  // Get personality from agent
  const personality = agent?.identity?.split('personality:')[1]?.split(' ')[0]?.toUpperCase() || 'WORKER';
  
  // Select random bark based on personality
  let barks: string[];
  switch(personality) {
    case 'CRIMINAL':
      barks = CRIMINAL_STARTERS;
      break;
    case 'GAMBLER':
      barks = GAMBLER_STARTERS;
      break;
    case 'WORKER':
    default:
      barks = WORKER_STARTERS;
      break;
  }
  
  return barks[Math.floor(Math.random() * barks.length)];
}

export async function continueConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { agent } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  
  // Get personality from agent
  const personality = agent?.identity?.split('personality:')[1]?.split(' ')[0]?.toUpperCase() || 'WORKER';
  
  // Select random response based on personality
  let responses: string[];
  switch(personality) {
    case 'CRIMINAL':
      responses = CRIMINAL_RESPONSES;
      break;
    case 'GAMBLER':
      responses = GAMBLER_RESPONSES;
      break;
    case 'WORKER':
    default:
      responses = WORKER_RESPONSES;
      break;
  }
  
  return responses[Math.floor(Math.random() * responses.length)];
}

export async function leaveConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { agent } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  
  // Get personality from agent
  const personality = agent?.identity?.split('personality:')[1]?.split(' ')[0]?.toUpperCase() || 'WORKER';
  
  // Select random exit based on personality
  let exits: string[];
  switch(personality) {
    case 'CRIMINAL':
      exits = CRIMINAL_EXITS;
      break;
    case 'GAMBLER':
      exits = GAMBLER_EXITS;
      break;
    case 'WORKER':
    default:
      exits = WORKER_EXITS;
      break;
  }
  
  return exits[Math.floor(Math.random() * exits.length)];
}

export const queryPromptData = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId,
    otherPlayerId: playerId,
    conversationId,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }
    const player = world.players.find((p) => p.id === args.playerId);
    if (!player) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .first();
    
    // If description not found, create a fallback
    let playerName = 'Unknown Bot';
    if (playerDescription) {
      playerName = playerDescription.name;
    } else {
      console.warn(`Player description for ${args.playerId} not found, using fallback`);
      // Try to find the agent to get aiArenaBotId
      const agent = world.agents.find((a) => a.playerId === args.playerId);
      if (agent) {
        const agentDesc = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', agent.id))
          .first();
        if (agentDesc && agentDesc.aiArenaBotId) {
          // Extract bot name from aiArenaBotId if possible
          playerName = `Bot-${agentDesc.aiArenaBotId.slice(-8)}`;
        } else {
          // Use Bot- prefix for better readability
          playerName = `Bot-${args.playerId.slice(-4)}`;
        }
      } else {
        // Use Bot- prefix for better readability
        playerName = `Bot-${args.playerId.slice(-4)}`;
      }
    }
    const otherPlayer = world.players.find((p) => p.id === args.otherPlayerId);
    if (!otherPlayer) {
      throw new Error(`Player ${args.otherPlayerId} not found`);
    }
    const otherPlayerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.otherPlayerId))
      .first();
    
    // If description not found, try to get bot name from agent
    let otherPlayerName = 'Unknown Bot';
    if (otherPlayerDescription) {
      otherPlayerName = otherPlayerDescription.name;
    } else {
      console.warn(`Player description for ${args.otherPlayerId} not found, using fallback`);
      // Try to find the agent to get aiArenaBotId
      const otherAgent = world.agents.find((a) => a.playerId === args.otherPlayerId);
      if (otherAgent) {
        const agentDesc = await ctx.db
          .query('agentDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', otherAgent.id))
          .first();
        if (agentDesc && agentDesc.aiArenaBotId) {
          // Extract bot name from aiArenaBotId if possible - use last 8 chars for readability
          otherPlayerName = `Bot-${agentDesc.aiArenaBotId.slice(-8)}`;
        } else {
          // Use Bot- prefix for better readability
          otherPlayerName = `Bot-${args.otherPlayerId.slice(-4)}`;
        }
      } else {
        // Use Bot- prefix for better readability
        otherPlayerName = `Bot-${args.otherPlayerId.slice(-4)}`;
      }
    }
    const conversation = world.conversations.find((c) => c.id === args.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${args.conversationId} not found`);
    }
    const agent = world.agents.find((a) => a.playerId === args.playerId);
    if (!agent) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const agentDescription = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', agent.id))
      .first();
    if (!agentDescription) {
      console.warn(`Agent description for ${agent.id} not found, using fallback`);
      // Don't throw - continue with fallback description
    }
    const otherAgent = world.agents.find((a) => a.playerId === args.otherPlayerId);
    let otherAgentDescription;
    if (otherAgent) {
      otherAgentDescription = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', otherAgent.id))
        .first();
      if (!otherAgentDescription) {
        console.warn(`Agent description for ${otherAgent.id} not found, using fallback`);
        // Use a fallback description for old/broken agents
        otherAgentDescription = {
          agentId: otherAgent.id,
          identity: `Agent ${otherAgent.id}`,
          plan: 'Just trying to have a conversation',
        };
      }
    }
    const lastTogether = await ctx.db
      .query('participatedTogether')
      .withIndex('edge', (q) =>
        q
          .eq('worldId', args.worldId)
          .eq('player1', args.playerId)
          .eq('player2', args.otherPlayerId),
      )
      // Order by conversation end time descending.
      .order('desc')
      .first();

    let lastConversation = null;
    if (lastTogether) {
      lastConversation = await ctx.db
        .query('archivedConversations')
        .withIndex('worldId', (q) =>
          q.eq('worldId', args.worldId).eq('id', lastTogether.conversationId),
        )
        .first();
      if (!lastConversation) {
        throw new Error(`Conversation ${lastTogether.conversationId} not found`);
      }
    }
    return {
      player: { name: playerName, ...player },
      otherPlayer: { name: otherPlayerName, ...otherPlayer },
      conversation,
      agent: { 
        identity: agentDescription?.identity || `Agent ${agent.id}`, 
        plan: agentDescription?.plan || 'Just trying to have a conversation', 
        ...agent 
      },
      otherAgent: otherAgent && {
        identity: otherAgentDescription!.identity,
        plan: otherAgentDescription!.plan,
        ...otherAgent,
      },
      lastConversation,
    };
  },
});