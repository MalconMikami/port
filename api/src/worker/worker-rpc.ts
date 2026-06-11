/**
 * Worker RPC — roda em um worker_thread por site.
 *
 * Carrega dinamicamente os arquivos de functions/ do site
 * e expõe as funções exportadas via message channel.
 *
 * Comunicação:
 *   Main → Worker: { callId, namespace, fn, args, userId }
 *   Worker → Main: { callId, ok, result } | { callId, ok, error }
 */
import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import pg from 'pg';

// ── VM sandbox setup ──
// Restricted context for running user functions — no `require`, `process`, `fs`
const SANDBOX_GLOBALS = new Set([
  'Object', 'Array', 'String', 'Number', 'Boolean',
  'Map', 'Set', 'WeakMap', 'WeakSet',
  'Promise', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'JSON', 'Math', 'Date', 'RegExp', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'NaN', 'Infinity', 'undefined',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'Buffer', 'Uint8Array', 'ArrayBuffer',
  'TextEncoder', 'TextDecoder',
]);

function createSandbox(port: typeof serverPort, args: Record<string, unknown>, userId: string, fnLabel: string) {
  const ctx: Record<string, unknown> = {};
  for (const g of SANDBOX_GLOBALS) {
    ctx[g] = (globalThis as any)[g];
  }
  // Provide the Port SDK + call context
  ctx.port = port;
  ctx.args = args;
  ctx.userId = userId;
  // Console com prefixo para debug
  ctx.console = {
    log:   (...m: unknown[]) => console.log(`[fn:${fnLabel}]`, ...m),
    warn:  (...m: unknown[]) => console.warn(`[fn:${fnLabel}]`, ...m),
    error: (...m: unknown[]) => console.error(`[fn:${fnLabel}]`, ...m),
  };
  return vm.createContext(ctx);
}

if (!parentPort) {
  throw new Error('worker-rpc must be run as a worker thread');
}

const { siteId, functionsDir, dbUrl } = workerData as {
  siteId: string;
  functionsDir: string;
  dbUrl: string;
};

const siteDir = path.dirname(functionsDir); // /data/sites/{siteId}

/**
 * Resolve dot-notation path in nested object
 */
function getByPath(obj: Record<string, unknown>, pathStr: string): unknown {
  return pathStr.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// Cache config from DB (refresh per call)
let cachedPublic: Record<string, unknown> | null = null;
let cachedPrivate: Record<string, unknown> | null = null;

async function loadConfigFromDB(): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT config_public, config_private FROM port.sites WHERE id = $1',
      [siteId]
    );
    if (result.rows.length > 0) {
      cachedPublic = result.rows[0].config_public || {};
      cachedPrivate = result.rows[0].config_private || {};
    }
  } catch {
    cachedPublic = {};
    cachedPrivate = {};
  }
}

// ── Database pool (one per site worker) ──
const pool = new pg.Pool({ connectionString: dbUrl, max: 5 });

