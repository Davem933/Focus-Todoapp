export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA registrace je doplňková vrstva. Aplikace musí fungovat i bez ní.
    });
  });
}
