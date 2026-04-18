import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { withConnectorRoute } from '@/lib/connector/route';
import { getApproval } from '@/lib/approvals/service';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withConnectorRoute(req, {
    scope: 'approvals:read',
    endpoint: 'v1/approvals.read',
    handler: async (auth) => {
      const { id } = await context.params;
      const approval = await getApproval(auth.tenantId, id);
      if (!approval) {
        return NextResponse.json(
          envelopeError('APPROVAL_NOT_FOUND', 'Approval not found', undefined, {
            api_version: 'v1',
            step: 'v1/approvals.read',
          }),
          { status: 404 }
        );
      }

      return NextResponse.json(
        envelopeSuccess(
          {
            approval,
          },
          {
            api_version: 'v1',
            step: 'v1/approvals.read',
          }
        )
      );
    },
  });
}
