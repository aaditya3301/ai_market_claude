import { getRequestId } from '@/lib/runtime/context';

export interface ApiEnvelopeMeta {
  request_id: string;
  timestamp: string;
  step?: string;
  mode?: string;
  api_version?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  error: null;
  meta: ApiEnvelopeMeta;
}

export interface ApiErrorEnvelope {
  success: false;
  data: null;
  error: ApiErrorBody;
  meta: ApiEnvelopeMeta;
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

export function createMeta(meta?: Partial<ApiEnvelopeMeta>): ApiEnvelopeMeta {
  const contextRequestId = getRequestId();

  return {
    request_id: meta?.request_id || contextRequestId || createRequestId(),
    timestamp: meta?.timestamp || new Date().toISOString(),
    step: meta?.step,
    mode: meta?.mode,
    api_version: meta?.api_version,
  };
}

export function envelopeSuccess<T>(data: T, meta?: Partial<ApiEnvelopeMeta>): ApiSuccessEnvelope<T> {
  return {
    success: true,
    data,
    error: null,
    meta: createMeta(meta),
  };
}

export function envelopeError(
  code: string,
  message: string,
  details?: unknown,
  meta?: Partial<ApiEnvelopeMeta>
): ApiErrorEnvelope {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
    meta: createMeta(meta),
  };
}
