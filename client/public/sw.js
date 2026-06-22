self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: 'Executive Engine', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Executive Engine';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'executive-engine',
    renotify: true,
    requireInteraction: true,
    vibrate: [400, 120, 400, 120, 400],
    data: payload
  };

  event.waitUntil(
    (async () => {
      // Let any open window play the in-app alarm sound for an immediate, sharp tone.
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: 'play-alarm', payload });
      }
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (clientList.length > 0) {
        const client = clientList[0];
        await client.focus();
        client.postMessage({ type: 'play-alarm', payload: event.notification.data || {} });
        return;
      }
      await self.clients.openWindow('/');
    })()
  );
});
