import { generateText } from './gemini';

/**
 * Phase 0: Competitor Intelligence
 * Scrapes a competitor URL and extracts their core semantic topics using Jina Reader.
 */
export async function scrapeCompetitorIntel(url: string) {
  try {
    const readerUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(readerUrl);
    const text = await response.text();

    const extractionPrompt = `
    Analyze the following scraped content from a competitor website.
    
    CONTENT:
    ${text.substring(0, 8000)}
    
    TASK:
    Identify the TOP 5 semantic keywords or topics this competitor is clearly targeting for SEO.
    Return a JSON object: {"keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]}
    `;

    const result = await generateText(extractionPrompt);
    return result?.keywords || [];
  } catch (error) {
    console.error('[SEO Intel] Scrape failed:', error);
    return [];
  }
}

/**
 * Phase 1: Generate a Hub & Spoke semantic topic cluster from a seed keyword.
 */
export async function generateTopicCluster(
  keyword: string,
  brandContext: { name: string; industry: string },
  competitorData?: { url: string, keywords: string[] }
) {
  const competitorContext = competitorData 
    ? `\nCOMPETITOR INTELLIGENCE:
We are competing against: ${competitorData.url}
They are currently ranking for these keywords: ${competitorData.keywords.join(', ')}

CRITICAL GOAL: Your cluster MUST be designed to out-rank and provide MORE depth than this competitor. Address their core topics but add unique value, better statistics, and more comprehensive H2 structures.`
    : '';

  const prompt = `
You are a world-class SEO strategist and content marketing expert.

Given the seed keyword "${keyword}" for a brand in the "${brandContext.industry}" industry called "${brandContext.name}", generate a comprehensive "Hub & Spoke" semantic topic cluster.${competitorContext}

REQUIREMENTS:
- The HUB is the central pillar topic that broadly covers the keyword.
- Each SPOKE is a subtopic that targets a long-tail variation and links back to the hub.
- Optimize for BOTH traditional Google Search AND AI search engines (Perplexity, ChatGPT, Gemini) — this is called Generative Engine Optimization (GEO).
- For GEO, each spoke should include data points, statistics references, and FAQ-style content that AI engines love to cite.

Generate a JSON object with strictly these keys:
{
  "hub": {
    "title": "The broad pillar article title (Max 60 chars)",
    "target_keyword": "Primary keyword to rank for",
    "search_intent": "informational | commercial | transactional | navigational",
    "description": "2-3 sentence summary of what this pillar covers"
  },
  "spokes": [
    {
      "title": "Spoke article title targeting a long-tail keyword (Max 60 chars)",
      "target_keyword": "The long-tail keyword",
      "search_intent": "informational | commercial | transactional | navigational",
      "suggested_h2s": ["H2 Section 1", "H2 Section 2", "H2 Section 3", "H2 Section 4"],
      "faq_questions": ["FAQ Question 1?", "FAQ Question 2?"],
      "geo_data_points": ["A statistic or data point to include for AI citation"]
    }
  ]
}

Generate exactly 5 spokes. Make them diverse — covering different angles and search intents for the keyword cluster.
`;

  return await generateText(prompt);
}

/**
 * Phase 2: Draft a full SEO + GEO optimized article for a given spoke topic.
 */
export async function generateArticle(
  spoke: {
    title: string;
    target_keyword: string;
    search_intent: string;
    suggested_h2s: string[];
    faq_questions: string[];
    geo_data_points: string[];
  },
  hubContext: {
    hub_title: string;
    seed_keyword: string;
    brand_name: string;
  }
) {
  const prompt = `
You are an elite SEO content writer who specializes in Generative Engine Optimization (GEO).

Write a comprehensive, well-structured article on the topic: "${spoke.title}"
Target Keyword: "${spoke.target_keyword}"
Search Intent: "${spoke.search_intent}"
Brand: "${hubContext.brand_name}"
Parent Pillar Topic: "${hubContext.hub_title}" (link back to this conceptually)

STRUCTURE REQUIREMENTS:
- Use these H2 sections: ${spoke.suggested_h2s.map(h => `"${h}"`).join(', ')}
- Include H3 sub-sections where appropriate for depth
- Write approximately 1200-1500 words of high-quality, authoritative content
- Include an FAQ section at the end answering: ${spoke.faq_questions.map(q => `"${q}"`).join(', ')}
- Weave in this data/statistics naturally: ${spoke.geo_data_points.map(d => `"${d}"`).join(', ')}

GEO OPTIMIZATION:
- Use clear, concise language that AI engines can easily parse and cite
- Include structured data-like patterns (definitions, lists, comparisons)
- Front-load key facts in paragraphs (AI engines prefer this)
- Use semantic variations of the target keyword naturally

OUTPUT FORMAT — return a JSON object:
{
  "title": "The final SEO-optimized title tag (Max 60 chars)",
  "meta_description": "A compelling meta description (Max 155 chars)",
  "content": "The full article in Markdown format with ## H2, ### H3, **bold**, bullet points. Include the FAQ section at the end with ## FAQ heading. IMPORTANT: Use \\n for newlines inside this JSON string. Escape all double quotes with backslash.",
  "word_count": 1350,
  "internal_link_suggestions": ["Related Topic 1 to link to", "Related Topic 2"]
}

CRITICAL JSON RULES:
- The "content" value is a SINGLE JSON string. Use \\n for line breaks, NOT actual newlines.
- Escape all double quotes inside the content with a backslash: \\"
- Do NOT use markdown code blocks inside the content.
- Return ONLY the JSON object, no other text.
`;

  return await generateText(prompt);
}
