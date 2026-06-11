import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyRequest {
    siteContext?: { type: 'admin' | 'site'; siteId?: string; siteDir?: string };
  }
}

export async function siteContextMiddleware(req: FastifyRequest, _reply: FastifyReply) {
  const host = req.hostname; // e.g.: "site-a.xp.inc" or "port.xp.inc"
  const subdomain = host.split('.')[0];

  if (subdomain === 'port' || subdomain === 'app' || subdomain === 'admin' || host === 'localhost' || host === '127.0.0.1') {
    // Admin dashboard
    req.siteContext = { type: 'admin' };
    return;
  }

  // Map subdomain to site folder
  const siteDir = path.join(config.storage.sitesDir, subdomain);
  if (fs.existsSync(siteDir)) {
    req.siteContext = {
      type: 'site',
      siteId: subdomain,
      siteDir,
    };
  } else {
    // Unknown site
    req.siteContext = { type: 'site', siteId: subdomain };
  }
}
