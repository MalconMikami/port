# 🚢 Port

**Internal hosting platform for AI-generated sites and apps.**

Port is an open-source platform built for a simple problem: non-technical people create sites with AI tools, they work beautifully on `localhost`, but there's nowhere to put them.

A product manager generates a landing page with Claude. A marketing intern builds a CRUD dashboard with ChatGPT. An innovation team prototypes an internal tool with Cursor. The sites work — but they live on someone's laptop, shared via screenshots or fragile `localhost` tunnels.

The company's infrastructure (AWS, GCP, Azure) is managed by a platform team that runs the main applications. It doesn't make sense to add these AI-generated experiments to the same deployment pipelines, same Kubernetes clusters, same CI/CD that the engineering team uses. They're different in nature: lighter, more ephemeral, faster to create, faster to discard. They need a different home.

**Port is that home.** A unified place where anyone can deploy a site with a single ZIP upload and immediately get static serving, a dedicated database, an AI endpoint, server-side functions, file storage, and a client SDK — all isolated, all governed, all visible from a single dashboard. No CI. No Dockerfiles. No platform team bottleneck.

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

---

## What Port Gives You

| Capability | What it is | How to use it |
|------------|-----------|---------------|
| **Static Serving** | HTML, CSS, JS, images | Site URL |
| **Database** | Dedicated PostgreSQL schema per site | `window.port.db.collection()` |
| **Blob Storage** | File upload & serve | `window.port.storage.upload()` |
| **AI Endpoint** | Configurable LLM chat | `window.port.ai.chat()` |
| **Server Functions** | Sandboxed backend code | `window.port.functions.*` |
| **Config** | JSON editable via dashboard | `window.port.config.get()` |
| **Realtime** | WebSocket pub/sub | `window.port.realtime.*` |
| **Auth** | User identity | `window.port.user.get()` |

---

## Architecture

```
Browser ──► Port API (Fastify 5)
                │
        ┌───────┼───────────┐
        ▼       ▼           ▼
    Postgres  /data/sites  Worker Threads
    (schema   │ (files)    │ (sandbox)
     per site)│            │
              │            │
        ┌─────┴─────┐      │
        │  SDK JS   │◄─────┘
        │ /sdk/port │
        └───────────┘
```

---

## Packages

| Package | Type | Entrypoint |
|---------|------|------------|
| `api/` | Fastify 5 server (TS, ESM) | `src/main.ts` |
| `cli/` | Commander.js CLI (TS, ESM) | `src/index.ts` |
| `sdk/` | Vanilla JS client library | `port.js` |

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

---

## License

MIT