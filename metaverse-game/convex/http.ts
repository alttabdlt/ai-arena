import { httpRouter } from 'convex/server';
import { handleReplicateWebhook } from './music';
import { 
  handleBotRegistration, 
  handleBotPositionUpdate, 
  handleBotStatsSync,
  handleGetBotPosition,
  handleLootboxSync,
  handleBotDeletion
} from './aiTown/botHttp';

const http = httpRouter();

// Music generation webhook
http.route({
  path: '/replicate_webhook',
  method: 'POST',
  handler: handleReplicateWebhook,
});

// AI Arena bot integration endpoints
http.route({
  path: '/api/bots/register',
  method: 'POST',
  handler: handleBotRegistration,
});

http.route({
  path: '/api/bots/update-position',
  method: 'POST',
  handler: handleBotPositionUpdate,
});

http.route({
  path: '/api/bots/sync-stats',
  method: 'POST',
  handler: handleBotStatsSync,
});

http.route({
  path: '/api/bots/get-position',
  method: 'POST',
  handler: handleGetBotPosition,
});

http.route({
  path: '/api/lootbox/sync',
  method: 'POST',
  handler: handleLootboxSync,
});

http.route({
  path: '/api/bots/delete',
  method: 'POST',
  handler: handleBotDeletion,
});

export default http;
