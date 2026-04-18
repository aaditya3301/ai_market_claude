'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrandId } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ShieldAlert,
  Paintbrush,
  Binary,
  Shield,
  MessageSquare,
  Sparkles,
  History,
  TrendingDown,
  TrendingUp,
  LineChart,
  BrainCircuit,
  Zap,
  Bot
} from 'lucide-react';
import { getBrandPlansAction } from '@/app/actions/db';
import { runWarRoomAction } from '@/app/actions/war-room';

export default function WarRoomPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeAgent, setActiveAgent] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const brandId = getBrandId();
      const res = await getBrandPlansAction(brandId);
      setPlans(res || []);
      if (res.length > 0) setSelectedPlanId(res[0].id);
    } catch {
      toast.error('Failed to load strategies');
    }
  };

  const startDebate = async () => {
    if (!selectedPlanId) return;
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    setLoading(true);
    setMessages([]);
    const loadingToast = toast.loading('Convening the Board of Directors...');

    try {
      const result = await runWarRoomAction({
        id: plan.id,
        product_name: plan.product_name || 'Brand',
        product_description: plan.product_description || '',
        target_audience: plan.ai_research_result?.target_audience || 'General audience',
        strategy_overview: plan.ai_research_result?.strategy_summary || 'To be defined'
      });

      // We'll reveal messages one by one for effect
      let revealedMessages: any[] = [];
      for (const msg of result) {
        revealedMessages.push(msg);
        setMessages([...revealedMessages]);
        setActiveAgent(msg.agent_name);
        await new Promise(r => setTimeout(r, 2000)); // Dramatic pause
      }

      toast.success('Strategy session complete.', { id: loadingToast });
    } catch (err: any) {
      toast.error('Board meeting failed: ' + err.message, { id: loadingToast });
    } finally {
      setLoading(false);
      setActiveAgent('');
    }
  };

  const getAgentIcon = (name: string) => {
    switch (name) {
      case 'Skeptical Auditor': return <ShieldAlert className="w-5 h-5" />;
      case 'Creative Director': return <Paintbrush className="w-5 h-5" />;
      case 'Data Analyst': return <Binary className="w-5 h-5" />;
      default: return <Bot className="w-5 h-5" />;
    }
  };

  const getAgentColor = (name: string) => {
    switch (name) {
      case 'Skeptical Auditor': return 'bg-rose-600 text-white border-rose-400';
      case 'Creative Director': return 'bg-violet-600 text-white border-violet-400';
      case 'Data Analyst': return 'bg-emerald-600 text-white border-emerald-400';
      default: return 'bg-gray-800 text-white';
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-serif text-gray-900 flex items-center justify-center gap-3">
            <BrainCircuit className="w-10 h-10 text-violet-600" />
            Strategic War Room
        </h1>
        <p className="text-gray-500 mt-3 text-lg">Watch 3 AI Directors debate the viability of your brand identity.</p>
        
        <div className="mt-8 flex items-center justify-center gap-4">
            <select 
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="bg-white shadow-sm border-gray-100 px-6 py-3 border border-gray-200 rounded-2xl text-sm focus:ring-4 focus:ring-violet-100 outline-none transition-all w-64"
                disabled={loading}
            >
                {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.product_name}</option>
                ))}
            </select>
            <button
                onClick={startDebate}
                disabled={loading || !selectedPlanId}
                className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-2xl font-bold transition-all disabled:opacity-50"
            >
                {loading ? <Zap className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                Call Meeting
            </button>
        </div>
      </div>

      <div className="relative">
        {/* Connection Line */}
        <div className="absolute left-[52px] top-4 bottom-4 w-1 bg-gray-100 rounded-full" />

        <div className="space-y-12 pl-14 pt-4">
            <AnimatePresence mode="popLayout">
                {messages.length === 0 && !loading && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="p-12 border-2 border-dashed border-gray-200 rounded-3xl text-center text-gray-400"
                    >
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">The War Room is currently silent.</p>
                        <p className="text-sm mt-1">Select a brand plan and call the meeting to start the debate.</p>
                    </motion.div>
                )}

                {messages.map((msg, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        className="relative group"
                    >
                        {/* Agent Avatar */}
                        <div className={`absolute -left-[64px] top-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110 z-10 
                            ${getAgentColor(msg.agent_name)} border-2`}>
                            {getAgentIcon(msg.agent_name)}
                        </div>

                        {/* Speech Bubble */}
                        <div className={`bg-white shadow-sm border-gray-100 p-8 rounded-3xl border border-gray-100 shadow-sm relative transition-all duration-300
                            ${activeAgent === msg.agent_name ? 'ring-2 ring-violet-500 shadow-violet-100 shadow-xl' : 'opacity-80'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="font-black text-gray-900 tracking-tight uppercase text-xs">{msg.agent_name}</h4>
                                    <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Focus: {msg.focus}</span>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-lg">
                                    {msg.agent_name === 'Skeptical Auditor' && <TrendingDown className="w-3 h-3 text-rose-500" />}
                                    {msg.agent_name === 'Creative Director' && <Sparkles className="w-3 h-3 text-violet-500" />}
                                    {msg.agent_name === 'Data Analyst' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                                </div>
                            </div>
                            <p className="text-gray-800 leading-relaxed font-serif text-xl italic">
                                \" {msg.message} \"
                            </p>
                        </div>
                    </motion.div>
                ))}

                {loading && activeAgent && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="flex items-center gap-3 pl-2 text-gray-400"
                    >
                        <div className="flex gap-1">
                            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">{activeAgent} is replying...</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
