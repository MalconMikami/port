import { FastifyInstance } from 'fastify';
import { siteManager } from '../services/site-manager.js';

export async function siteRoutes(app: FastifyInstance) {
  // List all sites
  app.get('/', async (_req, reply) => {
    const sites = await siteManager.list();
    return sites;
  });

  // Deploy a new site (upload ZIP)
  app.post('/', async (req, reply) => {
    try {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      // Site name: query param > multipart field > filename
      let siteName = String((req.query as any)?.name || '').trim();

      if (!siteName) {
        const rawSiteName = (data.fields as any)?.siteName;
        if (rawSiteName?.value) siteName = String(rawSiteName.value).trim();
        else if (typeof rawSiteName === 'string') siteName = rawSiteName.trim();
      }

      if (!siteName) {
        siteName = (data.filename || '').replace(/\.zip$/i, '').trim();
      }

      const zipBuffer = await data.toBuffer();

      const result = await siteManager.deploy(
        siteName.toLowerCase(),
        zipBuffer,
        req.user?.id
      );

      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Delete a site
  app.delete('/:name', async (req, reply) => {
    const { name } = req.params as { name: string };

    try {
      await siteManager.delete(name);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
