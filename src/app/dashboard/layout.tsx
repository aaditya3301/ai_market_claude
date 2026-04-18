'use client';

import Navbar from '@/components/dashboard/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Navbar />
      <div className="flex flex-col min-h-screen pt-[136px] md:pt-[64px]">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full mx-auto max-w-7xl">
          {children}
        </main>
      </div>
    </div>
  );
}
