import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { Redis } from '@upstash/redis';
import { createServiceRoleClient } from '@/lib/supabase';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { decryptConnectorSigningSecret, verifySecret } from '@/lib/tenancy/service';

export interface ConnectorAuthResult {
  tenantId: string;
  keyId: string;
  requestId: string;
  scopes: string[];
}

type AuthFailureCode =
  | 'AUTH_INVALID_KEY'
  | 'AUTH_INVALID_SIGNATURE'
  | 'AUTH_EXPIRED_TIMESTAMP'
  | 'AUTH_INSUFFICIENT_SCOPE'
  | 'AUTH_NONCE_REPLAY';

export class ConnectorAuthError extends Error {
  constructor(public code: AuthFailureCode, message: string) {
    super(message);
  }
}

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const redisUrl = process.env.CONNECTOR_NONCE_REDIS_URL;
  if (!redisUrl) return null;
  redisClient = new Redis({ url: redisUrl, token: process.env.CONNECTOR_NONCE_REDIS_TOKEN });
  return redisClient;
}

function hashBody(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

function safeEqHex(leftHex: string, rightHex: string): boolean {
  const a = Buffer.from(leftHex, 'hex');
  const b = Buffer.from(rightHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function consumeNonce(tenantId: string, nonce: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return true;
  }

  const key = `nonce:${tenantId}:${nonce}`;
  const inserted = await redis.set(key, '1', { nx: true, ex: ttlSeconds });
  return inserted === 'OK';
}

function getRequiredHeader(req: Request, name: string): string {
  const value = req.headers.get(name);
  if (!value || value.trim() === '') {
    throw new ConnectorAuthError('AUTH_INVALID_SIGNATURE', `Missing required header: ${name}`);
  }
  return value.trim();
}

function assertScope(scopes: string[], requiredScope: string) {
  if (scopes.includes('*')) return;
  if (!scopes.includes(requiredScope)) {
    throw new ConnectorAuthError('AUTH_INSUFFICIENT_SCOPE', `Missing scope: ${requiredScope}`);
  }
}

export async function authenticateConnectorRequest(
  req: Request,
  requiredScope: string
): Promise<ConnectorAuthResult> {
  const apiKey = getRequiredHeader(req, 'x-ai-market-key');
  const timestampRaw = getRequiredHeader(req, 'x-ai-market-timestamp');
  const signature = getRequiredHeader(req, 'x-ai-market-signature').toLowerCase();
  const nonce = getRequiredHeader(req, 'x-ai-market-nonce');
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  const keyParts = apiKey.split('_');
  if (keyParts.length < 4) {
    throw new ConnectorAuthError('AUTH_INVALID_KEY', 'Invalid API key format.');
  }
  const keyPrefix = keyParts[2];

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) {
    throw new ConnectorAuthError('AUTH_EXPIRED_TIMESTAMP', 'Invalid timestamp.');
  }

  const skew = getRuntimeConfig().connectorTimestampSkewSeconds;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > skew) {
    throw new ConnectorAuthError('AUTH_EXPIRED_TIMESTAMP', 'Timestamp outside allowed clock skew.');
  }

  const supabase = createServiceRoleClient();
  const { data: keyRows, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_prefix', keyPrefix)
    .is('revoked_at', null)
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  const matchingRow = (keyRows || []).find((row) => verifySecret(apiKey, row.key_hash));
  if (!matchingRow) {
    throw new ConnectorAuthError('AUTH_INVALID_KEY', 'API key not found or invalid.');
  }

  if (matchingRow.expires_at && new Date(matchingRow.expires_at).getTime() < Date.now()) {
    throw new ConnectorAuthError('AUTH_INVALID_KEY', 'API key is expired.');
  }

  const bodyText = await req.clone().text();
  const digest = hashBody(bodyText);
  const payload = `${timestampRaw}.${req.method.toUpperCase()}.${new URL(req.url).pathname}.${digest}`;

  let signingSecret: string;
  try {
    signingSecret = decryptConnectorSigningSecret(String(matchingRow.secret_hash));
  } catch {
    throw new ConnectorAuthError('AUTH_INVALID_KEY', 'Connector signing secret is invalid.');
  }

  const expected = createHmac('sha256', signingSecret)
    .update(payload)
    .digest('hex');

  if (!safeEqHex(expected, signature)) {
    throw new ConnectorAuthError('AUTH_INVALID_SIGNATURE', 'Invalid connector signature.');
  }

  const nonceOk = await consumeNonce(matchingRow.tenant_id, nonce, skew * 2);
  if (!nonceOk) {
    throw new ConnectorAuthError('AUTH_NONCE_REPLAY', 'Nonce replay detected.');
  }

  const scopes = Array.isArray(matchingRow.scopes) ? (matchingRow.scopes as string[]) : [];
  assertScope(scopes, requiredScope);

  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', matchingRow.id);

  return {
    tenantId: matchingRow.tenant_id,
    keyId: matchingRow.id,
    requestId,
    scopes,
  };
}
