import type { RetrievalPolicy } from '@/lib/intelligence/retrieval-policies';
import { RETRIEVAL_POLICIES } from '@/lib/intelligence/retrieval-policies';

export interface RetrievalEvalCase {
  id: string;
  query: string;
  policy: RetrievalPolicy;
  expectedTags: string[];
  minResults?: number;
}

export const DEFAULT_RETRIEVAL_CASES: RetrievalEvalCase[] = [
  {
    id: 'linkedin_voice_alignment',
    query: 'linkedin launch post idea for premium sleep headband',
    policy: RETRIEVAL_POLICIES.linkedin_long_form,
    expectedTags: ['voice_example', 'past_post'],
    minResults: 4,
  },
  {
    id: 'ad_hook_winner_bias',
    query: 'high-converting ad hook for stressed professionals',
    policy: RETRIEVAL_POLICIES.ad_hook,
    expectedTags: ['past_post', 'review'],
    minResults: 6,
  },
  {
    id: 'war_room_auditor_metrics',
    query: 'which recent campaign themes underperformed by engagement rate',
    policy: RETRIEVAL_POLICIES.war_room_auditor,
    expectedTags: ['past_post'],
    minResults: 5,
  },
];
