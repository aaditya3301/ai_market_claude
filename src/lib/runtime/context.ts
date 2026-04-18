import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  tenantId?: string;
  endpoint?: string;
}

const contextStore = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return contextStore.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return contextStore.getStore();
}

export function getRequestId(): string | undefined {
  return contextStore.getStore()?.requestId;
}
