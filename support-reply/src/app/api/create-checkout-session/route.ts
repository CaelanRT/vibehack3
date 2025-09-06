import { NextRequest, NextResponse } from 'next/server';
import { createApiRouteClient } from '@/lib/supabase-server';
import Stripe from 'stripe';

interface CheckoutSessionResponse {
  url: string;
}

interface CheckoutSessionError {
  error: 'AUTH_REQUIRED' | 'STRIPE_ERROR' | 'CONFIG_ERROR';
  message?: string;
}

// Validate required environment variables
function validateStripeConfig(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_ID', 
    'NEXT_PUBLIC_BASE_URL'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  return {
    isValid: missingVars.length === 0,
    missingVars
  };
}

// Initialize Stripe only if config is valid
function getStripeClient(): Stripe | null {
  const config = validateStripeConfig();
  if (!config.isValid) {
    return null;
  }
  
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
  });
}

export async function POST(request: NextRequest): Promise<NextResponse<CheckoutSessionResponse | CheckoutSessionError>> {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  try {
    // Validate Stripe configuration
    const config = validateStripeConfig();
    if (!config.isValid) {
      console.error(`[${requestId}] Missing Stripe env vars: ${config.missingVars.join(', ')}`);
      return NextResponse.json(
        { error: 'CONFIG_ERROR', message: 'Server configuration incomplete' } as CheckoutSessionError,
        { status: 500 }
      );
    }

    // Get Stripe client
    const stripe = getStripeClient();
    if (!stripe) {
      console.error(`[${requestId}] Failed to initialize Stripe client`);
      return NextResponse.json(
        { error: 'CONFIG_ERROR', message: 'Server configuration error' } as CheckoutSessionError,
        { status: 500 }
      );
    }

    // Initialize Supabase client and check authentication
    const supabase = createApiRouteClient(request);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log(`[${requestId}] Unauthenticated checkout attempt`);
      return NextResponse.json(
        { error: 'AUTH_REQUIRED' } as CheckoutSessionError,
        { status: 401 }
      );
    }

    console.log(`[${requestId}] Creating checkout session for user_id: ${user.id}`);

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/thank-you`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/`,
      metadata: {
        user_id: user.id,
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new Error('Stripe session created but no URL returned');
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Checkout session created successfully for user_id: ${user.id}, duration: ${duration}ms`);

    const response: CheckoutSessionResponse = {
      url: session.url,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Stripe checkout session creation failed, duration: ${duration}ms, error: ${error.message}`);
    
    return NextResponse.json(
      { error: 'STRIPE_ERROR', message: 'Failed to create checkout session' } as CheckoutSessionError,
      { status: 500 }
    );
  }
}
