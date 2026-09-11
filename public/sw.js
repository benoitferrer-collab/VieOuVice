/* Push only: no fetch handler and no private page/API cache. */
function safePushPath(value) {
  try {
    const url = new URL(value, self.location.origin);
    const tab = url.searchParams.get("tab");
    if (url.origin === self.location.origin && url.pathname === "/" && ["survie", "ligue", "nemesis", "amis", "messages"].includes(tab)) {
      const friend = url.searchParams.get("friend");
      const suffix = tab === "messages" && friend && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(friend) ? "&friend=" + friend : "";
      return "/?tab=" + tab + suffix;
    }
  } catch { /* Use the application home for malformed payloads. */ }
  return "/?tab=survie";
}
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* Generic notification. */ }
  event.waitUntil(self.registration.showNotification("Du nouveau dans ta partie", {
    body: "Ouvre le jeu pour voir tes nouveautés.",
    tag: typeof data.deliveryId === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(data.deliveryId)
      ? "viegame-" + data.deliveryId : "viegame-social",
    data: { url: safePushPath(data.url) },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safePushPath(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(path);
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(path);
  })());
});
