// Offline support for Lånekalkulator. Generated per build by scripts/prerender.mjs, which
// fills in BUILD and PRECACHE; a new build means a new worker and fresh caches.
const BUILD = "__BUILD__"
const PRECACHE = __PRECACHE__
const CACHE = `lk-${BUILD}`

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lk-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  // Only this site; never the AI, analytics or other hosts (SSB and the like go straight to the network).
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_vercel/")) return

  if (req.mode === "navigate") {
    // Pages: fresh when online, the last copy (or the calculator) when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(url.pathname, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(url.pathname)) ?? (await caches.match("/")) ?? Response.error()),
    )
    return
  }

  if (url.pathname.startsWith("/assets/")) {
    // Built files carry a content hash in their name, so a cached copy is always right.
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
