'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandId } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Video,
  Sparkles,
  RefreshCw,
  Clapperboard,
  Music,
  Mic2,
  Trash2,
  ChevronRight,
  Plus,
  Play,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { generateVideoAction, getVideoAssetsAction, deleteVideoAssetAction } from '@/app/actions/video';
import { getCampaignsAction } from '@/app/actions/db';

export default function VideoAssetsPage() {
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const brandId = getBrandId();
      const [cRes, aRes] = await Promise.all([
        getCampaignsAction(brandId),
        getVideoAssetsAction(brandId)
      ]);
      setCampaigns(cRes || []);
      setAssets(aRes || []);
      if (cRes.length > 0) setSelectedCampaignId(cRes[0].id);
    } catch {
      toast.error('Failed to load video assets');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCampaignId) return;
    setLoading(true);
    const loadingToast = toast.loading('AI Director crafting video script...');
    try {
      const brandId = getBrandId();
      const newAsset = await generateVideoAction(selectedCampaignId, brandId);
      setAssets([newAsset, ...assets]);
      setSelectedAsset(newAsset);
      toast.success('Production ready: Video Script generated!', { id: loadingToast });
    } catch (err: any) {
      toast.error(err.message || 'Generation failed', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure?')) return;
    try {
      await deleteVideoAssetAction(id);
      setAssets(assets.filter(a => a.id !== id));
      if (selectedAsset?.id === id) setSelectedAsset(null);
      toast.success('Asset deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-gray-900">Video Assets</h1>
          <p className="text-gray-500 mt-2">Generate raw scripts and storyboards for AI Video generators (Sora, HeyGen, Runway).</p>
        </div>
        
        <div className="flex items-center gap-3">
            <select 
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="bg-white shadow-sm border-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                disabled={loading}
            >
                <option value="">Select Campaign</option>
                {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            <button
                onClick={handleGenerate}
                disabled={loading || !selectedCampaignId}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm shadow-violet-200"
            >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Video Script
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left: History Sidebar */}
        <div className="lg:col-span-1 border-r border-gray-100 pr-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 px-2 pb-2 border-b border-gray-100">
                <Clock className="w-4 h-4 text-gray-400" />
                History
            </h3>
            {loadingHistory ? (
                <div className="space-y-3 p-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
                </div>
            ) : assets.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                    <Video className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs">No video scripts yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {assets.map(asset => (
                        <button
                            key={asset.id}
                            onClick={() => setSelectedAsset(asset)}
                            className={`w-full text-left p-4 rounded-xl border transition-all group relative ${
                                selectedAsset?.id === asset.id 
                                ? 'bg-violet-50 border-violet-200' 
                                : 'bg-white shadow-sm border-gray-100 hover:border-gray-200'
                            }`}
                        >
                            <p className="font-bold text-gray-900 text-sm truncate pr-6">{asset.title}</p>
                            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider truncate">
                                {asset.campaigns?.name || 'Campaign'}
                            </p>
                            <button 
                                onClick={(e) => handleDelete(asset.id, e)}
                                className="absolute top-4 right-4 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-500"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Right: Asset Detail / Empty State */}
        <div className="lg:col-span-3 min-h-[600px]">
            <AnimatePresence mode="wait">
                {!selectedAsset ? (
                   <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="flex flex-col items-center justify-center h-full text-center p-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200"
                   >
                       <Clapperboard className="w-16 h-16 text-gray-200 mb-6" />
                       <h3 className="text-xl font-bold text-gray-400">Lights, Camera, Action</h3>
                       <p className="text-gray-400 max-w-sm mt-2">Choose a campaign and generate a production-ready script for your AI video ad creators.</p>
                   </motion.div>
                ) : (
                    <motion.div 
                        key={selectedAsset.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-8"
                    >
                        {/* Header Banner */}
                        <div className="bg-gray-900 rounded-3xl p-8 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Video className="w-32 h-32" />
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="px-3 py-1 bg-violet-600 rounded-lg text-[10px] font-black uppercase tracking-widest">PRODUCTION READY</span>
                                        <span className="text-gray-400 text-sm flex items-center gap-1.5 font-medium">
                                            <Clock className="w-4 h-4" /> {selectedAsset.script_data.duration}
                                        </span>
                                    </div>
                                    <h2 className="text-4xl font-serif">{selectedAsset.title}</h2>
                                    <p className="mt-4 text-gray-400 italic max-w-2xl text-lg">
                                        \" {selectedAsset.script_data.hook} \"
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                                        <div className="flex items-center gap-2 mb-1 text-gray-400 uppercase text-[9px] font-bold tracking-widest">
                                            <Music className="w-3 h-3 text-violet-400" /> Music Tone
                                        </div>
                                        <p className="text-sm font-medium">{selectedAsset.script_data.music_tone}</p>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                                        <div className="flex items-center gap-2 mb-1 text-gray-400 uppercase text-[9px] font-bold tracking-widest">
                                            <Mic2 className="w-3 h-3 text-emerald-400" /> Voiceover Style
                                        </div>
                                        <p className="text-sm font-medium">{selectedAsset.script_data.voiceover_style}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Storyboard Grid */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <LayoutGrid className="w-5 h-5 text-violet-500" />
                                Interactive Storyboard
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {selectedAsset.script_data.scenes.map((scene: any, idx: number) => (
                                    <div key={idx} className="bg-white shadow-sm border-gray-100 rounded-3xl border border-gray-100 overflow-hidden shadow-sm group hover:border-violet-200 transition-all">
                                        <div className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white rounded-full text-xs font-bold leading-none">{idx + 1}</span>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{scene.duration_seconds}s</span>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                <div className="p-4 bg-violet-50/50 rounded-2xl border border-violet-100/50">
                                                    <p className="text-[10px] font-black uppercase text-violet-500 mb-1.5 tracking-widest flex items-center gap-1.5">
                                                        <Clapperboard className="w-3 h-3" /> Visual (AI Video Prompt)
                                                    </p>
                                                    <p className="text-sm text-gray-800 font-medium italic leading-relaxed">
                                                        {scene.visual_description}
                                                    </p>
                                                </div>

                                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                                    <p className="text-[10px] font-black uppercase text-emerald-500 mb-1.5 tracking-widest flex items-center gap-1.5">
                                                        <Mic2 className="w-3 h-3" /> Script / Voiceover
                                                    </p>
                                                    <p className="text-sm text-gray-800 leading-relaxed font-serif text-lg">
                                                        "{scene.script_text}"
                                                    </p>
                                                </div>

                                                {scene.overlay_text && (
                                                    <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-3">
                                                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-r pr-3">Overlay</span>
                                                        <p className="text-xs font-black text-gray-900 uppercase">
                                                            {scene.overlay_text}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Export / CTA */}
                        <div className="flex justify-center pt-8 border-t border-gray-100">
                             <button className="flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:shadow-xl hover:-translate-y-1 transition-all">
                                 <Play className="fill-white w-5 h-5" />
                                 Send to Video AI Generator (Open Sora)
                             </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
