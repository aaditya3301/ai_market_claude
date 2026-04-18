'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { getBrandId } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Rocket,
  Loader2,
  CalendarClock,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  Bot
} from 'lucide-react';

const platformsList = [
  { id: 'instagram', icon: Instagram, name: 'Instagram', color: 'text-pink-500' },
  { id: 'twitter', icon: Twitter, name: 'Twitter / X', color: 'text-sky-500' },
  { id: 'linkedin', icon: Linkedin, name: 'LinkedIn', color: 'text-blue-600' },
  { id: 'facebook', icon: Facebook, name: 'Facebook', color: 'text-indigo-600' },
  { id: 'reddit', icon: Bot, name: 'Reddit', color: 'text-orange-500' },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPlans, setFetchingPlans] = useState(true);

  // Form State
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'twitter', 'linkedin']);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('brand_plans')
        .select('id, product_name, created_at')
        .eq('brand_id', getBrandId())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
      if (data && data.length > 0) {
        setSelectedPlanId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load brand plans');
    } finally {
      setFetchingPlans(false);
    }
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!selectedPlanId || !campaignName.trim() || !objective.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }

    setLoading(true);
    try {
      toast.info('🚀 Launching campaign & generating content...');

      const response = await fetch('/api/campaigns/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: getBrandId(),
          brandPlanId: selectedPlanId,
          campaignName: campaignName.trim(),
          objective: objective.trim(),
          platforms: selectedPlatforms,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to launch');

      toast.success('Campaign launched successfully!');
      router.push(`/dashboard/campaigns/${result.campaignId}`);

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      <div>
        <h1 className="text-3xl font-serif text-gray-900">Launch Campaign</h1>
        <p className="text-gray-500 mt-1">Configure your campaign settings and generate content.</p>
      </div>

      <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-8">
        
        {/* Step 1: Strategy */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">1</div>
            <h2 className="text-lg font-semibold text-gray-800">Select Strategy</h2>
          </div>
          
          {fetchingPlans ? (
            <div className="h-12 bg-gray-50 animate-pulse rounded-xl" />
          ) : plans.length === 0 ? (
            <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-sm border border-amber-200">
              No brand strategies found. Go to <a href="/dashboard/planning" className="font-bold underline">Planning</a> to create one first.
            </div>
          ) : (
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white shadow-sm border-gray-100"
            >
              <option value="" disabled>Select a strategy</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.product_name} ({new Date(p.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Step 2: Campaign Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">2</div>
            <h2 className="text-lg font-semibold text-gray-800">Campaign Details</h2>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign Name *</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Summer Q3 Product Launch"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white shadow-sm border-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Objective / Focus *</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What is the goal of this specific campaign? e.g., Drive signups for the new premium tier by highlighting time-saving features."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white shadow-sm border-gray-100 resize-none"
            />
          </div>
        </div>

        {/* Step 3: Platforms */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">3</div>
            <h2 className="text-lg font-semibold text-gray-800">Target Platforms</h2>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {platformsList.map(platform => {
              const PIcon = platform.icon;
              const isSelected = selectedPlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                    isSelected 
                      ? 'border-violet-500 bg-violet-50/50' 
                      : 'border-gray-200 bg-white shadow-sm border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <PIcon className={`w-6 h-6 mb-2 ${isSelected ? platform.color : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                    {platform.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedPlanId || !campaignName.trim() || !objective.trim() || selectedPlatforms.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold py-4 rounded-xl shadow-sm shadow-emerald-200/50 hover:shadow-xl hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Content...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                Launch Campaign & Generate
              </>
            )}
          </button>
        </div>

      </div>
    </motion.div>
  );
}
