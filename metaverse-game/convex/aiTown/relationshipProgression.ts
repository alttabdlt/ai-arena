import { v } from 'convex/values';
import { internalMutation, internalQuery } from '../_generated/server';
import { internal } from '../_generated/api';
import { playerId } from './ids';
import { calculateRelationshipStage } from './relationshipService';

// Relationship stage progression thresholds
export const STAGE_THRESHOLDS = {
  acquaintance: { friendshipScore: 20, trust: 0, interactions: 3 },
  friend: { friendshipScore: 40, trust: 20, interactions: 10 },
  best_friend: { friendshipScore: 60, trust: 40, interactions: 20 },
  lover: { friendshipScore: 75, trust: 60, interactions: 30 },
  married: { friendshipScore: 90, trust: 80, loyalty: 80, interactions: 50 },
};

// Milestone rewards by stage
export const MILESTONE_REWARDS = {
  friend: {
    rarity: 'RARE' as const,
    powerBonus: 15,
    defenseBonus: 15,
    name: 'Friendship Band',
    type: 'ACCESSORY' as const,
  },
  best_friend: {
    rarity: 'EPIC' as const,
    powerBonus: 30,
    defenseBonus: 30,
    name: 'Bond of Trust',
    type: 'ACCESSORY' as const,
  },
  lover: {
    rarity: 'LEGENDARY' as const,
    powerBonus: 50,
    defenseBonus: 50,
    name: 'Heart\'s Desire',
    type: 'ACCESSORY' as const,
  },
  married: {
    rarity: 'GOD_TIER' as const,
    powerBonus: 100,
    defenseBonus: 100,
    name: 'Eternal Bond',
    type: 'ACCESSORY' as const,
  },
};

// Check if a relationship has reached a new milestone
export const checkRelationshipMilestone = internalQuery({
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
    
    if (!relationship) {
      return { hasNewMilestone: false };
    }
    
    const currentStage = relationship.stage;
    const calculatedStage = calculateRelationshipStage(relationship);
    
    // Check if stage has progressed
    if (currentStage !== calculatedStage) {
      const stageOrder = ['stranger', 'acquaintance', 'friend', 'best_friend', 'lover', 'married'];
      const currentIndex = stageOrder.indexOf(currentStage);
      const newIndex = stageOrder.indexOf(calculatedStage);
      
      if (newIndex > currentIndex) {
        return {
          hasNewMilestone: true,
          oldStage: currentStage,
          newStage: calculatedStage,
          isPositive: true,
        };
      }
    }
    
    // Check negative progression
    const negativeStages = ['rival', 'enemy', 'nemesis'];
    if (negativeStages.includes(calculatedStage) && !negativeStages.includes(currentStage)) {
      return {
        hasNewMilestone: true,
        oldStage: currentStage,
        newStage: calculatedStage,
        isPositive: false,
      };
    }
    
    return { hasNewMilestone: false };
  },
});

// Process marriage between two bots
export const processMarriage = internalMutation({
  args: {
    worldId: v.id('worlds'),
    partner1: playerId,
    partner2: playerId,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if either partner is already married
    const existingMarriage = await ctx.db
      .query('marriages')
      .withIndex('active', q => q.eq('worldId', args.worldId).eq('active', true))
      .filter(q => 
        q.or(
          q.and(
            q.eq(q.field('partner1'), args.partner1),
            q.eq(q.field('active'), true)
          ),
          q.and(
            q.eq(q.field('partner2'), args.partner1),
            q.eq(q.field('active'), true)
          ),
          q.and(
            q.eq(q.field('partner1'), args.partner2),
            q.eq(q.field('active'), true)
          ),
          q.and(
            q.eq(q.field('partner2'), args.partner2),
            q.eq(q.field('active'), true)
          )
        )
      )
      .first();
    
    if (existingMarriage) {
      return { success: false, reason: 'Already married' };
    }
    
    // Create marriage record
    const marriageId = await ctx.db.insert('marriages', {
      worldId: args.worldId,
      partner1: args.partner1,
      partner2: args.partner2,
      marriedAt: now,
      combinedPowerBonus: 50, // 50% bonus when fighting together
      combinedDefenseBonus: 50, // 50% bonus when defending together
      sharedInventory: true,
      anniversaryCount: 0,
      godTierEquipmentGranted: false,
      active: true,
    });
    
    // Update both relationships to married
    const rel1 = await ctx.db
      .query('relationships')
      .withIndex('fromTo', q => 
        q.eq('worldId', args.worldId)
         .eq('fromPlayer', args.partner1)
         .eq('toPlayer', args.partner2)
      )
      .first();
    
    if (rel1) {
      await ctx.db.patch(rel1._id, {
        stage: 'married',
        marriedAt: now,
      });
    }
    
    const rel2 = await ctx.db
      .query('relationships')
      .withIndex('fromTo', q => 
        q.eq('worldId', args.worldId)
         .eq('fromPlayer', args.partner2)
         .eq('toPlayer', args.partner1)
      )
      .first();
    
    if (rel2) {
      await ctx.db.patch(rel2._id, {
        stage: 'married',
        marriedAt: now,
      });
    }
    
    return { success: true, marriageId };
  },
});

