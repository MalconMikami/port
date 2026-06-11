# Modelo de Hospedagem

## Como os sites são organizados

Cada site deployado no Port é um **ambiente isolado** com seus próprios recursos:

```
Port Platform
│
├── Site: "meu-site"
│   ├── URL: http://meu-site.dominio.com
│   ├── Schema DB: site_meu_site
│   │   └── documents (tabela para coleções)
│   ├── Diretório: /data/sites/meu-site/
│   │   ├── index.html
│   │   ├── css/
│   │   ├── js/
│   │   └── functions/
│   ├── Worker Thread (se tiver functions/)
│   └── Config: port.sites (JSONB columns)
│       ├── config_public
│       └── config_private
│
├── Site: "outro-site"
│   ├── URL: http://outro-site.dominio.com
│   ├── Schema DB: site_outro_site
│   └── ...
│
└── Site: "app-teste"
    └── ...
```

### Subdomain Routing

O roteamento é feito pelo subdomínio da URL:

| Subdomínio | Tipo | Exemplo |
|------------|------|---------|
| `port.*`, `app.*`, `admin.*` | Admin dashboard | `http://port.dominio.com` |
| `localhost`, `127.0.0.1` | Admin (dev) | `http://localhost:10000` |
| `{site-id}.dominio` | Site deployado | `http://meu-site.dominio.com` |
| Desconhecido | 404 | — |

**Em produção com Caddy**, o proxy reverso encaminha `*.dominio.com` para a API, que decide se é admin ou site pelo subdomínio.

**Em dev**, acesse `http://{site-id}.localhost:10000` — o navegador resolve `*.localhost` para `127.0.0.1`.

---

## Isolamento entre Sites

| Recurso | Modelo de Isolamento |
|---------|---------------------|
| **Arquivos estáticos** | Diretório separado por site em `/data/sites/{id}/` |
| **Banco de dados** | Schema PostgreSQL separado por site (`site_{id}`) |
| **Server Functions** | Worker thread dedicada por site (processo separado) |
| **Config** | Linha na tabela `port.sites` com JSONB por site |
| **WebSocket** | Namespace de canais por site |

**Um site não consegue:**
- Ler arquivos de outro site
- Acessar o schema de banco de outro site
- Enviar mensagens para os canais WebSocket de outro site
- Ler ou alterar a config de outro site
- Ver as funções server-side de outro site

---

## Segmentação por Ambiente

O Port suporta segmentação via **domínios diferentes**. Você pode rodar múltiplas instâncias da plataforma:

| Ambiente | Domínio | Propósito |
|----------|---------|-----------|
| Desenvolvimento | `*.dev.empresa.com` | Protótipos gerados por IA, testes |
| Homologação | `*.staging.empresa.com` | Revisão antes de publicar |
| Produção | `*.app.empresa.com` | Sites ao vivo |

Cada ambiente é uma instância independente do Port (API + DB). A mesma CLI pode alternar entre ambientes via config:

```bash
# Desenvolvimento
export PORT_API_URL=http://dev.empresa.com:3000
port deploy ./meu-site

# Produção
export PORT_API_URL=https://app.empresa.com
port deploy ./meu-site
```

### Benefícios da segmentação

- **Times de IA podem experimentar livremente** em dev sem risco de afetar produção
- **Políticas de segurança diferentes** por ambiente (ex: dev não precisa de autenticação)
- **Refresh de dados** — DB de dev pode ser resetado periodicamente
- **Governança** — revisão manual para promover de staging para produção

---

## Considerações de Escala

O Port é desenhado para centenas de sites leves, não para milhares de aplicações pesadas. Para escala horizontal:

- **API**: Fastify 5 é assíncrono e leve. Uma instância serve centenas de sites simultâneos.
- **Banco**: PostgreSQL 16 com schemas separados. Índices por `collection` na tabela `documents`.
- **Workers**: Cada site com functions consome uma thread. O limite prático depende da carga.
- **Arquivos**: `/data/sites/` com subdiretórios planos. Para muitos arquivos, considere armazenamento externo.

> Nota: Port é uma plataforma interna. Se você precisa escalar para milhares de sites com alta disponibilidade, o modelo precisa de adaptações (load balancer, réplicas de banco, storage distribuído).