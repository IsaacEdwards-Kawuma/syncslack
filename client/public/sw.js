/* Minimal push handler — payload JSON: { title, body } */
self.addEventListener('push', (event) => {
  let title = 'Sync Work';
  let body = 'You have a new notification';
  try {
    if (event.data) {
      const j = event.data.json();
      if (j.title) title = String(j.title);
      if (j.body) body = String(j.body);
    }
  } catch (_) {
    try {
      const t = event.data?.text();
      if (t) body = t;
    } catch (_) {}
  }
  event.waitUntil(self.registration.showNotification(title, { body, tag: 'sync-work' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length) {
        clientList[0].focus();
        return;
      }
      return clients.openWindow('/');
    })
  );
});
