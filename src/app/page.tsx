'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Client-side fallback to push to login. 
    // The Next.js edge middleware.ts handles actual role-based auth redirection.
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center">
      <span className="h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></span>
    </div>
  );
}
