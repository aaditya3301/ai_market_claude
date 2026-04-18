'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { getCampaignWorkspaceAction, updateArtifactTextAction } from '@/app/actions/db';
import { getBrandId } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Megaphone,
  Calendar,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  Bot,
  Copy,
  Download,
  Edit2,
  RefreshCw,
  MoreVertical,
  CalendarClock,
  X,
} from 'lucide-react';
import { scheduleOrPublishAction } from '@/app/actions/distribution';

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

const platformIcons: Record<string, any> = {
  instagram: { icon: Instagram, color: 'text-pink-500' },
  twitter: { icon: Twitter, color: 'text-sky-500' },
  linkedin: { icon: Linkedin, color: 'text-blue-600' },
  facebook: { icon: Facebook, color: 'text-indigo-600' },
  reddit: { icon: Bot, color: 'text-orange-500' },
};

export default function CampaignWorkspacePage() {
  const { id } = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<string>('all');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  useEffect(() => {
    fetchCampaignAndArtifacts();
  }, [id]);

  const fetchCampaignAndArtifacts = async () => {
    try {
      const { campaign, artifacts } = await getCampaignWorkspaceAction(id as string);
      setCampaign(campaign);
      setArtifacts(artifacts);
      
      if (campaign?.social_platforms?.length > 0) {
        setActivePlatform('all');
      }
    } catch (err: any) {
      toast.error('Failed to load campaign');
      console.error(err);
      router.push('/dashboard/campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleEdit = async (artifact: any) => {
    const newText = window.prompt('Edit post content:', artifact.text_content);
    if (newText !== null && newText !== artifact.text_content) {
      try {
        await updateArtifactTextAction(artifact.id, newText);
        setArtifacts(artifacts.map(a => a.id === artifact.id ? { ...a, text_content: newText } : a));
        toast.success('Post updated successfully');
      } catch (error) {
        toast.error('Failed to update post');
      }
    }
  };

  const handlePublish = async (artifact: any) => {
    toast.promise(
      scheduleOrPublishAction(artifact.id, artifact.platform, artifact.text_content, artifact.media_url, false),
      {
        loading: `Publishing to ${artifact.platform}...`,
        success: () => {
          setArtifacts(artifacts.map(a => a.id === artifact.id ? { ...a, status: 'published' } : a));
          return `Published to ${artifact.platform} successfully!`;
        },
        error: 'Failed to publish'
      }
    );
  };

  const submitSchedule = async () => {
    if (!activeArtifact || !scheduleDate || !scheduleTime) {
      toast.error('Please select both date and time.');
      return;
    }
    
    const dateTimeStr = `${scheduleDate}T${scheduleTime}:00`;
    setScheduleModalOpen(false);

    toast.promise(
      scheduleOrPublishAction(activeArtifact.id, activeArtifact.platform, activeArtifact.text_content, activeArtifact.media_url, true, dateTimeStr),
      {
        loading: `Scheduling for ${activeArtifact.platform}...`,
        success: () => {
          setArtifacts(artifacts.map(a => a.id === activeArtifact.id ? { ...a, status: 'scheduled' } : a));
          return `Scheduled successfully for ${new Date(dateTimeStr).toLocaleString()}!`;
        },
        error: 'Failed to schedule'
      }
    );
  };

  const filteredArtifacts = activePlatform === 'all' 
    ? artifacts 
    : artifacts.filter(a => a.platform === activePlatform);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.push('/dashboard/campaigns')}
          className="p-2 bg-white shadow-sm border-gray-100 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-serif text-gray-900 flex items-center gap-3">
            {campaign.name}
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide">
              {campaign.status}
            </span>
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span className="flex items-center gap-1.5">
              <Megaphone className="w-4 h-4" />
              {campaign.brand_plans?.product_name}
            </span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Created {new Date(campaign.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left: Metadata */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Objective</h3>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-200">
                {campaign.objective}
              </p>
            </div>
            
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Platforms</h3>
              <div className="flex flex-wrap gap-2">
                {campaign.social_platforms?.map((p: string) => {
                  const Icon = platformIcons[p]?.icon || Megaphone;
                  return (
                    <span key={p} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 capitalize">
                      <Icon className={`w-4 h-4 ${platformIcons[p]?.color}`} />
                      {p}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Artifact Feed */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Platform Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setActivePlatform('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                activePlatform === 'all' 
                  ? 'bg-gray-900 text-white shadow-sm' 
                  : 'bg-white shadow-sm border-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              All Platforms
            </button>
            {campaign.social_platforms?.map((p: string) => {
              const Icon = platformIcons[p]?.icon || Megaphone;
              return (
                <button
                  key={p}
                  onClick={() => setActivePlatform(p)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    activePlatform === p 
                      ? 'bg-gray-900 text-white shadow-sm' 
                      : 'bg-white shadow-sm border-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activePlatform === p ? 'text-white' : platformIcons[p]?.color}`} />
                  <span className="capitalize">{p}</span>
                </button>
              );
            })}
          </div>

          {/* Feed */}
          {filteredArtifacts.length === 0 ? (
            <div className="bg-white shadow-sm border-gray-100 rounded-2xl border border-dashed border-gray-200 p-12 text-center flex flex-col items-center">
              <Megaphone className="w-10 h-10 text-gray-300 mb-3" />
              <h3 className="text-gray-900 font-medium text-lg">No content found</h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm">No artifacts have been generated for this platform yet.</p>
            </div>
          ) : (
             <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
              {filteredArtifacts.map((artifact) => {
                const PData = platformIcons[artifact.platform] || { icon: Megaphone, color: 'text-gray-500' };
                const PIcon = PData.icon;

                return (
                  <motion.div key={artifact.id} variants={item} className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-gray-50 ${PData.color}`}>
                          <PIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 capitalize">{artifact.platform} Post</p>
                          <p className="text-xs text-gray-500">
                            Generated {new Date(artifact.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleCopy(artifact.text_content)}
                          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Copy Text"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        
                        {/* Text Content */}
                        <div className="flex-1 space-y-4">
                          <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-200">
                            {artifact.text_content}
                          </div>
                        </div>

                        {/* Image Content */}
                        {artifact.media_url && (
                          <div className="md:w-64 shrink-0 flex flex-col gap-2">
                            <div className="rounded-xl overflow-hidden border border-gray-200 aspect-square shadow-sm">
                              <img 
                                src={artifact.media_url} 
                                alt="Generated" 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                            <a 
                              href={artifact.media_url} 
                              download={`post-image-${artifact.id}.png`}
                              className="flex items-center justify-center gap-2 w-full py-2 bg-white shadow-sm border-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Download className="w-4 h-4" /> Download
                            </a>
                          </div>
                        )}
                        
                        {!artifact.media_url && artifact.image_prompt && (
                          <div className="md:w-64 shrink-0">
                             <div className="rounded-xl border border-dashed border-gray-300 aspect-square flex flex-col items-center justify-center p-4 text-center bg-gray-50/50">
                                <span className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Image Prompt</span>
                                <p className="text-xs text-gray-500 line-clamp-4">{artifact.image_prompt}</p>
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Bar */}
                    <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-200 flex items-center justify-end gap-3">
                       <button onClick={() => handleEdit(artifact)} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 flex items-center gap-2">
                         <Edit2 className="w-4 h-4" /> Edit
                       </button>
                       <button onClick={() => { setActiveArtifact(artifact); setScheduleModalOpen(true); }} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 flex items-center gap-2">
                         <CalendarClock className="w-4 h-4" /> Schedule
                       </button>
                       <button onClick={() => handlePublish(artifact)} disabled={artifact.status === 'published' || artifact.status === 'scheduled'} className={`text-sm font-medium transition-colors px-3 py-1.5 rounded-lg flex items-center gap-2 ${(artifact.status === 'published' || artifact.status === 'scheduled') ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'text-violet-600 bg-violet-50 hover:bg-violet-100 hover:text-violet-700'}`}>
                         {artifact.status === 'published' ? 'Published' : artifact.status === 'scheduled' ? 'Scheduled' : 'Publish Now'}
                       </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

        </div>
      </div>

      {/* Schedule Modal */}
      {scheduleModalOpen && activeArtifact && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white shadow-sm border-gray-100 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setScheduleModalOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Schedule Post</h2>
            <p className="text-sm text-gray-500 mb-6">Select when you want to publish this {activeArtifact.platform} post via Postiz.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-violet-500 focus:border-violet-500 outline-none" min={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-violet-500 focus:border-violet-500 outline-none" />
              </div>
            </div>
            
            <div className="mt-8 flex gap-3">
              <button onClick={() => setScheduleModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={submitSchedule} className="flex-1 px-4 py-2 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors">Confirm Schedule</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
