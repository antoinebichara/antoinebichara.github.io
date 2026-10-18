---
# Service worker: lets the site work offline and be installed as an app.
# Jekyll stamps the build time below, so each publish replaces the old version.
sitemap: false
---
/*
 * Pages: always fetched fresh when online; the saved copy is used offline.
 * Photos and libraries: shown from the saved copy straight away, refreshed in the background.
 * Map tiles and anything else from other sites: never saved.
 */
var VERSION = '{{ site.time | date: "%Y%m%d%H%M%S" }}';
var CORE = 'fairvopia-core-' + VERSION;
var PAGES = 'fairvopia-pages';
var IMAGES = 'fairvopia-images';
var LIBS = 'fairvopia-libs';
var MAX_IMAGES = 300;

var PRECACHE = [
    '/',
    '/offline.html',
    '/vendor/bootstrap/css/bootstrap.min.css',
    '/vendor/bootstrap/js/bootstrap.min.js',
    '/vendor/jquery/jquery.min.js',
    '/vendor/font-awesome/css/font-awesome.min.css',
    '/vendor/font-awesome/fonts/fontawesome-webfont.woff2?v=4.6.3',
    '/css/clean-blog.min.css',
    '/css/transitions.css',
    '/css/recipe-tools.css',
    '/css/recipe-globe.css',
    '/css/recipe-finder.css',
    '/css/home-layouts.css',
    '/js/clean-blog.min.js',
    '/js/transitions.js',
    '/js/recipe-tools.js',
    '/js/cooked-this.js',
    '/js/recipe-globe.js',
    '/js/recipe-finder.js',
    '/img/logo.png',
    '/img/rszhome-image.jpg',
    '/img/icons/icon-192.png'
];
var LIB_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CORE).then(function (cache) { return cache.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (names) {
            return Promise.all(names.filter(function (n) {
                return n.indexOf('fairvopia-core-') === 0 && n !== CORE;
            }).map(function (n) { return caches.delete(n); }));
        }).then(function () { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);

    if (url.origin === location.origin) {
        if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
            event.respondWith(networkFirst(req, PAGES, true));
        } else if (url.pathname.indexOf('/img/') === 0) {
            event.respondWith(staleWhileRevalidate(req, IMAGES, MAX_IMAGES));
        } else if (url.pathname !== '/sw.js') {
            event.respondWith(networkFirst(req, CORE, false));
        }
    } else if (LIB_HOSTS.indexOf(url.hostname) !== -1) {
        event.respondWith(staleWhileRevalidate(req, LIBS, 100));
    }
});

function networkFirst(req, cacheName, isPage) {
    return fetch(req).then(function (res) {
        if (res.ok) {
            var copy = res.clone();
            caches.open(cacheName).then(function (cache) { cache.put(req, copy); });
        }
        return res;
    }).catch(function () {
        return caches.match(req, { ignoreSearch: isPage }).then(function (hit) {
            if (hit) return hit;
            if (isPage) return caches.match('/offline.html');
            return Response.error();
        });
    });
}

function staleWhileRevalidate(req, cacheName, maxEntries) {
    return caches.open(cacheName).then(function (cache) {
        return cache.match(req).then(function (hit) {
            var fresh = fetch(req).then(function (res) {
                if (res.ok || res.type === 'opaque') {
                    cache.put(req, res.clone());
                    trim(cache, maxEntries);
                }
                return res;
            }).catch(function () { return hit; });
            return hit || fresh;
        });
    });
}

// Keep the photo cache from growing forever: drop the oldest entries
function trim(cache, maxEntries) {
    cache.keys().then(function (keys) {
        for (var i = 0; i < keys.length - maxEntries; i++) cache.delete(keys[i]);
    });
}
