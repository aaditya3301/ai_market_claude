import { NextResponse } from 'next/server';
import { WorkerClient } from '@/lib/workers/client';

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const worker = new WorkerClient();
    const data = await worker.call('/internal/echo', payload, { timeoutMs: 15000 });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Worker call failed';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
