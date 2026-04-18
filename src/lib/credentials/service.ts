import { createServiceRoleClient } from '@/lib/supabase';
import { decryptCredential, encryptCredential } from '@/lib/credentials/vault';
import { logger } from '@/lib/runtime/logger';

export type CredentialProvider =
  | 'meta_ads'
  | 'google_ads'
  | 'shopify'
  | 'klaviyo'
  | 'postiz'
  | 'fal'
  | 'other';

export interface UpsertTenantCredentialInput {
  tenantId: string;
  provider: CredentialProvider;
  accountId: string;
  displayName?: string;
  secret: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: 'active' | 'needs_reauth' | 'expired' | 'revoked';
}

export async function upsertTenantCredential(input: UpsertTenantCredentialInput) {
  const encrypted = encryptCredential(input.secret);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('tenant_credentials')
    .upsert(
      {
        tenant_id: input.tenantId,
        provider: input.provider,
        account_id: input.accountId,
        display_name: input.displayName || null,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        encryption_key_id: encrypted.encryption_key_id,
        metadata: input.metadata || {},
        status: input.status || 'active',
      },
      { onConflict: 'tenant_id,provider,account_id' }
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getDecryptedTenantCredential(params: {
  tenantId: string;
  provider: CredentialProvider;
  accountId: string;
  caller: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('tenant_credentials')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .eq('provider', params.provider)
    .eq('account_id', params.accountId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  logger.info({
    msg: 'credential.decrypt',
    tenant_id: params.tenantId,
    provider: params.provider,
    caller: params.caller,
  });

  const toBuffer = (value: unknown): Buffer => {
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'string') {
      if (value.startsWith('\\x')) {
        return Buffer.from(value.slice(2), 'hex');
      }
      return Buffer.from(value, 'base64');
    }
    throw new Error('Invalid credential binary payload');
  };

  return {
    row: data,
    secret: decryptCredential({
      ciphertext: toBuffer(data.ciphertext),
      nonce: toBuffer(data.nonce),
    }),
  };
}

export async function listTenantCredentials(tenantId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('tenant_credentials')
    .select('id, provider, account_id, display_name, metadata, status, last_used_at, expires_at, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}
