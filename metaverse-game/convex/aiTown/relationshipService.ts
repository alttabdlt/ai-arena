import { v } from 'convex/values';
import { internalMutation, internalQuery } from '../_generated/server';
import { internal } from '../_generated/api';
import { GameId, playerId } from './ids';

// Default relationship values
export const DEFAULT_RELATIONSHIP = {
  respect: 0,
  fear: 0,
  trust: 0,
  loyalty: 0,
  revenge: 0,
  debt: 0,
};

// Personality modifiers for relationship changes
export const PERSONALITY_MODIFIERS = {
  CRIMINAL: {
    respectWeight: 1.5,   // Values respect highly
    fearWeight: 0.8,      // Less affected by fear
    revengeDecay: 0.95,   // Slow to forgive
    trustGain: 0.5,       // Hard to trust
    loyaltyGain: 0.7,     // Forms tight gangs
  },
  GAMBLER: {
    respectWeight: 1.0,
    fearWeight: 1.2,      // More cautious
    revengeDecay: 0.8,    // Forgives quicker
    trustGain: 1.5,       // Quick to trust for deals
    loyaltyGain: 0.5,     // Less loyal, opportunistic
  },
  WORKER: {
    respectWeight: 0.8,   // Less impressed by crime
    fearWeight: 1.5,      // More affected by fear
    revengeDecay: 0.7,    // Forgives quickly
    trustGain: 1.2,       // Trusts easier
    loyaltyGain: 1.3,     // Very loyal once trust is built
  },
};

// Interaction effect definitions
export const INTERACTION_EFFECTS = {
  ROBBERY_SUCCESS: {
    robber: { 
      respect: 10,
      globalRespect: 5,
      robberyCount: 1,
    },
    victim: { 
      respect: -20,
      fear: 30,
      revenge: 50,
      trust: -40,
      // debt is handled separately based on amount stolen
    },
  },
  ROBBERY_FAILED: {
    robber: {
      respect: -5,
      globalRespect: -2,
    },
    victim: {
      respect: 10,
      fear: -10,
      trust: -20,
      revenge: 20,
    },
  },
  COMBAT_WIN: {
    winner: {
      respect: 15,
      globalRespect: 10,
      combatWins: 1,
      dangerLevel: 5,
    },
    loser: {
      respect: -10,
      fear: 40,
      revenge: 30,
      combatLosses: 1,
    },
  },
  SUCCESSFUL_TRADE: {
    both: {
      trust: 10,
      loyalty: 2,
      successfulTrades: 1,
      reliability: 2,
    },
  },
  CONVERSATION: {
    both: {
      trust: 2,
      // Additional trust based on personality compatibility calculated separately
    },
  },
  BETRAYAL: {
    betrayer: {
      respect: 5,
      globalRespect: -10, // Others lose respect for betrayers
      reliability: -20,
    },
    betrayed: {
      trust: -80,
      revenge: 80,
      loyalty: -100,
    },
  },
};

// Get or create relationship between two players
export const getRelationship = internalQuery({
  args: {
    worldId: v.id('worlds'),
    fromPlayer: playerId,
    toPlayer: playerId,
  },
  handler: async (ctx, args) => {
    const relationship = await ctx.db
      .query('relationships')
      .withIndex('fromTo', q => 
        q.eq('worldId', args.worldId)
         .eq('fromPlayer', args.fromPlayer)
         .eq('toPlayer', args.toPlayer)
      )
      .first();
    
    return relationship || { ...DEFAULT_RELATIONSHIP, _id: null };
  },
});

