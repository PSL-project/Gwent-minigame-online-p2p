/* Shared lifecycle safety: preserve credentials, close suspended transport, retry. */
'use strict';
if (window.Capacitor?.isNativePlatform()) {
  document.documentElement.classList.add('native-mobile');
  document.addEventListener('visibilitychange', () => {
    const app = window.onlineApp;
    if (!app?.session) return;
    if (document.hidden) app.session.conn?.close();
    else app.session.retry();
  });
  window.addEventListener('online', () => window.onlineApp?.session?.retry());
}
