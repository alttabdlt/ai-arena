import { v } from 'convex/values';
import { mutation } from '../_generated/server';

export const clearBotRegistration = mutation({
  args: {
    aiArenaBotId: v.string(),
  },
  handler: async (ctx, { aiArenaBotId }) => {
    // Find the existing registration
    const existingRegistration = await ctx.db
      .query('pendingBotRegistrations')
      .withIndex('aiArenaBotId', (q) => q.eq('aiArenaBotId', aiArenaBotId))
      .first();
    
    if (existingRegistration) {
      console.log(`Found registration to clear: ${existingRegistration._id}`);
      
      // Delete the registration
      await ctx.db.delete(existingRegistration._id);
      
      console.log(`✅ Cleared registration for bot ${aiArenaBotId}`);
      return {
        success: true,
        deletedRegistrationId: existingRegistration._id,
        message: `Cleared registration ${existingRegistration._id} for bot ${aiArenaBotId}`
      };
    }
    
    return {
      success: false,
      message: `No registration found for bot ${aiArenaBotId}`
    };
  },
});

export const clearAllCompletedRegistrations = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all completed registrations
    const completedRegistrations = await ctx.db
      .query('pendingBotRegistrations')
      .filter((q) => q.eq(q.field('status'), 'completed'))
      .collect();
    
    let clearedCount = 0;
    
    for (const registration of completedRegistrations) {
      // Check if the agent actually exists
      if (registration.result?.agentId) {
        const agentId = registration.result.agentId.split(':')[1];
        const agent = await ctx.db.get(agentId as any);
        
        if (!agent) {
          // Agent doesn't exist, clear the registration
          await ctx.db.delete(registration._id);
          clearedCount++;
          console.log(`Cleared orphaned registration ${registration._id} for bot ${registration.aiArenaBotId}`);
        }
      }
    }
    
    return {
      success: true,
      clearedCount,
      message: `Cleared ${clearedCount} orphaned registrations`
    };
  },
});