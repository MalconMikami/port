import { FastifyInstance } from 'fastify';
import { functionRunner } from '../services/function-runner.js';

/** Resolve siteId: subdomain > query param > null */
function getSiteId(req: any): string | null {
  if (req.siteContext?.type === 'site' && req.siteContext?.siteId) {
    return req.siteContext.siteId;
  }
  const querySite = (req.query as Record<string, string>)?.site;
  if (querySite) return querySite;
  return null;
}

export async function rpcRoutes(app: FastifyInstance) {
  /**
   * POST /api/rpc/:namespace/:fn
   *
   * Chama uma função RPC no worker do site atual.
   * O site é determinado pelo subdomínio (via siteContext) ou ?site= query param.
   */
  app.post<{
    Params: { namespace: string; fn: string };
    Body: Record<string, unknown>;
    Querystring: { site?: string };
  }>('/api/rpc/:namespace/:fn', async (req, reply) => {
    const siteId = getSiteId(req);
    if (!siteId) {
      return reply.status(400).send({ error: 'No site context' });
    }

    const { namespace, fn } = req.params;
    const args = req.body || {};
    const userId = (req as any).user?.email || 'anonymous';

    try {
      const result = await functionRunner.call(siteId, namespace, fn, args, userId);
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * GET /api/rpc/status — lista workers ativos (admin/depuração)
   */
  app.get('/api/rpc/status', async (_req, reply) => {
    return reply.send({
      activeWorkers: functionRunner.activeCount,
    });
  });
}