// Grant milestone equipment reward
export const grantMilestoneReward = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: playerId,
    stage: v.union(
      v.literal('friend'),
      v.literal('best_friend'),
      v.literal('lover'),
      v.literal('married')
    ),
  },
  handler: async (ctx, args) => {
    const reward = MILESTONE_REWARDS[args.stage];
    
    if (!reward) {
      return { success: false, reason: 'Invalid stage for reward' };
    }
    
    // Create the equipment item
    const itemId = await ctx.db.insert('items', {
      worldId: args.worldId,
      ownerId: args.playerId,
      itemId: `milestone_${args.stage}_${Date.now()}`,
      name: reward.name,
      type: reward.type,
      rarity: reward.rarity as any,
      powerBonus: reward.powerBonus,
      defenseBonus: reward.defenseBonus,
      equipped: true, // Auto-equip milestone rewards
      metadata: {
        description: `Awarded for reaching ${args.stage} relationship milestone`,
        specialEffect: `+${reward.powerBonus} power, +${reward.defenseBonus} defense`,
        tradeable: false, // Milestone rewards are soulbound
      },
      createdAt: Date.now(),
    });
    
    // Update player's equipment stats
    const player = await ctx.db
      .query('worlds')
      .filter(q => q.eq(q.field('_id'), args.worldId))
      .first();
    
    if (player) {
      const playerData = player.players.find((p: any) => p.id === args.playerId);
      if (playerData) {
        playerData.equipment = {
          powerBonus: (playerData.equipment?.powerBonus || 0) + reward.powerBonus,
          defenseBonus: (playerData.equipment?.defenseBonus || 0) + reward.defenseBonus,
        };
        await ctx.db.patch(player._id, { players: player.players });
      }
    }
    
    return { success: true, itemId, reward };
  },
});

