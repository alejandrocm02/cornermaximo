/* FutStats Web Push service worker */
self.addEventListener('push', (event) => {
  let payload = {
    title: 'FutStats',
    body: 'Tienes una nueva alerta en tu seguimiento.',
    url: '/alertas',
    tag: 'futstats-alert',
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/futstats-icon.svg',
      badge: '/futstats-icon.svg',
      tag: payload.tag,
      renotify: true,
      data: { url: payload.url || '/alertas' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/alertas', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      return clients.openWindow ? clients.openWindow(target) : undefined;
    }),
  );
});