// ── Build port SDK for server-side use ──
const serverPort = {
  db: {
    collection: (name: string) => ({
      create: async (data: Record<string, unknown>) => {
        const result = await pool.query(
          `INSERT INTO ${sanitize(siteId)}.documents (collection, data, created_by, created_at)
           VALUES ($1, $2, $3, NOW()) RETURNING id`,
          [name, JSON.stringify(data), null]
        );
        return { id: result.rows[0].id, ...data };
      },

      get: async (id: string) => {
        const result = await pool.query(
          `SELECT id, data, created_by, created_at FROM ${sanitize(siteId)}.documents WHERE id = $1`,
          [id]
        );
        if (result.rows.length === 0) return null;
        return { id: result.rows[0].id, ...result.rows[0].data, created_by: result.rows[0].created_by };
      },

      list: async (query: Record<string, unknown> = {}) => {
        const result = await pool.query(
          `SELECT id, data, created_by, created_at FROM ${sanitize(siteId)}.documents WHERE collection = $1 ORDER BY created_at DESC`,
          [name]
        );
        return {
          docs: result.rows.map(r => ({ id: r.id, ...r.data, created_by: r.created_by, created_at: r.created_at })),
          total: result.rows.length,
        };
      },

      update: async (id: string, data: Record<string, unknown>) => {
        await pool.query(
          `UPDATE ${sanitize(siteId)}.documents SET data = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(data), id]
        );
        return { id, ...data };
      },

      delete: async (id: string) => {
        await pool.query(
          `DELETE FROM ${sanitize(siteId)}.documents WHERE id = $1`,
          [id]
        );
        return { ok: true };
      },
    }),
  },

  ai: {
    chat: async ({ messages, model }: { messages: Array<{ role: string; content: string }>; model?: string }) => {
      // For server-side ai calls, we'd proxy to the configured AI endpoint
      // For MVP, we call the same AI endpoint as the frontend
      const endpoint = process.env.AI_ENDPOINT_URL || '';
      const apiKey = process.env.AI_API_KEY || '';
      if (!endpoint) return { error: 'AI not configured' };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ messages, model: model || 'default' }),
      });
      return res.json();
    },
  },

  storage: {
    get: async (fileId: string) => {
      const dir = process.env.UPLOADS_DIR || '/data/uploads';
      const filePath = path.join(dir, fileId);
      try {
        return fs.readFileSync(filePath);
      } catch {
        return null;
      }
    },
  },

  // ── Config (port.sites columns — public + private) ──
  config: {
    /**
     * Lê config_public do banco — disponível no frontend também
     * port.config.get('theme.primaryColor')
     */
    get: async (key?: string) => {
      await loadConfigFromDB();
      if (!cachedPublic) return null;
      if (!key) return cachedPublic;
      return getByPath(cachedPublic, key);
    },

    /**
     * Lê config_private do banco — SÓ no backend
     * port.config.private('whatsapp.apiKey')
     */
    private: async (key?: string) => {
      await loadConfigFromDB();
      if (!cachedPrivate) return null;
      if (!key) return cachedPrivate;
      return getByPath(cachedPrivate, key);
    },
  },
};

// ── Load functions from the site's functions/ directory ──
type FunctionMap = Record<string, Record<string, Function>>;
const functions: FunctionMap = {};

async function loadFunctions(): Promise<void> {
  if (!fs.existsSync(functionsDir)) return;

  const files = fs.readdirSync(functionsDir).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const namespace = path.basename(file, '.js');
    const filePath = path.join(functionsDir, file);

    try {
      // Dynamic import of the site's function file
      const mod = await import(filePath);
      const namespaceFns: Record<string, Function> = {};

      for (const [key, val] of Object.entries(mod)) {
        if (typeof val === 'function') {
          namespaceFns[key] = val as Function;
        }
      }

      if (Object.keys(namespaceFns).length > 0) {
        functions[namespace] = namespaceFns;
        console.log(`[worker:${siteId}] Loaded ${Object.keys(namespaceFns).length} function(s) from ${namespace}`);
      }
    } catch (err) {
      console.error(`[worker:${siteId}] Failed to load ${file}:`, err);
    }
  }

  const totalNamespaces = Object.keys(functions).length;
  const totalFns = Object.values(functions).reduce((sum, ns) => sum + Object.keys(ns).length, 0);
  console.log(`[worker:${siteId}] Ready — ${totalNamespaces} namespace(s), ${totalFns} function(s)`);
}

// ── Message handling ──
parentPort.on('message', async (msg: { callId: string; namespace: string; fn: string; args: Record<string, unknown>; userId: string }) => {
  const { callId, namespace, fn, args, userId } = msg;

  try {
    // Look up the function
    const namespaceFns = functions[namespace];
    if (!namespaceFns) {
      parentPort!.postMessage({ callId, ok: false, error: `Namespace "${namespace}" not found` });
      return;
    }

    const targetFn = namespaceFns[fn];
    if (!targetFn) {
      parentPort!.postMessage({ callId, ok: false, error: `Function "${namespace}.${fn}" not found` });
      return;
    }

    // Execute with server-side port SDK + userId
    // (vm sandbox removido temporariamente pra debug do RPC)
    const result = await targetFn(args, { port: serverPort, userId });
    parentPort!.postMessage({ callId, ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    parentPort!.postMessage({ callId, ok: false, error: message });
  }
});

// ── Sanitize schema name ──
function sanitize(name: string): string {
  return 'site_' + name.replace(/[^a-zA-Z0-9_]/g, '_');
}

// ── Start ──
await loadFunctions();
parentPort.postMessage({ type: 'ready', siteId });
