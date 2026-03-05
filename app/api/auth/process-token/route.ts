import { NextResponse } from 'next/server';

interface WhopUserInfo {
  sub: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, codeVerifier, clientId, redirectUri } = body;

    if (!code || !codeVerifier) {
      return NextResponse.json(
        { error: 'Missing code or codeVerifier' },
        { status: 400 }
      );
    }

    const envClientId = process.env.WHOP_CLIENT_ID || process.env.NEXT_PUBLIC_WHOP_CLIENT_ID;
    const resolvedClientId = envClientId || clientId;
    const clientSecret = process.env.WHOP_OAUTH_CLIENT_SECRET || process.env.WHOP_CLIENT_SECRET;
    const requestOrigin = new URL(request.url).origin;
    const resolvedRedirectUri =
      process.env.WHOP_REDIRECT_URI ||
      process.env.NEXT_PUBLIC_WHOP_REDIRECT_URI ||
      redirectUri ||
      `${requestOrigin}/api/auth/callback`;

    if (!resolvedClientId) {
      console.error('[Auth Process Token] Missing OAuth client_id in environment');
      return NextResponse.json(
        { error: 'Server misconfiguration: missing OAuth client_id' },
        { status: 500 }
      );
    }

    console.log('[Auth Process Token] Exchanging code for tokens');

    // Exchange authorization code for tokens (following Whop OAuth 2.1 + PKCE)
    const tokenUrl = 'https://api.whop.com/oauth/token';
    const exchangeCode = async (includeClientSecret: boolean) => {
      const payload: Record<string, string> = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: resolvedRedirectUri,
        client_id: resolvedClientId,
        code_verifier: codeVerifier,
      };

      if (includeClientSecret && clientSecret) {
        payload.client_secret = clientSecret;
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      return { response, text };
    };

    let { response: tokenRes, text: tokenText } = await exchangeCode(Boolean(clientSecret));
    console.log('[Auth Process Token] Token response status:', tokenRes.status);
    console.log('[Auth Process Token] Token response body:', tokenText.substring(0, 500));

    if (!tokenRes.ok && clientSecret && tokenText.includes('lacks oauth:token_exchange permission')) {
      console.warn('[Auth Process Token] Provided client_secret lacks token_exchange permission; retrying without client_secret (PKCE-only).');
      ({ response: tokenRes, text: tokenText } = await exchangeCode(false));
      console.log('[Auth Process Token] Retry response status:', tokenRes.status);
      console.log('[Auth Process Token] Retry response body:', tokenText.substring(0, 500));
    }

    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error('[Auth Process Token] Failed to parse token response');
      return NextResponse.json(
        { error: 'Invalid token response from OAuth provider' },
        { status: 500 }
      );
    }

    if (!tokenRes.ok) {
      const errorMsg = tokenData.error_description || tokenData.error || 'Unknown error';
      console.error('[Auth Process Token] Token exchange failed:', errorMsg);
      return NextResponse.json(
        { error: `Token exchange failed: ${errorMsg}` },
        { status: tokenRes.status }
      );
    }

    if (!tokenData.access_token) {
      console.error('[Auth Process Token] No access_token in response:', tokenData);
      return NextResponse.json(
        { error: 'No access token in response' },
        { status: 500 }
      );
    }

    console.log('[Auth Process Token] Token exchanged successfully');

    // Fetch user info from Whop userinfo endpoint
    console.log('[Auth Process Token] Fetching user info');
    const userinfoUrl = 'https://api.whop.com/oauth/userinfo';
    const userRes = await fetch(userinfoUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userText = await userRes.text();
    let userInfo: WhopUserInfo | undefined;
    try {
      userInfo = JSON.parse(userText) as WhopUserInfo;
    } catch {
      console.error('[Auth Process Token] Failed to parse user info response');
      // Continue without user info
    }

    if (!userRes.ok) {
      console.error('[Auth Process Token] Failed to fetch user info:', userText);
      // Still return tokens even if userinfo fetch failed
    }

    console.log('[Auth Process Token] Authentication complete for user:', userInfo?.preferred_username || userInfo?.sub);

    // record login event
    try {
      const { logEvent } = await import('../../../lib/logger');
      await logEvent({ type: 'login', user: userInfo || {}, tokens: { hasAccess: !!tokenData.access_token } });
    } catch (e) {
      console.error('[Auth Process Token] logger import failed', e);
    }

    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      id_token: tokenData.id_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      userInfo: userInfo || {},
    });
  } catch (error) {
    console.error('[Auth Process Token] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 500 }
    );
  }
}
