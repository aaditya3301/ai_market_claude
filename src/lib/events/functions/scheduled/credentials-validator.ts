import { createServiceRoleClient } from '@/lib/supabase';
import { inngest } from '@/lib/events/client';

export const credentialsValidator = inngest.createFunction(
  {
    id: 'credentials-validator',
    triggers: { cron: '0 3 * * *' },
  },
  async ({ step }) => {
    await step.sendEvent('emit-scheduled-event', {
      name: 'credentials.validate.scheduled',
      data: {},
    });

    const supabase = createServiceRoleClient();
    const { data, error } = await step.run('list-active-credentials', async () =>
      supabase
        .from('tenant_credentials')
        .select('id')
        .eq('status', 'active')
    );

    if (error) {
      throw new Error(error.message);
    }

    return {
      activeCredentials: data?.length || 0,
    };
  }
);
