# Mission: Port - Full-Stack Framework — COMPLETE

## M1: Core Platform Features
### T1.1: Functions RPC system | status: completed
- [x] worker_threads per site for isolation
- [x] RPC routes (POST /api/rpc/:namespace/:fn)
- [x] SDK: window.port.functions.*

### T1.2: Config System (DB-backed) | status: completed
- [x] JSONB columns (config_public, config_private) in port.sites
- [x] API: GET/POST/DELETE public + private with dot notation
- [x] Worker reads config from DB
- [x] SDK: window.port.config.get(key)

### T1.3: Admin Dashboard Config UI | status: completed
- [x] Config button in sites table
- [x] Config modal with public/private JSON editors
- [x] API routes accept ?site= query param for admin calls
- [x] TypeScript compiles with 0 errors

### T1.4: Integration Test (Docker) | status: completed
- [x] Docker up → deploy → config → RPC flow
- [x] Verify config UI works end-to-end

### T1.5: Sandbox Worker | status: completed
- [x] Add resourceLimits to worker_threads (48MB/192MB/16MB/4MB)
- [x] Add node:vm for function sandboxing (restricted globals + 15s timeout)

### T1.6: Deploy Real (HTTPS) | status: completed
- [x] HTTPS setup (Caddyfile + docker-compose.prod.yml criados)
- [x] Production env config (.env.example com secrets template)
- [x] DNS + domain instructions documentados

### T1.7: Security Hardening | status: completed
- [x] Block direct access to /functions/, /config/, /node_modules/ in static handler
- [x] Block .env and .git exposure
- [x] Verify static assets still serve correctly after fix
