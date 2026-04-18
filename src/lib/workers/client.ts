import { createHash, createHmac } from 'crypto';

export class WorkerError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export class WorkerClient {
  private readonly baseUrl: string;
  private readonly sharedSecret: string;

  constructor() {
    this.baseUrl = process.env.WORKER_BASE_URL || '';
    this.sharedSecret = process.env.WORKER_SHARED_SECRET || '';

    if (!this.baseUrl) {
      throw new Error('WORKER_BASE_URL is required');
    }
    if (!this.sharedSecret) {
      throw new Error('WORKER_SHARED_SECRET is required');
    }
  }

  async call<T>(path: string, body: object, opts: { timeoutMs?: number } = {}): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = JSON.stringify(body);
    const bodyHash = createHash('sha256').update(bodyStr).digest('hex');
    const signature = createHmac('sha256', this.sharedSecret)
      .update(`${timestamp}.POST.${path}.${bodyHash}`)
      .digest('hex');

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-timestamp': timestamp,
        'x-signature': signature,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });

    if (!response.ok) {
      throw new WorkerError(await response.text(), response.status);
    }

    return response.json() as Promise<T>;
  }
}
