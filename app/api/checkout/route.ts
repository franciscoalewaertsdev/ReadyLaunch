import { NextResponse } from 'next/server';

interface CheckoutRequest {
  package: string;
  addressType: string;
  isYearly: boolean;
  companyName: string;
  selectedState: string;
  country: string;
  embed?: boolean;
}

// Whop Product IDs
const WHOP_PRODUCTS = {
  packages: {
    'Premium+': 'prod_RFJw2a7uTwyUc',
    'Credit Accelerator': 'prod_D7lEKMjC3m640',
  },
  address: {
    commercial: 'prod_6DjgbnbumeFrQ',
    residential: 'prod_8RQRGAsESatx8',
  },
};

// Pricing configuration for reference (used by both embed and redirect flows)
const PRICING = {
  packages: {
    'Premium+': 850,
    'Credit Accelerator': 1495,
  },
  address: {
    commercial: { monthly: 31, yearly: 31 * 12 },
    residential: { monthly: 127, yearly: 127 * 12 },
  },
};

// helper to compute total price given the selection
function computeTotalPrice(
  selectedPackage: string,
  addressType: string,
  isYearly: boolean
): number {
  const pkg = PRICING.packages[selectedPackage as keyof typeof PRICING.packages];
  const addr = PRICING.address[addressType as keyof typeof PRICING.address];
  if (pkg === undefined || addr === undefined) return 0;
  return pkg + (isYearly ? addr.yearly : addr.monthly);
}


import Whop from '@whop/sdk';

const WHOP_API_KEY = process.env.WHOP_API_KEY;
const WHOP_COMPANY_ID = process.env.WHOP_COMPANY_ID;

export async function POST(request: Request) {
  try {
    const body: CheckoutRequest = await request.json();
    const { package: selectedPackage, addressType, isYearly, companyName, selectedState, country, embed } = body as any;
    let orderId: string | null = null; // declare early for use in both branches
    let checkoutConfig: any = null; // declare early for use in both branches

    // attempt to parse user info from cookie
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
    let whopTokens: any = null;
    if (cookies.whop_tokens) {
      try {
        whopTokens = JSON.parse(decodeURIComponent(cookies.whop_tokens));
      } catch {}
    }

    if (!selectedPackage || !addressType || !companyName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // compute price for embed/metadata
    const totalPrice = computeTotalPrice(selectedPackage, addressType, isYearly);

    // log checkout attempt
    try {
      const { logEvent } = await import('../../lib/logger');
      await logEvent({
        type: 'checkout_request',
        user: whopTokens?.userInfo || null,
        selections: { selectedPackage, addressType, isYearly, companyName, selectedState, country },
        totalPrice,
      });
    } catch (e) {
      console.error('[Checkout] logger import failed', e);
    }

    const metadata = {
      company_name: companyName,
      selected_state: selectedState,
      country,
      billing_type: isYearly ? 'yearly' : 'monthly',
    };

    // if the client requested an embedded checkout, build a session with Whop SDK
    if (embed) {
      if (!WHOP_API_KEY || !WHOP_COMPANY_ID) {
        // log specifics for easier debugging
        console.error('[Checkout] Missing Whop configuration:', {
          WHOP_API_KEY: !!WHOP_API_KEY,
          WHOP_COMPANY_ID: !!WHOP_COMPANY_ID,
        });
        const missing = [];
        if (!WHOP_API_KEY) missing.push('WHOP_API_KEY');
        if (!WHOP_COMPANY_ID) missing.push('WHOP_COMPANY_ID');
        return NextResponse.json({ error: `Server misconfiguration: missing ${missing.join(', ')}` }, { status: 500 });
      }

      const client = new Whop({ apiKey: WHOP_API_KEY });
      // omit company_id at the top level; the API key is already scoped to a company
      checkoutConfig = await client.checkoutConfigurations.create({
        // company_id: WHOP_COMPANY_ID,
        plan: {
          company_id: WHOP_COMPANY_ID, // required by typings
          currency: 'usd',
          initial_price: totalPrice,
          plan_type: 'one_time',
        },
        metadata,
      } as any); // cast to any to silence TypeScript mismatch with runtime

      try {
        const { db } = await import('@/app/lib/firebase-admin');
        const orderDoc = await db.collection('orders').add({
          user: whopTokens?.userInfo || null,
          selections: { selectedPackage, addressType, isYearly, companyName, selectedState, country },
          totalPrice,
          whopSessionId: checkoutConfig.id,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        orderId = orderDoc.id;
      } catch (e) {
        console.error('[Checkout] failed to save order in Firestore', e);
      }
      return NextResponse.json({ sessionId: checkoutConfig.id, totalPrice, orderId });
    }

    // otherwise fall back to the existing redirect flow
    const packageProductId = WHOP_PRODUCTS.packages[selectedPackage as keyof typeof WHOP_PRODUCTS.packages];
    const addressProductId = WHOP_PRODUCTS.address[addressType as keyof typeof WHOP_PRODUCTS.address];

    if (!packageProductId || !addressProductId) {
      return NextResponse.json(
        { error: 'Invalid package or address type' },
        { status: 400 }
      );
    }

    const products = [packageProductId, addressProductId].join(',');

    const checkoutUrl = new URL('https://whop.com/checkout');
    checkoutUrl.searchParams.append('products', products);
    checkoutUrl.searchParams.append('metadata', JSON.stringify(metadata));

    console.log('[Checkout] Redirecting to Whop:', {
      packageProductId,
      addressProductId,
      products,
      companyName,
      isEmbed: false,
    });

    // Guarda la orden en Firestore
    try {
      const { db } = await import('@/app/lib/firebase-admin');
      const orderDoc = await db.collection('orders').add({
        user: whopTokens?.userInfo || null,
        selections: { selectedPackage, addressType, isYearly, companyName, selectedState, country },
        totalPrice,
        whopSessionId: embed ? checkoutConfig.id : null,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      orderId = orderDoc.id;
    } catch (e) {
      console.error('[Checkout] failed to save order in Firestore', e);
    }

    return NextResponse.json({
      redirect: checkoutUrl.toString(),
      orderId,
    });
  } catch (error) {
    console.error('[Checkout] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout creation failed' },
      { status: 500 }
    );
  }
}
