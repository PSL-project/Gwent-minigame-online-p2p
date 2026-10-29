const test = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('./harness.cjs');
function fixture() {
  const c = client(), app = c.w.onlineApp, sent = [];
  app.session = { connected: true, send: (type, data) => sent.push({ type, data }), close() {} };
  app.role = 'guest'; app.paused = false;
  const token = () => c.w.GwentProtocol.token();
  const card = name => ({ index: c.run(`card_dict.findIndex(d => d.name === ${JSON.stringify(name)})`), power: 4, uid: token() });
  const leader = { index: 0, power: 0, uid: token() };
  leader.index = c.run('card_dict.findIndex(d => d.row === "leader")');
  const one = card('Blue Stripes Commando'), two = card('Blue Stripes Commando');
  const view = {
    uiSchema: 1, revision: 10, state: 'playing', round: 1, turn: 1, fault: null, prompt: null, history: [], weather: [],
    players: [0, 1].map(id => ({ id, faction: 'realms', health: 2, total: 0, passed: false,
      leader: { ...leader, uid: token() }, leaderAvailable: false, handCount: 2, deckCount: 20, hand: id ? [one, two] : null, grave: [] })),
    rows: [0, 1].flatMap(owner => ['close', 'ranged', 'siege'].map(type => ({ owner, type, total: 0, cards: [], special: null, effects: { weather: false, horn: 0 } }))),
    actions: [one, two].map(card => ({ id: token(), kind: 'play', card, label: 'Play', destination: { type: 'row', owner: 1, row: 'close' } }))
  };
  const receive = v => app.receive({ type: 'state', view: structuredClone(v) });
  receive(view);
  return { c, app, view, sent, receive, token };
}
test('native clicks distinguish duplicate cards and dispatch once without local rule mutation', () => {
  const f = fixture();
  try {
    const { c, view, sent } = f;
    const doc = c.w.document;
    doc.querySelectorAll('#hand-row .card')[1].click();
    assert.equal(doc.querySelector('.native-selected').dataset.nativeCard, view.players[1].hand[1].uid);
    assert.equal(doc.querySelector('#field-me [data-row="close"] .row-cards').classList.contains('row-selectable'), true);
    doc.querySelector('#field-op [data-row="close"] .row-cards').click();
    assert.equal(sent.length, 0, 'illegal opposing row cannot submit');
    doc.querySelector('#field-me [data-row="close"] .row-cards').click();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].data.id, view.actions[1].id);
    doc.querySelector('#field-me [data-row="close"] .row-cards').click();
    assert.equal(sent.length, 1, 'pending submission is locked');
    assert.equal(doc.querySelectorAll('#field-me .card').length, 0, 'no speculative board mutation');
    assert.equal(c.run('player_me'), undefined, 'guest never constructs rules players');
    assert.equal(doc.querySelector('#online-dock'), null);
    assert.equal(doc.querySelectorAll('#hand-op .card, #deck-op [data-native-card]').length, 0);
  } finally { f.c.close(); }
});
test('paused and out-of-turn native controls inspect cards but cannot play or pass', () => {
  const f = fixture();
  try {
    f.view.actions = []; f.view.turn = 0; f.view.revision++;
    f.receive(f.view);
    f.c.w.document.querySelector('#hand-row .card').click();
    assert.equal(f.c.w.document.querySelector('.card-preview').classList.contains('hide'), false);
    assert.equal(f.c.w.document.querySelector('.native-selected'), null);
    f.c.w.document.querySelector('#pass-button').click();
    assert.equal(f.sent.length, 0);
    f.app.paused = true; f.app.refresh();
    f.c.w.document.querySelector('#hand-row .card').click();
    f.c.w.document.querySelector('#field-me .row-cards').click();
    assert.equal(f.sent.length, 0);
    assert.equal(f.c.w.document.querySelector('#pass-button').getAttribute('aria-disabled'), 'true');
  } finally { f.c.close(); }
});
test('stale projections are ignored and malformed native permissions are rejected', () => {
  const f = fixture();
  try {
    const legacy = structuredClone(f.view); delete legacy.uiSchema;
    assert.throws(() => f.app.validateView(legacy), /Incompatible gameplay interface/);
    const stale = structuredClone(f.view); stale.revision--;
    f.receive(stale); assert.equal(f.app.latest.revision, f.view.revision);
    const broken = structuredClone(f.view); delete broken.actions[0].card;
    assert.throws(() => f.app.validateView(broken), /Invalid actions/);
    broken.actions = []; broken.players[0].hand = broken.players[1].hand;
    assert.throws(() => f.app.validateView(broken), /Invalid player/);
    const malformed = structuredClone(f.view); malformed.actions[0].destination = { type: 'row', owner: 42, row: 'close' };
    assert.throws(() => f.app.validateView(malformed), /Invalid actions/);
  } finally { f.c.close(); }
});
test('network prompt and option strings are rendered as text in original dialogs', () => {
  const f = fixture();
  try {
    const attack = '<img src=x onerror="alert(1)">';
    f.view.revision++; f.view.prompt = attack;
    f.view.actions = [{ id: f.token(), kind: 'choice', label: attack, card: null, destination: null }];
    f.receive(f.view);
    assert.equal(f.c.w.document.querySelector('#popup h3').textContent, attack);
    assert.equal(f.c.w.document.querySelector('#popup img'), null);
    f.view.revision++; f.view.actions = [{ id: f.token(), kind: 'choice', label: 'Choose', card: f.view.players[1].hand[0], destination: null }];
    f.receive(f.view);
    assert.equal(f.c.w.document.querySelector('#carousel > div:nth-child(3)').textContent, attack);
    assert.equal(f.c.w.document.querySelector('#carousel img'), null);
    f.receive(f.view);
    assert.equal(f.c.w.document.querySelector('#carousel').classList.contains('hide'), false, 'same-revision sync preserves the pending dialog');
  } finally { f.c.close(); }
});
