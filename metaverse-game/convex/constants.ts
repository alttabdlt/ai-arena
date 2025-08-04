export const ACTION_TIMEOUT = 120_000; // more time for local dev
// export const ACTION_TIMEOUT = 60_000;// normally fine

export const IDLE_WORLD_TIMEOUT = 5 * 60 * 1000;
export const WORLD_HEARTBEAT_INTERVAL = 60 * 1000;

export const MAX_STEP = 10 * 60 * 1000;
export const TICK = 16;
export const STEP_INTERVAL = 1000;

export const PATHFINDING_TIMEOUT = 60 * 1000;
export const PATHFINDING_BACKOFF = 1000;
export const CONVERSATION_DISTANCE = 1.3;
export const MIDPOINT_THRESHOLD = 4;
export const TYPING_TIMEOUT = 15 * 1000;
export const COLLISION_THRESHOLD = 0.75;

// How many human players can be in a world at once.
export const MAX_HUMAN_PLAYERS = 8;

// Don't talk to anyone for 15s after having a conversation.
export const CONVERSATION_COOLDOWN = 15000;

// Don't do another activity for 10s after doing one.
export const ACTIVITY_COOLDOWN = 10_000;

// Don't talk to a player within 60s of talking to them.
export const PLAYER_CONVERSATION_COOLDOWN = 60000;

// Invite 80% of invites that come from other agents.
export const INVITE_ACCEPT_PROBABILITY = 0.8;

// Wait for 1m for invites to be accepted.
export const INVITE_TIMEOUT = 60000;

// Wait for another player to say something before jumping in.
export const AWKWARD_CONVERSATION_TIMEOUT = 60_000; // more time locally
// export const AWKWARD_CONVERSATION_TIMEOUT = 20_000;

// Leave a conversation after participating too long.
export const MAX_CONVERSATION_DURATION = 10 * 60_000; // more time locally
// export const MAX_CONVERSATION_DURATION = 2 * 60_000;

// Leave a conversation if it has more than 8 messages;
export const MAX_CONVERSATION_MESSAGES = 8;

// Wait for 1s after sending an input to the engine. We can remove this
// once we can await on an input being processed.
export const INPUT_DELAY = 1000;

// How many memories to get from the agent's memory.
// This is over-fetched by 10x so we can prioritize memories by more than relevance.
export const NUM_MEMORIES_TO_SEARCH = 3;

// Wait for at least two seconds before sending another message.
export const MESSAGE_COOLDOWN = 2000;

// Don't run a turn of the agent more than once a second.
export const AGENT_WAKEUP_THRESHOLD = 1000;

// How old we let memories be before we vacuum them
export const VACUUM_MAX_AGE = 2 * 7 * 24 * 60 * 60 * 1000;
export const DELETE_BATCH_SIZE = 64;

export const HUMAN_IDLE_TOO_LONG = 5 * 60 * 1000;

export const ACTIVITIES = [
  { description: 'reading a book', emoji: '📖', duration: 60_000 },
  { description: 'daydreaming', emoji: '🤔', duration: 60_000 },
  { description: 'gardening', emoji: '🥕', duration: 60_000 },
];

// Crime metaverse activities by zone
export const CRIME_ACTIVITIES = {
  casino: [
    { description: 'gambling at the slots', emoji: '🎰', duration: 45_000, personality: 'GAMBLER' },
    { description: 'playing poker', emoji: '🃏', duration: 90_000, personality: 'GAMBLER' },
    { description: 'making shady deals', emoji: '🤝', duration: 60_000, personality: 'CRIMINAL' },
    { description: 'counting winnings', emoji: '💰', duration: 30_000, personality: 'WORKER' },
  ],
  darkAlley: [
    { description: 'planning a robbery', emoji: '🔫', duration: 45_000, personality: 'CRIMINAL' },
    { description: 'selling stolen goods', emoji: '💼', duration: 60_000, personality: 'CRIMINAL' },
    { description: 'hiding in shadows', emoji: '🌑', duration: 30_000, personality: 'WORKER' },
    { description: 'rolling dice in the alley', emoji: '🎲', duration: 40_000, personality: 'GAMBLER' },
  ],
  suburb: [
    { description: 'decorating the house', emoji: '🏠', duration: 60_000, personality: 'WORKER' },
    { description: 'upgrading security', emoji: '🔒', duration: 45_000, personality: 'WORKER' },
    { description: 'hosting a party', emoji: '🎉', duration: 90_000, personality: 'GAMBLER' },
    { description: 'casing houses', emoji: '👀', duration: 30_000, personality: 'CRIMINAL' },
  ],
  downtown: [
    { description: 'window shopping', emoji: '🛍️', duration: 45_000, personality: 'WORKER' },
    { description: 'meeting contacts', emoji: '🤵', duration: 60_000, personality: 'CRIMINAL' },
    { description: 'street performance', emoji: '🎭', duration: 50_000, personality: 'GAMBLER' },
    { description: 'people watching', emoji: '👁️', duration: 30_000, personality: 'WORKER' },
  ],
  underground: [
    { description: 'fighting in the ring', emoji: '🥊', duration: 60_000, personality: 'CRIMINAL' },
    { description: 'betting on fights', emoji: '💸', duration: 45_000, personality: 'GAMBLER' },
    { description: 'training combat skills', emoji: '⚔️', duration: 90_000, personality: 'CRIMINAL' },
    { description: 'working as medic', emoji: '🏥', duration: 60_000, personality: 'WORKER' },
  ],
};

// Combat and robbery cooldowns
export const ROBBERY_COOLDOWN = 5 * 60_000; // 5 minutes between robbery attempts
export const COMBAT_COOLDOWN = 3 * 60_000; // 3 minutes between fights
export const HOSPITAL_RECOVERY = 2 * 60_000; // 2 minutes in hospital after knockout
export const REVENGE_MEMORY_DURATION = 24 * 60 * 60_000; // Remember robberies for 24 hours

// Crime success rates
export const BASE_ROBBERY_SUCCESS = 0.3; // 30% base chance
export const BASE_COMBAT_SUCCESS = 0.5; // 50% base chance
export const PERSONALITY_BONUS = {
  CRIMINAL: { robbery: 0.2, combat: 0.3 },
  GAMBLER: { robbery: 0.1, combat: 0.1 },
  WORKER: { robbery: -0.1, combat: -0.2 },
};

export const ENGINE_ACTION_DURATION = 30000;

// Bound the number of pathfinding searches we do per game step.
export const MAX_PATHFINDS_PER_STEP = 16;

export const DEFAULT_NAME = 'Me';
