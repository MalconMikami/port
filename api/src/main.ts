import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyFormbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Routes
import { authRoutes } from './routes/auth.js';
import { siteRoutes } from './routes/sites.js';
import { dbRoutes } from './routes/db.js';
import { aiRoutes } from './routes/ai.js';
import { storageRoutes } from './routes/storage.js';
import { identityRoutes } from './routes/identity.js';
import { rpcRoutes } from './routes/rpc.js';
import { configRoutes } from './routes/config.js';
import { functionRunner } from './services/function-runner.js';
import { siteManager } from './services/site-manager.js';
import { initDatabase } from './services/database.js';

// Middleware
import { authMiddleware } from './middleware/auth.js';
import { siteContextMiddleware } from './middleware/site-context.js';

// WebSocket
import { registerWsRoutes } from './ws/index.js';

const app = Fastify({ logger: true });

// ── Plugins ──
await app.register(fastifyCookie);
await app.register(fastifyCors, { origin: true, credentials: true });
await app.register(fastifyFormbody);
await app.register(fastifyMultipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB
await app.register(fastifyWebsocket);

// Serve admin dashboard (wildcard: false so it doesn't catch API routes)
await app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/',
  wildcard: false,
  serve: false, // we handle serving manually via setNotFoundHandler
});

// ── Middleware (order matters) ──
app.addHook('onRequest', siteContextMiddleware);
app.addHook('onRequest', authMiddleware);

// ── SDK Port — servido pra todos os domínios ──
app.get('/sdk/port.js', async (_req, reply) => {
  // Procura em ~/sdk/port.js (fora do build context) e copia pra /app/public/
  const candidates = [
    path.join(__dirname, '..', 'public', 'sdk', 'port.js'),   // via Dockerfile COPY
    '/app/sdk/port.js',                                         // via volume mount
  ];
  for (const fp of candidates) {
    try {
      const content = fs.readFileSync(fp);
      return reply.type('application/javascript').header('Cache-Control', 'no-cache').send(content);
    } catch { /* try next */ }
  }
  return reply.status(404).send({ error: 'SDK not found' });
});

// ── Routes ──
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(siteRoutes, { prefix: '/api/sites' });
await app.register(dbRoutes, { prefix: '/api/db' });
await app.register(aiRoutes, { prefix: '/api/ai' });
await app.register(storageRoutes, { prefix: '/api/storage' });
await app.register(identityRoutes, { prefix: '/api/identity' });
await app.register(rpcRoutes);
await app.register(configRoutes);

// WebSocket
registerWsRoutes(app);

// Health check (public)
app.get('/api/health', async () => ({ status: 'ok', version: '1.0.0' }));

// ── Static site serving (wildcard subdomain) ──
app.setNotFoundHandler(async (req, reply) => {
  // Admin dashboard — serve SPA (client-side routing)
  if (req.siteContext?.type === 'admin') {
    return reply.sendFile('index.html');
  }

  // Serve site files
  if (req.siteContext?.type === 'site' && req.siteContext.siteDir) {
    // 🔒 Security: block access to sensitive directories
    const blockedPrefixes = ['/functions/', '/config/', '/node_modules/', '.env', '.git'];
    const normalized = req.url.split('?')[0].split('#')[0]; // no query/hash
    if (blockedPrefixes.some(p => normalized.startsWith(p) || normalized.includes(p))) {
      return reply.status(403).type('text/html').send('<h1>403 - Acesso negado</h1>');
    }
    const filePath = path.join(req.siteContext.siteDir, normalized === '/' ? 'index.html' : normalized);
    try {
      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime: Record<string, string> = {
        '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
        '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain',
        '.ico': 'image/x-icon', '.webp': 'image/webp',
      };
      return reply.type(mime[ext] || 'application/octet-stream').send(content);
    } catch {
      return reply.status(404).type('text/html').send('<h1>404 - Página não encontrada</h1>');
    }
  }

  // Fallback
  return reply.status(404).send({ error: 'Not found' });
});

// ── Start workers for existing sites ──
async function startExistingWorkers() {
  try {
    const sites = await siteManager.list();
    for (const site of sites) {
      const siteDir = path.join(config.storage.sitesDir, site.id);
      if (functionRunner.hasFunctions(siteDir)) {
        console.log(`[boot] Starting worker for ${site.id}`);
        functionRunner.start(site.id, siteDir);
      }
    }
    console.log(`[boot] Workers started: ${functionRunner.activeCount}`);
  } catch (err) {
    console.error('[boot] Failed to start existing workers:', err);
  }
}

// ── Start ──
const start = async () => {
  try {
    // Initialize database schema and run migrations
    await initDatabase();

    // Start workers for any existing sites with functions/
    await startExistingWorkers();

    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚢 Port server running at http://localhost:${config.port}`);
    console.log(`📡 Domain: ${config.domain}`);
    console.log(`🔐 Auth: Mock (dev mode)`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };
