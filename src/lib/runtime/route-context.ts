import { withRequestContext } from '@/lib/runtime/context';
import { logger } from '@/lib/runtime/logger';
import { increment, timing } from '@/lib/runtime/metrics';

export async function withApiRequestContext<T>(
  req: Request,
  params: {
    tenantId?: string;
    endpoint: string;
  },
  handler: () => Promise<T>
): Promise<T> {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();

  return withRequestContext(
    {
      requestId,
      tenantId: params.tenantId,
      endpoint: params.endpoint,
    },
    async () => {
      try {
        const result = await handler();
        logger.info({
          msg: 'api.request.completed',
          request_id: requestId,
          tenant_id: params.tenantId,
          endpoint: params.endpoint,
          latency_ms: Date.now() - startedAt,
        });
        increment('connector.request.count', { endpoint: params.endpoint, status: 'success' });
        timing('connector.request.latency_ms', Date.now() - startedAt, { endpoint: params.endpoint });
        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({
          msg: 'api.request.failed',
          request_id: requestId,
          tenant_id: params.tenantId,
          endpoint: params.endpoint,
          latency_ms: Date.now() - startedAt,
          error: message,
        });
        increment('connector.request.count', { endpoint: params.endpoint, status: 'error' });
        timing('connector.request.latency_ms', Date.now() - startedAt, { endpoint: params.endpoint });
        throw error;
      }
    }
  );
}
