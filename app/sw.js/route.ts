// app/sw.js/route.ts
export async function GET() {
  const swContent = `
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('rotrg-cache-'))
          .map((cacheName) => caches.delete(cacheName))
      )),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      body: event.data ? event.data.text() : 'You have a new announcement',
    };
  }

  const title = payload.title || 'ROTRG Taxi';
  const options = {
    body: payload.body || 'You have a new announcement',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'rotrg-' + Date.now(),
    data: {
      url: payload.url || '/notifications',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || '/notifications',
    self.location.origin
  ).href;

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of windowClients) {
      if ('navigate' in client) {
        await client.navigate(targetUrl);
      }
      if ('focus' in client) {
        return client.focus();
      }
    }

    return clients.openWindow(targetUrl);
  })());
});
`;

  return new Response(swContent, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
