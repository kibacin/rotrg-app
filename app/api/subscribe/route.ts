import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/app/lib/serverAuth';
import { createSupabaseAdmin } from '@/app/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: authError },
        { status: 401 }
      );
    }

    const subscription = await request.json();
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (
      typeof endpoint !== 'string' ||
      typeof p256dh !== 'string' ||
      typeof auth !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid push subscription' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .neq('user_id', user.id);

    const { error: insertError } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
      }, {
        onConflict: 'user_id, endpoint'
      });

    if (insertError) {
      console.error('Could not save the subscription:', insertError);
      return NextResponse.json(
        { error: 'Could not save the subscription: ' + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Notification subscription failed:', error);
    return NextResponse.json(
      { error: 'Could not save the push subscription' },
      { status: 500 }
    );
  }
}
