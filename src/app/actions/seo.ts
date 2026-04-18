'use server';

import { supabase } from '@/lib/supabase';
import { generateTopicCluster, generateArticle, scrapeCompetitorIntel } from '@/lib/seo-service';

/**
 * Generate a Hub & Spoke topic cluster from a seed keyword.
 */
export async function generateClusterAction(keyword: string, brandId: string, competitorUrl?: string) {
  console.log(`[SEO Hub] Generating cluster for keyword: "${keyword}"${competitorUrl ? ` (Comp: ${competitorUrl})` : ''}`);

  // Get brand context
  const { data: brand } = await supabase
    .from('brands')
    .select('name, industry')
    .eq('id', brandId)
    .single();

  const brandContext = {
    name: brand?.name || 'Brand',
    industry: brand?.industry || 'Technology',
  };

  // NEW: Scrape competitor if URL provided
  let competitorKeywords: string[] = [];
  if (competitorUrl) {
    console.log(`[SEO Hub] Scraping competitor topics from ${competitorUrl}...`);
    competitorKeywords = await scrapeCompetitorIntel(competitorUrl);
    console.log(`[SEO Hub] Competitor keywords detected: ${competitorKeywords.join(', ')}`);
  }

  const clusterData = await generateTopicCluster(
    keyword, 
    brandContext, 
    competitorUrl ? { url: competitorUrl, keywords: competitorKeywords } : undefined
  );

  console.log(`[SEO Hub] Cluster generated: Hub="${clusterData.hub?.title}", ${clusterData.spokes?.length || 0} spokes`);

  // Save to DB
  const { data, error } = await supabase
    .from('seo_clusters')
    .insert([{
      brand_id: brandId,
      seed_keyword: keyword,
      hub_topic: clusterData.hub?.title || keyword,
      cluster_data: clusterData,
      status: 'generated'
    }])
    .select()
    .single();

  if (error) throw new Error('Failed to save cluster: ' + error.message);

  return data;
}

/**
 * Draft a single article for one spoke of a cluster.
 */
export async function generateArticleAction(clusterId: string, spokeIndex: number) {
  // Fetch cluster
  const { data: cluster, error } = await supabase
    .from('seo_clusters')
    .select('*')
    .eq('id', clusterId)
    .single();

  if (error || !cluster) throw new Error('Cluster not found');

  const clusterData = cluster.cluster_data as any;
  const spoke = clusterData.spokes?.[spokeIndex];
  if (!spoke) throw new Error(`Spoke at index ${spokeIndex} not found`);

  console.log(`[SEO Hub] Drafting article for spoke ${spokeIndex}: "${spoke.title}"`);

  // Get brand info
  const { data: brand } = await supabase
    .from('brands')
    .select('name')
    .eq('id', cluster.brand_id)
    .single();

  const articleData = await generateArticle(spoke, {
    hub_title: clusterData.hub?.title || cluster.seed_keyword,
    seed_keyword: cluster.seed_keyword,
    brand_name: brand?.name || 'Brand',
  });

  // Save article
  const { data: article, error: articleError } = await supabase
    .from('seo_articles')
    .insert([{
      cluster_id: clusterId,
      spoke_index: spokeIndex,
      title: articleData.title || spoke.title,
      target_keyword: spoke.target_keyword,
      meta_description: articleData.meta_description || '',
      content: articleData.content || '',
      word_count: articleData.word_count || 0,
      status: 'drafted'
    }])
    .select()
    .single();

  if (articleError) throw new Error('Failed to save article: ' + articleError.message);

  console.log(`[SEO Hub] Article drafted: "${article.title}" (${article.word_count} words)`);
  return article;
}

/**
 * Draft ALL articles for a cluster sequentially.
 */
export async function generateAllArticlesAction(clusterId: string) {
  // Update cluster status
  await supabase
    .from('seo_clusters')
    .update({ status: 'writing' })
    .eq('id', clusterId);

  const { data: cluster } = await supabase
    .from('seo_clusters')
    .select('*')
    .eq('id', clusterId)
    .single();

  if (!cluster) throw new Error('Cluster not found');

  const spokes = (cluster.cluster_data as any)?.spokes || [];
  const articles = [];

  for (let i = 0; i < spokes.length; i++) {
    try {
      const article = await generateArticleAction(clusterId, i);
      articles.push(article);
    } catch (e: any) {
      console.error(`[SEO Hub] Failed to draft spoke ${i}:`, e.message);
      articles.push({ error: e.message, spoke_index: i });
    }
  }

  // Mark cluster complete
  await supabase
    .from('seo_clusters')
    .update({ status: 'completed' })
    .eq('id', clusterId);

  return articles;
}

/**
 * List all clusters for a brand.
 */
export async function getClustersAction(brandId: string) {
  const { data, error } = await supabase
    .from('seo_clusters')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Get a cluster with its articles.
 */
export async function getClusterWithArticlesAction(clusterId: string) {
  const [clusterRes, articlesRes] = await Promise.all([
    supabase.from('seo_clusters').select('*').eq('id', clusterId).single(),
    supabase.from('seo_articles').select('*').eq('cluster_id', clusterId).order('spoke_index', { ascending: true })
  ]);

  if (clusterRes.error) throw new Error(clusterRes.error.message);

  return {
    cluster: clusterRes.data,
    articles: articlesRes.data || []
  };
}
