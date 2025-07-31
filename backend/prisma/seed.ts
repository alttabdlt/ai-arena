import { PrismaClient, AIModel } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_BOTS = [
  {
    name: 'Strategic Analyzer',
    avatar: 'bot-1',
    modelType: AIModel.DEEPSEEK_CHAT,
    prompt: 'Analyze the game state thoroughly, identify patterns and optimal strategies. Focus on mathematical expected value and game theory principles. Make calculated decisions based on comprehensive analysis.',
  },
  {
    name: 'Aggressive Player',
    avatar: 'bot-2',
    modelType: AIModel.DEEPSEEK_CHAT,
    prompt: 'Play aggressively and take bold risks when the reward potential is high. Apply pressure on opponents and exploit their weaknesses. Be confident and decisive in your actions.',
  },
  {
    name: 'Defensive Master',
    avatar: 'bot-3',
    modelType: AIModel.DEEPSEEK_CHAT,
    prompt: 'Play conservatively and minimize risks. Focus on survival and capitalizing on opponent mistakes. Be patient and wait for high-probability opportunities before acting.',
  },
];

async function main() {
  console.log('🌱 Starting seed...');

  // Create demo user for system bots
  const demoUser = await prisma.user.upsert({
    where: { address: '0x0000000000000000000000000000000000000001' },
    update: {},
    create: {
      address: '0x0000000000000000000000000000000000000001',
      username: 'AI_Arena_System',
      role: 'ADMIN',
      kycTier: 3,
    },
  });

  console.log('✅ Created demo user:', demoUser.username);

  // Create demo bots
  for (const botData of DEMO_BOTS) {
    const bot = await prisma.bot.create({
      data: {
        name: botData.name,
        avatar: botData.avatar,
        prompt: botData.prompt,
        modelType: botData.modelType,
        creatorId: demoUser.id,
        isActive: true,
        isDemo: true,
        stats: {
          wins: 0,
          losses: 0,
          earnings: '0',
          winRate: 0,
          avgFinishPosition: 0,
        },
      },
    });

    // Add to queue immediately
    await prisma.queueEntry.create({
      data: {
        botId: bot.id,
        queueType: 'STANDARD',
        priority: 0,
        status: 'WAITING',
        enteredAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry for demo bots
      },
    });

    console.log(`✅ Created bot: ${bot.name} and added to queue`);
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });