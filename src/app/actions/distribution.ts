'use server';

import { supabase } from '@/lib/supabase';
import { schedulePostToPostiz } from '@/lib/postiz';

export async function scheduleOrPublishAction(
  artifactId: string,
  platform: string,
  content: string,
  mediaUrl: string | null,
  isScheduled: boolean,
  scheduledTimeStr?: string
) {
  const targetTime = isScheduled && scheduledTimeStr ? new Date(scheduledTimeStr) : new Date();

  // 1. Send to Postiz (real or simulated)
  const result = await schedulePostToPostiz(platform, content, mediaUrl, targetTime);

  // 2. Update Supabase Artifact status with publishing metadata
  const newStatus = isScheduled ? 'scheduled' : 'published';
  
  const { data: artifact } = await supabase
    .from('artifacts')
    .select('metrics')
    .eq('id', artifactId)
    .single();

  const updatedMetrics = {
    ...(artifact?.metrics || {}),
    postiz_post_id: result.postId,
    postiz_success: result.success,
    postiz_simulated: result.isSimulated,
    postiz_message: result.message,
    published_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('artifacts')
    .update({ status: newStatus, metrics: updatedMetrics })
    .eq('id', artifactId);
  
  if (error) throw new Error(error.message);
  
  return {
    success: true,
    isReal: !result.isSimulated,
    postizPostId: result.postId,
    message: result.message,
  };
}
