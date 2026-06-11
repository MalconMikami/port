# Port — Internal Hosting Platform

**Purpose**: A framework for non-technical people to host AI-generated sites and apps. Deploy is a single ZIP upload (via CLI `port deploy` or admin dashboard). Each site gets static file serving, a dedicated DB schema, an AI endpoint, server-side functions (with sandboxed workers), and a client SDK (`/sdk/port.js`).

## Structure

No root package.json. `api/`, `cli/`, `sdk/` are independent — each has its own `node_modules/`, `package-lock.json`, and `tsconfig.json`. Install dependencies per directory, not from root.

| Package | Type | Entrypoint | NPM name |
|---------|------|------------|----------|
| `api/` | Fastify 5 server (ESM, TS) | `src/main.ts` | `port-api` |
| `cli/` | Commander.js CLI (ESM, TS) | `src/index.ts` | `@xp/port-cli` |
| `sdk/` | Vanilla JS client lib | `port.js` | `@xp/port-sdk` |

## Commands

Run each from the package directory:

```
# API — dev, typecheck, build
cd api
npm run dev          # tsx watch src/main.ts
npm run typecheck    # tsc --noEmit
npm run build        # tsc → dist/
npm run start        # node dist/main.js

# CLI
cd cli
npm run dev          # tsx src/index.ts
npm run build        # tsc → dist/
```

**No tests exist anywhere** — no test runner, no test files, no test dependencies.

**No lint, formatter, or CI config** exists.

## Docker

```bash
# Dev (API + Postgres)
docker compose up -d

# Production (adds Caddy + SSL)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

- `init.sql` mounts as `docker-entrypoint-initdb.d/init.sql` — runs on first DB startup (creates `port` schema, `users`, `sites` tables)
- `entrypoint.sh` creates `/data/sites` and `/data/uploads` with correct permissions before starting the app
- `api/public/sdk/port.js` is a copy of `sdk/port.js` for Docker — the API also falls back to `/app/sdk/port.js` via volume mount
- Caddyfile uses placeholder `DOMAIN.example.com` — **must replace** with real domain before prod deploy

## Architecture notes

- **Subdomain routing**: `siteContextMiddleware` reads `req.hostname` subdomain to decide if request targets the admin dashboard (`port.*`, `app.*`, `admin.*`, `localhost`) or a deployed site (`{siteId}.domain`)
- **API routes with `?site=` param**: admin routes for RPC and config accept `?site={id}` to target a specific site (used from admin dashboard)
- **Worker isolation**: Each site with `functions/` gets a `worker_thread`. Functions run inside a `node:vm` sandbox with restricted globals (no `require`, `process`, `fs`) and resource limits (48MB heap, 4MB stack, 15s timeout)
- **Dev worker mode**: In dev, `worker-rpc.ts` detects `.ts` suffix to boot workers with `tsx/esm`. In prod, precompiled `.js` is used
- **ESM import convention**: All TypeScript imports use `.js` extension (Node ESM)

## SDK

- Served at `/sdk/port.js` by the API — loaded via `<script src="/sdk/port.js"></script>` in deployed sites
- Provides `window.port` with: functions (Proxy-based RPC), `db.collection(name)`, `ai.chat()`, `config.get()`, `storage.upload()`, `user.get()`, `realtime` (WebSocket pub/sub)

## Config

| Source | Location | Contents |
|--------|----------|----------|
| API env | `.env` at repo root | DB creds, JWT secret, AI endpoint, storage paths |
| CLI config | `~/.config/port/config.json` | API URL, domain, session token |
| Site config | `port.sites` table (JSONB columns) | `config_public` (client-visible), `config_private` (backend-only) |

## Static serving security

The API `setNotFoundHandler` blocks access to sensitive paths in deployed sites: `/functions/`, `/config/`, `/node_modules/`, `.env`, `.git`. Adding new sensitive paths should update this block list.