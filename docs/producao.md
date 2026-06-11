# Produção

## Pré-requisitos

- Um domínio (ex: `port.minhaempresa.com`)
- DNS apontando para o servidor onde o Port vai rodar
- Portas 80 e 443 abertas (para Caddy + Let's Encrypt)

---

## 1. Configurar o Domínio

No seu provedor de DNS, crie registros:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `port.minhaempresa.com` | IP do servidor |
| A | `*.port.minhaempresa.com` | IP do servidor |

O wildcard `*.port.minhaempresa.com` é necessário para que cada site tenha seu próprio subdomínio (`meu-site.port.minhaempresa.com`).

---

## 2. Configurar o .env

```bash
cp .env.example .env
```

Edite:

```env
PORT=3000
EXTERNAL_PORT=10000
DOMAIN=port.minhaempresa.com            # Seu domínio real

DB_PASSWORD=senha-forte-aqui            # Troque a senha do Postgres
JWT_SECRET=$(openssl rand -hex 32)      # Gere um secret forte

AI_ENDPOINT_URL=https://api.openai.com/v1/chat/completions  # Opcional
AI_API_KEY=sk-proj-xxxxx                                      # Opcional
```

---

## 3. Configurar o Caddyfile

Edite `Caddyfile`:

```caddyfile
port.minhaempresa.com {
    handle_path /api/* { reverse_proxy api:3000 }
    handle_path /sdk/* { reverse_proxy api:3000 }
    handle_path /api/health { reverse_proxy api:3000 }
    handle_path /ws/* { reverse_proxy api:3000 }

    @portHost host port.port.minhaempresa.com
    handle @portHost { reverse_proxy api:3000 }

    handle { reverse_proxy api:3000 }

    log { output file /data/logs/access.log }
}

port.port.minhaempresa.com {
    redir https://port.minhaempresa.com{uri} 301
}

*.port.minhaempresa.com, port.minhaempresa.com {
    @apiHost host api.port.minhaempresa.com
    handle @apiHost { reverse_proxy api:3000 }

    handle { reverse_proxy api:3000 }
}
```

---

## 4. Subir

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

O Caddy vai:
- Obter certificado SSL automaticamente via Let's Encrypt
- Redirecionar HTTP → HTTPS
- Fazer proxy reverso para a API na porta 3000

---

## 5. Verificar

```bash
# Health check
curl https://port.minhaempresa.com/api/health
# → {"status":"ok","version":"1.0.0"}

# Deploy de um site
cd cli && npm install
npx tsx src/index.ts deploy ../../sample/site-a --site meu-site
# → Deployed! Live at: https://meu-site.port.minhaempresa.com
```

---

## 6. Manutenção

### Logs

```bash
docker compose logs api      # Logs da API
docker compose logs caddy    # Logs do Caddy
docker compose logs db       # Logs do PostgreSQL
```

### Backup

```bash
# Backup do banco
docker compose exec db pg_dump -U postgres port > backup-port.sql

# Backup dos sites
tar czf backup-sites.tar.gz /data/sites/

# Backup dos uploads
tar czf backup-uploads.tar.gz /data/uploads/
```

### Atualização

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Resolução de Problemas

### SSL não funciona

Verifique se as portas 80 e 443 estão abertas no firewall:

```bash
# Verificar portas abertas
ss -tlnp | grep -E '(:80|:443)'

# Firewall (exemplo UFW)
ufw allow 80/tcp
ufw allow 443/tcp
```

### Site não aparece

1. Verifique se o DNS resolve:
   ```bash
   dig meu-site.port.minhaempresa.com
   ```
2. Verifique os logs da API:
   ```bash
   docker compose logs api | grep siteContext
   ```
3. Confirme que o site foi criado:
   ```bash
   curl http://localhost:10000/api/sites
   ```

### Worker não inicia

```bash
# Verificar status dos workers
curl http://localhost:10000/api/rpc/status

# Verificar funções no diretório
ls /data/sites/meu-site/functions/
```