import { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export async function aiRoutes(app: FastifyInstance) {
  // Chat proxy — forwards to configured AI endpoint
  app.post('/chat', async (req, reply) => {
    if (!config.ai.endpoint) {
      return reply.status(501).send({ error: 'AI endpoint not configured' });
    }

    const { messages, model, stream } = req.body as {
      messages: Array<{ role: string; content: string }>;
      model?: string;
      stream?: boolean;
    };

    try {
      const aiRes = await fetch(config.ai.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ai.apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4',
          messages,
          stream: stream || false,
        }),
      });

      if (!aiRes.ok) {
        const err = await aiRes.text();
        return reply.status(502).send({ error: `AI upstream error: ${err}` });
      }

      if (stream) {
        // Pass through streaming response
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
        for await (const chunk of aiRes.body as any) {
          reply.raw.write(chunk);
        }
        reply.raw.end();
        return;
      }

      return aiRes.json();
    } catch (err: any) {
      return reply.status(502).send({ error: `AI proxy error: ${err.message}` });
    }
  });
}
