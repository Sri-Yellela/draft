// draft's service worker — ⭐ D112 item 8. It does ONE thing: show a Web Push the server sent (services/notify.js), and
// open draft on the page it names when it is pressed. No caching, no offline copy, no fetch handler — the app loads from
// the network exactly as before. Registered by Account → Notifications only when the person turns push on.
//
// The payload is { title, body, url, tag } — never a company or a value (D100 P4); a tag replaces the last one of its kind.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/app";
  event.waitUntil(self.registration.showNotification(data.title || "draft", {
    body: data.body || "",
    tag: data.tag || undefined,
    icon: "/favicon-48.png",
    badge: "/favicon-48.png",
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const same = wins.find(w => new URL(w.url).origin === self.location.origin);
    if (same) { await same.focus(); if ("navigate" in same) return same.navigate(target); return; }
    return self.clients.openWindow(target);
  })());
});

// The browser rotated the subscription: subscribe again with the same server key and tell draft (the session cookie
// rides along). If this fails, the person sees push as off in Account and can turn it on again.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const key = event.oldSubscription?.options?.applicationServerKey;
    if (!key) return;
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await fetch("/api/push/subscribe", { method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  })().catch(() => {}));
});
