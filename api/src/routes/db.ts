import { FastifyInstance } from 'fastify';
import { db } from '../services/database.js';

function schemaFor(siteId?: string) {
  if (!siteId) throw new Error('No site context');
  return `site_${siteId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

export async function dbRoutes(app: FastifyInstance) {
  // Create a document
  app.post('/:collection/create', async (req, reply) => {
    const { collection } = req.params as { collection: string };
    const data = req.body as Record<string, any>;
    const siteId = req.siteContext?.siteId;

    if (!siteId) return reply.status(400).send({ error: 'No site context' });

    try {
      const schema = schemaFor(siteId);
      const result = await db.query(
        `INSERT INTO ${schema}.documents (collection, data, created_by) 
         VALUES ($1, $2, $3) RETURNING *`,
        [collection, JSON.stringify(data), req.user?.email || null]
      );
      return result.rows[0];
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // List documents in a collection
  app.post('/:collection/list', async (req, reply) => {
    const { collection } = req.params as { collection: string };
    const siteId = req.siteContext?.siteId;

    if (!siteId) return reply.status(400).send({ error: 'No site context' });

    try {
      const schema = schemaFor(siteId);
      const result = await db.query(
        `SELECT * FROM ${schema}.documents 
         WHERE collection = $1 
         ORDER BY created_at DESC`,
        [collection]
      );
      return result.rows;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Update a document
  app.post('/:collection/update', async (req, reply) => {
    const { collection } = req.params as { collection: string };
    const { id, ...data } = req.body as Record<string, any>;
    const siteId = req.siteContext?.siteId;

    if (!siteId) return reply.status(400).send({ error: 'No site context' });

    try {
      const schema = schemaFor(siteId);
      const result = await db.query(
        `UPDATE ${schema}.documents 
         SET data = $1, updated_at = NOW()
         WHERE id = $2 AND collection = $3
         RETURNING *`,
        [JSON.stringify(data), id, collection]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Document not found' });
      }
      return result.rows[0];
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Delete a document (only the creator can delete)
  app.post('/:collection/delete', async (req, reply) => {
    const { collection } = req.params as { collection: string };
    const { id } = req.body as { id: string };
    const siteId = req.siteContext?.siteId;

    if (!siteId) return reply.status(400).send({ error: 'No site context' });
    if (!req.user) return reply.status(401).send({ error: 'Not authenticated' });

    try {
      const schema = schemaFor(siteId);
      const result = await db.query(
        `DELETE FROM ${schema}.documents 
         WHERE id = $1 AND collection = $2 AND created_by = $3
         RETURNING id`,
        [id, collection, req.user.email]
      );

      if (result.rows.length === 0) {
        // Check if the document exists but belongs to someone else
        const exists = await db.query(
          `SELECT id, created_by FROM ${schema}.documents WHERE id = $1 AND collection = $2`,
          [id, collection]
        );
        if (exists.rows.length > 0) {
          return reply.status(403).send({ error: 'Apenas o criador pode excluir este item' });
        }
        return reply.status(404).send({ error: 'Document not found' });
      }
      return { success: true, id };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
