'use client';

import { motion, Variants } from 'framer-motion';
import Link from 'next/link';
import {
  CalendarClock,
  Megaphone,
  UserCircle,
  Zap,
  BarChart3,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

const stats = [
  { label: 'Brand Plans', value: '—', icon: CalendarClock, color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Campaigns', value: '—', icon: Megaphone, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Profiles Set', value: '—', icon: UserCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Ads Created', value: '—', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
];

const quickActions = [
  {
    title: 'New Strategy',
    description: 'Plan a campaign from scratch with AI research',
    href: '/dashboard/planning',
    icon: CalendarClock,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    title: 'Launch Campaign',
    description: 'Generate multi-platform content instantly',
    href: '/dashboard/campaigns/new',
    icon: Megaphone,
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    title: 'Setup Profile',
    description: 'Create bios, DPs, and handles for your brand',
    href: '/dashboard/profile',
    icon: UserCircle,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    title: 'Create Ad',
    description: 'Generate ad copies and creatives with AI',
    href: '/dashboard/ads',
    icon: Zap,
    gradient: 'from-amber-500 to-orange-600',
  },
];

export default function DashboardPage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto space-y-10"
    >
      {/* Welcome */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-gray-900">
            {greeting} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Here&apos;s your marketing command center. Let&apos;s make something great today.
          </p>
        </div>
        <span className="text-sm text-gray-400 bg-white shadow-sm border-gray-100 px-3 py-1 rounded-full border border-gray-200 shadow-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          );
        })}
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item} className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-semibold text-gray-800">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className="group block bg-white shadow-sm border-gray-100 rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-sm hover:border-violet-100 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-violet-700 transition-colors">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {action.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Get started <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </motion.div>

      {/* Getting Started Banner */}
      <motion.div variants={item}>
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-8 text-white shadow-xl shadow-violet-200/50">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-serif mb-2">Ready to automate your marketing?</h2>
              <p className="text-violet-100 text-sm max-w-lg">
                Start by creating a brand strategy. Our AI will analyze your product, identify your ideal customers,
                and generate ready-to-post content for all platforms.
              </p>
            </div>
            <Link
              href="/dashboard/planning"
              className="inline-flex items-center gap-2 bg-white shadow-sm border-gray-100 text-violet-700 font-semibold px-6 py-3 rounded-xl shadow-sm hover:shadow-sm hover:bg-violet-50 transition-all shrink-0"
            >
              <Sparkles className="w-5 h-5" />
              Create First Strategy
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
