'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { getBrandId } from '@/lib/utils';
import { toast } from 'sonner';
import { Megaphone, Instagram, Twitter, Linkedin, Facebook, Bot, Sparkles, Copy, RefreshCw } from 'lucide-react';

const platforms = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-50' },
  { id: 'twitter', label: 'X (Twitter)', icon: Twitter, color: 'text-sky-500', bg: 'bg-sky-50' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-50' },
];

export default function ProfileSetupPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Dummy brand context since we're not pulling from DB in this simplified form
  const [brandContext, setBrandContext] = useState({
    name: 'Aadi Market Demo',
    industry: 'Marketing Technology',
    voice: 'Professional, innovative, clean',
  });

  const handleGenerate = async () => {
    if (!selectedPlatform) {
      toast.error('Please select a platform first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/profile/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: getBrandId(),
          platform: selectedPlatform,
          brandContext
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setResult(data.setup);
      toast.success('Profile generated successfully!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to generate profile');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-gray-900">Social Presence Builder</h1>
        <p className="text-gray-500 mt-2">Generate optimized bios, handles, and avatars tailored to each platform.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Col: Form */}
        <div className="space-y-6">
          <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
            
            {/* Context Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                <input 
                  type="text" 
                  value={brandContext.name}
                  onChange={e => setBrandContext({...brandContext, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all text-sm bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <input 
                    type="text" 
                    value={brandContext.industry}
                    onChange={e => setBrandContext({...brandContext, industry: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all text-sm bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tone of Voice</label>
                  <input 
                    type="text" 
                    value={brandContext.voice}
                    onChange={e => setBrandContext({...brandContext, voice: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all text-sm bg-gray-50"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Select Target Platform</label>
              <div className="grid grid-cols-3 gap-3">
                {platforms.map((p) => (
                   <button
                     key={p.id}
                     onClick={() => setSelectedPlatform(p.id)}
                     className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                       selectedPlatform === p.id 
                         ? 'border-violet-500 bg-violet-50 text-violet-700' 
                         : 'border-gray-200 bg-white shadow-sm border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-500'
                     }`}
                   >
                     <p.icon className={`w-6 h-6 mb-2 ${p.color}`} />
                     <span className="text-xs font-semibold">{p.label}</span>
                   </button>
                ))}
              </div>
            </div>

            <button
               onClick={handleGenerate}
               disabled={loading || !selectedPlatform}
               className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
               {loading ? (
                 <>
                   <RefreshCw className="w-5 h-5 animate-spin" />
                   Optimizing Profile...
                 </>
               ) : (
                 <>
                   <Sparkles className="w-5 h-5" />
                   Generate Profile Assets
                 </>
               )}
            </button>
          </div>
        </div>

        {/* Right Col: Results */}
        <div className="space-y-6">
          {!result && !loading && (
             <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <Bot className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-medium text-gray-500">No profile generated yet</p>
                <p className="text-sm mt-1">Select a platform and generate assets to preview them here.</p>
             </div>
          )}

          {loading && (
             <div className="bg-white shadow-sm border-gray-100 border border-gray-200 rounded-2xl h-full min-h-[400px] flex flex-col items-center justify-center p-8 space-y-4 shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-violet-50/50 to-emerald-50/50 animate-pulse" />
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin z-10" />
                <p className="text-gray-500 font-medium z-10 animate-pulse">Analyzing platform mechanics and designing assets...</p>
             </div>
          )}

          {result && !loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              {/* Profile Preview Card */}
              <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                {/* Header/Cover Placeholder */}
                <div className="h-32 bg-gradient-to-r from-gray-200 to-gray-300 w-full relative">
                  <div className="absolute -bottom-10 left-6">
                    <img 
                      src={result.dp_url} 
                      alt="Profile" 
                      className="w-24 h-24 rounded-full border-4 border-white object-cover bg-white shadow-sm border-gray-100 shadow-sm"
                    />
                  </div>
                </div>
                
                <div className="pt-14 p-6 pb-8 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {result.ai_metadata?.name || result.ai_metadata?.display_name || brandContext.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-medium text-gray-500">{result.handle_suggestions?.[0] || '@brand_handle'}</p>
                        {result.ai_metadata?.location && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">📍 {result.ai_metadata.location}</span>
                        )}
                        {result.ai_metadata?.tagline && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-medium">{result.ai_metadata.tagline}</span>
                        )}
                      </div>
                    </div>
                    <button className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-full">Follow</button>
                  </div>

                  <div className="relative group">
                    <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{result.bio}</p>
                    <button 
                      onClick={() => copyToClipboard(result.bio)}
                      className="absolute -top-2 -right-2 p-1.5 bg-white shadow-sm border-gray-100 shadow border border-gray-200 text-gray-500 hover:text-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm font-medium text-gray-500 border-b border-gray-200 pb-4">
                    <span><strong className="text-gray-900">0</strong> Following</span>
                    <span><strong className="text-gray-900">12K</strong> Followers</span>
                  </div>

                  {/* Dynamic Metadata (Links, Specialties) */}
                  <div className="space-y-3 pt-2">
                    {result.ai_metadata?.website_idea && (
                       <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                         <p className="text-xs font-bold text-sky-700 uppercase mb-1">🔗 Suggested Link</p>
                         <p className="text-sm text-sky-900">{result.ai_metadata.website_idea}</p>
                       </div>
                    )}
                    {result.ai_metadata?.link_idea && (
                       <div className="p-3 bg-pink-50 rounded-xl border border-pink-100">
                         <p className="text-xs font-bold text-pink-700 uppercase mb-1">🔗 Link-in-Bio Idea</p>
                         <p className="text-sm text-pink-900">{result.ai_metadata.link_idea}</p>
                       </div>
                    )}
                    {result.ai_metadata?.specialties && (
                       <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                         <p className="text-xs font-bold text-blue-700 uppercase mb-2">⭐ Specialties</p>
                         <div className="flex flex-wrap gap-2">
                           {result.ai_metadata.specialties.map((s: string, i: number) => (
                             <span key={i} className="text-xs bg-white shadow-sm border-gray-100 text-blue-700 border border-blue-200 px-2 py-1 rounded-md shadow-sm">{s}</span>
                           ))}
                         </div>
                       </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Handles List */}
              <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 p-6 shadow-sm">
                 <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                   <Megaphone className="w-4 h-4 text-violet-500" />
                   Available Handle Suggestions
                 </h3>
                 <div className="space-y-2">
                   {result.handle_suggestions?.map((handle: string, i: number) => (
                     <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-200 transition-colors">
                       <span className="font-medium text-gray-700">{handle}</span>
                       <button onClick={() => copyToClipboard(handle)} className="text-gray-400 hover:text-violet-600 transition-colors">
                         <Copy className="w-4 h-4" />
                       </button>
                     </div>
                   ))}
                 </div>
              </div>

            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
