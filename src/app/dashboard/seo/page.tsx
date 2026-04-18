'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandId } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Search,
  Globe,
  FileText,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Copy,
  ExternalLink,
  BookOpen,
  Target,
  HelpCircle,
  TrendingUp,
  X,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  generateClusterAction,
  generateAllArticlesAction,
  getClustersAction,
  getClusterWithArticlesAction,
} from '@/app/actions/seo';

export default function SeoHubPage() {
  const [keyword, setKeyword] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [showCompetitor, setShowCompetitor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftingIndex, setDraftingIndex] = useState(-1);
  const [cluster, setCluster] = useState<any>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const brandId = getBrandId();
      const data = await getClustersAction(brandId);
      setHistory(data);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (!keyword.trim()) {
      toast.error('Please enter a seed keyword');
      return;
    }

    setLoading(true);
    setCluster(null);
    setArticles([]);
    setSelectedArticle(null);

    try {
      const brandId = getBrandId();
      const result = await generateClusterAction(
        keyword.trim(), 
        brandId, 
        showCompetitor ? competitorUrl.trim() : undefined
      );
      setCluster(result);
      toast.success('Topic cluster generated!');
      fetchHistory();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate cluster');
    } finally {
      setLoading(false);
    }
  };

  const handleDraftAll = async () => {
    if (!cluster) return;

    setDrafting(true);
    setDraftingIndex(0);
    const loadingToast = toast.loading('Writer Agent drafting all articles...');

    try {
      const results = await generateAllArticlesAction(cluster.id);
      const valid = results.filter((a: any) => !a.error);
      setArticles(valid);
      setDraftingIndex(-1);
      toast.success(`${valid.length} articles drafted successfully!`, { id: loadingToast });
      fetchHistory();
    } catch (error: any) {
      toast.error(error.message || 'Failed to draft articles', { id: loadingToast });
    } finally {
      setDrafting(false);
      setDraftingIndex(-1);
    }
  };

  const loadCluster = async (id: string) => {
    setLoading(true);
    try {
      const { cluster: c, articles: a } = await getClusterWithArticlesAction(id);
      setCluster(c);
      setArticles(a);
      setKeyword(c.seed_keyword);
      setSelectedArticle(null);
    } catch {
      toast.error('Failed to load cluster');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const clusterData = cluster?.cluster_data;
  const spokes = clusterData?.spokes || [];

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-gray-900">Semantic SEO Hub</h1>
        <p className="text-gray-500 mt-2">
          Enter a keyword → AI builds a topic cluster → Writer Agent drafts 5 SEO + GEO optimized articles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Left: Input + History */}
        <div className="lg:col-span-1 space-y-6">

          {/* Input Card */}
          <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-violet-500" />
              Seed Keyword
            </h2>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="e.g. marketing automation"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all text-sm bg-gray-50"
            />

            {/* Competitor Toggle */}
            <div className="pt-2">
              <button
                onClick={() => setShowCompetitor(!showCompetitor)}
                className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  showCompetitor 
                    ? 'bg-rose-50 border-rose-100 text-rose-600' 
                    : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                {showCompetitor ? 'Competitor Intel: ACTIVE' : 'Enable Competitor Intel?'}
              </button>
              
              <AnimatePresence>
                {showCompetitor && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1.5">Competitor Domain/URL</label>
                    <input
                      type="url"
                      value={competitorUrl}
                      onChange={e => setCompetitorUrl(e.target.value)}
                      placeholder="e.g. competitor.com"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-xs bg-gray-50 mb-1"
                    />
                    <p className="text-[10px] text-gray-400 leading-tight">AI will scrape their site to find gaps in their strategy.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !keyword.trim() || (showCompetitor && !competitorUrl.trim())}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <><RefreshCw className="w-5 h-5 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate Cluster</>
              )}
            </button>
          </div>

          {/* History */}
          <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Past Clusters
            </h3>
            {loadingHistory ? (
              <p className="text-xs text-gray-400 animate-pulse">Loading...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400">No clusters yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map(h => (
                  <button
                    key={h.id}
                    onClick={() => loadCluster(h.id)}
                    className={`w-full text-left p-3 rounded-xl border text-sm transition-all hover:border-violet-200 hover:bg-violet-50/50 ${
                      cluster?.id === h.id ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    <p className="font-medium text-gray-800 truncate">{h.seed_keyword}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                        h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        h.status === 'writing' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{h.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-3 space-y-6">

          {/* Empty State */}
          {!cluster && !loading && (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl min-h-[500px] flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <Globe className="w-14 h-14 mb-4 opacity-40" />
              <p className="font-medium text-gray-500 text-lg">No cluster generated yet</p>
              <p className="text-sm mt-1 max-w-md">
                Enter a seed keyword to generate a Hub & Spoke semantic topic cluster with 5 AI-drafted articles optimized for Google & AI search.
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && !cluster && (
            <div className="bg-white shadow-sm border-gray-100 border border-gray-200 rounded-2xl min-h-[500px] flex flex-col items-center justify-center p-8 space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-50/50 to-emerald-50/50 animate-pulse" />
              <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin z-10" />
              <p className="text-gray-500 font-medium z-10 animate-pulse">AI Agent mapping semantic topic cluster...</p>
            </div>
          )}

          {/* Cluster Results */}
          {cluster && clusterData && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

              {/* Hub Card */}
              <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-violet-200/40">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white shadow-sm border-gray-100/20 rounded-xl backdrop-blur-sm">
                    <Target className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wider text-violet-200 font-semibold mb-1">Hub / Pillar Topic</p>
                    <h2 className="text-xl font-bold">{clusterData.hub?.title}</h2>
                    <p className="text-violet-100 text-sm mt-2 leading-relaxed">{clusterData.hub?.description}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs bg-white shadow-sm border-gray-100/20 px-3 py-1 rounded-full font-medium backdrop-blur-sm">
                        🎯 {clusterData.hub?.target_keyword}
                      </span>
                      <span className="text-xs bg-white shadow-sm border-gray-100/20 px-3 py-1 rounded-full font-medium backdrop-blur-sm capitalize">
                        {clusterData.hub?.search_intent}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spoke Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-violet-500" />
                    Spoke Topics ({spokes.length})
                  </h3>
                  <button
                    onClick={handleDraftAll}
                    disabled={drafting || articles.length >= spokes.length}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    {drafting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Writer Agent Drafting...</>
                    ) : articles.length >= spokes.length ? (
                      <><CheckCircle2 className="w-4 h-4" /> All Drafted</>
                    ) : (
                      <><FileText className="w-4 h-4" /> Draft All Articles</>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {spokes.map((spoke: any, i: number) => {
                    const article = articles.find((a: any) => a.spoke_index === i);
                    const isDrafting = drafting && draftingIndex <= i && !article;

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 }}
                        className={`bg-white shadow-sm border-gray-100 rounded-2xl border p-5 shadow-sm transition-all cursor-pointer hover:shadow-sm ${
                          selectedArticle?.spoke_index === i
                            ? 'border-violet-300 ring-2 ring-violet-100'
                            : 'border-gray-200 hover:border-gray-200'
                        }`}
                        onClick={() => article && setSelectedArticle(article)}
                      >
                        {/* Status Indicator */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            Spoke {i + 1}
                          </span>
                          {article ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Drafted
                            </span>
                          ) : isDrafting ? (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" /> Writing...
                            </span>
                          ) : (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                              Pending
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">
                          {spoke.title}
                        </h4>

                        <div className="flex items-center gap-1.5 mb-3">
                          <TrendingUp className="w-3 h-3 text-violet-500 shrink-0" />
                          <p className="text-xs text-violet-600 font-medium truncate">{spoke.target_keyword}</p>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md capitalize">
                            {spoke.search_intent}
                          </span>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
                            {spoke.suggested_h2s?.length || 0} H2s
                          </span>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
                            {spoke.faq_questions?.length || 0} FAQs
                          </span>
                        </div>

                        {article && (
                          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-medium">{article.word_count} words</span>
                            <span className="text-xs text-violet-600 font-medium flex items-center gap-1">
                              Read <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Article Viewer */}
              <AnimatePresence>
                {selectedArticle && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    {/* Article Header */}
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">
                            Article Preview — Spoke {selectedArticle.spoke_index + 1}
                          </p>
                          <h2 className="text-xl font-bold">{selectedArticle.title}</h2>
                          <p className="text-gray-300 text-sm mt-2">
                            {selectedArticle.meta_description}
                          </p>
                          <div className="flex items-center gap-3 mt-3">
                            <span className="text-xs bg-white shadow-sm border-gray-100/10 px-3 py-1 rounded-full font-medium">
                              🎯 {selectedArticle.target_keyword}
                            </span>
                            <span className="text-xs bg-white shadow-sm border-gray-100/10 px-3 py-1 rounded-full font-medium">
                              📝 {selectedArticle.word_count} words
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(selectedArticle.content)}
                            className="p-2 bg-white shadow-sm border-gray-100/10 hover:bg-white shadow-sm border-gray-100/20 rounded-lg transition-colors"
                            title="Copy article"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedArticle(null)}
                            className="p-2 bg-white shadow-sm border-gray-100/10 hover:bg-white shadow-sm border-gray-100/20 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* SEO Meta Preview */}
                    <div className="mx-6 mt-5 p-4 bg-green-50 border border-green-200 rounded-xl">
                      <p className="text-xs font-bold text-green-700 uppercase mb-2 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Google SERP Preview
                      </p>
                      <p className="text-blue-700 text-lg font-medium hover:underline cursor-pointer leading-tight">
                        {selectedArticle.title}
                      </p>
                      <p className="text-green-800 text-xs mt-0.5">https://www.yourbrand.com/blog/{selectedArticle.target_keyword?.replace(/\s+/g, '-').toLowerCase()}</p>
                      <p className="text-gray-500 text-sm mt-1 line-clamp-2">{selectedArticle.meta_description}</p>
                    </div>

                    {/* Article Content */}
                    <div className="p-6">
                      <div
                        className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-strong:text-gray-900"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(selectedArticle.content || '')
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple markdown renderer — converts ## H2, ### H3, **bold**, - lists, and \n to HTML.
 */
function renderMarkdown(md: string): string {
  return md
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/# (.*)/g, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/---/g, '<hr />')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />')
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p>${match}</p>`;
    });
}
