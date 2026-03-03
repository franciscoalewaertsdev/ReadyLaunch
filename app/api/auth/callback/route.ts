import { NextResponse } from 'next/server';

// Redirect to client-side token exchange page with authorization code
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('[OAuth Callback] Whop OAuth error:', error);
    return NextResponse.redirect(new URL('/?error=oauth_denied', request.url));
  }

  if (!code) {
    console.error('[OAuth Callback] No authorization code received');
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  console.log('[OAuth Callback] Received authorization code, redirecting to /auth/process');

  // Redirect to client-side page that will exchange the code with PKCE
  const redirectUrl = new URL('/auth/process', request.url);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  return NextResponse.redirect(redirectUrl);
}