self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/#panel-general";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const current = clients.find((client) => "focus" in client);
      if (current) {
        current.navigate(target);
        return current.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
