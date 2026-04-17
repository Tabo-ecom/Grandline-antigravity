// Grand Line Service Worker — Push Notifications + FCM + Offline Cache

// Import Firebase Messaging SW (for FCM background messages)
try {
    importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

    firebase.initializeApp({
        apiKey: 'AIzaSyCiavCu_awCXAIJNkMT6L7fa6cbOLyN4Sk',
        authDomain: 'grand-line-v8.firebaseapp.com',
        projectId: 'grand-line-v8',
        storageBucket: 'grand-line-v8.firebasestorage.app',
        messagingSenderId: '1026219736072',
        appId: '1:1026219736072:web:084470d603e924c6eba5bd',
    });

    const messaging = firebase.messaging();

    // Background message handler (when app is closed)
    messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || payload.data?.title || 'Grand Line';
        const body = payload.notification?.body || payload.data?.body || 'Nuevo mensaje';
        const url = payload.data?.url || '/chat';

        self.registration.showNotification(title, {
            body,
            icon: '/logos/grandline-isotipo.png',
            badge: '/logos/grandline-isotipo.png',
            tag: `fcm-${Date.now()}`,
            data: { url },
            vibrate: [200, 100, 200],
        });
    });
} catch (e) {
    // Firebase not available — still works for basic push
}

const CACHE_NAME = 'grandline-v2';

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(['/dashboard', '/logos/grandline-isotipo.png']))
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
    );
    self.clients.claim();
});

// Fetch: network-first
self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request).catch(() => caches.match('/dashboard')));
    }
});

// Manual push (non-FCM)
self.addEventListener('push', (event) => {
    let data = { title: 'Grand Line', body: 'Nuevo mensaje', url: '/chat' };
    if (event.data) {
        try { data = { ...data, ...event.data.json() }; } catch { data.body = event.data.text(); }
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/logos/grandline-isotipo.png',
            badge: '/logos/grandline-isotipo.png',
            tag: 'grandline-push',
            data: { url: data.url },
            vibrate: [200, 100, 200],
        })
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'dismiss') return;
    const url = event.notification.data?.url || '/chat';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});
