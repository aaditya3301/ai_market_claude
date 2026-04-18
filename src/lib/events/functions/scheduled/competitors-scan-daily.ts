import { inngest } from '@/lib/events/client';
import { listActiveTenants } from '@/lib/intelligence/tenants';
import { scanCompetitorsForTenant } from '@/lib/intelligence/competitors';

export const competitorsScanDaily = inngest.createFunction(
  {
    id: 'competitors-scan-daily',
    triggers: { cron: '0 4 * * *' },
  },
  async ({ step }) => {
    const tenants = await step.run('list-tenants', () => listActiveTenants(200));

    let observations = 0;
    let alerts = 0;

    for (const tenant of tenants) {
      const result = await step.run(`scan-competitors-${tenant.id}`, () =>
        scanCompetitorsForTenant(tenant.id)
      );
      observations += result.observations;
      alerts += result.alerts;
    }

    return {
      tenants: tenants.length,
      observations,
      alerts,
    };
  }
);
