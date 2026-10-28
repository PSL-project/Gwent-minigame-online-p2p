const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../online/transport.js');
const { FakePeer, wait } = require('./harness.cjs');
test('two independent sessions authenticate, exchange messages and recover same identity', async () => {
  let hostPaused = 0, received;
  const host = new Session(FakePeer, { pause: () => hostPaused++, message: m => received = m }, { interval: 20, timeout: 100 });
  const guest = new Session(FakePeer, {}, { interval: 20, timeout: 100 });
  try {
    const invite = await host.host(); await guest.join(invite);
    await wait(() => host.connected && guest.connected, 'authentication');
    guest.send('sample', { number: 42 }); await wait(() => received, 'message'); assert.equal(received.number, 42);
    const credential = host.guestCredential; guest.conn.close(); assert.equal(hostPaused, 1);
    await wait(() => host.connected && guest.connected, 'recovery'); assert.equal(host.guestCredential, credential);
  } finally { host.close(); guest.close(); }
});
test('wrong invitation and impostor recovery cannot seize guest seat', async () => {
  const host = new Session(FakePeer, {}, { interval: 20 });
  const guest = new Session(FakePeer, {}, { interval: 20 });
  const intruder = new Session(FakePeer, {}, { interval: 20 });
  try {
    const invite = await host.host(); await guest.join(invite); await wait(() => host.connected, 'guest');
    clearInterval(guest.timer); guest.conn.close();
    await intruder.join(invite); await new Promise(r => setTimeout(r, 50));
    assert.equal(host.connected, false); assert.equal(intruder.connected, false);
    intruder.close(); guest.retry(); await wait(() => host.connected, 'original guest returns');
  } finally { host.close(); guest.close(); intruder.close(); }
});

test('destroyed signaling peers reclaim their original ID without changing the invitation', async () => {
  const host = new Session(FakePeer, {}, { interval: 20 });
  const guest = new Session(FakePeer, {}, { interval: 20 });
  try {
    const invite = await host.host(); await guest.join(invite);
    await wait(() => host.connected && guest.connected, 'initial connection');
    const id = host.hostId;
    host.peer.destroy(); host.peer.id = null; // PeerJS clears .id on destruction.
    await wait(() => host.connected && guest.connected, 'destroyed peer recovered');
    assert.equal(host.peer.id, id); assert.equal(host.peerId, id);
  } finally { host.close(); guest.close(); }
});
