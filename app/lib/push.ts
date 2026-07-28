import { supabase } from './supabaseClient';
import webpush from 'web-push';

// VAPID ključevi
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const privateKey = process.env.VAPID_PRIVATE_KEY!;

webpush.setVapidDetails(
  'mailto:admin@rotrg.com',
  publicKey,
  privateKey
);

// Čuvanje pretplate u bazi
export async function saveSubscription(userId: string, subscription: PushSubscription) {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || '',
      auth: subscription.keys?.auth || '',
    }, {
      onConflict: 'user_id, endpoint'
    });

  if (error) {
    console.error('Greška pri čuvanju pretplate:', error);
    throw error;
  }
}

// Slanje notifikacije svim pretplaćenim korisnicima
export async function sendNotificationToAll(title: string, body: string, url?: string) {
  // Dohvati sve pretplate
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (error) {
    console.error('Greška pri dohvatanju pretplata:', error);
    return;
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/notifications',
    icon: '/icons/icon-192.png',
  });

  // Pošalji notifikaciju svakoj pretplati
  const results = await Promise.allSettled(
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
        return { success: true, endpoint: sub.endpoint };
      } catch (error) {
        // Ako je endpoint invalid, obriši ga iz baze
        if (error instanceof Error && error.message.includes('410')) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
        return { success: false, endpoint: sub.endpoint, error };
      }
    })
  );

  return results;
}