'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // MVP: No auth — set default brand and redirect to dashboard
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem('brand_id')) {
        localStorage.setItem('brand_id', 'brand_001');
      }
      if (!localStorage.getItem('brand_name')) {
        localStorage.setItem('brand_name', 'My Brand');
      }
    }
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-violet-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Setting up your workspace...</p>
      </div>
    </div>
  );
}
