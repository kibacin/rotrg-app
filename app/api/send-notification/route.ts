import { NextRequest, NextResponse } from 'next/server';
import { sendNotificationToAll } from '@/app/lib/push';
import { authenticateAdmin } from '@/app/lib/serverAuth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authentication = await authenticateAdmin(request);
    if (!authentication.user) {
      return NextResponse.json(
        { error: authentication.error },
        { status: authentication.error === 'Niste prijavljeni' ? 401 : 403 }
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
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const result = await sendNotificationToAll(title, body, url);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Notification delivery failed:', error);
    return NextResponse.json(
      { error: 'Notification delivery failed' },
      { status: 500 }
    );
  }
}
