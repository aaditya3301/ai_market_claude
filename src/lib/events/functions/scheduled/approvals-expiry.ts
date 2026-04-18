import { expirePendingApprovals } from '@/lib/approvals/service';
import { inngest } from '@/lib/events/client';

export const approvalsExpirySweep = inngest.createFunction(
  {
    id: 'approvals-expiry-sweep',
    triggers: { cron: '*/15 * * * *' },
  },
  async ({ step }) => {
    const expired = await step.run('expire-approvals', async () => expirePendingApprovals());

    for (const approval of expired) {
      await step.sendEvent('emit-expired-resolution', {
        name: 'approval.resolved',
        data: {
          tenant_id: approval.tenant_id,
          approval_id: approval.id,
          decision: 'rejected',
          note: 'auto-expired',
        },
      });
    }

    return {
      expiredCount: expired.length,
    };
  }
);
