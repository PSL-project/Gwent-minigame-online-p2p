const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../online/protocol.js');
const { client } = require('./harness.cjs');
test('cryptographic invitations parse strictly and version mismatch is rejected', () => {
  const a = P.token(), b = P.token(); assert.notEqual(a, b); assert.equal(a.length, 48);
  assert.deepEqual(P.invitation('GC1-' + a + '-' + b), { id: 'gc-' + a, secret: b });
  for (const bad of ['GC1-x-y', '<script>', '', null]) assert.throws(() => P.invitation(bad));
  assert.throws(() => P.envelope({ protocol: 1, version: '0', type: 'hello' }), /Incompatible/);
  assert.throws(() => P.envelope({ protocol: 1, version: P.VERSION, type: 'x', data: 'x'.repeat(262144) }));
});
test('actions bind actor and revision and can only be consumed once', () => {
  const caps = new P.Capabilities(); let called = 0;
  const a = caps.add(1, { label: 'play' }, () => called++), revision = caps.revision;
  assert.throws(() => caps.take(0, revision, a.id));
  assert.throws(() => caps.take(1, revision + 1, a.id));
  caps.take(1, revision, a.id)(); assert.equal(called, 1);
  assert.throws(() => caps.take(1, revision, a.id));
});
test('deck validation rejects duplicates, foreign factions, generated cards and bad counts', () => {
  const c = client();
  try {
    const valid = c.run('JSON.parse(premade_deck[0])');
    const cards = c.w.card_dict, factions = c.w.factions;
    assert.equal(P.deck(valid, cards, factions).faction, 'realms');
    for (const mutate of [d => d.cards.push(d.cards[0]), d => d.cards[0][1] = -1, d => d.cards[0][1] = 999, d => d.cards.push([21, 1]), d => d.leader = 59, d => d.cards = [], d => d.faction = '__proto__', d => d.cards.push([62, 1])]) {
      const invalid = structuredClone(valid); mutate(invalid); assert.throws(() => P.deck(invalid, cards, factions));
    }
  } finally { c.close(); }
});
