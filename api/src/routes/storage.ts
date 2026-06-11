import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

export async function storageRoutes(app: FastifyInstance) {
  // Upload a file
  app.post('/upload', async (req, reply) => {
    const siteId = req.siteContext?.siteId;
    if (!siteId) return reply.status(400).send({ error: 'No site context' });

    try {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const fileName = `${Date.now()}-${data.filename}`;
      const siteUploadDir = path.join(config.storage.uploadsDir, siteId);

      fs.mkdirSync(siteUploadDir, { recursive: true });
      fs.writeFileSync(path.join(siteUploadDir, fileName), buffer);

      return {
        id: fileName,
        url: `/api/storage/${fileName}`,
        size: buffer.length,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Download/retrieve a file
  app.get('/:fileId', async (req, reply) => {
    const siteId = req.siteContext?.siteId;
    const { fileId } = req.params as { fileId: string };

    if (!siteId) return reply.status(400).send({ error: 'No site context' });

    const filePath = path.join(config.storage.uploadsDir, siteId, fileId);
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'File not found' });
    }

    return reply.sendFile(filePath);
  });
}
