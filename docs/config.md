# Public and Private Config

## The Model

Each site's configuration is stored in two JSONB columns on the `port.sites` table:

```sql
CREATE TABLE port.sites (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  config_public JSONB DEFAULT '{}',   ← visible to frontend
  config_private JSONB DEFAULT '{}'   ← backend only
);
```

| Column | Visible in Frontend | Visible in Functions | Use case |
|--------|-------------------|----------------------|----------|
| `config_public` | ✅ `port.config.get()` | ✅ `port.config.get()` | Theme, text, public URLs |
| `config_private` | ❌ | ✅ `port.config.private()` | API keys, passwords, internal endpoints |

---

## Access via SDK (Frontend)

```js
// Read entire config
const config = await window.port.config.get();
// → { theme: { primaryColor: '#4361ee' }, siteName: 'My Site' }

// Read specific key (dot-notation)
const color = await window.port.config.get('theme.primaryColor');
// → '#4361ee'

// Nested key
const borderRadius = await window.port.config.get('theme.borderRadius');
// → '8px'
```

> ⚠️ The frontend **cannot** access `config_private`. The SDK does not expose `port.config.private()`.

---

## Access via SDK (Server-Side Functions)

In functions, the server-side SDK exposes both objects:

```js
export async function sendEmail({ to, message }, { port }) {
  // Public config
  const siteName = await port.config.get('siteName');

  // Private config — only the backend sees this
  const apiKey = await port.config.private('sendgrid.apiKey');
  const fromEmail = await port.config.private('email.from');

  // Use the configs
  await sendEmail({ to, from: fromEmail, apiKey, content: message });
}
```

---

## Management via API

All routes accept `?site={id}` for admin targeting (when the request comes from the dashboard, not a site subdomain).

### Public Config

```bash
# Create / update key
curl -X POST 'http://localhost:10000/api/config/theme.primaryColor?site=my-site' \
  -H 'Content-Type: application/json' \
  -d '{"value": "#4361ee"}'

# Read specific key
curl 'http://localhost:10000/api/config/theme.primaryColor?site=my-site'
# → "#4361ee"

# Read entire config
curl 'http://localhost:10000/api/config?site=my-site'
# → { "theme": { "primaryColor": "#4361ee" }, ... }

# Delete key
curl -X DELETE 'http://localhost:10000/api/config/theme.primaryColor?site=my-site'
```

### Private Config (backend only)

```bash
# Create / update
curl -X POST 'http://localhost:10000/api/config/private/sendgrid.apiKey?site=my-site' \
  -H 'Content-Type: application/json' \
  -d '{"value": "SG.xxxxx"}'

# Read
curl 'http://localhost:10000/api/config/private/sendgrid.apiKey?site=my-site'

# Delete
curl -X DELETE 'http://localhost:10000/api/config/private/sendgrid.apiKey?site=my-site'
```

---

## Dot-Notation

Keys use **dot-notation** to access nested properties:

```json
{
  "theme": {
    "primaryColor": "#4361ee",
    "backgroundColor": "#ffffff",
    "borderRadius": "8px"
  },
  "siteName": "My Site",
  "social": {
    "instagram": "@mysite",
    "twitter": "@mysite"
  }
}
```

| Key | Value |
|-----|-------|
| `theme` | `{ primaryColor: "...", ... }` |
| `theme.primaryColor` | `"#4361ee"` |
| `social.instagram` | `"@mysite"` |
| `theme` (delete) | Removes the entire object |
| `theme.borderRadius` (delete) | Removes only that key |

---

## Admin Dashboard

The web dashboard (at `http://localhost:10000`) lets you edit both configs via the UI:

- Sites table with a "Config" button per site
- Modal with two JSON editors side by side: **Public** and **Private**
- Saves via API with `?site={id}`

---

## Use Cases

### Dynamic Theme

In `config_public`:

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

In the frontend:

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

### API Keys for External Services

In `config_private`:

```json
{
  "sendgrid": { "apiKey": "SG.xxxxx" },
  "stripe": { "secretKey": "sk_live_xxx" },
  "whatsapp": { "apiKey": "abc123", "endpoint": "https://api.whatsapp.com/v1" }
}
```

In functions:

```js
export async function processPayment({ orderId }, { port }) {
  const stripeKey = await port.config.private('stripe.secretKey');
  // process payment...
}
```

### Feature Flags

In `config_public`:

```json
{
  "features": {
    "chat": true,
    "darkMode": false,
    "beta": true
  }
}
```

In the frontend:

```js
const features = await window.port.config.get('features');
if (features.chat) {
  // Show chat button
}
```

---

## Best Practices

| Do | Don't |
|----|-------|
| Use `config_public` for everything the frontend needs | Put secrets in `config_public` |
| Use `config_private` for API keys and passwords | Put large data (> 100KB) in config |
| Use dot-notation to organize by domain | Use special characters in key names |
| Delete unused keys | Depend on config for transactional data |
| Document expected keys in the site's README | Use the same namespace for public and private config |