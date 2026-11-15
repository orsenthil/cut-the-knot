"use strict";

/*
 * The service worker: lets the site open when there is no connection, and
 * makes it installable as an app.
 *
 * It is deliberately cautious. For every page and file on this site it asks
 * the network first and keeps a copy of what comes back; only when the
 * network fails does it answer from the copies. So a player who is online
 * always gets the newest version, with no cache to go stale and no version
 * numbers to keep, and a player who is offline can still open whatever they
 * have opened before.
 *
 * It never touches requests to other sites (sign-in, the database,
 * Wikipedia), and never anything but GET.
 *
 * To retire it, change CACHE; old copies are deleted when the new worker
 * takes over.
 */

const CACHE = "coolmaths-v1";
/** Roughly: the home page, the shared files, and a few hundred games. */
const MAX_ENTRIES = 600;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

async function remember(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  const keys = await cache.keys();
  // Oldest first: drop the overflow.
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(old);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") event.waitUntil(remember(request, response.clone()));
        return response;
      } catch (err) {
        const cached = await caches.match(request, { ignoreSearch: request.mode === "navigate" });
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});
