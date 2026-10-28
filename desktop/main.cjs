'use strict';
const { app, BrowserWindow, Menu, session, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
protocol.registerSchemesAsPrivileged([{ scheme: 'gwent', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
app.enableSandbox();
let window;
app.whenReady().then(() => {
  const root = app.getAppPath();
  const allowed = new Set(['index.html', 'common.js', 'cards.js', 'decks.js', 'abilities.js', 'factions.js', 'gwent.js', 'style.css']);
  protocol.handle('gwent', request => {
    const url = new URL(request.url);
    let relative;
    try { relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'; }
    catch { return new Response('', { status: 400 }); }
    const target = path.resolve(root, relative);
    const inside = target.startsWith(root + path.sep);
    if (url.host !== 'app' || !inside || !(allowed.has(relative) || /^(online|img|sfx|svg|vendor)\//.test(relative)) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return new Response('', { status: 404 });
    return net.fetch(pathToFileURL(target).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    callback(permission === 'clipboard-sanitized-write' && details.requestingUrl.startsWith('gwent://app/'));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => permission === 'clipboard-sanitized-write' && origin === 'gwent://app');
  const create = () => {
    window = new BrowserWindow({ width: 1440, height: 1000, minWidth: 1024, minHeight: 720, backgroundColor: '#080706', title: 'Gwent Classic Online', show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.once('ready-to-show', () => window.show());
    window.loadURL('gwent://app/index.html');
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Game', submenu: [{ role: 'quit' }] },
    { label: 'View', submenu: [{ role: 'togglefullscreen', accelerator: 'F11' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] }
  ]));
  create();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) create(); });
});
app.on('window-all-closed', () => app.quit());
