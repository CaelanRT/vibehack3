import { NextRequest, NextResponse } from 'next/server';
import { createApiRouteClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

type Tone = 'Friendly' | 'Professional' | 'Concise';
type Language = 'Auto' | 'English' | 'French' | string;

interface GenerateRequest {
  message: string;
  tone: Tone;
  language?: Language;
}

interface GenerateResponse {
  drafts: string[];
  quota: {
    limit: number | null;
    used: number;
    remaining: number | null;
    pro: boolean;
  };
}

interface QuotaErrorResponse {
  error: 'DAILY_LIMIT_REACHED';
  limit: number;
  remaining: number;
  pro: boolean;
  message: string;
}

// Anonymous quota tracking with signed cookies
const ANON_QUOTA_LIMIT = 5;
const FREE_QUOTA_LIMIT = 20;
const PRO_SAFETY_CAP = 1000;

// Get JWT secret for signing cookies
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
  return new TextEncoder().encode(secret);
}

// Create or get anonymous session cookie
async function getOrCreateAnonSession(): Promise<string> {
  const cookieStore = await cookies();
  const anonCookie = cookieStore.get('anon_session');
  
  if (anonCookie?.value) {
    try {
      const { payload } = await jwtVerify(anonCookie.value, getJWTSecret());
      return payload.sessionId as string;
    } catch (e) {
      // Invalid cookie, create new session
    }
  }
  
  // Create new anonymous session
  const sessionId = crypto.randomUUID();
  const token = await new SignJWT({ sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getJWTSecret());
  
  cookieStore.set('anon_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/'
  });
  
  return sessionId;
}

// Check anonymous quota using in-memory tracking
const anonQuotaMap = new Map<string, { day: string; count: number }>();

async function checkAnonQuota(sessionId: string): Promise<{ allowed: boolean; used: number }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `${sessionId}:${today}`;
  
  const current = anonQuotaMap.get(key) || { day: today, count: 0 };
  
  if (current.count >= ANON_QUOTA_LIMIT) {
    return { allowed: false, used: current.count };
  }
  
  // Increment count
  current.count++;
  anonQuotaMap.set(key, current);
  
  return { allowed: true, used: current.count };
}

// Check signed-in user quota
async function checkUserQuota(supabase: any, userId: string, isPro: boolean): Promise<{ allowed: boolean; used: number }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  if (isPro) {
    // Pro users have unlimited access (with safety cap)
    const { data: quotaData } = await supabase
      .from('daily_quota')
      .select('count')
      .eq('user_id', userId)
      .eq('day', today)
      .single();
    
    const currentCount = quotaData?.count || 0;
    
    if (currentCount >= PRO_SAFETY_CAP) {
      return { allowed: false, used: currentCount };
    }
    
    // Increment count for Pro users (for tracking)
    await supabase
      .from('daily_quota')
      .upsert({
        user_id: userId,
        day: today,
        count: currentCount + 1
      });
    
    return { allowed: true, used: currentCount + 1 };
  } else {
    // Free users: enforce 20/day limit
    const { data: quotaData } = await supabase
      .from('daily_quota')
      .select('count')
      .eq('user_id', userId)
      .eq('day', today)
      .single();
    
    const currentCount = quotaData?.count || 0;
    
    if (currentCount >= FREE_QUOTA_LIMIT) {
      return { allowed: false, used: currentCount };
    }
    
    // Atomic upsert + increment
    const { data: updatedData, error } = await supabase
      .from('daily_quota')
      .upsert({
        user_id: userId,
        day: today,
        count: currentCount + 1
      }, {
        onConflict: 'user_id,day'
      })
      .select('count')
      .single();
    
    if (error) {
      console.error('Error updating daily quota:', error);
      return { allowed: false, used: currentCount };
    }
    
    return { allowed: true, used: updatedData.count };
  }
}

