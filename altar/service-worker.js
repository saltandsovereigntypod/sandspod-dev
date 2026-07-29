/*
 * Dormant service worker: no application page currently registers this file.
 * Relative URLs make a future explicit registration safe at either /altar/ or
 * /sandspod-dev/altar/. Environment/config/auth requests are never cached.
 */
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/+$/, "");
const HOST_ENVIRONMENT = self.location.hostname === "saltandsovereignty.com" || self.location.hostname === "www.saltandsovereignty.com"
  ? "production"
  : "development";
const CACHE_NAME = `salt-sovereignty-${HOST_ENVIRONMENT}-${encodeURIComponent(SCOPE_PATH)}-v2`;
const CORE_ASSETS = ["./", "./index.html", "./altar.css", "./manifest.webmanifest", "../assets/icons/icon-192.png", "../assets/icons/icon-512.png"];
const NEVER_CACHE = ["/js/environment.js", "/js/supabase-config.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((name) => name.startsWith("salt-sovereignty-") && name !== CACHE_NAME).map((name) => caches.delete(name))
  )));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || NEVER_CACHE.some((suffix) => new URL(event.request.url).pathname.endsWith(suffix))) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("./index.html") : undefined))));
});
