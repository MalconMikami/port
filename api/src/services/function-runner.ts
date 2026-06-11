import { Worker } from 'node:worker_threads';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface WorkerRequest {
  namespace: string;
  fn: string;
  args: Record<string, unknown>;
  userId: string;
}

interface WorkerResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface ActiveWorker {
  worker: Worker;
  siteId: string;
  startTime: Date;
}

type Callback = (response: WorkerResponse) => void;

class FunctionRunner {
  private workers = new Map<string, ActiveWorker>();
  private pendingCalls = new Map<string, Callback>();
  private callIdCounter = 0;
  private lastSiteDir = new Map<string, string>(); // for restart on crash

  /** Check if a site has functions/ directory */
  hasFunctions(siteDir: string): boolean {
    const functionsDir = path.join(siteDir, 'functions');
    return fs.existsSync(functionsDir) && fs.readdirSync(functionsDir).some(f => f.endsWith('.js'));
  }

  /** Start a worker for a site */
  start(siteId: string, siteDir: string): void {
    if (this.workers.has(siteId)) {
      return; // already running
    }

    const functionsDir = path.join(siteDir, 'functions');
    if (!fs.existsSync(functionsDir)) {
      return; // no functions directory
    }

    const dbUrl = `postgres://${config.db.user}:${config.db.password}@${config.db.host}:${config.db.port}/${config.db.name}`;
    const isDev = import.meta.url.endsWith('.ts');
    const workerFile = path.resolve(__dirname, '..', 'worker', isDev ? 'worker-rpc.ts' : 'worker-rpc.js');

    const worker = new Worker(workerFile, {
      workerData: { siteId, functionsDir, dbUrl },
      ...(isDev ? { execArgv: ['--import', 'tsx/esm'] } : {}),
      resourceLimits: {
        maxYoungGenerationSizeMb: 32,   // heap young gen
        maxOldGenerationSizeMb: 128,    // heap old gen
        codeRangeSizeMb: 16,            // JIT code cache
        stackSizeMb: 4,                 // stack per worker
      },
    });

    const active: ActiveWorker = { worker, siteId, startTime: new Date() };
    this.workers.set(siteId, active);

    worker.on('message', (msg: { callId: string } & WorkerResponse) => {
      const cb = this.pendingCalls.get(msg.callId);
      if (cb) {
        this.pendingCalls.delete(msg.callId);
        cb(msg);
      }
    });

    worker.on('error', (err) => {
      console.error(`[worker:${siteId}] Error:`, err);
      this.workers.delete(siteId);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[worker:${siteId}] Exited with code ${code}`);
      }
      this.workers.delete(siteId);
    });

    console.log(`[worker:${siteId}] Started (pid ${worker.threadId})`);
  }

  /** Call a function on a site's worker */
  async call(siteId: string, namespace: string, fn: string, args: Record<string, unknown>, userId: string): Promise<unknown> {
    const active = this.workers.get(siteId);
    if (!active) {
      throw new Error(`Site "${siteId}" has no active worker`);
    }

    return new Promise((resolve, reject) => {
      const callId = `call_${++this.callIdCounter}`;

      this.pendingCalls.set(callId, (response: WorkerResponse) => {
        if (response.ok) {
          resolve(response.result);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      });

      const msg: WorkerRequest & { callId: string } = {
        callId,
        namespace,
        fn,
        args,
        userId,
      };

      active.worker.postMessage(msg);

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingCalls.has(callId)) {
          this.pendingCalls.delete(callId);
          reject(new Error(`Function ${namespace}.${fn} timed out after 30s`));
        }
      }, 30_000);
    });
  }

  /** Stop a worker */
  stop(siteId: string): void {
    const active = this.workers.get(siteId);
    if (!active) return;

    active.worker.terminate();
    this.workers.delete(siteId);
    console.log(`[worker:${siteId}] Stopped`);
  }

  /** Stop all workers */
  stopAll(): void {
    for (const [siteId] of this.workers) {
      this.stop(siteId);
    }
  }

  /** Get count of active workers */
  get activeCount(): number {
    return this.workers.size;
  }
}

export const functionRunner = new FunctionRunner();
