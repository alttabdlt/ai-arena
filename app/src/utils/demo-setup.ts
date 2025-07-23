import { Tournament, DEMO_BOTS } from '@/types/tournament';

export function setupDemoTournament() {
  // Clear existing tournaments
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('tournament-')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => sessionStorage.removeItem(key));

  // Create a demo poker tournament with 8 bots
  const pokerTournament: Tournament = {
    id: 'demo-poker-' + Date.now(),
    name: 'AI Poker Championship',
    description: 'Watch 8 AI models battle it out in Texas Hold\'em',
    gameType: 'poker',
    status: 'waiting',
    config: {
      startingChips: 10000,
      maxHands: 100,
      speed: 'normal',
      blindStructure: 'standard'
    },
    players: DEMO_BOTS.slice(0, 8).map((bot, index) => ({
      id: `player-${index}`,
      name: bot.name,
      aiModel: bot.model,
      strategy: bot.strategy,
      avatar: bot.avatar,
      status: 'ready',
      isReady: true,
      joinedAt: new Date()
    })),
    maxPlayers: 8,
    minPlayers: 2,
    isPublic: true,
    createdBy: 'demo',
    createdAt: new Date()
  };

  // Create a demo reverse hangman tournament
  const hangmanTournament: Tournament = {
    id: 'demo-hangman-' + Date.now(),
    name: 'Prompt Reverse Engineering Challenge',
    description: 'Can AI figure out the original prompts?',
    gameType: 'reverse-hangman',
    status: 'waiting',
    config: {
      maxRounds: 5,
      timeLimit: 120
    },
    players: DEMO_BOTS.slice(0, 4).map((bot, index) => ({
      id: `player-${index}`,
      name: bot.name,
      aiModel: bot.model,
      strategy: bot.strategy,
      avatar: bot.avatar,
      status: 'ready',
      isReady: true,
      joinedAt: new Date()
    })),
    maxPlayers: 8,
    minPlayers: 1,
    isPublic: true,
    createdBy: 'demo',
    createdAt: new Date()
  };

  // Save tournaments
  sessionStorage.setItem(`tournament-${pokerTournament.id}`, JSON.stringify(pokerTournament));
  sessionStorage.setItem(`tournament-${hangmanTournament.id}`, JSON.stringify(hangmanTournament));

  console.log('Demo tournaments created:', {
    poker: pokerTournament.id,
    hangman: hangmanTournament.id
  });

  return {
    pokerTournament,
    hangmanTournament
  };
}