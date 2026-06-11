import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../services/database.js';

const MOCK_USERS = [
  { id: 'user-001', email: 'joao@teste.com.br',   name: 'João Silva',   avatarUrl: '' },
  { id: 'user-002', email: 'maria@teste.com.br',  name: 'Maria Santos', avatarUrl: '' },
  { id: 'user-003', email: 'malcon@teste.com.br', name: 'Malcon',       avatarUrl: '' },
];

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function authRoutes(app: FastifyInstance) {
  // ── Mock Login Page (Microsoft-style) ──
  app.get('/login', async (req, reply) => {
    const redirect = (req.query as any)?.redirect || '';
    const hiddenField = redirect ? `<input type="hidden" name="redirect" value="${escHtml(redirect)}">` : '';
    const error = (req.query as any)?.error || '';

    reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Entrar - Port</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-[#f0f0f0] min-h-screen flex items-center justify-center p-4">
        <div class="w-full max-w-[440px] bg-white rounded-lg shadow-[0_2px_6px_rgba(0,0,0,0.2)]">
          <!-- Header -->
          <div class="p-8 pb-4">
            <div class="mb-6">
              <svg viewBox="0 0 21 21" width="36" height="36" fill="#0078d4" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="8" height="8" fill="#0078d4"/>
                <rect x="11" y="1" width="8" height="8" fill="#0078d4"/>
                <rect x="1" y="11" width="8" height="8" fill="#0078d4"/>
                <rect x="11" y="11" width="8" height="8" fill="#0078d4"/>
              </svg>
            </div>

            <h1 class="text-2xl font-semibold text-[#1b1b1b] mb-1">Entrar</h1>
            <p class="text-sm text-[#5e5e5e] mb-6">Use sua conta institucional</p>

            ${error ? `<div class="bg-[#fef2f2] border border-[#f87171] text-[#dc2626] text-sm rounded px-3 py-2 mb-4">${escHtml(error)}</div>` : ''}

            <form id="loginForm" method="POST" action="/api/auth/login">
              ${hiddenField}
              <div class="mb-4">
                <label class="block text-sm font-medium text-[#1b1b1b] mb-1.5" for="email">E-mail</label>
                <input id="email" name="email" type="email"
                       class="w-full border border-[#8b8b8b] rounded px-3 py-2 text-[#1b1b1b] text-sm
                              focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] outline-none
                              placeholder:text-[#8b8b8b] transition-colors"
                       placeholder="nome@teste.com.br"
                       required
                       autofocus>
              </div>

              <button type="submit"
                      class="w-full bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium text-sm py-2 px-4 rounded transition-colors">
                Entrar
              </button>
            </form>
          </div>

          <!-- Footer -->
          <div class="px-8 pb-6">
            <details class="text-xs">
              <summary class="text-[#5e5e5e] cursor-pointer hover:text-[#1b1b1b]">Contas disponíveis</summary>
              <div class="mt-2 space-y-1 text-[#5e5e5e]">
                ${MOCK_USERS.map(u => `<p class="text-xs">• ${u.email}</p>`).join('')}
              </div>
            </details>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // Extrai o domínio raiz do hostname (ex: "sample-crud.localhost" → "localhost", "port.xp.inc" → "xp.inc")
  function getRootDomain(hostname: string): string {
    const parts = hostname.split('.');
    // localhost → localhost (single-label, não remove nada)
    // sample-crud.localhost → localhost (remove 1 label)
    // port.xp.inc → xp.inc (remove 1 label)
    return parts.length >= 2 ? parts.slice(1).join('.') : hostname;
  }

  // ── Mock Login Action ──
  app.post('/login', async (req, reply) => {
    const body = req.body as { email?: string; redirect?: string };
    const email = body?.email?.trim().toLowerCase();

    req.log.info(
      { bodyRedirect: body?.redirect, referer: req.headers.referer, email },
      '[LOGIN] POST /login'
    );

    if (!email || !email.includes('@')) {
      return reply.type('text/html').send(`
        <script>alert('Email inválido'); window.location.href='/api/auth/login';</script>
      `);
    }

    // Only accept known users
    const user = MOCK_USERS.find(u => u.email === email);
    if (!user) {
      const errorMsg = encodeURIComponent('Usuário desconhecido. Use uma das contas institucionais.');
      const redirectTo = `/api/auth/login?error=${errorMsg}`;
      return reply.redirect(redirectTo);
    }

    // Upsert user in database (conflict on unique email)
    await db.query(`
      INSERT INTO port.users (id, email, name, avatar_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET name = $3, id = $1
    `, [user.id, user.email, user.name, user.avatarUrl]);

    // Create session JWT
    const sessionToken = jwt.sign(
      { sub: user.id, email: user.email, name: user.name, avatar: user.avatarUrl },
      config.jwt.secret,
      { expiresIn: '24h' }
    );

    // Set cookies — domain compartilhado entre subdomínios
    const rootDomain = getRootDomain(req.hostname);
    req.log.info({ rootDomain, hostname: req.hostname }, '[LOGIN] definindo domain');
    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: false,
      path: '/',
      maxAge: 86400,
      domain: rootDomain,
    };
    reply.setCookie('port_session', sessionToken, cookieOpts);
    // NOTA: não fazer clearCookie aqui — em alguns navegadores o clear
    // pode acidentalmente limpar o Domain cookie que acabamos de setar.
    // A limpeza é feita automaticamente no authMiddleware quando detecta duplicatas.

    // Redirect to the original URL (from hidden field) or fallback to /
    // NOTA: req.headers.referer aponta pra própria login page, não usar como fallback!
    const redirectTo = body.redirect || '/';
    req.log.info({ redirectTo, bodyRedirect: body.redirect, referer: req.headers.referer }, '[LOGIN] redirect final');
    return reply.redirect(redirectTo);
  });

  // ── Logout ──
  app.get('/logout', async (req, reply) => {
    const rootDomain = getRootDomain(req.hostname);
    reply.clearCookie('port_session', { path: '/', domain: rootDomain });
    reply.redirect('/api/auth/login');
  });
}