// Update relationship between two players
export const updateRelationship = internalMutation({
  args: {
    worldId: v.id('worlds'),
    fromPlayer: playerId,
    toPlayer: playerId,
    changes: v.object({
      respect: v.optional(v.number()),
      fear: v.optional(v.number()),
      trust: v.optional(v.number()),
      loyalty: v.optional(v.number()),
      revenge: v.optional(v.number()),
      debt: v.optional(v.number()),
    }),
    personality: v.optional(v.union(
      v.literal('CRIMINAL'),
      v.literal('GAMBLER'),
      v.literal('WORKER')
    )),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('relationships')
      .withIndex('fromTo', q => 
        q.eq('worldId', args.worldId)
         .eq('fromPlayer', args.fromPlayer)
         .eq('toPlayer', args.toPlayer)
      )
      .first();
    
    // Apply personality modifiers to changes
    const modifiers = args.personality ? PERSONALITY_MODIFIERS[args.personality] : null;
    const adjustedChanges = { ...args.changes };
    
    if (modifiers) {
      if (adjustedChanges.respect !== undefined) {
        adjustedChanges.respect *= modifiers.respectWeight;
      }
      if (adjustedChanges.fear !== undefined) {
        adjustedChanges.fear *= modifiers.fearWeight;
      }
      if (adjustedChanges.trust !== undefined && adjustedChanges.trust > 0) {
        adjustedChanges.trust *= modifiers.trustGain;
      }
      if (adjustedChanges.loyalty !== undefined && adjustedChanges.loyalty > 0) {
        adjustedChanges.loyalty *= modifiers.loyaltyGain;
      }
    }
    
    if (existing) {
      // Update existing relationship
      const updated = {
        respect: clamp(existing.respect + (adjustedChanges.respect || 0), -100, 100),
        fear: clamp(existing.fear + (adjustedChanges.fear || 0), 0, 100),
        trust: clamp(existing.trust + (adjustedChanges.trust || 0), -100, 100),
        loyalty: clamp(existing.loyalty + (adjustedChanges.loyalty || 0), 0, 100),
        revenge: clamp(existing.revenge + (adjustedChanges.revenge || 0), 0, 100),
        debt: existing.debt + (adjustedChanges.debt || 0),
        lastInteraction: Date.now(),
        interactionCount: existing.interactionCount + 1,
      };
      
      // Check if relationship should be deleted (all values near default)
      if (isNearDefault(updated)) {
        await ctx.db.delete(existing._id);
      } else {
        await ctx.db.patch(existing._id, updated);
      }
    } else {
      // Create new relationship if values are significant
      const newRelationship = {
        worldId: args.worldId,
        fromPlayer: args.fromPlayer,
        toPlayer: args.toPlayer,
        respect: clamp(adjustedChanges.respect || 0, -100, 100),
        fear: clamp(adjustedChanges.fear || 0, 0, 100),
        trust: clamp(adjustedChanges.trust || 0, -100, 100),
        loyalty: clamp(adjustedChanges.loyalty || 0, 0, 100),
        revenge: clamp(adjustedChanges.revenge || 0, 0, 100),
        debt: adjustedChanges.debt || 0,
        lastInteraction: Date.now(),
        interactionCount: 1,
      };
      
      if (!isNearDefault(newRelationship)) {
        await ctx.db.insert('relationships', newRelationship);
      }
    }
  },
});

// Update global reputation
export const updateReputation = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    changes: v.object({
      globalRespect: v.optional(v.number()),
      dangerLevel: v.optional(v.number()),
      reliability: v.optional(v.number()),
      robberyCount: v.optional(v.number()),
      combatWins: v.optional(v.number()),
      combatLosses: v.optional(v.number()),
      successfulTrades: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('reputations')
      .withIndex('player', q => 
        q.eq('worldId', args.worldId)
         .eq('playerId', args.playerId)
      )
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        globalRespect: existing.globalRespect + (args.changes.globalRespect || 0),
        dangerLevel: Math.max(0, existing.dangerLevel + (args.changes.dangerLevel || 0)),
        reliability: existing.reliability + (args.changes.reliability || 0),
        robberyCount: existing.robberyCount + (args.changes.robberyCount || 0),
        combatWins: existing.combatWins + (args.changes.combatWins || 0),
        combatLosses: existing.combatLosses + (args.changes.combatLosses || 0),
        successfulTrades: existing.successfulTrades + (args.changes.successfulTrades || 0),
        lastUpdated: Date.now(),
      });
    } else {
      await ctx.db.insert('reputations', {
        worldId: args.worldId,
        playerId: args.playerId,
        globalRespect: args.changes.globalRespect || 0,
        dangerLevel: Math.max(0, args.changes.dangerLevel || 0),
        reliability: args.changes.reliability || 0,
        robberyCount: args.changes.robberyCount || 0,
        combatWins: args.changes.combatWins || 0,
        combatLosses: args.changes.combatLosses || 0,
        successfulTrades: args.changes.successfulTrades || 0,
        lastUpdated: Date.now(),
      });
    }
  },
});

