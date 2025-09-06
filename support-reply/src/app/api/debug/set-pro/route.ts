import { NextRequest, NextResponse } from 'next/server';
import { createApiRouteClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Debug set-pro request received.`);

  try {
    // Authenticate user with Supabase
    const supabase = createApiRouteClient(request);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log(`[${requestId}] Authentication required for Pro activation. User: ${user?.id || 'none'}`);
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }

    console.log(`[${requestId}] Setting Pro status for user: ${user.id}`);

    // Update the user's profile to set pro = true
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({ pro: true })
      .eq('user_id', user.id)
      .select()
      .single();

    if (profileError) {
      console.error(`[${requestId}] Error updating profile:`, profileError);
      return NextResponse.json(
        { error: 'PROFILE_UPDATE_FAILED', message: 'Failed to update profile' },
        { status: 500 }
      );
    }

    console.log(`[${requestId}] Pro status activated for user: ${user.id}`);
    return NextResponse.json({ 
      success: true, 
      message: 'Pro status activated successfully',
      pro: true 
    });

  } catch (error: any) {
    console.error(`[${requestId}] Debug set-pro error:`, error.message);
    return NextResponse.json(
      { error: 'ACTIVATION_FAILED', message: error.message || 'Failed to activate Pro status' },
      { status: 500 }
    );
  }
}
