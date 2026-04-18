export type RetrievalPolicy = {
  sourceTypes: string[];
  k: number;
  includeTopWinners?: number;
  includeTrendContext?: boolean;
  includeCompetitorContext?: boolean;
  filters?: {
    platform?: string;
    minPerformance?: number;
    hasMetrics?: boolean;
  };
};

export const RETRIEVAL_POLICIES: Record<string, RetrievalPolicy> = {
  linkedin_long_form: {
    sourceTypes: ['past_post', 'voice_example'],
    filters: { platform: 'linkedin' },
    k: 8,
    includeTopWinners: 5,
  },
  instagram_caption: {
    sourceTypes: ['past_post', 'voice_example'],
    filters: { platform: 'instagram' },
    k: 10,
    includeTopWinners: 5,
  },
  ad_hook: {
    sourceTypes: ['past_post', 'voice_example', 'review'],
    k: 15,
    includeTopWinners: 8,
  },
  seo_article: {
    sourceTypes: ['voice_example', 'product', 'style_rule', 'past_post'],
    k: 20,
  },
  war_room_auditor: {
    sourceTypes: ['past_post'],
    filters: { hasMetrics: true },
    k: 20,
  },
  war_room_creative: {
    sourceTypes: ['past_post', 'voice_example'],
    k: 15,
    includeTopWinners: 10,
  },
  war_room_analyst: {
    sourceTypes: ['past_post'],
    k: 10,
    includeTrendContext: true,
    includeCompetitorContext: true,
  },
};
