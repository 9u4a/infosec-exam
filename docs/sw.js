/* 오프라인 지원. 앱 셸을 바꾸면 CACHE 버전을 올리세요 (data/bundle.js 는 네트워크 우선이라 무관). */
const CACHE = 'infosec-sil-v9';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './vendor/marked.min.js',
  './data/bundle.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // 데이터 번들: 네트워크 우선 (온라인이면 최신, 오프라인이면 캐시)
  if (url.pathname.endsWith('/data/bundle.js')) {
    e.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // 그 외: 캐시 우선, 없으면 네트워크 후 캐시에 저장
  e.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
