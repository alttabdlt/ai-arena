import { WebSocketServer, WebSocket } from 'ws';
import { Redis } from 'ioredis';

interface WSClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
}

export function setupWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });
  const clients = new Map<string, WSClient>();
  const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  subscriber.psubscribe('price:*', 'graduation:*', 'tournament:*');

  subscriber.on('pmessage', (pattern, channel, message) => {
    const data = JSON.parse(message);
    
    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (channel.startsWith('price:') && client.subscriptions.has(channel)) {
          client.ws.send(JSON.stringify({
            type: 'PRICE_UPDATE',
            data,
          }));
        } else if (channel === 'graduation:event') {
          client.ws.send(JSON.stringify({
            type: 'GRADUATION_EVENT',
            data,
          }));
        }
      }
    });
  });

  wss.on('connection', (ws) => {
    const clientId = generateClientId();
    const client: WSClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
    };
    
    clients.set(clientId, client);
    console.log(`Client ${clientId} connected`);

    ws.send(JSON.stringify({
      type: 'CONNECTION_ESTABLISHED',
      clientId,
    }));

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'SUBSCRIBE':
            if (message.channel) {
              client.subscriptions.add(message.channel);
              ws.send(JSON.stringify({
                type: 'SUBSCRIBED',
                channel: message.channel,
              }));
            }
            break;
            
          case 'UNSUBSCRIBE':
            if (message.channel) {
              client.subscriptions.delete(message.channel);
              ws.send(JSON.stringify({
                type: 'UNSUBSCRIBED',
                channel: message.channel,
              }));
            }
            break;
            
          case 'PING':
            ws.send(JSON.stringify({ type: 'PONG' }));
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`Client ${clientId} disconnected`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });
  });

  const interval = setInterval(() => {
    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
    subscriber.disconnect();
  });

  return wss;
}

function generateClientId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}