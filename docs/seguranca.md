# Segurança e Governança

## Filosofia

Sites gerados por IA representam um risco novo para as empresas: código que **funciona**, mas que ninguém revisou linha a linha. Port foi desenhado para que esse código possa rodar com segurança mesmo sem revisão manual completa.

O princípio é: **confie zero, isole tudo**.

---

## Isolamento de Workers (Functions)

Cada site que possui diretório `functions/` ganha uma **worker thread dedicada**. Dentro dela, as funções rodam em um **sandbox `node:vm`** com restrições severas:

```js
// Globals permitidos no sandbox
Object, Array, String, Number, Boolean,
Map, Set, WeakMap, WeakSet,
Promise, Error, TypeError, RangeError, SyntaxError,
JSON, Math, Date, RegExp, parseInt, parseFloat,
isNaN, isFinite, NaN, Infinity, undefined,
console, setTimeout, clearTimeout, setInterval, clearInterval,
Buffer, Uint8Array, ArrayBuffer,
TextEncoder, TextDecoder

// ❌ NÃO disponíveis:
require          // sem módulos npm
process          // sem acesso ao sistema
fs               // sem sistema de arquivos
net, http        // sem rede arbitrária
child_process    // sem execução de comandos
import           // sem import dinâmico (fora do permitido)
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

- **Timeout de execução**: 15 segundos por chamada de função (30s na camada RPC)
- **Memory limit**: 160MB total de heap (128+32)
- **Stack limit**: 4MB

Se uma função estourar qualquer limite, o worker é morto e reiniciado automaticamente no próximo deploy.

### O que a função pode fazer

A função recebe um objeto `port` com acesso controlado:

```js
export async function minhaFuncao(args, { port, userId }) {
  // ✅ Acesso ao banco DO SEU site
  await port.db.collection('dados').create({ ... });

  // ✅ Chamar AI
  await port.ai.chat({ messages });

  // ✅ Ler config pública do seu site
  await port.config.get('chave');

  // ✅ Ler config privada do seu site (backend only)
  await port.config.private('apiKey');

  // ✅ Ler arquivos de storage
  await port.storage.get('fileId');

  // ❌ NÃO consegue acessar dados de outro site
  // ❌ NÃO consegue ler arquivos fora de /data/uploads/
  // ❌ NÃO consegue fazer requisições HTTP arbitrárias
}
```

---

## Proteção de Arquivos Estáticos

O `setNotFoundHandler` bloqueia acesso a paths sensíveis nos sites deployados:

```js
const blockedPrefixes = [
  '/functions/',    // código server-side (executável, não servível)
  '/config/',       // arquivos de configuração
  '/node_modules/', // dependências npm
  '.env',           // variáveis de ambiente
  '.git'            // histórico de versões
];
```

Qualquer requisição para esses paths retorna **403 Forbidden**.

Para adicionar novos paths sensíveis, edite o array `blockedPrefixes` em `api/src/main.ts`.

---

## Isolamento de Banco de Dados

Cada site tem seu próprio schema PostgreSQL:

```sql
-- Site "meu-site" → schema "site_meu_site"
CREATE SCHEMA IF NOT EXISTS site_meu_site;

CREATE TABLE site_meu_site.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection VARCHAR(100) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Proteção contra SQL Injection**: o nome do schema é sanitizado antes de ser usado em queries:

```js
function sanitizeSchema(name: string): string {
  return 'site_' + name.replace(/[^a-zA-Z0-9_]/g, '_');
}
```

Isso impede que um nome de site malicioso como `meu-site; DROP TABLE` cause danos.

---

## Modelo de Config

| Tipo | Visibilidade | Exemplo | Risco |
|------|-------------|---------|-------|
| `config_public` | Frontend + Backend | Tema do site, textos públicos | Baixo |
| `config_private` | Backend apenas | API keys, senhas, endpoints internos | Alto |

A rota `/api/config/private/*` existe na API, mas o frontend nunca chama diretamente — só as server-side functions têm acesso.

---

## Subdomain Routing

O middleware `siteContextMiddleware` determina o contexto da requisição pelo subdomínio:

- `port.*`, `app.*`, `admin.*`, `localhost` → **Admin dashboard** (acesso à interface de gestão)
- `{siteId}.dominio` → **Site deployado** (serve arquivos estáticos + API pública)

Um site não consegue acessar o admin dashboard de outro site via subdomínio.

---

## Recomendações de Segurança

### Para produção

1. **Altere o JWT secret** — `openssl rand -hex 32` e coloque no `.env`
2. **Configure AI endpoint com chave real** — ou deixe vazio se não for usar
3. **Defina um domínio real** no `DOMAIN` do `.env` e no `Caddyfile`
4. **Use PostgreSQL com senha forte** — altere `DB_PASSWORD` no `.env`
5. **Rode atrás do Caddy** — SSL automático via Let's Encrypt
6. **Monitore os workers** via endpoint `GET /api/rpc/status`

### Políticas recomendadas

- **Revise functions antes do deploy em produção** — o sandbox mitiga riscos, mas não substitui revisão
- **Config privada nunca deve conter secrets compartilhados entre sites** — cada site tem seu próprio config
- **Separe ambientes** — dev e produção em instâncias diferentes do Port
- **Limpe sites não utilizados** — dados órfãos acumulam risco

---

## Matriz de Risco

| Cenário | Risco | Mitigação |
|---------|-------|-----------|
| Site injecta SQL malicioso | Baixo | Schema sanitizado, queries parametrizadas via `pg` |
| Site tenta ler arquivos de outro site | Baixo | Diretórios separados, blocking paths |
| Site tenta acessar banco de outro site | Muito Baixo | Schemas separados, pool por worker |
| Function tenta executar código malicioso | Médio | Sandbox VM + resource limits + timeout |
| Function faz loop infinito | Baixo | Timeout de 15s + resource limits |
| Config privada vaza para frontend | Muito Baixo | Rota privada nunca exposta ao público |
| Ataque de força bruta no dashboard | Médio | (a implementar: rate limiting) |