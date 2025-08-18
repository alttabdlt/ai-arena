import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function main() {
  const botsToCheck = [
    'test-bot-1755170175436',
    'cmebytiwk0002rupbsy08dk3w',
    'cmee9ud970002ruu0nsl5j6uu',  // mango2222
    'cmeeka9gg0002ru12q89nf232'   // mango333
  ];
  
  console.log('Checking Arena Backend for Bots\n');
  
  for (const botId of botsToCheck) {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: { 
        id: true, 
        name: true, 
        channel: true,
        isActive: true 
      }
    });
    
    if (bot) {
      console.log('Found: ' + bot.name + ' (' + bot.id + ')');
      console.log('   Channel: ' + (bot.channel || 'main'));
      console.log('   Active: ' + bot.isActive);
    } else {
      console.log('Not found: ' + botId);
    }
    console.log('');
  }
  
  await prisma.$disconnect();
}

main();
