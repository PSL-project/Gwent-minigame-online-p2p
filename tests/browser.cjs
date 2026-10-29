/* Graphical browser + real PeerJS/WebRTC integration. Local signaling is test-only. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { PeerServer } = require('peer');
const root = path.resolve(__dirname, '..');
const { clickAction, specialScenarios } = require('./native-browser.cjs');
(async () => {
  const server = http.createServer((req, res) => {
    const target = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { res.setHeader('content-type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' })[path.extname(target)] || 'application/octet-stream'); res.end(fs.readFileSync(target)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const peerServer = await new Promise(resolve => PeerServer({ port: 0, host: '127.0.0.1', path: '/test' }, resolve));
  const port = peerServer.address().port;
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true });
  const errors = [];
  let hostContext, guestContext;
  try {
    // First exercise unchanged single-player UI with the actual production CSP.
    const solo = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    solo.on('pageerror', e => errors.push(e.message));
    await solo.goto(base + '/index.html');
    await solo.locator('#mode-single').click();
    await solo.evaluate(() => dm.loadPlayerDeck(JSON.parse(premade_deck[0]), false));
    await solo.locator('#start-game').click();
    await solo.locator('#carousel:not(.hide)').waitFor({ timeout: 30000 });
    // Inline handlers were removed; real event handlers allow mulligan selection.
    await solo.locator('#carousel > div:first-child').click({ position: { x: 1, y: 1 } });
    await solo.waitForFunction(() => !Carousel.curr, { timeout: 10000 });
    assert.equal(await solo.evaluate(() => player_op.controller instanceof ControllerAI), true);
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await solo.screenshot({ path: path.join(root, 'test-results/single-player.png') });
    await solo.close();
    // Allow local test signaling while leaving production CSP untouched on disk.
    hostContext = await browser.newContext({ bypassCSP: true, viewport: { width: 1440, height: 1000 } });
    guestContext = await browser.newContext({ bypassCSP: true, viewport: { width: 1440, height: 1000 } });
    if (process.env.SIMULATE_WEBRTC) await require('./browser-network.cjs')([hostContext, guestContext]);
    const host = await hostContext.newPage(), guest = await guestContext.newPage();
    for (const page of [host, guest]) {
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', msg => { if (msg.type() === 'error') console.log('Browser error:', msg.text()); });
      await page.goto(base + '/index.html');
      await page.evaluate(port => {
        const RealPeer = window.Peer;
        window.Peer = window.TestPeer || class extends RealPeer {
          constructor(id, options) { super(id, { ...options, host: '127.0.0.1', port, path: '/test', secure: false, debug: 0, config: { iceServers: [] } }); }
        };
        sleep = () => Promise.resolve(); translateTo = async () => {}; Card.prototype.animate = async () => {};
        AudioManager.playSFX = async () => {}; ui.notification = async () => {};
        dm.loadPlayerDeck(JSON.parse(premade_deck[0]), false);
      }, port);
    }
    await host.locator('#mode-host').click();
    await host.waitForFunction(() => document.querySelector('#online-invitation').value.startsWith('GC1-'));
    const invite = await host.locator('#online-invitation').inputValue();
    await guest.locator('#online-code').fill(invite); await guest.locator('#mode-join').click();
    try { await host.waitForFunction(() => onlineApp.session.connected, null, { timeout: 20000 }); }
    catch (e) {
      for (const page of [host, guest]) console.log(await page.evaluate(() => ({ status: document.getElementById('online-status').textContent, error: onlineApp.session.peer.disconnected, pending: [...onlineApp.session.pending].map(c => ({ open: c.open, state: c.peerConnection?.connectionState, ice: c.peerConnection?.iceConnectionState, signal: c.peerConnection?.signalingState })) })));
      throw e;
    }
    await guest.waitForFunction(() => onlineApp.session.connected);
    assert.equal(await host.evaluate(() => onlineApp.session.conn.dataChannel.readyState), 'open');
    await host.locator('#online-ready').click(); await guest.locator('#online-ready').click();
    await host.waitForFunction(() => onlineApp.engine?.prompt);
    // Both players redraw an actual illustrated card, then keep the rest.
    for (const page of [host, guest]) {
      await page.locator('#carousel:not(.hide)').waitFor();
      await page.locator('#carousel > div:first-child > .card-lg').nth(2).click();
      await page.waitForFunction(() => document.querySelector('#native-choice-done:not([hidden])') && onlineApp.latest.actions.some(a => a.kind === 'choice'));
      await page.locator('#native-choice-done').click();
    }
    await host.waitForFunction(() => onlineApp.engine.ready);
    await host.screenshot({ path: path.join(root, 'test-results/online-host.png') });
    await guest.screenshot({ path: path.join(root, 'test-results/online-guest.png') });
    await specialScenarios(host, guest);
    // Disconnect a real RTC channel and resume using the preserved credentials.
    await guest.evaluate(() => { clearInterval(onlineApp.session.timer); onlineApp.session.conn.close(); });
    await host.waitForFunction(() => onlineApp.paused);
    await guest.locator('#online-retry').click();
    await host.waitForFunction(() => !onlineApp.paused);
    await guest.waitForFunction(() => !onlineApp.paused);
    // Complete the match by clicking original hand cards, board rows and Pass.
    for (let n = 0; n < 180; n++) {
      await host.waitForFunction(() => onlineApp.latest?.state === 'complete' || onlineApp.engine.fault || onlineApp.engine.actions.some(a => a.length));
      const decision = await host.evaluate(() => {
        const e = onlineApp.engine;
        if (e.fault) throw Error(e.fault);
        if (onlineApp.latest.state === 'complete') return null;
        const actor = e.actions[0].length ? 0 : 1;
        const a = e.actions[actor].find(a => a.kind === 'play') || e.actions[actor].find(a => a.kind === 'pass') || e.actions[actor][0];
        return { actor, action: a, revision: e.caps.revision };
      });
      if (!decision) break;
      const page = decision.actor ? guest : host;
      await page.waitForFunction(r => onlineApp.latest.revision === r, decision.revision);
      await clickAction(page, decision.action, decision.actor);
      await host.waitForFunction(r => onlineApp.engine.caps.revision !== r, decision.revision);
    }
    await guest.waitForFunction(() => onlineApp.latest.state === 'complete');
    assert.equal(await guest.evaluate(() => onlineApp.latest.players[0].hand), null);
    assert.deepEqual(await guest.evaluate(() => onlineApp.latest.history), await host.evaluate(() => onlineApp.latest.history));
    assert.equal(await host.locator('#online-dock, .online-actions').count(), 0);
    assert.equal(await guest.locator('#online-dock, .online-actions').count(), 0);
    await host.locator('#end-screen button:visible').click();
    await host.waitForFunction(() => window.onlineApp?.native && onlineApp.session === null && !onlineApp.playing);
    await host.locator('#mode-host').waitFor();
    await host.locator('#mode-single').click();
    await host.evaluate(() => dm.loadPlayerDeck(JSON.parse(premade_deck[0]), false));
    await host.locator('#start-game').click();
    await host.locator('#carousel:not(.hide)').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: production-CSP single-player UI, two browser contexts with ' + (process.env.SIMULATE_WEBRTC ? 'simulated transport' : 'real PeerJS/WebRTC') + ', native graphical card/row/Pass controls, redraw, complete match, disconnect/resync and starting another game.');
  } finally {
    await hostContext?.close(); await guestContext?.close(); await browser.close(); peerServer.close(); server.close();
  }
})().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
