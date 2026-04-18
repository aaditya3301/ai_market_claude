import { serve } from 'inngest/next';
import { inngest } from '@/lib/events/client';
import { functions } from '@/lib/events/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
