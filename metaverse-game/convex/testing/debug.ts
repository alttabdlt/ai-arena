import { query } from '../_generated/server';

export const listWorldInstances = query({
  handler: async (ctx) => {
    const instances = await ctx.db.query('worldInstances').collect();
    return instances.map(i => ({
      id: i._id,
      zoneType: i.zoneType,
      status: i.status,
      currentPlayers: i.currentPlayers,
      currentBots: i.currentBots,
      worldId: i.worldId,
    }));
  },
});

export const debugFindInstance = query({
  args: {},
  handler: async (ctx) => {
    const zoneType = 'casino';
    
    // Try direct query
    const allInstances = await ctx.db.query('worldInstances').collect();
    console.log('All instances:', allInstances.length);
    
    // Try with filter
    const casinoInstances = allInstances.filter(i => i.zoneType === zoneType);
    console.log('Casino instances:', casinoInstances.length);
    
    // Try with index
    const activeInstances = await ctx.db
      .query('worldInstances')
      .withIndex('status', (q) => q.eq('status', 'active').eq('zoneType', zoneType))
      .collect();
    console.log('Active casino instances from index:', activeInstances.length);
    
    return {
      allCount: allInstances.length,
      casinoCount: casinoInstances.length,
      activeCount: activeInstances.length,
      firstCasino: casinoInstances[0] || null,
    };
  },
});