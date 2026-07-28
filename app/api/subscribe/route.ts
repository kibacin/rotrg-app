import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';
import { saveSubscription } from '@/app/lib/push';

export async function POST(request: NextRequest) {
  try {
    // ⭐ Dohvati token iz header-a ⭐
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Niste prijavljeni' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // ⭐ Postavi session sa tokenom ⭐
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Niste prijavljeni' },
        { status: 401 }
      );
    }

    const subscription = await request.json();
    await saveSubscription(user.id, subscription);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Greška pri pretplati:', error);
    return NextResponse.json(
      { error: 'Greška pri pretplati' },
      { status: 500 }
    );
  }
}