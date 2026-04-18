/**
 * Scraper Service — Real-world web scraping using Jina Reader (FREE)
 * 
 * Jina Reader converts any URL into clean, LLM-ready text.
 * Usage: Just prefix any URL with https://r.jina.ai/
 * 
 * Fallback: Firecrawl (if FIRECRAWL_API_KEY is set)
 */

const JINA_READER_PREFIX = 'https://r.jina.ai/';

/**
 * Scrape a single URL and return clean text content.
 * Primary: Jina Reader (free, no API key needed)
 * Fallback: Firecrawl (if configured)
 */
export async function scrapeUrl(url: string): Promise<{ text: string; title: string; success: boolean }> {
  if (!url || url.trim() === '') {
    return { text: '', title: '', success: false };
  }

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  // Try Jina Reader first (FREE)
  try {
    console.log(`[Scraper] Jina Reader → ${normalizedUrl}`);
    const response = await fetch(`${JINA_READER_PREFIX}${normalizedUrl}`, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
      },
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (response.ok) {
      const text = await response.text();
      
      // Extract title from the first line if it looks like a title
      const lines = text.split('\n').filter(l => l.trim());
      const title = lines[0]?.replace(/^#\s*/, '').trim() || '';
      
      // Limit text to prevent token overflow (keep first 12000 chars)
      const trimmedText = text.substring(0, 12000);
      
      console.log(`[Scraper] Success: ${trimmedText.length} chars scraped from ${normalizedUrl}`);
      return { text: trimmedText, title, success: true };
    }

    console.warn(`[Scraper] Jina Reader returned ${response.status} for ${normalizedUrl}`);
  } catch (error: any) {
    console.error(`[Scraper] Jina Reader failed for ${normalizedUrl}:`, error.message);
  }

  // Fallback: Firecrawl (if API key is configured)
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey && firecrawlKey !== 'your_firecrawl_key') {
    try {
      console.log(`[Scraper] Falling back to Firecrawl → ${normalizedUrl}`);
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url: normalizedUrl,
          formats: ['markdown'],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        const markdown = data.data?.markdown || '';
        const title = data.data?.metadata?.title || '';
        const trimmedText = markdown.substring(0, 12000);

        console.log(`[Scraper] Firecrawl success: ${trimmedText.length} chars`);
        return { text: trimmedText, title, success: true };
      }
    } catch (error: any) {
      console.error(`[Scraper] Firecrawl also failed:`, error.message);
    }
  }

  return { text: '', title: '', success: false };
}

/**
 * Scrape a social media profile URL.
 * For Instagram/Twitter handles, construct the profile URL.
 */
export async function scrapeSocialProfile(platform: string, handleOrUrl: string): Promise<{ text: string; success: boolean }> {
  if (!handleOrUrl || handleOrUrl.trim() === '') {
    return { text: '', success: false };
  }

  let url = handleOrUrl.trim();

  // If it's just a handle (e.g. @brand or brand), construct the full URL
  if (!url.startsWith('http')) {
    const handle = url.replace('@', '');
    switch (platform.toLowerCase()) {
      case 'instagram':
        url = `https://www.instagram.com/${handle}/`;
        break;
      case 'twitter':
      case 'x':
        url = `https://x.com/${handle}`;
        break;
      case 'linkedin':
        url = url.includes('linkedin.com') ? url : `https://www.linkedin.com/company/${handle}/`;
        break;
      default:
        url = `https://${handle}`;
    }
  }

  return scrapeUrl(url);
}

/**
 * Batch scrape multiple URLs and return combined context.
 * Used by the Planning Engine to scrape website + social profiles.
 */
export async function scrapeMultipleUrls(urls: { label: string; url: string }[]): Promise<string> {
  const results: string[] = [];

  for (const { label, url } of urls) {
    if (!url || url.trim() === '' || url === 'Not provided') continue;

    const { text, success } = await scrapeUrl(url);
    if (success && text.length > 100) {
      results.push(`\n=== SCRAPED DATA FROM ${label.toUpperCase()} (${url}) ===\n${text}\n===END===`);
    }
  }

  if (results.length === 0) {
    return '';
  }

  return results.join('\n\n');
}
