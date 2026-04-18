import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase';

export interface CreateTenantInput {
  parentTenantId: string;
  parentPlatformId: string;
  name: string;
  slug: string;
  timezone?: string;
  planCode?: string;
}

export interface IssueApiKeyInput {
  tenantId: string;
  name: string;
  scopes: string[];
  expiresAt?: string;
}

const CONNECTOR_SECRET_PREFIX = 'enc_v1:';

function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(secret, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifySecret(secret: string, encodedHash: string): boolean {
  const [algorithm, saltHex, hashHex] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;

  const derived = scryptSync(secret, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function getConnectorSecretEncryptionKey(): Buffer {
  const raw = process.env.CONNECTOR_SECRETS_ENCRYPTION_KEY || process.env.CREDENTIALS_MASTER_KEY;
  if (!raw) {
    throw new Error('CONNECTOR_SECRETS_ENCRYPTION_KEY or CREDENTIALS_MASTER_KEY is required.');
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('Connector secret encryption key must decode to exactly 32 bytes.');
  }

  return key;
}

export function encryptConnectorSigningSecret(secret: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getConnectorSecretEncryptionKey(), nonce);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${CONNECTOR_SECRET_PREFIX}${nonce.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

export function decryptConnectorSigningSecret(value: string): string {
  // Backward compatibility: previously issued keys stored raw secret in this column.
  if (!value.startsWith(CONNECTOR_SECRET_PREFIX)) {
    return value;
  }

  const payload = value.slice(CONNECTOR_SECRET_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid connector signing secret payload format.');
  }

  const [nonceHex, encryptedHex, tagHex] = parts;
  const nonce = Buffer.from(nonceHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', getConnectorSecretEncryptionKey(), nonce);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export async function createTenant(input: CreateTenantInput) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      parent_tenant_id: input.parentTenantId,
      parent_platform_id: input.parentPlatformId,
      name: input.name,
      slug: input.slug,
      timezone: input.timezone || 'UTC',
      plan_code: input.planCode || 'trial',
      settings: {},
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getTenantById(tenantId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function issueApiKey(input: IssueApiKeyInput) {
  const prefix = randomBytes(4).toString('hex');
  const keyToken = randomBytes(24).toString('base64url');
  const secret = randomBytes(32).toString('base64url');

  const apiKey = `aim_live_${prefix}_${keyToken}`;
  const keyHash = hashSecret(apiKey);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      key_prefix: prefix,
      key_hash: keyHash,
      secret_hash: encryptConnectorSigningSecret(secret),
      scopes: input.scopes,
      expires_at: input.expiresAt || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  return {
    row: data,
    apiKey,
    secret,
  };
}
