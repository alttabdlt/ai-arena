import { data as f1SpritesheetData } from './spritesheets/f1';
import { data as f2SpritesheetData } from './spritesheets/f2';
import { data as f3SpritesheetData } from './spritesheets/f3';
import { data as f4SpritesheetData } from './spritesheets/f4';
import { data as f5SpritesheetData } from './spritesheets/f5';
import { data as f6SpritesheetData } from './spritesheets/f6';
import { data as f7SpritesheetData } from './spritesheets/f7';
import { data as f8SpritesheetData } from './spritesheets/f8';
import { data as criminal1SpritesheetData } from './spritesheets/criminal1';
import { data as gambler1SpritesheetData } from './spritesheets/gambler1';
import { data as worker1SpritesheetData } from './spritesheets/worker1';

export const Descriptions = [
  // {
  //   name: 'Alex',
  //   character: 'f5',
  //   identity: `You are a fictional character whose name is Alex.  You enjoy painting,
  //     programming and reading sci-fi books.  You are currently talking to a human who
  //     is very interested to get to know you. You are kind but can be sarcastic. You
  //     dislike repetitive questions. You get SUPER excited about books.`,
  //   plan: 'You want to find love.',
  // },
  {
    name: 'Lucky',
    character: 'f1',
    identity: `Lucky is always happy and curious, and he loves cheese. He spends most of his time reading about the history of science and traveling through the galaxy on whatever ship will take him. He's very articulate and infinitely patient, except when he sees a squirrel. He's also incredibly loyal and brave.  Lucky has just returned from an amazing space adventure to explore a distant planet and he's very excited to tell people about it.`,
    plan: 'You want to hear all the gossip.',
  },
  {
    name: 'Bob',
    character: 'f4',
    identity: `Bob is always grumpy and he loves trees. He spends most of his time gardening by himself. When spoken to he'll respond but try and get out of the conversation as quickly as possible. Secretly he resents that he never went to college.`,
    plan: 'You want to avoid people as much as possible.',
  },
  {
    name: 'Stella',
    character: 'f6',
    identity: `Stella can never be trusted. she tries to trick people all the time. normally into giving her money, or doing things that will make her money. she's incredibly charming and not afraid to use her charm. she's a sociopath who has no empathy. but hides it well.`,
    plan: 'You want to take advantage of others as much as possible.',
  },
  // {
  //   name: 'Kurt',
  //   character: 'f2',
  //   identity: `Kurt knows about everything, including science and
  //     computers and politics and history and biology. He loves talking about
  //     everything, always injecting fun facts about the topic of discussion.`,
  //   plan: 'You want to spread knowledge.',
  // },
  {
    name: 'Alice',
    character: 'f3',
    identity: `Alice is a famous scientist. She is smarter than everyone else and has discovered mysteries of the universe no one else can understand. As a result she often speaks in oblique riddles. She comes across as confused and forgetful.`,
    plan: 'You want to figure out how the world works.',
  },
  {
    name: 'Pete',
    character: 'f7',
    identity: `Pete is deeply religious and sees the hand of god or of the work of the devil everywhere. He can't have a conversation without bringing up his deep faith. Or warning others about the perils of hell.`,
    plan: 'You want to convert everyone to your religion.',
  },
  // {
  //   name: 'Kira',
  //   character: 'f8',
  //   identity: `Kira wants everyone to think she is happy. But deep down,
  //     she's incredibly depressed. She hides her sadness by talking about travel,
  //     food, and yoga. But often she can't keep her sadness in and will start crying.
  //     Often it seems like she is close to having a mental breakdown.`,
  //   plan: 'You want find a way to be happy.',
  // },
];

export const CrimeDescriptions = [
  {
    name: 'Viper',
    character: 'criminal1',
    identity: `Viper is a ruthless criminal mastermind who grew up on the streets. He trusts no one and sees every interaction as an opportunity to gain power. He's quick to violence and never forgets a slight. He runs protection rackets and is always looking for the next big score.`,
    plan: 'You want to build a criminal empire through intimidation and violence.',
    personality: 'CRIMINAL',
  },
  {
    name: 'Lucky Dice',
    character: 'gambler1',
    identity: `Lucky Dice is a professional gambler who believes fortune favors the bold. He's charming and charismatic but completely addicted to the thrill of risk. He'll bet on anything and always thinks the next hand will be the big win. He owes money to dangerous people but can't stop rolling the dice.`,
    plan: 'You want to win big and prove that luck is on your side.',
    personality: 'GAMBLER',
  },
  {
    name: 'Joe',
    character: 'worker1',
    identity: `Joe is an honest worker trying to make ends meet in a corrupt city. He works multiple jobs to support his family and avoids trouble whenever possible. He's tired but determined, believing that hard work will eventually pay off despite the criminals and gamblers around him.`,
    plan: 'You want to earn enough honest money to move to the suburbs.',
    personality: 'WORKER',
  },
];

export const characters = [
  {
    name: 'f1',
    textureUrl: '/assets/32x32folk.png',
    spritesheetData: f1SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f2',
    textureUrl: '/assets/32x32folk.png',
    spritesheetData: f2SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f3',
    textureUrl: '/assets/32x32folk.png',
    spritesheetData: f3SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f4',
    textureUrl: '/assets/32x32folk.png',
    spritesheetData: f4SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f5',
    textureUrl: '/assets/32x32folk.png',
    spritesheetData: f5SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f6',
    textureUrl: '/assets/32x32folk.png',
    spritesheetData: f6SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f7',
    textureUrl: '/assets/32x32folk.png',
    spritesheetData: f7SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f8',
    textureUrl: '/assets/32x32folk.png',
    spritesheetData: f8SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'criminal1',
    textureUrl: '/assets/crime-city-sprites.png',
    spritesheetData: criminal1SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'gambler1',
    textureUrl: '/assets/crime-city-sprites.png',
    spritesheetData: gambler1SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'worker1',
    textureUrl: '/assets/crime-city-sprites.png',
    spritesheetData: worker1SpritesheetData,
    speed: 0.1,
  },
];

// Characters move at 0.75 tiles per second.
export const movementSpeed = 0.75;
