const CACHE = 'woblii-v1';
const SHELL = [
  '/app.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Libre+Franklin:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install: cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache what we can, ignore failures for external resources
      return Promise.allSettled(SHELL.map(url => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network first, fall back to cache
self.addEventListener('fetch', e => {
  // Don't intercept Supabase API calls
  if (e.request.url.includes('supabase.co') ||
      e.request.url.includes('libreview.io') ||
      e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          // If navigating and nothing cached, serve app shell
          if (e.request.mode === 'navigate') {
            return caches.match('/app.html');
          }
        });
      })
  );
});

// Push notifications
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'Woblii', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'woblii',
      requireInteraction: false,
      data: { url: data.url || '/app.html' }
    })
  );
});

// Notification click: open or focus app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/app.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('woblii.com') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
