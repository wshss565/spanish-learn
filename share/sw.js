// Service Worker：离线缓存应用外壳，断网也能打开学习
const CACHE = 'hola-es-v5';   // 外壳（CSS/JS/主题/数据）变更后升版，强制已安装客户端刷新缓存
// v5：源码版模块图变更（js/core/store.js 改用相对路径引 ts-fsrs）。
//      静态资源走 cache-first，老访客若还用 v4 缓存里的旧 store.js 会继续白屏，必须升版。
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 云端 TTS 等跨域请求不拦，直连

  // 页面导航：网络优先，断网回退缓存（这样更新能及时生效）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源：
  //   小体积的代码文件（js/css，< 512KB）走 stale-while-revalidate —— 先用缓存秒开，
  //   后台悄悄拉新版并更新缓存。这样代码更新后下一次访问就能生效，
  //   不再依赖「记得升 CACHE 版本号」这件事（漏升就会让用户一直跑旧代码）。
  //   大文件（js/data/books.js 约 2.3MB）保持 cache-first：每次访问都后台重下 2.3MB
  //   对移动网络不友好，而词库内容变旧并不会让应用出错。
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      if (!hit) return net;
      const len = Number(hit.headers.get('content-length') || 0);
      const isCode = /\.(?:js|mjs|css)$/.test(new URL(req.url).pathname);
      if (isCode && len && len < 512 * 1024) { net.catch(() => {}); return hit; }
      return hit;
    })
  );
});
