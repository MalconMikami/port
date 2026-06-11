# 🚢 Port

**Host AI-generated sites and apps with zero config.**

Port is an open-source internal hosting platform designed for people who aren't DevOps engineers. Upload a ZIP → get a live site with static serving, a dedicated database, an AI endpoint, server-side functions, and a client SDK — all included.

Built for the age of AI-generated code: no CI, no Dockerfiles, no infrastructure knowledge required.

---

## Quick Start

```bash
# 1. Start the platform (API + Postgres)
docker compose up -d

# 2. Deploy a sample site
cd cli && npm install
npx tsx src/index.ts deploy ../sample/site-a
```

Your site is live at `http://site-a.localhost:10000`.

Or deploy via the admin dashboard at `http://localhost:10000`.

---

## Deploy a Site

### CLI

```bash
cd cli && npm install

# Deploy a folder
npx tsx src/index.ts deploy ./my-site

# Deploy a ZIP
npx tsx src/index.ts deploy ./my-site.zip

# Custom site name
npx tsx src/index.ts deploy ./my-site --site my-custom-name
```

### Admin Dashboard

Open `http://localhost:10000` and upload a ZIP through the UI.

### What a Site Needs

A valid site is a folder with:

```
my-site/
├── index.html          # required — landing page
├── css/                # optional
├── js/                 # optional
├── img/                # optional
└── functions/          # optional — server-side RPC functions
    └── itens.js
```

Each site gets:
- **Static file serving** — HTML, CSS, JS, images served with correct MIME types
- **A dedicated Postgres schema** — `site_{id}` with a `documents` table
- **Server-side functions** — JS files in `functions/` run in sandboxed worker threads
- **AI endpoint** — configurable, accessible from frontend and backend
- **File storage** — upload and serve files via API

---

## The SDK

Add one line to your site's HTML:

```html
<script src="/sdk/port.js"></script>
```

Then use `window.port` in your frontend code:

```js
// Database — full CRUD per collection
await window.port.db.collection('items').create({ name: 'Keyboard', price: 299 })
await window.port.db.collection('items').list()
await window.port.db.collection('items').update('uuid', { price: 349 })
await window.port.db.collection('items').delete('uuid')

// AI chat
const reply = await window.port.ai.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
})

// Config (stored in DB, editable from admin dashboard)
const theme = await window.port.config.get('theme.primaryColor')

// File storage
const file = await window.port.storage.upload(fileInput.files[0])
const url = window.port.storage.getUrl(file.id)

// User identity
const user = await window.port.user.get()

// Real-time pub/sub
const ws = window.port.realtime.connect()
window.port.realtime.subscribe('chat', (data) => console.log(data))

// RPC — calls server-side functions in sandboxed workers
await window.port.functions.itens.create({ name: 'Keyboard', price: 299 })
await window.port.functions.itens.list()
```

### Server-side Functions

Functions run in isolated `worker_threads` with a `node:vm` sandbox — no `require`, `process`, or `fs` access. Each function receives the server-side Port SDK (`port.db`, `port.ai`, `port.config`, `port.storage`).

```js
// my-site/functions/itens.js
export async function create({ name, price }, { port, userId }) {
  if (!name || name.length < 2) throw new Error('Name too short');
  return port.db.collection('itens').create({ name, price, owner: userId });
}

export async function list({ owner }, { port }) {
  const result = await port.db.collection('itens').list();
  if (owner) result.docs = result.docs.filter(d => d.owner === owner);
  return result;
}
```

---

## Architecture

```
┌─────────────┐    ┌──────────────────────────────────┐
│   Browser   │ ── │         Port API (Fastify 5)     │
│  (site or   │    │  ┌──────┐ ┌──────┐ ┌──────────┐ │
│   admin)    │    │  │Auth  │ │Routes│ │Worker    │ │
└─────────────┘    │  │Middleware│ │/api/*│ │Threads  │ │
                   │  └──────┘ └──────┘ │per site  │ │
                          │              └──────────┘ │
                          ▼                           │
                   ┌──────────┐                       │
                   │ Postgres │    ┌────────────────┐ │
                   │  16      │    │  /data/sites/  │ │
                   └──────────┘    │  {siteId}/     │ │
                                   │   index.html   │ │
                                   │   functions/   │ │
                                   └────────────────┘ │
                   ┌──────────┐                       │
                   │  Caddy   │  (prod: SSL + proxy)  │
                   └──────────┘                       │
                   ┌──────────┐                       │
                   │   SDK    │  served at /sdk/port.js│
                   └──────────┘                       │
└──────────────────────────────────────────────────────┘
```

### Packages

| Package | Type | Entrypoint |
|---------|------|------------|
| `api/` | Fastify 5 server (TS, ESM) | `src/main.ts` |
| `cli/` | Commander.js CLI (TS, ESM) | `src/index.ts` |
| `sdk/` | Vanilla JS client library | `port.js` |

---

## Config

Copy `.env.example` to `.env` and adjust:

```env
PORT=3000               # Internal API port
EXTERNAL_PORT=10000     # Exposed port (docker)
DOMAIN=localhost        # Your domain (prod: port.example.com)
DB_HOST=db              # Postgres host
DB_PASSWORD=port_secret # Change in production
JWT_SECRET=dev-secret-change-in-production  # `openssl rand -hex 32` in prod
AI_ENDPOINT_URL=        # Optional: OpenAI-compatible API
AI_API_KEY=             # Optional: AI API key
```

---

## Production

```bash
# 1. Set up .env with real domain and secrets
# 2. Replace DOMAIN.example.com in Caddyfile
# 3. Start with production profile
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Development

```bash
# API (hot reload)
cd api && npm install && npm run dev

# CLI
cd cli && npm install && npm run dev

# Type checking
cd api && npm run typecheck

# Full stack with Docker
docker compose up -d
```

No test runner, no lint config, no CI — this is early-stage. Contributions welcome.

---

## License

MIT