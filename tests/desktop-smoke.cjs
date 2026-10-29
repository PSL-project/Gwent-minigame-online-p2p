const { _electron: electron } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const target = process.argv[2];
  const app = await electron.launch(target ? { executablePath: path.resolve(target) } : { args: ['.'] });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => window.onlineApp?.native);
    await page.locator('#mode-single').waitFor();
    if (await page.evaluate(() => typeof require !== 'undefined' || typeof process !== 'undefined')) throw Error('Node exposed to renderer');
    await page.locator('#mode-single').click();
    await page.locator('#deck-customization').waitFor();
    const loaded = await page.evaluate(async () => (await fetch('img/board.jpg')).ok);
    if (!loaded) throw Error('Packaged board asset unavailable');
    const traversal = await page.evaluate(async () => (await fetch('gwent://app/package.json')).status);
    if (traversal !== 404) throw Error('Desktop protocol exposed non-game files');
    // Exercise the actual bundled secure protocol and host rules iframe, with
    // test-only delivery. This check does not depend on an external PeerJS service.
    const context = app.context();
    await require('./browser-network.cjs')([context]);
    await page.reload();
    await app.evaluate(async ({ BrowserWindow }) => {
      const guest = new BrowserWindow({ show: true, width: 1440, height: 1000,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false } });
      await guest.loadURL('gwent://app/index.html');
    });
    const guest = context.pages().find(p => p !== page);
    await guest.locator('#mode-host').waitFor();
    for (const p of [page, guest]) await p.evaluate(() => {
      window.Peer = window.TestPeer;
      dm.loadPlayerDeck(JSON.parse(premade_deck[0]), false);
    });
    await page.locator('#mode-host').click();
    await page.waitForFunction(() => document.querySelector('#online-invitation').value.startsWith('GC1-'));
    await guest.locator('#online-code').fill(await page.locator('#online-invitation').inputValue());
    await guest.locator('#mode-join').click();
    await page.waitForFunction(() => onlineApp.session.connected);
    await page.locator('#online-ready').click(); await guest.locator('#online-ready').click();
    for (const p of [page, guest]) await p.locator('#native-choice-done').click();
    await page.waitForFunction(() => onlineApp.engine.ready);
    const actor = await page.evaluate(() => onlineApp.latest.turn), active = actor ? guest : page;
    const uid = await active.evaluate(() => onlineApp.latest.actions.find(a => a.kind === 'play').card.uid);
    await active.locator('#hand-row [data-native-card="' + uid + '"]').click();
    assert.equal(await active.locator('.native-selected').count(), 1);
    assert.equal(await active.locator('.row-selectable, .native-target').count() > 0, true);
    assert.equal(await page.locator('#online-dock, .online-actions').count(), 0);
    assert.equal(await guest.evaluate(() => typeof require !== 'undefined' || typeof process !== 'undefined'), false);
    console.log('Desktop started; bundled assets, renderer isolation, protocol allowlist, host rules iframe and native multiplayer screens verified.');
  } finally {
    for (const p of app.context().pages()) await p.evaluate(() => { if (window.onlineApp) onlineApp.playing = false; }).catch(() => {});
    await app.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