// Process interaction between two players
export const processInteraction = internalMutation({
  args: {
    worldId: v.id('worlds'),
    type: v.union(
      v.literal('ROBBERY_SUCCESS'),
      v.literal('ROBBERY_FAILED'),
      v.literal('COMBAT_WIN'),
      v.literal('SUCCESSFUL_TRADE'),
      v.literal('CONVERSATION'),
      v.literal('BETRAYAL')
    ),
    actor: v.object({
      playerId: playerId,
      personality: v.optional(v.union(
        v.literal('CRIMINAL'),
        v.literal('GAMBLER'),
        v.literal('WORKER')
      )),
    }),
    target: v.object({
      playerId: playerId,
      personality: v.optional(v.union(
        v.literal('CRIMINAL'),
        v.literal('GAMBLER'),
        v.literal('WORKER')
      )),
    }),
    amount: v.optional(v.number()), // For robberies and trades
  },
  handler: async (ctx, args) => {
    const effects = INTERACTION_EFFECTS[args.type];
    
    // Handle actor's relationship changes
    if (args.type === 'ROBBERY_SUCCESS' || args.type === 'ROBBERY_FAILED') {
      const robberChanges = (effects as any).robber;
      const victimChanges = (effects as any).victim;
      
      // Update robber's view of victim
      await ctx.runMutation(internal.aiTown.relationshipService.updateRelationship, {
        worldId: args.worldId,
        fromPlayer: args.actor.playerId,
        toPlayer: args.target.playerId,
        changes: {
          respect: robberChanges.respect,
          debt: args.amount ? -args.amount : 0, // Victim "owes" revenge
        },
        personality: args.actor.personality,
      });
      
      // Update victim's view of robber
      await ctx.runMutation(internal.aiTown.relationshipService.updateRelationship, {
        worldId: args.worldId,
        fromPlayer: args.target.playerId,
        toPlayer: args.actor.playerId,
        changes: victimChanges,
        personality: args.target.personality,
      });
      
      // Update reputations
      if (robberChanges.globalRespect) {
        await ctx.runMutation(internal.aiTown.relationshipService.updateReputation, {
          worldId: args.worldId,
          playerId: args.actor.playerId,
          changes: {
            globalRespect: robberChanges.globalRespect,
            robberyCount: robberChanges.robberyCount,
          },
        });
      }
      
    } else if (args.type === 'COMBAT_WIN') {
      const winnerChanges = (effects as any).winner;
      const loserChanges = (effects as any).loser;
      
      // Update winner's view
      await ctx.runMutation(internal.aiTown.relationshipService.updateRelationship, {
        worldId: args.worldId,
        fromPlayer: args.actor.playerId,
        toPlayer: args.target.playerId,
        changes: { respect: winnerChanges.respect },
        personality: args.actor.personality,
      });
      
      // Update loser's view
      await ctx.runMutation(internal.aiTown.relationshipService.updateRelationship, {
        worldId: args.worldId,
        fromPlayer: args.target.playerId,
        toPlayer: args.actor.playerId,
        changes: loserChanges,
        personality: args.target.personality,
      });
      
      // Update reputations
      await ctx.runMutation(internal.aiTown.relationshipService.updateReputation, {
        worldId: args.worldId,
        playerId: args.actor.playerId,
        changes: {
          globalRespect: winnerChanges.globalRespect,
          combatWins: winnerChanges.combatWins,
          dangerLevel: winnerChanges.dangerLevel,
        },
      });
      
      await ctx.runMutation(internal.aiTown.relationshipService.updateReputation, {
        worldId: args.worldId,
        playerId: args.target.playerId,
        changes: { combatLosses: 1 },
      });
      
    } else if (args.type === 'SUCCESSFUL_TRADE' || args.type === 'CONVERSATION') {
      const changes = (effects as any).both;
      
      // Update both directions
      await ctx.runMutation(internal.aiTown.relationshipService.updateRelationship, {
        worldId: args.worldId,
        fromPlayer: args.actor.playerId,
        toPlayer: args.target.playerId,
        changes,
        personality: args.actor.personality,
      });
      
      await ctx.runMutation(internal.aiTown.relationshipService.updateRelationship, {
        worldId: args.worldId,
        fromPlayer: args.target.playerId,
        toPlayer: args.actor.playerId,
        changes,
        personality: args.target.personality,
      });
      
      // Update reputations for trades
      if (args.type === 'SUCCESSFUL_TRADE') {
        await ctx.runMutation(internal.aiTown.relationshipService.updateReputation, {
          worldId: args.worldId,
          playerId: args.actor.playerId,
          changes: {
            successfulTrades: 1,
            reliability: changes.reliability || 0,
          },
        });
        
        await ctx.runMutation(internal.aiTown.relationshipService.updateReputation, {
          worldId: args.worldId,
          playerId: args.target.playerId,
          changes: {
            successfulTrades: 1,
            reliability: changes.reliability || 0,
          },
        });
      }
    }
  },
});

