const { _electron: electron } = require('playwright');
const path = require('node:path');
(async () => {
  const target = process.argv[2];
  const app = await electron.launch(target ? { executablePath: path.resolve(target) } : { args: ['.'] });
  try {
    const page = await app.firstWindow();
    await page.locator('#mode-single').waitFor();
    if (await page.evaluate(() => typeof require !== 'undefined' || typeof process !== 'undefined')) throw Error('Node exposed to renderer');
    await page.locator('#mode-single').click();
    await page.locator('#deck-customization').waitFor();
    const loaded = await page.evaluate(async () => (await fetch('img/board.jpg')).ok);
    if (!loaded) throw Error('Packaged board asset unavailable');
    const traversal = await page.evaluate(async () => (await fetch('gwent://app/package.json')).status);
    if (traversal !== 404) throw Error('Desktop protocol exposed non-game files');
    console.log('Desktop started, bundled assets loaded, renderer isolation and protocol allowlist verified.');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
