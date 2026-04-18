import { NextResponse } from 'next/server';
import { envelopeError, envelopeSuccess } from '@/lib/api-envelope';
import { withConnectorRoute } from '@/lib/connector/route';
import { resolveApproval } from '@/lib/approvals/service';
import { inngest } from '@/lib/events/client';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return withConnectorRoute(req, {
    scope: 'approvals:resolve',
    endpoint: 'v1/approvals.resolve',
    handler: async (auth) => {
      const body = await req.json().catch(() => ({}));
      const { id } = await context.params;
      const decision = String(body.decision || '').toLowerCase();

      if (decision !== 'approved' && decision !== 'rejected') {
        return NextResponse.json(
          envelopeError('VALIDATION_FAILED', 'decision must be approved or rejected', {
            field: 'decision',
          }, {
            api_version: 'v1',
            step: 'v1/approvals.resolve',
          }),
          { status: 400 }
        );
      }

      let resolved;
      try {
        resolved = await resolveApproval({
          approvalId: id,
          tenantId: auth.tenantId,
          decision,
          actor: `agent:${auth.keyId}`,
          edits: body.edits && typeof body.edits === 'object' ? body.edits : undefined,
          note: typeof body.note === 'string' ? body.note : undefined,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
        if (message === 'APPROVAL_NOT_FOUND') {
          return NextResponse.json(
            envelopeError('APPROVAL_NOT_FOUND', 'Approval not found', undefined, {
              api_version: 'v1',
              step: 'v1/approvals.resolve',
            }),
            { status: 404 }
          );
        }
        if (message === 'APPROVAL_ALREADY_RESOLVED') {
          return NextResponse.json(
            envelopeError('APPROVAL_ALREADY_RESOLVED', 'Approval already resolved', undefined, {
              api_version: 'v1',
              step: 'v1/approvals.resolve',
            }),
            { status: 409 }
          );
        }
        throw error;
      }

      await inngest.send({
        name: 'approval.resolved',
        data: {
          tenant_id: auth.tenantId,
          approval_id: id,
          decision,
          note: resolved.resolution_note || undefined,
        },
      });

      return NextResponse.json(
        envelopeSuccess(
          {
            approval_id: id,
            state: resolved.state,
            decision,
          },
          {
            api_version: 'v1',
            step: 'v1/approvals.resolve',
          }
        )
      );
    },
  });
}
