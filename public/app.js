// =======================================================
// 🔐 PWA ENGINE WORKSPACE SERVICE WORKER HANDSHAKE
// =======================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('Core Service Worker linked successfully to active workspace route.', reg);
        
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New update cache pipeline available.');
              }
            };
          }
        };
      })
      .catch(err => console.error('Workspace pipeline service worker validation crash:', err));
  });
}
