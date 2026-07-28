import { NextRequest, NextResponse } from 'next/server';
import { sendNotificationToAll } from '@/app/lib/push';

export async function POST(request: NextRequest) {
  try {
    const { title, body, url } = await request.json();
    
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