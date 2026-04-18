'use client';

import { useEffect, useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { getCampaignsAction, deleteCampaignAction } from '@/app/actions/db';
import { getBrandId } from '@/lib/utils';
import Link from 'next/link';
import {
  Megaphone,
  Plus,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  created_at: string;
  brand_plans: { product_name: string; duration: string } | null;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const data = await getCampaignsAction(getBrandId());
      setCampaigns(data || []);
    } catch (err: any) {
      toast.error('Failed to load campaigns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    // Optimistic UI
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    toast.success('Campaign deleted');

    try {
      await deleteCampaignAction(id);
    } catch (error) {
      toast.error('Failed to delete campaign');
      fetchCampaigns(); // Revert
    }
  };

  const calculateProgress = (createdAt: string, durationMonths: string = '3') => {
    const start = new Date(createdAt);
    const now = new Date();
    const diffDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDays = parseInt(durationMonths) * 30;
    const pct = Math.min((diffDays / totalDays) * 100, 100);
    return { day: diffDays, total: totalDays, pct };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-gray-900">Campaigns</h1>
          <p className="text-gray-500 mt-1">Manage all your active marketing campaigns.</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-violet-200"
          >
            <Plus className="w-5 h-5" />
            New Campaign
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm animate-pulse p-6" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white shadow-sm border-gray-100 rounded-2xl border border-dashed border-gray-200">
          <Megaphone className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No campaigns yet</h3>
          <p className="text-gray-500 max-w-sm text-center mt-1 mb-6">
            Get started by launching a new campaign using an existing brand strategy.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="text-violet-600 font-medium hover:text-violet-700"
          >
            Launch first campaign &rarr;
          </Link>
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {campaigns.map((camp) => {
             // Need to handle when brand_plans is array or object. Based on schema it's a many-to-one so Supabase returns object, but sometimes an array if poorly mapped.
            const brandPlan = Array.isArray(camp.brand_plans) ? camp.brand_plans[0] : camp.brand_plans;
            const prog = calculateProgress(camp.created_at, brandPlan?.duration);
            
            return (
              <motion.div key={camp.id} variants={item}>
                <Link
                  href={`/dashboard/campaigns/${camp.id}`}
                  className="group block bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm hover:shadow-sm hover:border-violet-200 transition-all p-6 relative overflow-hidden h-full flex flex-col"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide">
                      {camp.status}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, camp.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-xl font-serif text-gray-900 truncate group-hover:text-violet-700 transition-colors">
                    {camp.name}
                  </h3>

                  <div className="flex items-center text-sm text-gray-500 mt-2 mb-4">
                    <TrendingUp className="w-4 h-4 mr-1.5 text-gray-400" />
                    {brandPlan?.product_name || 'Unknown Product'}
                  </div>

                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">
                    {camp.objective}
                  </p>

                  <div className="mt-6 pt-4 border-t border-gray-50">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-gray-500">Timeline Progress</span>
                      <span className="text-gray-400">Day {prog.day} of {prog.total}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-violet-500 h-full rounded-full transition-all"
                        style={{ width: `${prog.pct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
