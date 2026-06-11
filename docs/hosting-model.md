# Hosting Model

## How Sites Are Organized

Each deployed site on Port is an **isolated environment** with its own resources:

```
Port Platform
│
├── Site: "my-site"
│   ├── URL: http://my-site.domain.com
│   ├── DB Schema: site_my_site
│   │   └── documents (collection table)
│   ├── Directory: /data/sites/my-site/
│   │   ├── index.html
│   │   ├── css/
│   │   ├── js/
│   │   └── functions/
│   ├── Worker Thread (if it has functions/)
│   └── Config: port.sites (JSONB columns)
│       ├── config_public
│       └── config_private
│
├── Site: "another-site"
│   ├── URL: http://another-site.domain.com
│   ├── DB Schema: site_another_site
│   └── ...
│
└── Site: "test-app"
    └── ...
```

### Subdomain Routing

Routing is determined by the URL's subdomain:

| Subdomain | Type | Example |
|-----------|------|---------|
| `port.*`, `app.*`, `admin.*` | Admin dashboard | `http://port.domain.com` |
| `localhost`, `127.0.0.1` | Admin (dev) | `http://localhost:10000` |
| `{site-id}.domain` | Deployed site | `http://my-site.domain.com` |
| Unknown | 404 | — |

**In production with Caddy**, the reverse proxy forwards `*.domain.com` to the API, which determines admin vs. site by subdomain.

**In dev**, access `http://{site-id}.localhost:10000` — the browser resolves `*.localhost` to `127.0.0.1`.

---

## Isolation Between Sites

| Resource | Isolation Model |
|---------|----------------|
| **Static files** | Separate directory per site in `/data/sites/{id}/` |
| **Database** | Separate PostgreSQL schema per site (`site_{id}`) |
| **Server Functions** | Dedicated worker thread per site (separate process) |
| **Config** | Row in `port.sites` table with JSONB per site |
| **WebSocket** | Channel namespace per site |

**One site cannot:**
- Read another site's files
- Access another site's database schema
- Send messages to another site's WebSocket channels
- Read or modify another site's config
- See another site's server-side functions

---

## Environment Segmentation

Port supports segmentation through **different domains**. You can run multiple instances of the platform:

| Environment | Domain | Purpose |
|-------------|--------|---------|
| Development | `*.dev.company.com` | AI-generated prototypes, experiments, tests |
| Staging | `*.staging.company.com` | Review before publishing |
| Production | `*.app.company.com` | Live sites |

Each environment is an independent instance of Port (API + DB). The same CLI switches between environments via config:

```bash
# Development
export PORT_API_URL=http://dev.company.com:3000
port deploy ./my-site

# Production
export PORT_API_URL=https://app.company.com
port deploy ./my-site
```

### Benefits of Segmentation

- **AI teams can experiment freely** in dev without production risk
- **Different security policies** per environment (e.g., dev doesn't require auth)
- **Data refresh** — dev DB can be reset periodically
- **Governance** — manual review to promote from staging to production

---

## Scale Considerations

Port is designed for hundreds of lightweight sites, not thousands of heavy applications. For horizontal scale:

- **API**: Fastify 5 is async and lightweight. One instance serves hundreds of concurrent sites.
- **Database**: PostgreSQL 16 with separate schemas. Indexes on `collection` in the `documents` table.
- **Workers**: Each site with functions consumes one thread. The practical limit depends on load.
- **Files**: `/data/sites/` with flat subdirectories. For many files, consider external storage.

> Note: Port is an internal hosting platform. If you need to scale to thousands of sites with high availability, the model needs adaptations (load balancer, database replicas, distributed storage).