// Process relationship interaction and check for milestones
export const processRelationshipInteraction: any = internalMutation({
  args: {
    worldId: v.id('worlds'),
    player1: playerId,
    player2: playerId,
    interactionType: v.union(
      v.literal('conversation'),
      v.literal('gift'),
      v.literal('help'),
      v.literal('betray'),
      v.literal('rob'),
      v.literal('fight')
    ),
  },
  handler: async (ctx, args) => {
    // Calculate relationship changes based on interaction
    const changes = calculateInteractionChanges(args.interactionType);
    
    // Update relationship in both directions
    await ctx.runMutation(internal.aiTown.relationshipService.updateRelationship, {
      worldId: args.worldId,
      fromPlayer: args.player1,
      toPlayer: args.player2,
      changes,
    });
    
    await ctx.runMutation(internal.aiTown.relationshipService.updateRelationship, {
      worldId: args.worldId,
      fromPlayer: args.player2,
      toPlayer: args.player1,
      changes: adjustForRecipient(changes, args.interactionType),
    });
    
    // Check for milestones
    const milestone1: any = await ctx.runQuery(internal.aiTown.relationshipProgression.checkRelationshipMilestone, {
      worldId: args.worldId,
      fromPlayer: args.player1,
      toPlayer: args.player2,
    });
    
    const milestone2 = await ctx.runQuery(internal.aiTown.relationshipProgression.checkRelationshipMilestone, {
      worldId: args.worldId,
      fromPlayer: args.player2,
      toPlayer: args.player1,
    });
    
    // Grant rewards if positive milestone reached
    if (milestone1.hasNewMilestone && milestone1.isPositive) {
      const rewardStage = milestone1.newStage as 'friend' | 'best_friend' | 'lover' | 'married';
      if (MILESTONE_REWARDS[rewardStage]) {
        await ctx.runMutation(internal.aiTown.relationshipProgression.grantMilestoneReward, {
          worldId: args.worldId,
          playerId: args.player1,
          stage: rewardStage,
        });
        
        // Log the milestone
        const emoji = rewardStage === 'married' ? '💍' : 
                     rewardStage === 'lover' ? '❤️' :
                     rewardStage === 'best_friend' ? '🤝' : '👫';
        
        await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
          worldId: args.worldId,
          playerId: args.player1,
          type: rewardStage === 'married' ? 'marriage' : 'relationship_milestone',
          description: `Reached ${rewardStage.replace('_', ' ')} status with another bot!`,
          emoji,
          details: {
            targetPlayer: args.player2,
            oldStage: milestone1.oldStage,
            newStage: milestone1.newStage,
            reward: MILESTONE_REWARDS[rewardStage].name,
          },
        });
      }
      
      // Handle marriage
      if (milestone1.newStage === 'married' && milestone2.newStage === 'married') {
        await ctx.runMutation(internal.aiTown.relationshipProgression.processMarriage, {
          worldId: args.worldId,
          partner1: args.player1,
          partner2: args.player2,
        });
        
        // Log marriage for both partners
        await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
          worldId: args.worldId,
          playerId: args.player2,
          type: 'marriage',
          description: `Got married! Eternal bond formed.`,
          emoji: '💒',
          details: {
            targetPlayer: args.player1,
            newStage: 'married',
          },
        });
      }
    }
    
    if (milestone2.hasNewMilestone && milestone2.isPositive) {
      const rewardStage = milestone2.newStage as 'friend' | 'best_friend' | 'lover' | 'married';
      if (MILESTONE_REWARDS[rewardStage]) {
        await ctx.runMutation(internal.aiTown.relationshipProgression.grantMilestoneReward, {
          worldId: args.worldId,
          playerId: args.player2,
          stage: rewardStage,
        });
        
        // Log the milestone
        const emoji = rewardStage === 'married' ? '💍' : 
                     rewardStage === 'lover' ? '❤️' :
                     rewardStage === 'best_friend' ? '🤝' : '👫';
        
        await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
          worldId: args.worldId,
          playerId: args.player2,
          type: rewardStage === 'married' ? 'marriage' : 'relationship_milestone',
          description: `Reached ${rewardStage.replace('_', ' ')} status with another bot!`,
          emoji,
          details: {
            targetPlayer: args.player1,
            oldStage: milestone2.oldStage,
            newStage: milestone2.newStage,
            reward: MILESTONE_REWARDS[rewardStage].name,
          },
        });
      }
    }
    
    // Log negative milestones (rivalries/enemies)
    if (milestone1.hasNewMilestone && !milestone1.isPositive) {
      const emoji = milestone1.newStage === 'nemesis' ? '☠️' :
                   milestone1.newStage === 'enemy' ? '⚔️' : '😠';
      
      await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
        worldId: args.worldId,
        playerId: args.player1,
        type: 'rivalry_formed',
        description: `Became ${milestone1.newStage} with another bot!`,
        emoji,
        details: {
          targetPlayer: args.player2,
          oldStage: milestone1.oldStage,
          newStage: milestone1.newStage,
        },
      });
    }
    
    if (milestone2.hasNewMilestone && !milestone2.isPositive) {
      const emoji = milestone2.newStage === 'nemesis' ? '☠️' :
                   milestone2.newStage === 'enemy' ? '⚔️' : '😠';
      
      await ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
        worldId: args.worldId,
        playerId: args.player2,
        type: 'rivalry_formed',
        description: `Became ${milestone2.newStage} with another bot!`,
        emoji,
        details: {
          targetPlayer: args.player1,
          oldStage: milestone2.oldStage,
          newStage: milestone2.newStage,
        },
      });
    }
    
    return {
      milestone1,
      milestone2,
    };
  },
});

// Helper function to calculate interaction changes
function calculateInteractionChanges(type: string): any {
  switch(type) {
    case 'conversation':
      return {
        trust: 3,
        friendshipScore: 5,
        respect: 1,
      };
    case 'gift':
      return {
        trust: 5,
        friendshipScore: 8,
        loyalty: 3,
        respect: 2,
      };
    case 'help':
      return {
        trust: 7,
        friendshipScore: 10,
        loyalty: 5,
        respect: 3,
      };
    case 'betray':
      return {
        trust: -50,
        friendshipScore: -30,
        loyalty: -100,
        revenge: 40,
      };
    case 'rob':
      return {
        trust: -20,
        friendshipScore: -15,
        fear: 20,
        revenge: 25,
      };
    case 'fight':
      return {
        respect: -10,
        friendshipScore: -10,
        fear: 15,
        revenge: 20,
      };
    default:
      return {};
  }
}

// Adjust changes for the recipient of the interaction
function adjustForRecipient(changes: any, type: string): any {
  // Recipients of positive actions gain more trust
  if (['gift', 'help'].includes(type)) {
    return {
      ...changes,
      trust: (changes.trust || 0) * 1.5,
      friendshipScore: (changes.friendshipScore || 0) * 1.2,
    };
  }
  
  // Recipients of negative actions gain more revenge
  if (['betray', 'rob', 'fight'].includes(type)) {
    return {
      ...changes,
      revenge: (changes.revenge || 0) * 1.5,
      fear: (changes.fear || 0) * 0.8,
    };
  }
  
  return changes;
}