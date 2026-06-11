# 🚢 Port

**Internal hosting platform para sites e apps gerados por IA.**

Port é uma plataforma open-source feita para empresas que usam IA para gerar sites e aplicações, mas não têm onde hospedá-los com segurança, governança e simplicidade.

> 📚 Documentação completa em português:
>
> - [Por que Port?](docs/por-que-port.md) — O problema que resolvemos
> - [Capacidades da Plataforma](docs/capacidades.md) — DB, Blob, AI, Functions, SDK
> - [Modelo de Hospedagem](docs/modelo-de-hospedagem.md) — Segmentação por ambiente, isolamento
> - [Segurança e Governança](docs/seguranca.md) — Sandbox, workers, blocking paths
> - [Config Pública e Privada](docs/config.md) — JSONB, dot-notation, admin dashboard
> - [Samples](docs/samples.md) — Exemplos reais com código
> - [Guias e How-Tos](docs/guias.md) — Tutoriais práticos
> - [Produção](docs/producao.md) — Deploy real com Caddy + SSL

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

## O que é Port?

Uma única plataforma que entrega **tudo que um site moderno precisa** com um deploy de 1 comando:

| Capacidade | O que é | Como acessar |
|------------|---------|-------------|
| **Static Serving** | HTML, CSS, JS, imagens | Via URL do site |
| **Banco de Dados** | Schema PostgreSQL dedicado por site | `window.port.db.collection()` |
| **Blob Storage** | Upload e servir arquivos | `window.port.storage.upload()` |
| **AI Endpoint** | Chat com LLM configurável | `window.port.ai.chat()` |
| **Server Functions** | Código backend em sandbox | `window.port.functions.*` |
| **Config** | JSON editável via dashboard | `window.port.config.get()` |
| **Realtime** | WebSocket pub/sub | `window.port.realtime.*` |
| **Auth** | Identidade do usuário | `window.port.user.get()` |

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