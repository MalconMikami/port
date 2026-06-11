# Security and Governance

## Philosophy

AI-generated sites represent a new risk for companies: code that **works**, but that no one has reviewed line by line. Port is designed so this code can run safely even without full manual review.

The principle is: **trust zero, isolate everything**.

---

## Worker Isolation (Functions)

Each site with a `functions/` directory gets a **dedicated worker thread**. Inside it, functions run in a **`node:vm` sandbox** with severe restrictions:

```js
// Globals allowed in the sandbox
Object, Array, String, Number, Boolean,
Map, Set, WeakMap, WeakSet,
Promise, Error, TypeError, RangeError, SyntaxError,
JSON, Math, Date, RegExp, parseInt, parseFloat,
isNaN, isFinite, NaN, Infinity, undefined,
console, setTimeout, clearTimeout, setInterval, clearInterval,
Buffer, Uint8Array, ArrayBuffer,
TextEncoder, TextDecoder

// ❌ NOT available:
require          // no npm modules
process          // no system access
fs               // no filesystem
net, http        // no arbitrary network
child_process    // no command execution
import           // no dynamic imports (beyond allowed)
```

### Resource Limits

```js
resourceLimits: {
  maxYoungGenerationSizeMb: 32,   // heap young gen
  maxOldGenerationSizeMb: 128,    // heap old gen
  codeRangeSizeMb: 16,            // JIT code cache
  stackSizeMb: 4,                 // stack
}
```

- **Execution timeout**: 15 seconds per function call (30s at RPC layer)
- **Memory limit**: 160MB total heap (128+32)
- **Stack limit**: 4MB

If a function exceeds any limit, the worker is killed and restarted automatically on next deploy.

### What the function can do

The function receives a `port` object with controlled access:

```js
export async function myFunction(args, { port, userId }) {
  // ✅ Access YOUR SITE's database
  await port.db.collection('data').create({ ... });

  // ✅ Call AI
  await port.ai.chat({ messages });

  // ✅ Read your site's public config
  await port.config.get('key');

  // ✅ Read your site's private config (backend only)
  await port.config.private('apiKey');

  // ✅ Read storage files
  await port.storage.get('fileId');

  // ❌ Cannot access another site's data
  // ❌ Cannot read files outside /data/uploads/
  // ❌ Cannot make arbitrary HTTP requests
}
```

---

## Static File Protection

The `setNotFoundHandler` blocks access to sensitive paths in deployed sites:

```js
const blockedPrefixes = [
  '/functions/',    // server-side code (executable, not servable)
  '/config/',       // configuration files
  '/node_modules/', // npm dependencies
  '.env',           // environment variables
  '.git'            // version history
];
```

Any request to these paths returns **403 Forbidden**.

To add new sensitive paths, edit the `blockedPrefixes` array in `api/src/main.ts`.

---

## Database Isolation

Each site has its own PostgreSQL schema:

```sql
-- Site "my-site" → schema "site_my_site"
CREATE SCHEMA IF NOT EXISTS site_my_site;

CREATE TABLE site_my_site.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection VARCHAR(100) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**SQL Injection protection**: the schema name is sanitized before being used in queries:

```js
function sanitizeSchema(name: string): string {
  return 'site_' + name.replace(/[^a-zA-Z0-9_]/g, '_');
}
```

This prevents malicious site names like `my-site; DROP TABLE` from causing damage.

---

## Config Model

| Type | Visibility | Example | Risk |
|------|-----------|---------|------|
| `config_public` | Frontend + Backend | Site theme, public text | Low |
| `config_private` | Backend only | API keys, passwords, internal endpoints | High |

The `/api/config/private/*` route exists in the API, but the frontend never calls it directly — only server-side functions have access.

---

## Subdomain Routing

The `siteContextMiddleware` determines the request context by subdomain:

- `port.*`, `app.*`, `admin.*`, `localhost` → **Admin dashboard** (management interface access)
- `{siteId}.domain` → **Deployed site** (serves static files + public API)

One site cannot access another site's admin dashboard via subdomain.

---

## Security Recommendations

### For production

1. **Change the JWT secret** — `openssl rand -hex 32` and put it in `.env`
2. **Configure AI endpoint with a real key** — or leave empty if not used
3. **Set a real domain** in `DOMAIN` in `.env` and in the `Caddyfile`
4. **Use a strong PostgreSQL password** — change `DB_PASSWORD` in `.env`
5. **Run behind Caddy** — automatic SSL via Let's Encrypt
6. **Monitor workers** via `GET /api/rpc/status`

### Recommended policies

- **Review functions before production deploy** — the sandbox mitigates risks but doesn't replace review
- **Private config should never contain cross-site shared secrets** — each site has its own config
- **Separate environments** — dev and production in different Port instances
- **Clean up unused sites** — orphaned data accumulates risk

---

## Risk Matrix

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Site injects malicious SQL | Low | Sanitized schema name, parameterized queries via `pg` |
| Site tries to read another site's files | Low | Separate directories, blocking paths |
| Site tries to access another site's database | Very Low | Separate schemas, per-worker pool |
| Function tries to execute malicious code | Medium | VM sandbox + resource limits + timeout |
| Function enters infinite loop | Low | 15s timeout + resource limits |
| Private config leaks to frontend | Very Low | Private route never exposed publicly |
| Brute force attack on dashboard | Medium | (to implement: rate limiting) |