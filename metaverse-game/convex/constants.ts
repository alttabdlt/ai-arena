export const ACTION_TIMEOUT = 120_000; // more time for local dev
// export const ACTION_TIMEOUT = 60_000;// normally fine

export const IDLE_WORLD_TIMEOUT = 30 * 60 * 1000; // 30 minutes to allow bot deployments to complete
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

// Don't talk to anyone for 10s after having a conversation (reduced for dynamic gameplay).
export const CONVERSATION_COOLDOWN = 10000;

// Don't do another activity for 5s after doing one (reduced for dynamic gameplay).
export const ACTIVITY_COOLDOWN = 5_000;

// Don't talk to a player within 30s of talking to them (reduced for dynamic gameplay).
export const PLAYER_CONVERSATION_COOLDOWN = 30000;

// Invite 80% of invites that come from other agents.
export const INVITE_ACCEPT_PROBABILITY = 0.8;

// Wait for 30s for invites to be accepted (reduced for dynamic gameplay).
export const INVITE_TIMEOUT = 30000;

// Wait for another player to say something before jumping in.
export const AWKWARD_CONVERSATION_TIMEOUT = 15_000; // reduced for dynamic gameplay

// Leave a conversation after participating too long.
export const MAX_CONVERSATION_DURATION = 2 * 60_000; // 2 minutes for dynamic gameplay

// Leave a conversation if it has more than 4 messages (reduced for dynamic gameplay);
export const MAX_CONVERSATION_MESSAGES = 4;

// Wait for 1s after sending an input to the engine. We can remove this
// once we can await on an input being processed.
export const INPUT_DELAY = 1000;

// How many memories to get from the agent's memory.
// This is over-fetched by 10x so we can prioritize memories by more than relevance.
export const NUM_MEMORIES_TO_SEARCH = 3;

// Wait for at least one second before sending another message (reduced for dynamic gameplay).
export const MESSAGE_COOLDOWN = 1000;

// Don't run a turn of the agent more than once a second.
export const AGENT_WAKEUP_THRESHOLD = 1000;

// How old we let memories be before we vacuum them
// Aggressive cleanup: 2 hours for inputs, longer for other data
export const VACUUM_MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours (was 1 day)
export const DELETE_BATCH_SIZE = 200; // Increased from 100 for faster cleanup
export const MAX_INPUTS_PER_ENGINE = 1000; // New: limit inputs to prevent explosion

export const HUMAN_IDLE_TOO_LONG = 5 * 60 * 1000;

export const ACTIVITIES = [
  { description: 'reading a book', emoji: '📖', duration: 10_000 },
  { description: 'daydreaming', emoji: '🤔', duration: 8_000 },
  { description: 'gardening', emoji: '🥕', duration: 12_000 },
];

// Crime metaverse activities by zone (reduced durations for more movement)
export const CRIME_ACTIVITIES = {
  casino: [
    { description: 'gambling at the slots', emoji: '🎰', duration: 8_000, personality: 'GAMBLER' },
    { description: 'playing poker', emoji: '🃏', duration: 15_000, personality: 'GAMBLER' },
    { description: 'making shady deals', emoji: '🤝', duration: 10_000, personality: 'CRIMINAL' },
    { description: 'counting winnings', emoji: '💰', duration: 5_000, personality: 'WORKER' },
  ],
  darkAlley: [
    { description: 'planning a robbery', emoji: '🔫', duration: 8_000, personality: 'CRIMINAL' },
    { description: 'selling stolen goods', emoji: '💼', duration: 10_000, personality: 'CRIMINAL' },
    { description: 'hiding in shadows', emoji: '🌑', duration: 5_000, personality: 'WORKER' },
    { description: 'rolling dice in the alley', emoji: '🎲', duration: 7_000, personality: 'GAMBLER' },
  ],
  suburb: [
    { description: 'decorating the house', emoji: '🏠', duration: 10_000, personality: 'WORKER' },
    { description: 'upgrading security', emoji: '🔒', duration: 8_000, personality: 'WORKER' },
    { description: 'hosting a party', emoji: '🎉', duration: 15_000, personality: 'GAMBLER' },
    { description: 'casing houses', emoji: '👀', duration: 5_000, personality: 'CRIMINAL' },
  ],
  downtown: [
    { description: 'window shopping', emoji: '🛍️', duration: 8_000, personality: 'WORKER' },
    { description: 'meeting contacts', emoji: '🤵', duration: 10_000, personality: 'CRIMINAL' },
    { description: 'street performance', emoji: '🎭', duration: 12_000, personality: 'GAMBLER' },
    { description: 'people watching', emoji: '👁️', duration: 5_000, personality: 'WORKER' },
  ],
  underground: [
    { description: 'fighting in the ring', emoji: '🥊', duration: 10_000, personality: 'CRIMINAL' },
    { description: 'betting on fights', emoji: '💸', duration: 8_000, personality: 'GAMBLER' },
    { description: 'training combat skills', emoji: '⚔️', duration: 12_000, personality: 'CRIMINAL' },
    { description: 'working as medic', emoji: '🏥', duration: 10_000, personality: 'WORKER' },
  ],
};

// Combat and robbery cooldowns
export const ROBBERY_COOLDOWN = 5 * 60_000; // 5 minutes between robbery attempts
export const COMBAT_COOLDOWN = 3 * 60_000; // 3 minutes between fights
export const HOSPITAL_RECOVERY = 2 * 60_000; // 2 minutes in hospital after knockout
export const REVENGE_MEMORY_DURATION = 24 * 60 * 60_000; // Remember robberies for 24 hours

// Zone boundaries for the crime metaverse (assuming 100x100 map)
// These define rectangular regions for each zone
export const ZONE_BOUNDARIES = {
  casino: { minX: 0, maxX: 30, minY: 0, maxY: 30 },
  darkAlley: { minX: 70, maxX: 100, minY: 70, maxY: 100 },
  suburb: { minX: 0, maxX: 30, minY: 70, maxY: 100 },
  underground: { minX: 70, maxX: 100, minY: 0, maxY: 30 },
  downtown: { minX: 30, maxX: 70, minY: 30, maxY: 70 }, // Center area
};

// Helper function to determine zone from position
export function getZoneFromPosition(position: { x: number; y: number }): string {
  for (const [zone, bounds] of Object.entries(ZONE_BOUNDARIES)) {
    if (position.x >= bounds.minX && position.x < bounds.maxX &&
        position.y >= bounds.minY && position.y < bounds.maxY) {
      return zone;
    }
  }
  return 'downtown'; // Default to downtown if outside defined zones
}

// Crime success rates
export const BASE_ROBBERY_SUCCESS = 0.3; // 30% base chance
export const BASE_COMBAT_SUCCESS = 0.5; // 50% base chance
export const PERSONALITY_BONUS = {
  CRIMINAL: { robbery: 0.2, combat: 0.3 },
  GAMBLER: { robbery: 0.1, combat: 0.1 },
  WORKER: { robbery: -0.1, combat: -0.2 },
};

export const ENGINE_ACTION_DURATION = 60000; // Increased to 60 seconds to prevent premature restarts

// Bound the number of pathfinding searches we do per game step.
export const MAX_PATHFINDS_PER_STEP = 16;

export const DEFAULT_NAME = 'Me';
