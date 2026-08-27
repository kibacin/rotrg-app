import 'server-only';

import webpush from 'web-push';
import { createSupabaseAdmin } from './supabaseAdmin';

type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are missing');
  }

  webpush.setVapidDetails(
    'mailto:admin@rotrg.com',
    publicKey,
    privateKey
  );
}

async function deliverNotifications(
  subscriptions: StoredSubscription[],
  title: string,
  body: string,
  url?: string,
  tag?: string
) {
  configureWebPush();
  const supabaseAdmin = createSupabaseAdmin();

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/notifications',
    icon: '/icons/icon-192.png',
    tag,
  });

  const results = await Promise.all(
    subscriptions.map(async (sub) => {
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
        console.error('Push notification delivery failed:', error);
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

export async function sendNotificationToAll(title: string, body: string, url?: string) {
  const supabaseAdmin = createSupabaseAdmin();
  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (error) throw error;

  return deliverNotifications(
    (subscriptions ?? []) as StoredSubscription[],
    title,
    body,
    url
  );
}

export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  url?: string,
  tag?: string
) {
  const supabaseAdmin = createSupabaseAdmin();
  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) throw error;

  return deliverNotifications(
    (subscriptions ?? []) as StoredSubscription[],
    title,
    body,
    url,
    tag
  );
}

export async function sendNotificationToUsers(
  userIds: string[],
  title: string,
  body: string,
  url?: string,
  tag?: string
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  const supabaseAdmin = createSupabaseAdmin();
  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', uniqueUserIds);

  if (error) throw error;

  return deliverNotifications(
    (subscriptions ?? []) as StoredSubscription[],
    title,
    body,
    url,
    tag
  );
}
