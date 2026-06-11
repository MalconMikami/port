# Platform Capabilities

Every site deployed on Port automatically gets all capabilities below. No need to configure separate services — everything is included in the deploy.

---

## 📄 Static File Serving

Serves static files with correct MIME types for HTML, CSS, JS, images (PNG, JPG, GIF, SVG, WebP, ICO), JSON, and TXT.

```
my-site/
├── index.html          ← main page (required)
├── css/style.css
├── js/app.js
├── img/logo.png
└── functions/          ← isolated backend (optional)
    └── items.js
```

Accessible via `http://{site-id}.yourdomain.com` or `http://{site-id}.localhost:10000` in dev.

> 🔒 Blocked paths: `/functions/`, `/config/`, `/node_modules/`, `.env`, `.git`

---

## 🗄️ Database (PostgreSQL)

Each site gets a **dedicated PostgreSQL schema** with a `documents` table for collections:

| SDK Method | Description |
|------------|-------------|
| `port.db.collection('items').create(data)` | Create a document |
| `port.db.collection('items').get(id)` | Get by ID |
| `port.db.collection('items').list(query)` | List documents |
| `port.db.collection('items').update(id, data)` | Update a document |
| `port.db.collection('items').delete(id)` | Delete a document |

**Full isolation**: Site A cannot access Site B's data. Each schema is prefixed with `site_` + site ID.

```js
// Frontend
const item = await window.port.db.collection('products').create({
  name: 'Mechanical Keyboard',
  price: 299.90
});

const { docs } = await window.port.db.collection('products').list();
```

---

## 📦 Blob Storage

Upload and serve files with public URLs:

```js
// Frontend upload
const file = await window.port.storage.upload(fileInput.files[0]);
// → { id: 'uuid', url: '/api/storage/uuid', filename: 'photo.jpg' }

// Direct URL
const url = window.port.storage.getUrl(file.id);
// → '/api/storage/uuid'

// Server-side (in functions)
const buffer = await port.storage.get('file-id');
```

50MB per upload limit. Files stored in `/data/uploads/`.

---

## 🤖 AI Endpoint

A configurable AI endpoint via environment variables (`AI_ENDPOINT_URL` and `AI_API_KEY`). Compatible with OpenAI and compatible providers.

```js
// Frontend
const reply = await window.port.ai.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of Brazil?' }
  ],
  model: 'gpt-4'     // optional
});
```

**Same endpoint available in server-side functions** with the same API.

---

## ⚡ Server-Side Functions (RPC)

JavaScript functions that run on the server, in **isolated worker threads** with a `node:vm` sandbox.

```js
// my-site/functions/orders.js
export async function calculateShipping({ zipCode, weight }, { port, userId }) {
  // Server-side validation
  if (weight > 30) throw new Error('Weight exceeds limit');

  // Database access
  const rules = await port.db.collection('shipping_rules').list();

  // Calculation
  return { cost: weight * 1.5, deliveryDays: 5 };
}
```

Called from frontend via SDK:

```js
const shipping = await window.port.functions.orders.calculateShipping({
  zipCode: '01310-100',
  weight: 2.5
});
```

**Function limits:**
- No access to `require`, `process`, `fs`, `net`
- Heap: 128MB old generation, 32MB young generation
- Stack: 4MB
- Timeout: 15s per call (30s at RPC layer)
- Console with prefix for debugging (`[fn:name]`)

---

## 🔧 Client SDK (`/sdk/port.js`)

Loaded with one line of HTML:

```html
<script src="/sdk/port.js"></script>
```

Provides `window.port` with all capabilities:

| API | Description |
|-----|-------------|
| `port.db.collection(name)` | CRUD on the site's database |
| `port.functions.ns.fn(args)` | Call server-side functions |
| `port.ai.chat({ messages })` | Chat with configured LLM |
| `port.config.get(key)` | Read public config |
| `port.storage.upload(file)` | File upload |
| `port.user.get()` | User identity |
| `port.realtime.*` | WebSocket pub/sub |

All requests include `credentials: 'include'` for cookie-based authentication.

---

## 🔐 Public and Private Config

Each site has two JSONB objects stored in the database:

| Type | Visible in Frontend | Visible in Functions | Example |
|------|-------------------|----------------------|---------|
| `config_public` | ✅ `port.config.get('key')` | ✅ `port.config.get('key')` | Theme, text, public URLs |
| `config_private` | ❌ | ✅ `port.config.private('key')` | API keys, passwords, internal endpoints |

Managed via admin dashboard or directly via API:

```bash
# Set public config
curl -X POST http://localhost:10000/api/config/theme.primaryColor?site=my-site \
  -H "Content-Type: application/json" \
  -d '{"value": "#4361ee"}'

# Read public config
curl http://localhost:10000/api/config/theme.primaryColor?site=my-site

# Private config (backend only)
curl -X POST http://localhost:10000/api/config/private/whatsapp.apiKey?site=my-site \
  -H "Content-Type: application/json" \
  -d '{"value": "sk-xxx"}'
```

---

## 🔌 WebSocket Realtime

Pub/sub per channel, per site:

```js
// Connect
window.port.realtime.connect();

// Subscribe to a channel
const unsubscribe = window.port.realtime.subscribe('notifications', (data) => {
  console.log('New notification:', data);
});

// Publish
window.port.realtime.publish('chat', {
  user: 'John',
  message: 'Hello everyone!'
});

// Unsubscribe
unsubscribe();

// Disconnect
window.port.realtime.disconnect();
```

Each site has isolated channels — Site A cannot receive Site B's messages.

---

## 👤 User Identity

```js
const user = await window.port.user.get();
// → { id, email, name, avatar_url } or null if unauthenticated

// Clear local cache
window.port.user.clear();
```

Authentication via Microsoft Entra (Azure AD) configurable. Uses mock in dev mode.

---

## Summary

| Capability | Included | Isolated per Site | Accessible via |
|-----------|---------|-----------------|---------------|
| Static files | ✅ | ✅ | Site URL |
| PostgreSQL | ✅ | ✅ (own schema) | SDK + Functions |
| Blob Storage | ✅ | ✅ | SDK + Functions |
| AI Endpoint | ✅ | ❌ (shared) | SDK + Functions |
| Functions (RPC) | ✅ | ✅ (own worker) | SDK |
| Config | ✅ | ✅ | SDK + API + Dashboard |
| WebSocket | ✅ | ✅ (isolated channels) | SDK |
| Auth | ✅ | ✅ | SDK |