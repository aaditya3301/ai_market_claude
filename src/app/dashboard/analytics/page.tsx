'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getBrandId } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Eye, 
  Search,
  Activity,
  Award
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { getCampaignAnalyticsAction, getCompetitorInsightsAction } from '@/app/actions/analytics';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  
  // Scraper State
  const [compHandle, setCompHandle] = useState('');
  const [compPlatform, setCompPlatform] = useState('instagram');
  const [scraping, setScraping] = useState(false);
  const [compData, setCompData] = useState<any>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const data = await getCampaignAnalyticsAction(getBrandId());
      setAnalytics(data);
    } catch (err) {
      toast.error('Failed to load analytics dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compHandle) return;
    
    setScraping(true);
    const id = toast.loading('Initializing Apify spider routines...');
    try {
      const data = await getCompetitorInsightsAction(compPlatform, compHandle.replace('@', ''));
      setCompData(data);
      toast.success('Competitor data retrieved!', { id });
    } catch (err: any) {
      toast.error(err.message || 'Scraping failed', { id });
    } finally {
      setScraping(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Analytics...</div>;

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-8">
      <div>
        <h1 className="text-3xl font-serif text-gray-900">Performance Analytics</h1>
        <p className="text-gray-500 mt-2">Track campaign KPIs, generated asset performance, and competitor intel.</p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Impressions', value: analytics.kpis.totalImpressions, icon: Eye, color: 'text-violet-500', bg: 'bg-violet-50' },
          { label: 'Avg Engagement', value: analytics.kpis.avgEngagement, icon: Heart, color: 'text-pink-500', bg: 'bg-pink-50' },
          { label: 'Conversions', value: analytics.kpis.conversions, icon: Award, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Total Ad Spend', value: analytics.kpis.adSpend, icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white shadow-sm border-gray-100 p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            </div>
            <div className={`p-4 rounded-xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white shadow-sm border-gray-100 p-6 rounded-2xl border border-gray-200 shadow-sm h-[400px] flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Weekly Reach & Impressions
          </h2>
          <div className="flex-1 w-full h-full min-h-0">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <Tooltip wrapperStyle={{ outline: 'none' }} cursor={{ stroke: '#e5e7eb', strokeWidth: 2, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="Reach" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorReach)" />
                  <Area type="monotone" dataKey="Impressions" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorImp)" />
                </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Competitor Scraper */}
        <div className="lg:col-span-1 bg-gray-900 text-white p-6 rounded-2xl shadow-xl flex flex-col relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
           
           <h2 className="text-xl font-bold mb-2 flex items-center gap-2 relative z-10"><Search className="w-5 h-5 text-violet-400" /> Competitor Intel</h2>
           <p className="text-sm text-gray-400 mb-6 relative z-10">Run Apify actors to scrape competitor profiles and find content gaps.</p>
           
           <form onSubmit={handleScrape} className="space-y-4 relative z-10">
              <div className="flex gap-2">
                <select value={compPlatform} onChange={e => setCompPlatform(e.target.value)} className="bg-gray-800 border-gray-700 text-white rounded-xl px-3 outline-none focus:ring-1 focus:ring-violet-500 text-sm">
                  <option value="instagram">Instagram</option>
                  <option value="twitter">X (Twitter)</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-gray-500">@</span>
                  <input type="text" value={compHandle} onChange={e => setCompHandle(e.target.value)} placeholder="competitor" className="w-full pl-8 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none text-sm placeholder:text-gray-500" />
                </div>
              </div>
              <button disabled={scraping || !compHandle} type="submit" className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl disabled:opacity-50 transition-colors flex justify-center items-center gap-2">
                {scraping ? <Activity className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {scraping ? 'Deploying Scraper...' : 'Analyze Competitor'}
              </button>
           </form>

           {compData && !scraping && (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 pt-6 border-t border-gray-800 relative z-10 flex-1 flex flex-col">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold">@{compData.handle}</h3>
                 <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md font-medium">{compData.engagement_rate} ER</span>
               </div>
               
               <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                 <div className="bg-gray-800 rounded-xl p-3">
                   <p className="text-xs text-gray-400 mb-1">Followers</p>
                   <p className="font-mono text-lg font-bold">{compData.followers.toLocaleString()}</p>
                 </div>
                 <div className="bg-gray-800 rounded-xl p-3">
                   <p className="text-xs text-gray-400 mb-1">Top Format</p>
                   <p className="font-bold text-violet-400 capitalize">{compData.top_posts[0].type}</p>
                 </div>
               </div>

               <div className="mt-auto bg-violet-900/40 border border-violet-800 rounded-xl p-4">
                 <p className="text-xs text-violet-300 font-semibold mb-1 uppercase tracking-wider">AI Insight</p>
                 <p className="text-sm text-violet-100">{compData.insight}</p>
               </div>
             </motion.div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"><Activity className="w-5 h-5 text-violet-500" /> Top Performing Ads & Posts</h2>
          <div className="space-y-4">
            {analytics?.topPerformers?.length === 0 && <p className="text-sm text-gray-500">No active variants running.</p>}
            {analytics?.topPerformers?.map((item: any, idx: number) => (
              <div key={item.id || idx} className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0 hover:bg-gray-50 p-2 rounded-lg transition-colors">
                <div>
                   <p className="font-semibold text-gray-900">{item.title}</p>
                   <p className="text-xs text-gray-500 uppercase font-medium mt-1 tracking-wider">{item.platform} • {item.type}</p>
                </div>
                <div className="text-right pl-4">
                   <p className="font-bold text-emerald-600 text-lg">{item.engagement}</p>
                   <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">CTR/Engage</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex gap-2 items-center"><Search className="w-5 h-5 text-blue-500" /> SEO Content Engine</h2>
          <div className="space-y-4 flex-1">
             <div className="bg-blue-50/50 p-4 rounded-xl flex justify-between items-center border border-blue-100/50">
                <span className="text-gray-600 font-medium text-sm">Published Articles</span>
                <span className="font-mono font-bold text-xl text-blue-700">{analytics?.seo?.published_articles || 0}</span>
             </div>
             <div className="bg-emerald-50/50 p-4 rounded-xl flex justify-between items-center border border-emerald-100/50">
                <span className="text-gray-600 font-medium text-sm">Words Generated</span>
                <span className="font-mono font-bold text-xl text-emerald-700">{(analytics?.seo?.total_words || 0).toLocaleString()}</span>
             </div>
             <div className="mt-6 pt-6 border-t border-gray-100">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold block mb-2">Top Ranking Article</span>
                <p className="text-sm font-semibold text-gray-800 line-clamp-2">{analytics?.seo?.top_article || 'No articles yet'}</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Missing Lucide Icon import helper
const Heart = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
);
