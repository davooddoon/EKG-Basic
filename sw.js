const CACHE = 'ecg-rhythms-v3';
const CORE = ['./', './index.html', './manifest.json', './icon.svg'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;800;900&display=swap';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// نصب: پیش‌ذخیره فایل‌های اصلی و فونت وزیرمتن
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    try {
      const res = await fetch(FONT_CSS);
      const css = await res.clone().text();
      await cache.put(FONT_CSS, res);
      const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
      await Promise.all(urls.map((u) => cache.add(u).catch(() => {})));
    } catch (err) {
      // آفلاین هنگام نصب: فونت در اولین بارگذاری آنلاین بعدی ذخیره می‌شود
    }
    await self.skipWaiting();
  })());
});

// فعال‌سازی: حذف همه کش‌های قدیمی و کنترل فوری صفحه‌ها
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// درخواست‌ها: ابتدا کش (آفلاین)، سپس به‌روزرسانی بی‌صدا در پس‌زمینه
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  const isNav = req.mode === 'navigate';

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreVary: true, ignoreSearch: isNav });

    const network = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        cache.put(isNav ? './index.html' : req, res.clone());
      }
      return res;
    }).catch(() => null);

    if (hit) { event.waitUntil(network); return hit; }

    const res = await network;
    if (res) return res;
    if (isNav) {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    return Response.error();
  })());
});
