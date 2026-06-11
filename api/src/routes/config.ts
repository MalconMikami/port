import { FastifyInstance } from 'fastify';
import { db } from '../services/database.js';

/**
 * Resolve dot-notation path in nested object
 */
function getByPath(obj: Record<string, unknown>, pathStr: string): unknown {
  return pathStr.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Define a value at a dot-notation path in a nested object
 */
function setByPath(obj: Record<string, unknown>, pathStr: string, value: unknown): void {
  const keys = pathStr.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Delete a key at a dot-notation path
 */
function unsetByPath(obj: Record<string, unknown>, pathStr: string): boolean {
  const keys = pathStr.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) return false;
    current = current[keys[i]] as Record<string, unknown>;
  }
  return delete current[keys[keys.length - 1]];
}

function getSiteId(req: any): string | null {
  // Priority: site context (from subdomain) > query param > null
  if (req.siteContext?.type === 'site' && req.siteContext?.siteId) {
    return req.siteContext.siteId;
  }
  const querySite = (req.query as Record<string, string>)?.site;
  if (querySite) return querySite;
  return null;
}

export async function configRoutes(app: FastifyInstance) {
  // ── GET public config ──
  app.get<{ Params: { key?: string }; Querystring: { site?: string } }>('/api/config/:key?', async (req, reply) => {
    const siteId = getSiteId(req);
    if (!siteId) {
      return reply.status(400).send({ error: 'No site context' });
    }

    const result = await db.query('SELECT config_public FROM port.sites WHERE id = $1', [siteId]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Site not found' });
    }

    const config = result.rows[0].config_public || {};
    const key = req.params.key;

    if (key) {
      const value = getByPath(config, key);
      if (value === undefined) {
        return reply.status(404).send({ error: `Key "${key}" not found in public config` });
      }
      return reply.send(value);
    }

    return reply.send(config);
  });

  // ── SET public config ──
  app.post<{ Params: { key: string }; Body: { value: unknown }; Querystring: { site?: string } }>('/api/config/:key', async (req, reply) => {
    const siteId = getSiteId(req);
    if (!siteId) {
      return reply.status(400).send({ error: 'No site context' });
    }

    const key = req.params.key;
    if (!key) {
      return reply.status(400).send({ error: 'Key is required' });
    }

    const { value } = req.body;

    // Get current config, set the key, save
    const result = await db.query('SELECT config_public FROM port.sites WHERE id = $1', [siteId]);
    const config: Record<string, unknown> = result.rows[0]?.config_public || {};

    setByPath(config, key, value);

    await db.query(
      'UPDATE port.sites SET config_public = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(config), siteId]
    );

    return reply.send({ ok: true, key, value });
  });

  // ── DELETE public config key ──
  app.delete<{ Params: { key: string }; Querystring: { site?: string } }>('/api/config/:key', async (req, reply) => {
    const siteId = getSiteId(req);
    if (!siteId) {
      return reply.status(400).send({ error: 'No site context' });
    }

    const key = req.params.key;
    const result = await db.query('SELECT config_public FROM port.sites WHERE id = $1', [siteId]);
    const config: Record<string, unknown> = result.rows[0]?.config_public || {};

    unsetByPath(config, key);

    await db.query(
      'UPDATE port.sites SET config_public = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(config), siteId]
    );

    return reply.send({ ok: true, key });
  });

  // ── GET private config (backend only, NEVER exposed) ──
  // Only callable from within a function/worker context, not directly from browser
  app.get<{ Params: { key?: string }; Querystring: { site?: string } }>('/api/config/private/:key?', async (req, reply) => {
    const siteId = getSiteId(req);
    if (!siteId) {
      return reply.status(400).send({ error: 'No site context' });
    }

    const result = await db.query('SELECT config_private FROM port.sites WHERE id = $1', [siteId]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Site not found' });
    }

    const config = result.rows[0].config_private || {};
    const key = req.params.key;

    if (key) {
      const value = getByPath(config, key);
      if (value === undefined) {
        return reply.status(404).send({ error: `Key "${key}" not found in private config` });
      }
      return reply.send(value);
    }

    return reply.send(config);
  });

  // ── SET private config ──
  app.post<{ Params: { key: string }; Body: { value: unknown }; Querystring: { site?: string } }>('/api/config/private/:key', async (req, reply) => {
    const siteId = getSiteId(req);
    if (!siteId) {
      return reply.status(400).send({ error: 'No site context' });
    }

    const key = req.params.key;
    const { value } = req.body;

    const result = await db.query('SELECT config_private FROM port.sites WHERE id = $1', [siteId]);
    const config: Record<string, unknown> = result.rows[0]?.config_private || {};

    setByPath(config, key, value);

    await db.query(
      'UPDATE port.sites SET config_private = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(config), siteId]
    );

    return reply.send({ ok: true, key, value });
  });

  // ── DELETE private config key ──
  app.delete<{ Params: { key: string }; Querystring: { site?: string } }>('/api/config/private/:key', async (req, reply) => {
    const siteId = getSiteId(req);
    if (!siteId) {
      return reply.status(400).send({ error: 'No site context' });
    }

    const key = req.params.key;
    const result = await db.query('SELECT config_private FROM port.sites WHERE id = $1', [siteId]);
    const config: Record<string, unknown> = result.rows[0]?.config_private || {};

    unsetByPath(config, key);

    await db.query(
      'UPDATE port.sites SET config_private = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(config), siteId]
    );

    return reply.send({ ok: true, key });
  });
}
