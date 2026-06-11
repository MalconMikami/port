import { FastifyInstance } from 'fastify';

export async function identityRoutes(app: FastifyInstance) {
  // Get current user identity
  app.get('/me', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    return {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      avatarUrl: req.user.avatarUrl,
      site: req.siteContext?.type === 'site' ? req.siteContext.siteId : null,
    };
  });
}
