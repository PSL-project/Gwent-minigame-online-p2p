const test = require('node:test');
const assert = require('node:assert/strict');
const { client, wait } = require('./harness.cjs');
async function setup() {
  const c = client();
  c.run(`const data = JSON.parse(premade_deck[0]);
    const deck = { faction: data.faction, leader: card_dict[data.leader], cards: data.cards.map(([index, count]) => ({index, count})) };
    player_me = new Player(0, 'Host', deck); player_op = new Player(1, 'Guest', deck); player_op.controller = new Controller();
    player_me.hand.reset(); player_op.hand.reset();
    game.currPlayer = player_me; game.setState(GameState.PLAYING); game.roundCount = 1;
    const adapter = new OnlineEngine(() => {}, () => true); onlineApp.engine = adapter;
    function unit(name, p = player_me) { return new Card(card_dict.find(c => c.name === name), p); }
    function hand(name, p = player_me) { const c = unit(name, p); p.hand.addCard(c); return c; }
    async function place(name, type = 'close', p = player_me) { const c = unit(name, p); await board.moveTo(c, board.getRow(c, type, p)); return c; }
  `);
  c.runAsync = code => /\bawait\b/.test(code) ? c.run('(async()=>{' + code + '})()') : c.run(code);
  return c;
}
test('original row scoring: bond, horn, morale, weather, heroes and scorch', async () => {
  const c = await setup();
  try {
    await c.runAsync(`place('Blue Stripes Commando')`); await c.runAsync(`place('Blue Stripes Commando')`);
    assert.equal(c.run('board.row[3].total'), 16);
    await c.runAsync(`place("Commander's Horn")`); assert.equal(c.run('board.row[3].total'), 32);
    c.run('player_me.deck.reset()');
    await c.runAsync(`place('Geralt of Rivia')`); assert.equal(c.run('board.row[3].total'), 47);
    await c.runAsync(`const frost = hand('Biting Frost'); await board.moveTo(frost, weather, player_me.hand)`);
    assert.equal(c.run('board.row[3].total'), 23); // two weathered/bonded/horned 4s plus immune hero
    await c.run('weather.clearWeather()'); assert.equal(c.run('board.row[3].total'), 47);
    await c.runAsync(`const scorch = hand('Scorch'); await ability_dict.scorch.activated(scorch)`);
    assert.equal(c.run('board.row[3].total'), 15); assert.equal(c.run('player_me.grave.cards.filter(c => c.name === "Blue Stripes Commando").length'), 2);
    console.log('Scoring/effect assertions used original Row and ability_dict implementations.');
  } finally { c.close(); }
});
test('spy draws two and muster reuses original hand/deck effects', async () => {
  const c = await setup();
  try {
    const before = c.run('player_me.deck.cards.length');
    await c.runAsync(`const spy = hand('Prince Stennis'); await board.moveTo(spy, board.getRow(spy, 'close'), player_me.hand)`);
    assert.equal(c.run('player_me.hand.cards.length'), 2); assert.equal(c.run('player_me.deck.cards.length'), before - 2);
    assert.equal(c.run('board.row[2].cards[0].name'), 'Prince Stennis');
    await c.runAsync(`player_me.deck.reset(); player_me.hand.reset(); hand("Gaunter O'Dimm - Darkness"); hand("Gaunter O'Dimm - Darkness"); const muster = hand("Gaunter O'Dimm"); await board.moveTo(muster, board.getRow(muster, 'siege'), player_me.hand)`);
    assert.equal(c.run('board.row[4].cards.filter(c => c.name.includes("Darkness")).length'), 2);
  } finally { c.close(); }
});
test('human medic choice, agile resurrection and decoy legal targets', async () => {
  const c = await setup();
  try {
    c.run(`player_me.grave.addCard(unit('Olgierd von Everec')); const medic = hand('Yennefer of Vengerberg'); var resolution = board.moveTo(medic, board.getRow(medic, 'ranged'), player_me.hand)`);
    await wait(() => c.run('adapter.prompt?.title.includes("Choose")'), 'medic choice');
    c.run('adapter.act(0, adapter.caps.revision, adapter.actions[0][0].id)');
    await wait(() => c.run('adapter.prompt?.title.includes("row")'), 'agile row choice');
    c.run('adapter.act(0, adapter.caps.revision, adapter.actions[0].find(a=>a.label === "ranged").id)');
    await c.run('resolution'); assert.equal(c.run('board.row[4].cards.some(c => c.name === "Olgierd von Everec")'), true);
    c.run(`hand('Decoy'); adapter.ready = true; adapter.rebuild()`);
    const targets = c.run('adapter.actions[0].filter(a => a.label.startsWith("Decoy"))');
    assert.equal(targets.length, 1); assert.ok(targets[0].label.includes('Olgierd')); // hero medic not a legal target
  } finally { c.close(); }
});
test('every active leader resolves human choices through the original ability', async () => {
  const c = await setup();
  try {
    // Build a representative hand, deck and grave. Explicitly answer every prompt.
    const leaders = c.run('card_dict.map((d,i)=>({d,i})).filter(x=>x.d.row === "leader" && ability_dict[x.d.ability].activated).map(x=>x.i)');
    for (const index of leaders) {
      c.run(`game.reset(); game.roundCount = 2; game.currPlayer = player_me; game.setState(GameState.PLAYING);
        player_me.hand.reset(); player_me.grave.reset(); player_op.hand.reset(); player_op.grave.reset();
        player_me.leader = new Card(card_dict[${index}], player_me);
        player_me.grave.addCard(unit('Olgierd von Everec')); player_op.grave.addCard(unit('Blue Stripes Commando', player_op));
        hand('Blue Stripes Commando'); hand('Biting Frost'); hand('Triss Merigold', player_op);
        var done = false, failure = null;
        ability_dict[card_dict[${index}].ability].activated(player_me.leader).then(()=>done=true).catch(e=>{failure=String(e);done=true});`);
      for (let n = 0; n < 10; n++) {
        await wait(() => c.run('done || !!adapter.prompt'), 'leader decision ' + index);
        if (c.run('done')) break;
        c.run('adapter.act(0, adapter.caps.revision, adapter.actions[0][0].id)');
      }
      await wait(() => c.run('done'), 'leader resolves ' + index);
      assert.equal(c.run('failure'), null, 'leader ' + index);
    }
    console.log('Resolved ' + leaders.length + ' active leader abilities with human choices.');
  } finally { c.close(); }
});

test('empty decks draw safely and Northern Realms waits for its bonus card', async () => {
  const c = await setup();
  try {
    c.run('player_me.deck.reset(); player_op.deck.reset()');
    await c.run('Promise.all([player_me.deck.draw(player_me.hand), player_op.deck.draw(player_op.hand)])');
    assert.equal(c.run('player_me.hand.cards.length + player_op.hand.cards.length'), 0);
    c.run(`player_me.deck.addCard(unit('Blue Stripes Commando'));
      game.roundCount = 2; game.roundHistory = [{winner: player_me}];
      factions.realms.factionAbility(player_me);
      var releaseDraw, resolved = false;
      translateTo = () => new Promise(resolve => releaseDraw = resolve);
      var bonus = game.roundStart[0]().then(() => resolved = true);`);
    await wait(() => c.run('!!releaseDraw'), 'bonus card animation');
    assert.equal(c.run('resolved'), false);
    c.run('releaseDraw()'); await c.run('bonus');
    assert.equal(c.run('player_me.hand.cards.length'), 1);
  } finally { c.close(); }
});
