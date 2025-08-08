#!/usr/bin/env node

/**
 * Script to check if avatar data is synced to metaverse
 */

const { prisma } = require('../../dist/config/database');

async function checkAvatarSync() {
  console.log('🔍 Checking avatar sync status...\n');

  try {
    // Get all bots with metaverse deployment
    const bots = await prisma.bot.findMany({
      where: {
        metaverseAgentId: {
          not: null
        }
      },
      include: {
        botSync: true,
        lootboxRewards: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Found ${bots.length} deployed bots\n`);
    console.log('═'.repeat(80));

    for (const bot of bots) {
      console.log(`\n🤖 ${bot.name} (${bot.personality})`);
      console.log(`   ID: ${bot.id}`);
      console.log(`   Agent ID: ${bot.metaverseAgentId}`);
      console.log(`   Current Zone: ${bot.currentZone || 'Unknown'}`);
      
      // Check avatar data
      if (bot.avatar) {
        const isBase64 = bot.avatar.startsWith('data:image');
        const avatarSize = isBase64 ? Math.round(bot.avatar.length / 1024) : 0;
        console.log(`   ✅ Avatar: ${isBase64 ? `Base64 image (${avatarSize}KB)` : 'URL/Path'}`);
        if (isBase64) {
          console.log(`   📸 Avatar preview: ${bot.avatar.substring(0, 50)}...`);
        }
      } else {
        console.log(`   ❌ Avatar: Not set`);
      }

      // Check lootbox rewards
      const unopenedLootboxes = bot.lootboxRewards?.filter(r => !r.opened).length || 0;
      const totalLootboxes = bot.lootboxRewards?.length || 0;
      console.log(`   📦 Lootboxes: ${totalLootboxes} total (${unopenedLootboxes} unopened)`);

      // Check sync status
      if (bot.botSync) {
        console.log(`   🔄 Sync Status: ${bot.botSync.syncStatus}`);
        if (bot.botSync.lastSyncedAt) {
          console.log(`   📅 Last Synced: ${bot.botSync.lastSyncedAt.toLocaleString()}`);
        }
      }

      console.log('   ' + '-'.repeat(60));
    }

    console.log('\n' + '═'.repeat(80));

    // Summary
    const botsWithAvatar = bots.filter(b => b.avatar).length;
    const botsWithLootboxes = bots.filter(b => b.lootboxRewards && b.lootboxRewards.length > 0).length;
    
    console.log('\n📈 Summary:');
    console.log(`   Bots with Avatar: ${botsWithAvatar}/${bots.length}`);
    console.log(`   Bots with Lootboxes: ${botsWithLootboxes}/${bots.length}`);

    if (botsWithAvatar < bots.length) {
      console.log('\n⚠️  Some bots are missing avatar data!');
      console.log('   Run: node scripts/generate-bot-avatars.js');
    }

  } catch (error) {
    console.error('❌ Error checking avatar sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAvatarSync().catch(console.error);