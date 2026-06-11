# Guides and How-Tos

---

## Quick Start: Zero to Live Site in 5 Minutes

```bash
# 1. Clone and start the platform
git clone https://github.com/MalconMikami/port.git
cd port
docker compose up -d

# 2. Create a minimal site
mkdir my-first-site
cat > my-first-site/index.html << 'HTML'
<!DOCTYPE html>
<html lang="en">
<head><title>My First Site</title></head>
<body>
  <h1>🚢 Running on Port!</h1>
  <script src="/sdk/port.js"></script>
  <script>
    window.port.db.collection('visits').create({ data: new Date().toISOString() });
  </script>
</body>
</html>
HTML

# 3. Deploy
cd port/cli && npm install
npx tsx src/index.ts deploy ../my-first-site
```

Access [http://my-first-site.localhost:10000](http://my-first-site.localhost:10000) ✅

---

## How to Add Server-Side Functions to Your Site

1. Create a `functions/` folder at the root of your site
2. Add `.js` files — each file becomes a namespace
3. Each exported function becomes a callable method

```
my-site/
├── index.html
└── functions/
    ├── user.js      →  port.functions.user.*
    └── payments.js  →  port.functions.payments.*
```

**Example: `functions/user.js`**
```js
export async function create({ name, email }, { port, userId }) {
  if (!email || !email.includes('@')) throw new Error('Invalid email');
  return port.db.collection('users').create({ name, email, createdBy: userId });
}

export async function list({ }, { port }) {
  return port.db.collection('users').list();
}
```

**In the frontend:**
```js
await window.port.functions.user.create({ name: 'John', email: 'john@email.com' });
const { docs } = await window.port.functions.user.list();
```

---

## How to Use Config for Theme Customization

### 1. Set config via API

```bash
curl -X POST 'http://localhost:10000/api/config/theme.primaryColor?site=my-site' \
  -H 'Content-Type: application/json' \
  -d '{"value": "#4361ee"}'

curl -X POST 'http://localhost:10000/api/config/theme.backgroundColor?site=my-site' \
  -H 'Content-Type: application/json' \
  -d '{"value": "#f8f9fc"}'
```

### 2. Apply in the frontend

```js
const theme = await window.port.config.get('theme');
if (theme) {
  document.documentElement.style.setProperty('--primary', theme.primaryColor);
  document.documentElement.style.setProperty('--bg', theme.backgroundColor);
}
```

### 3. Use in CSS

```css
:root {
  --primary: #4361ee;
  --bg: #f8f9fc;
}
body { background: var(--bg); }
.button { background: var(--primary); }
```

---

## How to Use Storage for File Upload

### Frontend

```html
<input type="file" id="fileInput" accept="image/*">
<button onclick="upload()">Upload</button>
<img id="preview">

<script src="/sdk/port.js"></script>
<script>
async function upload() {
  const file = await window.port.storage.upload(
    document.getElementById('fileInput').files[0]
  );
  document.getElementById('preview').src = window.port.storage.getUrl(file.id);
}
</script>
```

### Server-Side (in functions)

```js
export async function processFile({ fileId }, { port }) {
  const buffer = await port.storage.get(fileId);
  if (!buffer) throw new Error('File not found');
  // process the buffer...
}
```

---

## How to Use AI Chat

```html
<script src="/sdk/port.js"></script>
<script>
async function ask() {
  const reply = await window.port.ai.chat({
    messages: [
      { role: 'user', content: 'Summarize the theory of relativity in one paragraph.' }
    ]
  });
  document.getElementById('answer').textContent = reply.choices[0].message.content;
}
</script>
```

Configure the endpoint in `.env`:

```env
AI_ENDPOINT_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=sk-proj-xxxxx
```

Compatible with any OpenAI-compatible API (OpenAI, Anthropic via proxy, Ollama, etc.).

---

## How to Use WebSocket for Realtime

```js
// Connect
window.port.realtime.connect();

// Subscribe to a channel
const unsub = window.port.realtime.subscribe('notifications', (data) => {
  showNotification(data);
});

// Publish
document.getElementById('send-btn').onclick = () => {
  window.port.realtime.publish('chat', {
    user: 'John',
    message: 'Hello everyone!'
  });
};

// Unsubscribe when no longer needed
unsub();
```

---

## How to Deploy via the Admin Dashboard

1. Access `http://localhost:10000`
2. Click "Deploy"
3. Select a ZIP file containing `index.html` at the root
4. Give the site a name
5. Confirm

The dashboard lists all sites with options to:
- View (opens the site)
- Delete
- Edit config
- Check status

---

## How to Deploy via CLI with NPM Global

```bash
# Install globally
cd cli && npm install && npm link

# Now the 'port' command is available everywhere
port deploy ./my-site
port login
port --help
```

---

## How to Run in Production with SSL

1. **Set up the domain** — in `.env`, set `DOMAIN=your-domain.com`
2. **Update Caddyfile** — replace `DOMAIN.example.com` with your real domain
3. **Generate strong secrets**:
   ```bash
   openssl rand -hex 32  # for JWT_SECRET
   ```
4. **Start with production profile**:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

Caddy will automatically:
- Obtain SSL certificate via Let's Encrypt
- Reverse proxy to the API
- Serve sites at `https://{site-id}.your-domain.com`

---

## How to Add a ZIP Site via the Admin Dashboard

1. Package your site:
   ```bash
   cd my-site && zip -r ../my-site.zip .
   ```
2. Access `http://localhost:10000`
3. Click "Choose file"
4. Select `my-site.zip`
5. Name it and confirm

---

## How to Reset the Dev Environment

```bash
# Stop everything and remove volumes
docker compose down -v

# Start fresh
docker compose up -d

# init.sql will run and recreate tables
```

⚠️ Removes all sites and data.

---

## How to Check if the Worker is Running

```bash
curl http://localhost:10000/api/rpc/status
# → { "activeWorkers": 3 }
```

If a site has a `functions/` directory but the worker doesn't show up, check the logs:

```bash
docker compose logs api
```

---

## Security Tips

- **Never put passwords in `config_public`** — use `config_private`
- **Delete unused sites** — orphaned data is a risk
- **In production, use a strong PostgreSQL password**
- **The JWT secret in production must be unique and strong**
- **Review functions before deploying to production** — the sandbox helps, but review is better
- **Separate dev and production environments** into different Port instances