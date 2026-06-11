// port.js — Client SDK for Port sites
// Carregue via: <script src="/sdk/port.js"></script>

class Port {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || window.location.origin;
    this._user = null;
    this._ws = null;
    this._subscriptions = new Map();
    // Functions proxy — constroi a árvore de namespaces dinamicamente
    this.functions = this._buildFunctionsProxy();
  }

  // ── Internal request helper ──
  async _request(path, options = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(err);
    }
    return res.json();
  }

  // ── Functions RPC (backend do site) ──
  // Uso: port.functions.user.create({ name: 'João' })
  // Uso: port.functions.itens.list()
  _buildFunctionsProxy() {
    const self = this;
    return new Proxy({}, {
      get(_, namespace) {
        return new Proxy({}, {
          get(__, fn) {
            return async (...args) => {
              const body = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
                ? args[0]
                : { _args: args };

              return self._request(`/api/rpc/${String(namespace)}/${String(fn)}`, {
                method: 'POST',
                body: JSON.stringify(body),
              });
            };
          },
        });
      },
    });
  }

  // ── Database API ──
  db = {
    collection: (name) => ({
      create: async (data) => {
        return port._request(`/api/db/${name}/create`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },

      list: async (query = {}) => {
        return port._request(`/api/db/${name}/list`, {
          method: 'POST',
          body: JSON.stringify(query),
        });
      },

      update: async (id, data) => {
        return port._request(`/api/db/${name}/update`, {
          method: 'POST',
          body: JSON.stringify({ id, ...data }),
        });
      },

      delete: async (id) => {
        return port._request(`/api/db/${name}/delete`, {
          method: 'POST',
          body: JSON.stringify({ id }),
        });
      },
    }),
  };

  // ── AI API ──
  ai = {
    chat: async ({ messages, model, stream } = {}) => {
      const res = await fetch(`${port.baseUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model, stream }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return stream ? res.body : res.json();
    },
  };

  // ── Config API (public.json do site) ──
  config = {
    get: async (key) => {
      const path = key ? `/api/config/${key}` : '/api/config';
      return port._request(path);
    },
  };

  // ── File Storage API ──
  storage = {
    upload: async (file) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${port.baseUrl}/api/storage/upload`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    getUrl: (fileId) => `${port.baseUrl}/api/storage/${fileId}`,
  };

  // ── Identity API ──
  user = {
    get: async () => {
      if (port._user) return port._user;
      const res = await fetch(`${port.baseUrl}/api/identity/me`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      port._user = await res.json();
      return port._user;
    },

    clear: () => { port._user = null; },
  };

  // ── Realtime (WebSocket) ──
  realtime = {
    connect: () => {
      if (port._ws?.readyState === WebSocket.OPEN) return port._ws;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const subs = port._subscriptions.get(msg.channel);
          if (subs) subs.forEach(cb => cb(msg.data));
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => { port._ws = null; };
      port._ws = ws;
      return ws;
    },

    subscribe: (channel, callback) => {
      if (!port._subscriptions.has(channel)) {
        port._subscriptions.set(channel, []);
      }
      port._subscriptions.get(channel).push(callback);

      if (port._ws?.readyState === WebSocket.OPEN) {
        port._ws.send(JSON.stringify({ type: 'subscribe', channel }));
      }

      return () => {
        const subs = port._subscriptions.get(channel);
        if (subs) {
          const idx = subs.indexOf(callback);
          if (idx >= 0) subs.splice(idx, 1);
        }
      };
    },

    publish: (channel, data) => {
      if (port._ws?.readyState === WebSocket.OPEN) {
        port._ws.send(JSON.stringify({ type: 'publish', channel, data }));
      }
    },

    disconnect: () => {
      port._ws?.close();
      port._ws = null;
    },
  };
}

// Auto-install as window.port
const port = new Port();
if (typeof window !== 'undefined') {
  window.port = port;
}
