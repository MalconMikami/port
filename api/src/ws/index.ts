import { FastifyInstance } from 'fastify';

interface WsClient {
  socket: WebSocket;
  siteId: string;
  userId?: string;
  channels: Set<string>;
}

const clients = new Map<WebSocket, WsClient>();

export function registerWsRoutes(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, (socket, req) => {
    const siteId = req.siteContext?.siteId || 'unknown';
    const userId = req.user?.email;

    const client: WsClient = {
      socket: socket as any,
      siteId,
      userId,
      channels: new Set(),
    };

    clients.set(socket as any, client);
    console.log(`🔌 WS connected: ${siteId} (${userId || 'anon'})`);

    (socket as any).on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'subscribe':
            client.channels.add(msg.channel);
            break;

          case 'unsubscribe':
            client.channels.delete(msg.channel);
            break;

          case 'publish':
            // Broadcast to other clients in the same site + channel
            broadcast(siteId, msg.channel, msg.data, socket as any);
            break;
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    (socket as any).on('close', () => {
      clients.delete(socket as any);
      console.log(`🔌 WS disconnected: ${siteId}`);
    });
  });
}

function broadcast(siteId: string, channel: string, data: any, sender: WebSocket) {
  for (const [socket, client] of clients) {
    if (socket !== sender && client.siteId === siteId && client.channels.has(channel)) {
      try {
        socket.send(JSON.stringify({ channel, data }));
      } catch {
        clients.delete(socket);
      }
    }
  }
}
