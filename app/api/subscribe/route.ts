import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';
import { saveSubscription } from '@/app/lib/push';

export async function POST(request: NextRequest) {
  try {
    // Dohvati korisnika iz sesije
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Niste prijavljeni' },
        { status: 401 }
      );
    }

    const subscription = await request.json();
    
    await saveSubscription(session.user.id, subscription);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Greška pri pretplati:', error);
    return NextResponse.json(
      { error: 'Greška pri pretplati' },
      { status: 500 }
    );
  }
}