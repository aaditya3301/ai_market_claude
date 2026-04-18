import { NextResponse } from 'next/server';
import { envelopeSuccess } from '@/lib/api-envelope';
import { withConnectorRoute } from '@/lib/connector/route';
import { listApprovals, type ApprovalState } from '@/lib/approvals/service';

function asApprovalState(value: string | null): ApprovalState | undefined {
  if (!value) return undefined;
  if (value === 'pending' || value === 'approved' || value === 'rejected' || value === 'expired' || value === 'cancelled') {
    return value;
  }
  return undefined;
}

export async function GET(req: Request) {
  return withConnectorRoute(req, {
    scope: 'approvals:list',
    endpoint: 'v1/approvals.list',
    handler: async (auth) => {
      const state = asApprovalState(new URL(req.url).searchParams.get('state'));
      const approvals = await listApprovals(auth.tenantId, state || 'pending');

      return NextResponse.json(
        envelopeSuccess(
          {
            approvals,
          },
          {
            api_version: 'v1',
            step: 'v1/approvals.list',
          }
        )
      );
    },
  });
}
