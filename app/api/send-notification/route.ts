import { NextRequest, NextResponse } from 'next/server';
import { sendNotificationToAll } from '@/app/lib/push';
import { authenticateRequest } from '@/app/lib/serverAuth';
import { createSupabaseAdmin } from '@/app/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: driver, error: roleError } = await supabaseAdmin
      .from('drivers')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (roleError || driver?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Samo admin može slati notifikacije' },
        { status: 403 }
      );
    }

    const { title, body, url } = await request.json();

    if (
      typeof title !== 'string' ||
      typeof body !== 'string' ||
      !title.trim() ||
      !body.trim()
    ) {
      return NextResponse.json(
        { error: 'Naslov i sadržaj su obavezni' },
        { status: 400 }
      );
    }

    const result = await sendNotificationToAll(title, body, url);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Greška pri slanju notifikacija:', error);
    return NextResponse.json(
      { error: 'Greška pri slanju notifikacija' },
      { status: 500 }
    );
  }
}
