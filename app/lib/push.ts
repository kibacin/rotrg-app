import 'server-only';

import webpush from 'web-push';
import { createSupabaseAdmin } from './supabaseAdmin';

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error('Nedostaju VAPID ključevi');
  }

  webpush.setVapidDetails(
    'mailto:admin@rotrg.com',
    publicKey,
    privateKey
  );
}

export async function sendNotificationToAll(title: string, body: string, url?: string) {
  configureWebPush();
  const supabaseAdmin = createSupabaseAdmin();

  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*');

  if (error) {
    throw error;
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/notifications',
    icon: '/icons/icon-192.png',
  });

  const results = await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        return true;
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
        console.error('Greška pri slanju push notifikacije:', error);
        return false;
      }
    })
  );

  return {
    total: results.length,
    sent: results.filter(Boolean).length,
    failed: results.filter((success) => !success).length,
  };
}
