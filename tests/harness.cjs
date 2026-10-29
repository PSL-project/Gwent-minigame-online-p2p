const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '..');
const peers = new Map();
class Connection extends EventEmitter {
  constructor(peer) { super(); this.peer = peer; this.open = false; }
  send(data) { if (this.open) { const copy = structuredClone(data); queueMicrotask(() => { if (this.other.open) this.other.emit('data', copy); }); } }
  close() { if (!this.open) return; this.open = false; this.emit('close'); if (this.other.open) { this.other.open = false; this.other.emit('close'); } }
}
class FakePeer extends EventEmitter {
  constructor(id) { super(); this.id = id; this.open = false; this.connections = [];
    queueMicrotask(() => { if (peers.has(id)) this.emit('error', { type: 'unavailable-id' }); else { peers.set(id, this); this.open = true; this.emit('open', id); } });
  }
  connect(id) {
    const a = new Connection(id), b = new Connection(this.id); a.other = b; b.other = a;
    queueMicrotask(() => {
      const remote = peers.get(id);
      if (!remote) { this.emit('error', { type: 'peer-unavailable' }); return; }
      this.connections.push(a); remote.connections.push(b); remote.emit('connection', b);
      a.open = b.open = true; b.emit('open'); a.emit('open');
    }); return a;
  }
  reconnect() { this.disconnected = false; this.open = true; peers.set(this.id, this); this.emit('open', this.id); }
  destroy() { this.connections.forEach(c => c.close()); peers.delete(this.id); this.open = false; this.destroyed = true; }
}
function client() {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { url: 'https://gwent.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, ctx = dom.getInternalVMContext();
  Object.defineProperty(w.crypto, 'subtle', { value: require('node:crypto').webcrypto.subtle });
  w.Peer = FakePeer; w.alert = message => { throw Error('Alert: ' + message); }; w.confirm = () => true;
  w.Audio = class { constructor() { this.volume = 1; } play() { return Promise.resolve(); } pause() {} addEventListener() {} };
  const run = code => vm.runInContext(code, ctx);
  for (const file of ['common.js', 'cards.js', 'decks.js', 'abilities.js', 'factions.js', 'gwent.js', 'online/protocol.js', 'online/transport.js', 'online/engine.js', 'online/native-ui.js', 'online/app.js', 'online/legacy-events.js']) run(fs.readFileSync(path.join(root, file), 'utf8'));
  run(`sleep = () => Promise.resolve();
    sleepUntil = predicate => new Promise(resolve => { const timer = setInterval(() => { if (predicate()) { clearInterval(timer); resolve(); } }, 1); });
    translateTo = async () => {}; translate = async () => {};
    fadeIn = async elem => elem.classList.remove('hide'); fadeOut = async elem => elem.classList.add('hide');
    Card.prototype.animate = async () => {}; AudioManager.playSFX = async () => {};
    ui.notification = async () => {}; userInteracted = false;`);
  const result = { dom, w, run, close() { w.onlineApp.engine?.stop(); w.onlineApp.session?.close(); result.authority?.close(); dom.window.close(); } };
  w.onlineApp.createAuthority = async () => {
    result.authority = client();
    return result.authority.w;
  };
  return result;
}
async function wait(predicate, description, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await new Promise(r => setTimeout(r, 5)); }
  throw Error('Timed out: ' + description);
}
module.exports = { client, wait, FakePeer, peers };