// Input validation and sanitization
function validateAndSanitizeInput(data: any): { message: string; tone: Tone; language: Language } {
  // Validate message
  if (!data.message || typeof data.message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  let message = data.message.trim();
  
  // Strip HTML tags
  message = message.replace(/<[^>]*>/g, '');
  
  // Check minimum length
  if (message.length < 10) {
    throw new Error('Message must be at least 10 characters long');
  }
  
  // Truncate if too long
  if (message.length > 2500) {
    message = message.substring(0, 2500);
  }

  // Validate tone
  const validTones: Tone[] = ['Friendly', 'Professional', 'Concise'];
  if (!data.tone || !validTones.includes(data.tone)) {
    throw new Error('Tone must be one of: Friendly, Professional, Concise');
  }

  // Validate language (optional)
  const language = data.language || 'Auto';

  return { message, tone: data.tone, language };
}

// Create system prompt with guardrails
function createSystemPrompt(tone: Tone, language: Language): string {
  const languageInstruction = language === 'Auto' ? '' : ` Respond in ${language}.`;
  
  return `You are a customer support AI assistant. Generate exactly 3 different reply drafts for customer messages.

CRITICAL REQUIREMENTS:
- Each draft must be under 150 words
- Use a ${tone.toLowerCase()} tone
- Do NOT invent company policies or procedures
- If information is missing, ask ONE concise clarifying question
- For abusive messages, respond politely and de-escalate
- Return ONLY valid JSON in this exact format: {"drafts": ["draft1", "draft2", "draft3"]}${languageInstruction}

Generate 3 distinct approaches to the same customer message.`;
}

// Fallback JSON parsing
function parseFallbackResponse(text: string): string[] {
  // Try to extract JSON first
  const jsonMatch = text.match(/\{[\s\S]*"drafts"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.drafts && Array.isArray(parsed.drafts)) {
        return parsed.drafts.slice(0, 3).map((draft: any) => String(draft).trim()).filter(Boolean);
      }
    } catch (e) {
      // Fall through to text splitting
    }
  }

  // Fallback: split by double newlines
  const blocks = text.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  return blocks.slice(0, 3);
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    // Check environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      console.error(`[${requestId}] Missing OPENAI_API_KEY`);
      return NextResponse.json(
        { 
          error: 'Missing server configuration',
          code: 'MISSING_API_KEY',
          message: 'Please set OPENAI_API_KEY in your .env.local file'
        },
        { status: 500 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const { message, tone, language } = validateAndSanitizeInput(body);

    console.log(`[${requestId}] Processing request - tone: ${tone}, language: ${language}, message length: ${message.length}`);

    // Debug: Check what cookies are being sent
    const cookieHeader = request.headers.get('cookie');
    console.log(`[${requestId}] Cookie header: ${cookieHeader ? cookieHeader.substring(0, 100) + '...' : 'none'}`);

    // Initialize Supabase client
    const supabase = createApiRouteClient(request);
    
    // Check authentication and quota
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log(`[${requestId}] Auth check - user: ${user ? user.id : 'null'}, email: ${user?.email || 'null'}, error: ${userError?.message || 'none'}`);
    
    let quotaResult: { allowed: boolean; used: number };
    let isPro = false;
    let limit: number | null = null;
    
    if (user) {
      // Signed-in user: check profile and quota
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('pro')
        .eq('user_id', user.id)
        .single();
      
      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email,
            pro: false,
            created_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error(`[${requestId}] Error creating profile:`, insertError);
        }
        isPro = false;
        limit = FREE_QUOTA_LIMIT;
      } else if (profile) {
        isPro = profile.pro || false;
        limit = isPro ? null : FREE_QUOTA_LIMIT;
      } else {
        isPro = false;
        limit = FREE_QUOTA_LIMIT;
      }
      
      quotaResult = await checkUserQuota(supabase, user.id, isPro);
      console.log(`[${requestId}] User quota check - user: ${user.id}, pro: ${isPro}, used: ${quotaResult.used}, allowed: ${quotaResult.allowed}`);
    } else {
      // Anonymous user: check anonymous quota
      const sessionId = await getOrCreateAnonSession();
      quotaResult = await checkAnonQuota(sessionId);
      limit = ANON_QUOTA_LIMIT;
      console.log(`[${requestId}] Anonymous quota check - session: ${sessionId}, used: ${quotaResult.used}, allowed: ${quotaResult.allowed}`);
    }
    
    // Check if quota exceeded
    if (!quotaResult.allowed) {
      const errorResponse: QuotaErrorResponse = {
        error: 'DAILY_LIMIT_REACHED',
        limit: limit!,
        remaining: 0,
        pro: isPro,
        message: 'Daily limit reached. Sign in or upgrade for higher limits.'
      };
      
      console.log(`[${requestId}] Quota exceeded - limit: ${limit}, used: ${quotaResult.used}`);
      return NextResponse.json(errorResponse, { status: 429 });
    }

    // Create OpenAI request
    const systemPrompt = createSystemPrompt(tone, language);
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.5,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`[${requestId}] OpenAI API error: ${openaiResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to generate replies' },
        { status: 500 }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error(`[${requestId}] No content in OpenAI response`);
      return NextResponse.json(
        { error: 'No content generated' },
        { status: 500 }
      );
    }

    // Parse response
    let drafts: string[];
    try {
      const parsed = JSON.parse(content);
      if (parsed.drafts && Array.isArray(parsed.drafts)) {
        drafts = parsed.drafts.slice(0, 3).map((draft: any) => String(draft).trim()).filter(Boolean);
      } else {
        throw new Error('Invalid JSON structure');
      }
    } catch (e) {
      console.warn(`[${requestId}] JSON parse failed, using fallback parsing`);
      drafts = parseFallbackResponse(content);
    }

    // Ensure we have at least 3 drafts
    while (drafts.length < 3) {
      drafts.push(`Thank you for your message. I'm here to help and will get back to you shortly.`);
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Success - generated ${drafts.length} drafts in ${duration}ms`);

    // Calculate remaining quota
    const remaining = limit ? Math.max(0, limit - quotaResult.used) : null;

    const response: GenerateResponse = { 
      drafts: drafts.slice(0, 3),
      quota: {
        limit,
        used: quotaResult.used,
        remaining,
        pro: isPro
      }
    };
    return NextResponse.json(response);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      console.error(`[${requestId}] Request timeout after ${duration}ms`);
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 408 }
      );
    }

    if (error.message.includes('Message must be') || error.message.includes('Tone must be')) {
      console.warn(`[${requestId}] Validation error: ${error.message}`);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error(`[${requestId}] Unexpected error after ${duration}ms:`, error.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
