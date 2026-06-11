import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string; name: string; avatarUrl?: string };
    siteId?: string;
  }
}

const PUBLIC_ROUTES = [
  '/api/health',
  '/api/auth/login',
  '/sdk/port.js',
];

// Páginas SPA que devem servir sem auth (SPA cuida do login state)
const SPA_ROUTES = [
  '/',
  '/index.html',
];

// Assets que NÃO devem redirecionar pro login (só 404)
const STATIC_ASSETS = [
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
];

function isStaticAsset(url: string): boolean {
  const lower = url.toLowerCase();
  return STATIC_ASSETS.some(a =>
    a.startsWith('.') ? lower.endsWith(a) : lower === a
  );
}

// Parseia o Cookie header manualmente e retorna o ÚLTIMO valor de port_session
// Motivo: quando existem cookies duplicados (host-only + Domain),
// queremos o Domain cookie (enviado por último), que é o mais recente.
function getLastSessionToken(cookieHeader: string): string | null {
  const regex = /port_session=([^;]+)/g;
  let match, last = null;
  while ((match = regex.exec(cookieHeader)) !== null) {
    last = match[1];
  }
  return last;
}

// Verifica se há múltiplos port_session (indica host-only + Domain conflitantes)
function hasDuplicateSessions(cookieHeader: string): boolean {
  let count = 0;
  const regex = /port_session=/g;
  let match;
  while ((match = regex.exec(cookieHeader)) !== null) count++;
  return count > 1;
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const url = req.url;
  const method = req.method;

  req.log.info({ url, method, cookie: !!req.cookies?.port_session }, '[AUTH] request');

  // Skip auth for public routes
  if (PUBLIC_ROUTES.some(r => url.startsWith(r))) {
    req.log.info('[AUTH] public route — skip');
    return;
  }
  if (url === '/api/auth/login' && method === 'POST') {
    req.log.info('[AUTH] login POST — skip');
    return;
  }

  // Try to validate session from cookie
  // Usa o raw Cookie header (último valor) em vez de req.cookies (primeiro valor)
  const rawCookie = req.headers.cookie || '';
  const sessionToken = getLastSessionToken(rawCookie);
  const hadDuplicates = hasDuplicateSessions(rawCookie);
  if (sessionToken) {
    try {
      const payload = jwt.verify(sessionToken, config.jwt.secret) as any;
      req.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        avatarUrl: payload.avatar,
      };
      req.log.info({ user: payload.email, hadDuplicates }, '[AUTH] cookie valid — autorizado');

      // Se havia cookies duplicados, limpa o host-only antigo
      if (hadDuplicates) {
        reply.clearCookie('port_session', { path: '/' });
        req.log.info('[AUTH] limpou cookie host-only duplicado');
      }

      return; // Autenticado — permite
    } catch (err) {
      req.log.warn('[AUTH] cookie inválido/expirado — cai no redirect');
    }
  }

  // ── NÃO AUTENTICADO ──
  // Assets estáticos: só retorna 404 (não redireciona pra login)
  if (isStaticAsset(url) && method === 'GET') {
    req.log.info({ url }, '[AUTH] static asset — 404');
    return reply.status(404).send('Not found');
  }

  // SPA routes: serve index.html (SPA cuida do estado de login)
  if (method === 'GET' && SPA_ROUTES.includes(url.split('?')[0])) {
    req.log.info({ url }, '[AUTH] SPA route — allow (SPA handles auth)');
    return; // Deixa o setNotFoundHandler servir o index.html
  }

  // GET de páginas (não API): redireciona pro login preservando URL original
  if (method === 'GET' && !url.startsWith('/api/')) {
    const protocol = req.protocol || 'http';
    const host = req.hostname;
    const port = config.externalPort || config.port;
    const fullUrl = `${protocol}://${host}${port !== 80 && port !== 443 ? ':' + port : ''}${url}`;
    req.log.info({ fullUrl }, '[AUTH] redirect p/ login');
    return reply.redirect(`/api/auth/login?redirect=${encodeURIComponent(fullUrl)}`);
  }

  // API: 401
  if (url.startsWith('/api/')) {
    req.log.warn('[AUTH] API sem auth — 401');
    return reply.status(401).send({ error: 'Unauthorized', message: 'Login required' });
  }

  // Fallback
  return reply.status(401).send({ error: 'Unauthorized' });
}
