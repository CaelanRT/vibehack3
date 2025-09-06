import { NextRequest, NextResponse } from 'next/server';

type Tone = 'Friendly' | 'Professional' | 'Concise';
type Language = 'Auto' | 'English' | 'French' | string;

interface GenerateRequest {
  message: string;
  tone: Tone;
  language?: Language;
}

interface GenerateResponse {
  drafts: string[];
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

    const response: GenerateResponse = { drafts: drafts.slice(0, 3) };
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
