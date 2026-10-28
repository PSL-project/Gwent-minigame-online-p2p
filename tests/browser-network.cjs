/* Test-only in-memory signaling/data adapter for environments blocking ICE.
   Production and the default browser test always use the actual PeerJS library. */
const { randomUUID } = require('node:crypto');
async function simulatedNetwork(contexts) {
  const peers = new Map(), connections = new Map();
  async function deliver(page, message) { if (!page.isClosed()) await page.evaluate(m => window.__testNetwork(m), message); }
  for (const context of contexts) {
    await context.exposeBinding('__testCall', async ({ page }, message) => {
      if (message.op === 'register') { peers.set(message.id, page); return; }
      if (message.op === 'connect') {
        const target = peers.get(message.peer), remoteKey = randomUUID();
        if (!target) return;
        connections.set(message.key, { page: target, key: remoteKey });
        connections.set(remoteKey, { page, key: message.key });
        await deliver(target, { type: 'incoming', key: remoteKey, peer: message.from });
        await deliver(target, { type: 'open', key: remoteKey });
        await deliver(page, { type: 'open', key: message.key });
      }
      if (message.op === 'send') { const target = connections.get(message.key); if (target) await deliver(target.page, { type: 'data', key: target.key, data: message.data }); }
      if (message.op === 'close') {
        const target = connections.get(message.key); connections.delete(message.key);
        if (target) { connections.delete(target.key); await deliver(target.page, { type: 'close', key: target.key }); }
      }
    });
    await context.addInitScript(() => {
      const connections = new Map(); let current;
      class Events {
        constructor() { this.handlers = new Map(); }
        on(event, fn) { if (!this.handlers.has(event)) this.handlers.set(event, []); this.handlers.get(event).push(fn); return this; }
        emit(event, value) { for (const fn of this.handlers.get(event) || []) fn(value); }
      }
      class Connection extends Events {
        constructor(peer, key = crypto.randomUUID()) { super(); this.peer = peer; this.key = key; this.open = false; connections.set(key, this); this.dataChannel = { readyState: 'connecting' }; }
        send(data) { window.__testCall({ op: 'send', key: this.key, data }); }
        close() { if (!this.open) return; this.open = false; this.dataChannel.readyState = 'closed'; this.emit('close'); window.__testCall({ op: 'close', key: this.key }); }
      }
      window.TestPeer = class extends Events {
        constructor(id) { super(); current = this; this.id = id; this.open = false; window.__testCall({ op: 'register', id }).then(() => { this.open = true; this.emit('open', id); }); }
        connect(peer) { const c = new Connection(peer); window.__testCall({ op: 'connect', peer, from: this.id, key: c.key }); return c; }
        destroy() { this.destroyed = true; this.open = false; for (const c of connections.values()) c.close(); }
      };
      window.__testNetwork = m => {
        if (m.type === 'incoming') { current.emit('connection', new Connection(m.peer, m.key)); return; }
        const c = connections.get(m.key); if (!c) return;
        if (m.type === 'open') { c.open = true; c.dataChannel.readyState = 'open'; c.emit('open'); }
        if (m.type === 'data') c.emit('data', m.data);
        if (m.type === 'close') { c.open = false; c.dataChannel.readyState = 'closed'; c.emit('close'); }
      };
    });
  }
}
module.exports = simulatedNetwork;
