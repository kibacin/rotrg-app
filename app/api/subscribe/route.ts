import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';


export async function POST(request: NextRequest) {
  try {
    // 1. Dohvati token iz header-a
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Niste prijavljeni' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 2. Dohvati korisnika preko tokena
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ Greška pri dohvatanju korisnika:', userError);
      return NextResponse.json(
        { error: 'Niste prijavljeni' },
        { status: 401 }
      );
    }

    // 3. Dohvati subscription podatke
    const subscription = await request.json();
    console.log('📝 Subscription:', subscription);

    // 4. Sačuvaj u bazu
    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh || '',
        auth: subscription.keys?.auth || '',
      }, {
        onConflict: 'user_id, endpoint'
      });

    if (insertError) {
      console.error('❌ Greška pri čuvanju u bazu:', insertError);
      return NextResponse.json(
        { error: 'Greška pri čuvanju pretplate: ' + insertError.message },
        { status: 500 }
      );
    }

    console.log('✅ Pretplata sačuvana za korisnika:', user.email);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Greška pri pretplati:', error);
    return NextResponse.json(
      { error: 'Greška pri pretplati: ' + error.message },
      { status: 500 }
    );
  }
}