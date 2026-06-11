# Production

## Prerequisites

- A domain (e.g., `port.mycompany.com`)
- DNS pointing to the server running Port
- Ports 80 and 443 open (for Caddy + Let's Encrypt)

---

## 1. Configure DNS

In your DNS provider, create records:

| Type | Name | Value |
|------|------|-------|
| A | `port.mycompany.com` | Server IP |
| A | `*.port.mycompany.com` | Server IP |

The wildcard `*.port.mycompany.com` is required so each site gets its own subdomain (`my-site.port.mycompany.com`).

---

## 2. Configure .env

```bash
cp .env.example .env
```

Edit:

```env
PORT=3000
EXTERNAL_PORT=10000
DOMAIN=port.mycompany.com               # Your real domain

DB_PASSWORD=strong-password-here        # Change Postgres password
JWT_SECRET=$(openssl rand -hex 32)      # Generate a strong secret

AI_ENDPOINT_URL=https://api.openai.com/v1/chat/completions  # Optional
AI_API_KEY=sk-proj-xxxxx                                      # Optional
```

---

## 3. Configure the Caddyfile

Edit `Caddyfile`:

```caddyfile
port.mycompany.com {
    handle_path /api/* { reverse_proxy api:3000 }
    handle_path /sdk/* { reverse_proxy api:3000 }
    handle_path /api/health { reverse_proxy api:3000 }
    handle_path /ws/* { reverse_proxy api:3000 }

    @portHost host port.port.mycompany.com
    handle @portHost { reverse_proxy api:3000 }

    handle { reverse_proxy api:3000 }

    log { output file /data/logs/access.log }
}

port.port.mycompany.com {
    redir https://port.mycompany.com{uri} 301
}

*.port.mycompany.com, port.mycompany.com {
    @apiHost host api.port.mycompany.com
    handle @apiHost { reverse_proxy api:3000 }

    handle { reverse_proxy api:3000 }
}
```

---

## 4. Start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Caddy will:
- Obtain SSL certificate automatically via Let's Encrypt
- Redirect HTTP → HTTPS
- Reverse proxy to the API on port 3000

---

## 5. Verify

```bash
# Health check
curl https://port.mycompany.com/api/health
# → {"status":"ok","version":"1.0.0"}

# Deploy a site
cd cli && npm install
npx tsx src/index.ts deploy ../../sample/site-a --site my-site
# → Deployed! Live at: https://my-site.port.mycompany.com
```

---

## 6. Maintenance

### Logs

```bash
docker compose logs api      # API logs
docker compose logs caddy    # Caddy logs
docker compose logs db       # PostgreSQL logs
```

### Backup

```bash
# Database backup
docker compose exec db pg_dump -U postgres port > backup-port.sql

# Sites backup
tar czf backup-sites.tar.gz /data/sites/

# Uploads backup
tar czf backup-uploads.tar.gz /data/uploads/
```

### Update

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Troubleshooting

### SSL doesn't work

Check that ports 80 and 443 are open on your firewall:

```bash
# Check open ports
ss -tlnp | grep -E '(:80|:443)'

# Firewall (UFW example)
ufw allow 80/tcp
ufw allow 443/tcp
```

### Site doesn't appear

1. Check DNS resolution:
   ```bash
   dig my-site.port.mycompany.com
   ```
2. Check API logs:
   ```bash
   docker compose logs api | grep siteContext
   ```
3. Confirm the site was created:
   ```bash
   curl http://localhost:10000/api/sites
   ```

### Worker doesn't start

```bash
# Check worker status
curl http://localhost:10000/api/rpc/status

# Check functions directory
ls /data/sites/my-site/functions/
```