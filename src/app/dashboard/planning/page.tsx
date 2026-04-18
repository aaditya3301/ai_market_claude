'use client';

import { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { getBrandPlansAction, getBrandPlanByIdAction } from '@/app/actions/db';
import { getBrandId } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CalendarClock,
  Sparkles,
  Loader2,
  Target,
  Users,
  BarChart3,
  Lightbulb,
  ChevronRight,
  Upload,
  X,
  Clock,
  Check,
} from 'lucide-react';

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

interface BrandPlan {
  id: string;
  product_name: string;
  product_description: string;
  product_price: string | null;
  duration: string | null;
  ai_research_result: any;
  created_at: string;
}

export default function PlanningPage() {
  // Form state
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [plans, setPlans] = useState<BrandPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<BrandPlan | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const brandId = getBrandId();
      const data = await getBrandPlansAction(brandId);
      setPlans(data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
      toast.error('Failed to connect to database. Please check your Supabase configuration.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImageBase64(result);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!productName.trim() || !description.trim()) {
      toast.error('Please fill in the product name and description.');
      return;
    }

    setLoading(true);
    setShowResults(false);
    setSelectedPlan(null);

    try {
      toast.info('🧠 AI is analyzing your product and market...');

      const response = await fetch('/api/planning/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: getBrandId(),
          productName: productName.trim(),
          description: description.trim(),
          websiteUrl: websiteUrl.trim(),
          instagramUrl: instagramUrl.trim(),
          linkedinUrl: linkedinUrl.trim(),
          twitterUrl: twitterUrl.trim(),
          imageBase64,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate plan');
      }

      toast.success('✅ Strategy generated! Campaign and content created.');

      // Refresh plans and show the new one
      await fetchPlans();

      // Select the new plan
      const newPlan = await getBrandPlanByIdAction(result.data.id);

      if (newPlan) {
        setSelectedPlan(newPlan);
        setShowResults(true);
      }

      // Clear form
      setProductName('');
      setDescription('');
      setWebsiteUrl('');
      setInstagramUrl('');
      setLinkedinUrl('');
      setTwitterUrl('');
      setImageBase64(null);
      setImagePreview(null);

    } catch (error: any) {
      console.error('Planning error:', error);
      toast.error(error.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: BrandPlan) => {
    setSelectedPlan(plan);
    setShowResults(true);
  };

  const research = selectedPlan?.ai_research_result;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-gray-900">Planning</h1>
          <p className="text-gray-500 mt-1">Create brand strategies with AI-powered market research.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: Form */}
        <motion.div variants={item} className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              <h2 className="text-lg font-semibold text-gray-800">New Strategy</h2>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Product / Brand Name *</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Canva, Nike, Stripe..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white shadow-sm border-gray-100"
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your product, its features, target audience, and what makes it unique..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white shadow-sm border-gray-100 resize-none"
                disabled={loading}
              />
            </div>

            {/* URLs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Website URL</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://brand.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white shadow-sm border-gray-100"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Instagram Handle / URL</label>
                <input
                  type="text"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="@brand"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white shadow-sm border-gray-100"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">LinkedIn Profile / Page</label>
                <input
                  type="text"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="linkedin.com/company/brand"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white shadow-sm border-gray-100"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Twitter Handle</label>
                <input
                  type="text"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  placeholder="@brand"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white shadow-sm border-gray-100"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Image (optional)</label>
              {imagePreview ? (
                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200">
                  <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
                  <button
                    onClick={() => { setImageBase64(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all">
                  <Upload className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Click to upload a product image</span>
                  <span className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 5MB</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={loading} />
                </label>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || !productName.trim() || !description.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold py-3.5 rounded-xl shadow-sm shadow-violet-200/50 hover:shadow-xl hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI is thinking... (this takes ~30s)
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Strategy
                </>
              )}
            </button>
          </div>

          {/* RESULTS */}
          {showResults && research && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* ICP */}
              <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-xl bg-violet-50">
                    <Target className="w-5 h-5 text-violet-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Ideal Customer Profile</h3>
                </div>
                {research.ideal_customer_profile && (
                  <div className="space-y-4">
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {research.ideal_customer_profile.summary}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Demographics</h4>
                        <ul className="space-y-1">
                          {research.ideal_customer_profile.demographics?.map((d: string, i: number) => (
                            <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                              <ChevronRight className="w-3 h-3 text-violet-400 mt-1 shrink-0" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pain Points</h4>
                        <ul className="space-y-1">
                          {research.ideal_customer_profile.pain_points?.map((p: string, i: number) => (
                            <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                              <ChevronRight className="w-3 h-3 text-rose-400 mt-1 shrink-0" />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Psychographics</h4>
                        <ul className="space-y-1">
                          {research.ideal_customer_profile.psychographics?.map((ps: string, i: number) => (
                            <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                              <ChevronRight className="w-3 h-3 text-emerald-400 mt-1 shrink-0" />
                              {ps}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Objections</h4>
                        <ul className="space-y-1">
                          {research.ideal_customer_profile.objections?.map((ob: string, i: number) => (
                            <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                              <ChevronRight className="w-3 h-3 text-red-500 mt-1 shrink-0" />
                              {ob}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Brand Voice & Content Pillars */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {research.brand_voice_guidelines && (
                  <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 rounded-xl bg-pink-50">
                        <Sparkles className="w-5 h-5 text-pink-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800">Brand Voice</h3>
                    </div>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-700 font-medium">Tone: <span className="font-normal">{research.brand_voice_guidelines.tone}</span></p>
                      
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {research.brand_voice_guidelines.keywords?.map((k: string, i: number) => (
                            <span key={i} className="px-3 py-1 bg-pink-50 text-pink-600 rounded-full text-xs font-medium">{k}</span>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4 mt-2">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Dos & Don'ts</h4>
                        <ul className="space-y-1">
                          {research.brand_voice_guidelines.dos_and_donts?.map((d: string, i: number) => (
                            <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 mt-1.5 shrink-0" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {research.content_pillars && (
                  <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 rounded-xl bg-blue-50">
                        <Users className="w-5 h-5 text-blue-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800">Content Pillars</h3>
                    </div>
                    <div className="space-y-3">
                      {research.content_pillars.map((c: any, i: number) => (
                        <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                          <h4 className="text-sm font-bold text-gray-900 mb-1">{c.name}</h4>
                          <p className="text-xs text-gray-500">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Market Analysis */}
              <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-xl bg-emerald-50">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Market Analysis</h3>
                </div>
                {research.market_analysis && (
                  <div className="space-y-4">
                    {/* Competitors */}
                    {research.market_analysis.competitors?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Competitors</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {research.market_analysis.competitors.map((c: any, i: number) => (
                            <div key={i} className="bg-gray-50 rounded-xl p-4">
                              <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                              <p className="text-xs text-gray-500 mt-1">{c.strategy}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Channels, Gaps, USPs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {research.market_analysis.marketing_channels?.length > 0 && (
                        <div className="bg-blue-50 rounded-xl p-4">
                          <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2">Channels</h4>
                          {research.market_analysis.marketing_channels.map((ch: string, i: number) => (
                            <span key={i} className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full mr-1 mb-1">{ch}</span>
                          ))}
                        </div>
                      )}
                      {research.market_analysis.market_gaps?.length > 0 && (
                        <div className="bg-amber-50 rounded-xl p-4">
                          <h4 className="text-xs font-semibold text-amber-700 uppercase mb-2">Market Gaps</h4>
                          {research.market_analysis.market_gaps.map((g: string, i: number) => (
                            <p key={i} className="text-xs text-amber-800 mb-1">• {g}</p>
                          ))}
                        </div>
                      )}
                      {research.market_analysis.unique_selling_propositions?.length > 0 && (
                        <div className="bg-emerald-50 rounded-xl p-4">
                          <h4 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Your USPs</h4>
                          {research.market_analysis.unique_selling_propositions.map((u: string, i: number) => (
                            <p key={i} className="text-xs text-emerald-800 mb-1">✦ {u}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Strategies */}
              <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-xl bg-amber-50">
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Suggested Strategies</h3>
                </div>
                {research.suggested_strategies && (
                  <div className="space-y-3">
                    {research.suggested_strategies.map((s: any, i: number) => (
                      <div key={i} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 border border-gray-200">
                        <h4 className="font-medium text-gray-900 text-sm flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          {s.title}
                        </h4>
                        <p className="text-sm text-gray-500 mt-2 ml-8">{s.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 30-Day Roadmap */}
              {research.roadmap_30_days && (
                <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-xl bg-indigo-50">
                      <CalendarClock className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">30-Day execution Roadmap</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {research.roadmap_30_days.map((r: any, i: number) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-purple-500/0 rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
                        <h4 className="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-wider">{r.week}</h4>
                        <p className="text-sm text-gray-700">{r.focus}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success Banner */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-sm shadow-emerald-200/50">
                <div className="flex items-center gap-3">
                  <Check className="w-8 h-8" />
                  <div>
                    <h3 className="text-lg font-semibold">Campaign Created!</h3>
                    <p className="text-emerald-100 text-sm mt-0.5">
                      Your campaign and 3 platform-specific posts have been generated. Head to Campaigns to see them.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* RIGHT: History Sidebar */}
        <motion.div variants={item} className="space-y-4">
          <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">Recent Plans</h3>
            </div>

            {historyLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-8">
                <CalendarClock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No plans yet</p>
                <p className="text-xs text-gray-400 mt-0.5">Create your first strategy above</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedPlan?.id === plan.id
                        ? 'bg-violet-50 border-violet-200 shadow-sm'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <p className={`text-sm font-medium truncate ${
                      selectedPlan?.id === plan.id ? 'text-violet-700' : 'text-gray-900'
                    }`}>
                      {plan.product_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {plan.product_description?.substring(0, 60)}...
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(plan.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
