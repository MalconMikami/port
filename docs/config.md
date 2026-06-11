# Config Pública e Privada

## O Modelo

Cada site tem um objeto de configuração armazenado em duas colunas JSONB na tabela `port.sites`:

```sql
CREATE TABLE port.sites (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  config_public JSONB DEFAULT '{}',   ← visível ao frontend
  config_private JSONB DEFAULT '{}'   ← só no backend
);
```

| Coluna | Visível no Frontend | Visível nas Functions | Exemplo de uso |
|--------|-------------------|----------------------|----------------|
| `config_public` | ✅ `port.config.get()` | ✅ `port.config.get()` | Tema, textos, URLs públicas |
| `config_private` | ❌ | ✅ `port.config.private()` | API keys, senhas, endpoints internos |

---

## Acesso via SDK (Frontend)

```js
// Ler config inteira
const config = await window.port.config.get();
// → { theme: { primaryColor: '#4361ee' }, siteName: 'Meu Site' }

// Ler chave específica (dot-notation)
const cor = await window.port.config.get('theme.primaryColor');
// → '#4361ee'

// Chave aninhada
const borderRadius = await window.port.config.get('theme.borderRadius');
// → '8px'
```

> ⚠️ O frontend **não** tem acesso a `config_private`. A SDK não expõe `port.config.private()`.

---

## Acesso via SDK (Server-Side Functions)

Nas functions, o SDK do servidor expõe ambos os objetos:

```js
export async function enviarEmail({ para, mensagem }, { port }) {
  // Config pública
  const siteName = await port.config.get('siteName');

  // Config privada — só o backend vê
  const apiKey = await port.config.private('sendgrid.apiKey');
  const fromEmail = await port.config.private('email.from');

  // Usa as configs
  await sendEmail({ to: para, from: fromEmail, apiKey, content: mensagem });
}
```

---

## Gerenciamento via API

Todas as rotas aceitam `?site={id}` para admin targeting (quando a requisição vem do dashboard, não de um subdomínio de site).

### Config Pública

```bash
# Criar / atualizar chave
curl -X POST 'http://localhost:10000/api/config/theme.primaryColor?site=meu-site' \
  -H 'Content-Type: application/json' \
  -d '{"value": "#4361ee"}'

# Ler chave específica
curl 'http://localhost:10000/api/config/theme.primaryColor?site=meu-site'
# → "#4361ee"

# Ler config inteira
curl 'http://localhost:10000/api/config?site=meu-site'
# → { "theme": { "primaryColor": "#4361ee" }, ... }

# Deletar chave
curl -X DELETE 'http://localhost:10000/api/config/theme.primaryColor?site=meu-site'
```

### Config Privada (só backend)

```bash
# Criar / atualizar
curl -X POST 'http://localhost:10000/api/config/private/sendgrid.apiKey?site=meu-site' \
  -H 'Content-Type: application/json' \
  -d '{"value": "SG.xxxxx"}'

# Ler
curl 'http://localhost:10000/api/config/private/sendgrid.apiKey?site=meu-site'

# Deletar
curl -X DELETE 'http://localhost:10000/api/config/private/sendgrid.apiKey?site=meu-site'
```

---

## Dot-Notation

As chaves usam **dot-notation** para acessar propriedades aninhadas:

```json
{
  "theme": {
    "primaryColor": "#4361ee",
    "backgroundColor": "#ffffff",
    "borderRadius": "8px"
  },
  "siteName": "Meu Site",
  "social": {
    "instagram": "@meusite",
    "twitter": "@meusite"
  }
}
```

| Chave | Valor |
|-------|-------|
| `theme` | `{ primaryColor: "...", ... }` |
| `theme.primaryColor` | `"#4361ee"` |
| `social.instagram` | `"@meusite"` |
| `theme` (deletar) | Remove o objeto inteiro |
| `theme.borderRadius` (deletar) | Remove só essa chave |

---

## Admin Dashboard

O dashboard web (acessível em `http://localhost:10000`) permite editar ambas as configs via interface visual:

- Tabela de sites com botão "Config"
- Modal com dois editors JSON lado a lado: **Public** e **Private**
- Salvamento via API com `?site={id}`

---

## Casos de Uso

### Tema Dinâmico

No `config_public`:

```json
{
  "theme": {
    "primaryColor": "#4361ee",
    "backgroundColor": "#f8f9fc",
    "cardBackground": "#ffffff",
    "textColor": "#1a1a2e",
    "borderRadius": "12px"
  }
}
```

No frontend:

```js
const theme = await window.port.config.get('theme');
if (theme) {
  document.documentElement.style.setProperty('--primary', theme.primaryColor);
  document.documentElement.style.setProperty('--bg', theme.backgroundColor);
  document.documentElement.style.setProperty('--card', theme.cardBackground);
  document.documentElement.style.setProperty('--text', theme.textColor);
  document.documentElement.style.setProperty('--radius', theme.borderRadius);
}
```

### API Keys para Serviços Externos

No `config_private`:

```json
{
  "sendgrid": { "apiKey": "SG.xxxxx" },
  "stripe": { "secretKey": "sk_live_xxx" },
  "whatsapp": { "apiKey": "abc123", "endpoint": "https://api.whatsapp.com/v1" }
}
```

Nas functions:

```js
export async function processarPagamento({ pedidoId }, { port }) {
  const stripeKey = await port.config.private('stripe.secretKey');
  // processa pagamento...
}
```

### Flag de Funcionalidade

No `config_public`:

```json
{
  "features": {
    "chat": true,
    "darkMode": false,
    "beta": true
  }
}
```

No frontend:

```js
const features = await window.port.config.get('features');
if (features.chat) {
  // Mostrar botão de chat
}
```

---

## Boas Práticas

| Faça | Não Faça |
|------|----------|
| Use `config_public` para tudo que o frontend precisa ver | Coloque secrets no `config_public` |
| Use `config_private` para API keys e senhas | Coloque dados grandes (> 100KB) no config |
| Use dot-notation para organizar por domínio | Use caracteres especiais nas chaves |
| Delete chaves não utilizadas | Dependa de config para dados transacionais |
| Documente as chaves esperadas no README do site | Use o mesmo namespace para config pública e privada |