'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'whop_oauth_pkce';
const CLIENT_ID = process.env.NEXT_PUBLIC_WHOP_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_WHOP_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

interface WhopTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  obtained_at: number;
}

export default function AuthProcessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState('');

  useEffect(() => {
    const processAuth = async () => {
      try {
        const code = searchParams.get('code');
        const returnedState = searchParams.get('state');

        if (!CLIENT_ID) {
          throw new Error('Missing NEXT_PUBLIC_WHOP_CLIENT_ID');
        }

        if (!code) {
          throw new Error('No authorization code in URL');
        }

        // Retrieve PKCE data from sessionStorage
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
        sessionStorage.removeItem(STORAGE_KEY);

        if (!stored || !stored.codeVerifier) {
          throw new Error('Missing code verifier - PKCE data not found');
        }

        if (returnedState && returnedState !== stored.state) {
          throw new Error('Invalid state - possible CSRF attack');
        }

        console.log('[Auth Process] Exchanging code for tokens');

        // Call backend to exchange code for tokens (backend has no client secret, so it needs to ask client for code_verifier)
        const res = await fetch('/api/auth/process-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            codeVerifier: stored.codeVerifier,
            clientId: CLIENT_ID,
            redirectUri: REDIRECT_URI,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Token exchange failed with status ${res.status}`);
        }

        // Store tokens
        const tokens: WhopTokens = {
          ...data,
          obtained_at: Date.now(),
        };
        document.cookie = `whop_tokens=${encodeURIComponent(JSON.stringify(tokens))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;

        // Also set user_name cookie for simple display
        const userInfo = data.userInfo;
        if (userInfo?.preferred_username) {
          document.cookie = `user_name=${encodeURIComponent(userInfo.preferred_username)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        } else if (userInfo?.name) {
          document.cookie = `user_name=${encodeURIComponent(userInfo.name)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        } else if (userInfo?.sub) {
          document.cookie = `user_name=${encodeURIComponent(userInfo.sub)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        }

        console.log('[Auth Process] Authentication successful');
        setStatus('success');

        // Redirect home after 500ms
        setTimeout(() => {
          router.push('/');
        }, 500);
      } catch (err) {
        console.error('[Auth Process] Error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setStatus('error');
      }
    };

    processAuth();
  }, [searchParams, router]);

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-[#0e0718] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="w-12 h-12 border-4 border-[#a5b4fc] border-t-[#f59e0b] rounded-full animate-spin" />
          </div>
          <p className="text-white text-lg font-medium">Completing your login...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0e0718] flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-400 text-lg font-medium mb-4">Authentication failed</p>
          <p className="text-zinc-400 mb-6">{error}</p>
          <button
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              window.location.href = '/';
            }}
            className="bg-white text-black px-6 py-2 rounded-xl font-bold hover:bg-zinc-200 transition"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0718] flex items-center justify-center">
      <p className="text-white">Redirecting...</p>
    </div>
  );
}
