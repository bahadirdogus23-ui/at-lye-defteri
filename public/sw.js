const CACHE = "atolye-shell-v1";
const BASE = new URL("./", self.location.href).pathname;
const FILES = ["index.html", "icon.svg", "manifest.webmanifest"].map(
  (file) => BASE + file,
);
const CACHE_PREFIX = "atolye-" + BASE + "-";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE)
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE)
                .then((cache) => cache.put(BASE + "index.html", copy)),
            );
          }
          return response;
        })
        .catch(() => caches.match(BASE + "index.html", { ignoreVary: true })),
    );
    return;
  }
  if (
    !FILES.some(
      (file) => new URL(file, self.location.origin).pathname === url.pathname,
    )
  )
    return;
  event.respondWith(
    caches
      .match(event.request, { ignoreVary: true })
      .then((cached) => cached || fetch(event.request)),
  );
});
