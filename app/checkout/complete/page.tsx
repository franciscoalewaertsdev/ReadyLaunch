'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Check, ChevronRight } from 'lucide-react';

export default function CheckoutCompletePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'success') {
      setStatus('success');
    } else if (statusParam === 'error') {
      setStatus('error');
    } else {
      setStatus('error');
    }
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0e0718] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="w-12 h-12 border-4 border-[#a5b4fc] border-t-[#f59e0b] rounded-full animate-spin" />
          </div>
          <p className="text-white text-lg font-medium">Processing payment...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#0e0718] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/50">
              <Check size={32} className="text-green-500" strokeWidth={3} />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 italic tracking-tight">Payment successful!</h1>
          <p className="text-zinc-400 text-lg mb-8 leading-relaxed">Your LLC setup is now complete. We'll send all the details to your email shortly.</p>
          <div className="space-y-3 mb-12">
            <div className="flex items-center gap-3 text-left p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl">
              <Check size={18} className="text-green-500 shrink-0" />
              <span className="font-medium">LLC incorporation filed</span>
            </div>
            <div className="flex items-center gap-3 text-left p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl">
              <Check size={18} className="text-green-500 shrink-0" />
              <span className="font-medium">EIN assigned</span>
            </div>
            <div className="flex items-center gap-3 text-left p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl">
              <Check size={18} className="text-green-500 shrink-0" />
              <span className="font-medium">Virtual address activated</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-white text-black px-12 py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
          >
            Back to Home <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0718] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">
            <span className="text-red-500 text-3xl font-bold">✕</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4 italic tracking-tight">Payment failed</h1>
        <p className="text-zinc-400 text-lg mb-8 leading-relaxed">We couldn't process your payment. Please try again or contact support.</p>
        <button
          onClick={() => router.push('/')}
          className="w-full bg-white text-black px-12 py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
        >
          Back to Home <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
