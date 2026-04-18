import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function getMasterKey(): Buffer {
  const raw = process.env.CREDENTIALS_MASTER_KEY;
  if (!raw) {
    throw new Error('CREDENTIALS_MASTER_KEY is required.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_MASTER_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

function getKeyId(): string {
  const keyId = process.env.CREDENTIALS_KEY_ID;
  if (!keyId) {
    throw new Error('CREDENTIALS_KEY_ID is required.');
  }
  return keyId;
}

export function encryptCredential(plaintext: Record<string, unknown>) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getMasterKey(), nonce);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([data, tag]),
    nonce,
    encryption_key_id: getKeyId(),
  };
}

export function decryptCredential(row: { ciphertext: Buffer; nonce: Buffer }) {
  const tag = row.ciphertext.slice(-16);
  const data = row.ciphertext.slice(0, -16);
  const decipher = createDecipheriv('aes-256-gcm', getMasterKey(), row.nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as Record<string, unknown>;
}
