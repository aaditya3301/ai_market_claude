'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getBrandId } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Target, 
  TrendingUp, 
  MousePointerClick, 
  DollarSign, 
  Plus,
  RefreshCw,
  Image as ImageIcon,
  Search,
  Zap,
  PlayCircle,
  PauseCircle,
  Trophy
} from 'lucide-react';
import { createAdCampaignAction, getAdArtifactsAction, getEligibleCampaignsAction, optimizeAdsAction } from '@/app/actions/ads';

export default function AdsManagerPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [targetAudience, setTargetAudience] = useState('Marketing Professionals aged 25-45');
  const [adBudget, setAdBudget] = useState(500);
  const [platform, setPlatform] = useState('meta');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const brandId = getBrandId();
      const [camps, adArtifacts] = await Promise.all([
        getEligibleCampaignsAction(brandId),
        getAdArtifactsAction(brandId)
      ]);
      setCampaigns(camps);
      setAds(adArtifacts || []);
      if (camps.length > 0) setSelectedCampaign(camps[0].id);
    } catch (error) {
      toast.error('Failed to load Ad data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign || !targetAudience || !adBudget) return;

    setIsCreating(true);
    const loadingToast = toast.loading(`Generating 3 Psychological Variants for ${platform === 'meta' ? 'Meta' : 'Google'}...`);
    try {
      const newAds = await createAdCampaignAction(selectedCampaign, targetAudience, adBudget, platform);
      
      const campaignInfo = campaigns.find(c => c.id === selectedCampaign);
      const formattedNewAds = newAds.map((a: any) => ({ ...a, campaigns: campaignInfo }));
      
      setAds([...formattedNewAds, ...ads]);
      toast.success('3 Ad Variants created successfully!', { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create ads', { id: loadingToast });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    const loadingToast = toast.loading('Optimizer Agent analyzing CTRs...');
    try {
      const { optimized } = await optimizeAdsAction();
      await fetchData(); // Refresh data to see new paused/winner statuses
      toast.success(`Optimization complete. ${optimized} ad groups updated.`, { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message || 'Failed to optimize ads', { id: loadingToast });
    } finally {
      setIsOptimizing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Ads Manager...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-gray-900">Autonomous Ads Manager</h1>
          <p className="text-gray-500 mt-2">Generate 3 multivariate psychological ad variants and let the Optimizer Agent reallocate budget automatically.</p>
        </div>
        
        {/* Optimizer Button */}
        <button
          onClick={handleOptimize}
          disabled={isOptimizing || ads.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium shadow-sm shadow-violet-200 hover:shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {isOptimizing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
          {isOptimizing ? 'Analyzing...' : 'Run Optimizer Agent'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col: Creation Form */}
        <div className="lg:col-span-4 border border-gray-200 bg-white shadow-sm border-gray-100 rounded-2xl p-6 shadow-sm h-fit sticky top-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-500" />
            Launch Multivariate Test
          </h2>
          
          <form onSubmit={handleCreateAd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source Campaign</label>
              <select 
                value={selectedCampaign}
                onChange={e => setSelectedCampaign(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-violet-500 focus:border-violet-500 outline-none bg-gray-50"
              >
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ad Network</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPlatform('meta')}
                  className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-all ${platform === 'meta' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white shadow-sm border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                >
                  Meta Ads
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform('google')}
                  className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-all ${platform === 'google' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white shadow-sm border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                >
                  Google Ads
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
              <textarea 
                rows={3}
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-violet-500 focus:border-violet-500 outline-none bg-gray-50 text-sm"
                placeholder="e.g. Small business owners looking for marketing tools"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Daily Budget (Shared)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <DollarSign className="w-4 h-4" />
                </div>
                <input 
                  type="number" 
                  value={adBudget}
                  onChange={e => setAdBudget(Number(e.target.value))}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-violet-500 focus:border-violet-500 outline-none bg-gray-50"
                  min="5"
                />
              </div>
            </div>

            <button
               type="submit"
               disabled={isCreating || campaigns.length === 0}
               className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition-all mt-4"
            >
               {isCreating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
               {isCreating ? 'Generating 3 Variants...' : 'Generate 3 Variants'}
            </button>
            {campaigns.length === 0 && (
              <p className="text-xs text-red-500 mt-2 text-center">You need an active campaign first.</p>
            )}
          </form>
        </div>

        {/* Right Col: Ad Cards */}
        <div className="lg:col-span-8 space-y-6">
          {ads.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl h-64 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
               <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
               <p className="font-medium text-gray-500">No ad variants generated yet</p>
               <p className="text-sm mt-1">Create your first AI-powered multivariate campaign on the left.</p>
            </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
               {ads.map((ad, idx) => {
                 const isGoogle = ad.platform === 'google_ad';
                 const text = ad.text_content || '';
                 const metrics = ad.metrics || {};
                 
                 // We now expect pure JSON formatted as a string
                 const apiPayloadString = text || '{}';

                 const ctr = metrics.ctr || '0.00';
                 const spend = metrics.spend || '0.00';
                 const clicks = metrics.clicks || 0;
                 const status = metrics.variant_status || 'active'; // active, winner, paused
                 const isWinner = status === 'winner';
                 const isPaused = status === 'paused';

                 // Dynamic classes based on variant color and status
                 let statusBadge = null;
                 let cardBorder = 'border-gray-200';
                 
                 if (isWinner) {
                    cardBorder = 'border-emerald-400 ring-2 ring-emerald-100';
                    statusBadge = (
                      <div className="absolute -top-3 -right-3 bg-emerald-950/300 text-white rounded-full p-2 shadow-sm z-10 flex items-center justify-center" title="Optimizer Agent chose this as the winner">
                        <Trophy className="w-4 h-4" />
                      </div>
                    );
                 } else if (isPaused) {
                    cardBorder = 'border-gray-200 opacity-60 grayscale-[0.3]';
                    statusBadge = (
                      <div className="absolute top-3 right-3 bg-gray-800 text-white px-2 py-1 rounded-md text-xs font-bold tracking-wider uppercase flex items-center gap-1 z-10 shadow-sm" title="Turned off by Optimizer due to low CTR">
                        <PauseCircle className="w-3 h-3" /> Paused
                      </div>
                    );
                 } else {
                    statusBadge = (
                      <div className="absolute top-3 right-3 bg-blue-500 text-white px-2 py-1 rounded-md text-xs font-bold tracking-wider uppercase flex items-center gap-1 z-10 shadow-sm">
                        <PlayCircle className="w-3 h-3" /> Active
                      </div>
                    );
                 }

                 return (
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }} 
                     animate={{ opacity: 1, scale: 1 }} 
                     transition={{ delay: idx * 0.03 }}
                     key={ad.id} 
                     className={`relative bg-white shadow-sm border-gray-100 border text-sm rounded-2xl shadow-sm overflow-visible flex flex-col transition-all ${cardBorder}`}
                   >
                     {statusBadge}
                     
                     {/* Variant Angle Badge */}
                     {metrics.variant_angle && (
                       <div className="absolute top-0 left-0 -translate-y-1/2 translate-x-4 bg-white shadow-sm border-gray-100 border border-gray-200 px-3 py-1 rounded-full text-xs font-bold text-gray-700 shadow-sm z-10 flex items-center gap-1">
                         <span>{metrics.variant_emoji}</span> {metrics.variant_angle} Variant
                       </div>
                     )}

                     <div className="p-4 flex-1 flex flex-col relative bg-gray-50 text-emerald-400 font-mono text-[10px] sm:text-xs overflow-hidden rounded-t-2xl border-b border-gray-200">
                       <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200/50">
                         <span className="text-gray-400 font-sans tracking-wide uppercase text-[10px]">API_PAYLOAD_{platform.toUpperCase()}</span>
                         <div className="flex gap-1.5">
                           <div className="w-2 h-2 rounded-full bg-rose-500/20" />
                           <div className="w-2 h-2 rounded-full bg-amber-500/20" />
                           <div className="w-2 h-2 rounded-full bg-emerald-950/300/20" />
                         </div>
                       </div>
                       <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 max-h-[200px]">
                         <pre className="whitespace-pre-wrap word-break">{apiPayloadString}</pre>
                       </div>
                       {ad.image_prompt && (
                         <div className="mt-4 pt-3 border-t border-gray-200/50">
                           <p className="text-gray-400 font-sans uppercase text-[9px] mb-1 tracking-wider">Image Gen Prompt</p>
                           <p className="text-gray-700 font-sans text-xs italic line-clamp-2">{ad.image_prompt}</p>
                         </div>
                       )}
                     </div>

                     {/* Metrics Bar */}
                     <div className={`border-t p-4 grid grid-cols-3 gap-2 divide-x rounded-b-2xl ${isWinner ? 'bg-emerald-50 border-emerald-100 divide-emerald-200' : 'bg-white/50 border-gray-200 divide-gray-100'}`}>
                        <div className="text-center px-1">
                          <p className={`text-[10px] uppercase font-semibold flex items-center justify-center gap-1 mb-1 ${isWinner ? 'text-emerald-400' : 'text-gray-400'}`}><MousePointerClick className="w-3 h-3"/> Clicks</p>
                          <p className={`font-mono font-medium ${isWinner ? 'text-emerald-900' : 'text-gray-900'}`}>{clicks}</p>
                        </div>
                        <div className="text-center px-1">
                          <p className={`text-[10px] uppercase font-semibold flex items-center justify-center gap-1 mb-1 ${isWinner ? 'text-emerald-400' : 'text-gray-400'}`}><TrendingUp className="w-3 h-3"/> CTR</p>
                          <p className={`font-mono font-bold ${isWinner ? 'text-emerald-400 text-lg' : 'text-emerald-400'}`}>{ctr}%</p>
                        </div>
                        <div className="text-center px-1">
                          <p className={`text-[10px] uppercase font-semibold flex items-center justify-center gap-1 mb-1 ${isWinner ? 'text-emerald-400' : 'text-gray-400'}`}><DollarSign className="w-3 h-3"/> Spend</p>
                          <p className={`font-mono font-medium flex flex-col items-center justify-center ${isWinner ? 'text-emerald-900' : 'text-gray-900'}`}>
                            ${spend}
                            {metrics.reallocated_budget && (
                              <span className="text-[9px] text-emerald-400 font-bold bg-emerald-100 px-1 rounded-sm mt-0.5" title="Budget reallocated from paused variants">+${metrics.reallocated_budget}</span>
                            )}
                          </p>
                        </div>
                     </div>
                   </motion.div>
                 );
               })}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