// Decay old relationships and revenge
export const decayRelationships = internalMutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const staleDate = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    
    const stale = await ctx.db
      .query('relationships')
      .withIndex('lastInteraction', q => 
        q.eq('worldId', args.worldId)
         .lt('lastInteraction', staleDate)
      )
      .collect();
    
    for (const rel of stale) {
      // Decay revenge and temporary emotions
      const updated = {
        revenge: rel.revenge * 0.9,
        fear: rel.fear > 50 ? rel.fear - 5 : rel.fear,
        lastInteraction: rel.lastInteraction, // Keep the same to avoid re-processing
      };
      
      // Remove if all values are near default
      if (isNearDefault({ ...rel, ...updated })) {
        await ctx.db.delete(rel._id);
      } else {
        await ctx.db.patch(rel._id, updated);
      }
    }
  },
});

// Get all relationships for a player
export const getPlayerRelationships = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
  },
  handler: async (ctx, args) => {
    const outgoing = await ctx.db
      .query('relationships')
      .withIndex('fromTo', q => 
        q.eq('worldId', args.worldId)
         .eq('fromPlayer', args.playerId)
      )
      .collect();
    
    const incoming = await ctx.db
      .query('relationships')
      .withIndex('toFrom', q => 
        q.eq('worldId', args.worldId)
         .eq('toPlayer', args.playerId)
      )
      .collect();
    
    return { outgoing, incoming };
  },
});

// Calculate relationship score for decision making
export function calculateRelationshipScore(
  relationship: any,
  action: 'robbery' | 'combat' | 'conversation' | 'trade'
): number {
  const r = relationship || DEFAULT_RELATIONSHIP;
  let score = 0;
  
  switch (action) {
    case 'robbery':
      score = 100;
      score -= r.fear * 2;        // Avoid feared players
      score -= r.loyalty * 10;    // Don't rob allies
      score += r.revenge * 3;     // Target enemies
      score -= Math.max(0, r.trust) * 2; // Don't rob trusted players
      break;
      
    case 'combat':
      score = 50;
      score -= r.fear * 1.5;      // Avoid strong opponents
      score += r.revenge * 4;     // Fight enemies
      score -= r.loyalty * 8;     // Don't fight allies
      score += r.respect < -20 ? 20 : 0; // Fight disrespected players
      break;
      
    case 'conversation':
      score = 50;
      score += r.trust * 0.5;     // Talk to trusted players
      score -= r.revenge * 2;     // Avoid high-revenge enemies
      score += r.loyalty * 0.3;   // Chat with allies
      score -= r.fear * 0.5;      // Slightly avoid feared players
      break;
      
    case 'trade':
      score = 30;
      score += r.trust * 2;       // Trade with trusted players
      score += r.loyalty * 1.5;   // Trade with allies
      score -= r.revenge * 3;     // Don't trade with enemies
      score -= r.debt * 0.1;      // Consider existing debts
      break;
  }
  
  return score;
}

// Helper functions
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isNearDefault(rel: any, threshold = 5): boolean {
  return Math.abs(rel.respect) < threshold &&
         rel.fear < threshold &&
         Math.abs(rel.trust) < threshold &&
         rel.loyalty < threshold &&
         rel.revenge < threshold &&
         Math.abs(rel.debt) < 10;
}

// Calculate personality compatibility
export function calculatePersonalityCompatibility(
  personality1?: string,
  personality2?: string
): number {
  if (!personality1 || !personality2) return 1;
  
  const compatibility: Record<string, Record<string, number>> = {
    CRIMINAL: { CRIMINAL: 1.2, GAMBLER: 0.8, WORKER: 0.5 },
    GAMBLER: { CRIMINAL: 0.8, GAMBLER: 1.0, WORKER: 0.9 },
    WORKER: { CRIMINAL: 0.5, GAMBLER: 0.9, WORKER: 1.3 },
  };
  
  return compatibility[personality1]?.[personality2] || 1;
}