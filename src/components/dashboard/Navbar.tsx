'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarClock,
  Megaphone,
  UserCircle,
  BarChart3,
  Zap,
  FileText,
  Video,
  Shield,
} from 'lucide-react';

const navigation = [
  { name: 'Planning', href: '/dashboard/planning', icon: CalendarClock },
  { name: 'AI War Room', href: '/dashboard/war-room', icon: Shield },
  { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
  { name: 'Profile Setup', href: '/dashboard/profile', icon: UserCircle },
  { name: 'Ads', href: '/dashboard/ads', icon: Zap },
  { name: 'SEO Hub', href: '/dashboard/seo', icon: FileText },
  { name: 'Video Assets', href: '/dashboard/video', icon: Video },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-gray-100/80 backdrop-blur-md border-b border-gray-200">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="shrink-0 flex items-center">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <span className="text-xl font-bold font-serif tracking-tight text-gray-900">
                Aadi<span className="text-violet-600 transition-colors group-hover:text-violet-700">Market</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex flex-1 justify-center">
            <nav className="flex space-x-1 bg-gray-100/50 p-1 rounded-2xl border border-gray-200 shadow-inner">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out
                      ${isActive
                        ? 'bg-white shadow-sm border-gray-100 text-violet-700 shadow-sm border border-gray-200/50'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                    `}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-violet-600' : 'text-gray-400'} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Brand name */}
          <div className="shrink-0 hidden sm:flex items-center">
            <span className="text-sm text-gray-400 bg-white shadow-sm border-gray-100 px-3 py-1 rounded-full border border-gray-200 shadow-sm">
              MVP Mode
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200 bg-gray-50">
        <nav className="flex justify-around p-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center w-full py-2 rounded-xl text-[10px] font-medium transition-all
                  ${isActive
                    ? 'text-violet-700 bg-white shadow-sm border-gray-100 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                  }
                `}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`mb-1 ${isActive ? 'text-violet-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
