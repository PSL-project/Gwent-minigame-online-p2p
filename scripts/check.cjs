const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sources = fs.readdirSync('.').filter(f => f.endsWith('.js')).concat(...['online', 'desktop', 'scripts'].map(dir => fs.readdirSync(dir).filter(f => /\.(c?js)$/.test(f)).map(f => path.join(dir, f))));
for (const f of sources) execFileSync(process.execPath, ['--check', f]);
for (const f of ['img/board.jpg', 'vendor/peerjs.min.js', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) if (!fs.existsSync(f)) throw Error('Missing bundled file: ' + f);
const pkg = require('../package.json');
if (pkg.version !== require('../online/protocol.js').VERSION) throw Error('App/protocol version mismatch');
console.log('Syntax, bundled entry assets and version checks passed (' + sources.length + ' files).');
