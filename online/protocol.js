/* Shared protocol and deck validation. No dependencies; also exercised in Node. */
(function (root) {
  'use strict';
  const VERSION = '1.0.0';
  const PROTOCOL = 1;
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
  const isToken = v => typeof v === 'string' && /^[a-f0-9]{48}$/.test(v);
  async function proof(secret, text) {
    const bytes = value => Uint8Array.from(value, c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', bytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes(text))), b => b.toString(16).padStart(2, '0')).join('');
  }
  function invitation(code) {
    if (typeof code !== 'string' || !/^GC1-[a-f0-9]{48}-[a-f0-9]{48}$/.test(code.trim())) throw Error('Invalid invitation code. Paste the full GC1 code.');
    const [, id, secret] = code.trim().split('-');
    return { id: 'gc-' + id, secret };
  }
  function envelope(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 262144) throw Error('Invalid network message');
    if (value.protocol !== PROTOCOL || value.version !== VERSION) throw Error('Incompatible version. Both players must use ' + VERSION + '.');
    if (typeof value.type !== 'string' || value.type.length > 32) throw Error('Invalid message type');
    return value;
  }
  function deck(value, cards, factions) {
    if (!value || !Object.hasOwn(factions, value.faction) || !Number.isInteger(value.leader) || !Array.isArray(value.cards) || value.cards.length > cards.length) throw Error('Invalid deck');
    const leader = cards[value.leader];
    if (!leader || leader.row !== 'leader' || leader.deck !== value.faction) throw Error('Invalid leader');
    let units = 0, special = 0;
    const seen = new Set();
    const result = value.cards.map(pair => {
      if (!Array.isArray(pair) || pair.length !== 2) throw Error('Invalid card entry');
      const [index, count] = pair, card = cards[index];
      if (!Number.isInteger(index) || !card || seen.has(index) || !Number.isInteger(count) || count < 1 || count > Number(card.count) || card.row === 'leader') throw Error('Invalid card count');
      if (![value.faction, 'neutral', 'weather', 'special'].includes(card.deck)) throw Error('Card belongs to another faction');
      seen.add(index);
      if (card.deck === 'weather' || card.deck === 'special') special += count; else units += count;
      return [index, count];
    });
    if (units < 22 || special > 10) throw Error('Use at least 22 units and at most 10 special/weather cards.');
    return { faction: value.faction, leader: value.leader, cards: result };
  }
  class Capabilities {
    constructor() { this.revision = 0; this.entries = new Map(); }
    clear() { ++this.revision; this.entries.clear(); }
    add(actor, description, run) {
      const id = token(); this.entries.set(id, { actor, run });
      return { id, ...description };
    }
    take(actor, revision, id) {
      const entry = this.entries.get(id);
      if (revision !== this.revision || !entry || entry.actor !== actor) throw Error('Stale or illegal action');
      this.clear(); return entry.run;
    }
  }
  const api = { VERSION, PROTOCOL, token, isToken, proof, invitation, envelope, deck, Capabilities };
  if (typeof module !== 'undefined') module.exports = api; else root.GwentProtocol = api;
})(globalThis);
