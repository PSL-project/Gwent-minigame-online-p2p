/* Two isolated DOM clients using the actual app, transport and original rules.
   Only PeerJS delivery and animation/audio timing are simulated. */
const assert = require('node:assert/strict');
const { client, wait } = require('./harness.cjs');
async function pair(hostDeck = 0, guestDeck = 2) {
  const host = client(), guest = client();
  host.run(`dm.loadPlayerDeck(JSON.parse(premade_deck[${hostDeck}]), false)`);
  guest.run(`dm.loadPlayerDeck(JSON.parse(premade_deck[${guestDeck}]), false)`);
  await host.w.onlineApp.connect('host');
  guest.w.document.getElementById('online-code').value = host.w.document.getElementById('online-invitation').value;
  await guest.w.onlineApp.connect('guest');
  await wait(() => host.w.onlineApp.session.connected && guest.w.onlineApp.session.connected, 'two app clients connect');
  host.w.onlineApp.setReady(); guest.w.onlineApp.setReady();
  await wait(() => host.w.onlineApp.playing && host.w.onlineApp.engine?.prompt, 'ready starts mulligan');
  return { host, guest, close() { host.close(); guest.close(); } };
}
async function step(host, guest, choose) {
  await wait(() => host.w.onlineApp.engine.fault || host.w.onlineApp.latest?.state === 'complete' || host.w.onlineApp.engine.actions.some(a => a.length), 'next decision');
  assert.equal(host.w.onlineApp.engine.fault, undefined);
  const e = host.w.onlineApp.engine;
  const actor = e.actions[0].length ? 0 : 1;
  const actions = e.actions[actor];
  if (!actions.length) return false;
  const a = choose(actions, actor, !!e.prompt) || actions[0];
  const revision = e.caps.revision;
  (actor ? guest : host).w.onlineApp.act(revision, a.id);
  await wait(() => e.caps.revision !== revision, 'action accepted');
  return true;
}
(async () => {
  let count = 0;
  const p = await pair();
  try {
    const { host: h, guest: g } = p;
    await step(h, g, a => a.find(x => /Done/.test(x.label)));
    await step(h, g, a => a.find(x => /Done/.test(x.label)));
    await wait(() => h.w.onlineApp.engine.ready, 'initial turn');
    const e = h.w.onlineApp.engine;
    const hostView = JSON.parse(JSON.stringify(e.view(0))), guestView = JSON.parse(JSON.stringify(e.view(1)));
    g.w.onlineApp.renderGuest(guestView);
    assert.ok(g.w.document.querySelector('#leader-me .card'));
    assert.equal(g.w.document.querySelector('#hand-row').children.length, guestView.players[1].handCount);
    assert.equal(hostView.players[1].hand, null); assert.equal(guestView.players[0].hand, null);
    assert.equal('deck' in guestView.players[0], false); assert.equal('deck_data' in guestView.players[0], false);
    assert.ok(!JSON.stringify(guestView).includes('deck_data')); g.w.onlineApp.validateView(guestView);
    const before = e.caps.revision;
    await assert.rejects(() => e.act(1 - h.run('game.currPlayer.id'), before, e.actions[h.run('game.currPlayer.id')][0].id), /illegal/);
    assert.equal(e.caps.revision, before);
    // Drop live channel. No action may mutate state while paused.
    const state = JSON.stringify(e.view(1));
    clearInterval(g.w.onlineApp.session.timer); g.w.onlineApp.session.conn.close();
    assert.equal(h.w.onlineApp.paused, true); assert.equal(g.w.onlineApp.paused, true);
    const actor = h.run('game.currPlayer.id');
    await assert.rejects(() => e.act(actor, before, e.actions[actor][0].id), /paused/);
    assert.equal(e.caps.revision, before);
    g.w.onlineApp.session.retry();
    await wait(() => !h.w.onlineApp.paused && !g.w.onlineApp.paused, 'reconnect app');
    await wait(() => g.w.onlineApp.latest?.revision === before, 'guest resynchronizes');
    assert.equal(JSON.stringify(e.view(1)), state);
    // Complete a nontrivial game: use leaders, play cards and resolve nested choices.
    const usedLeaders = new Set(); let plays = 0;
    for (let n = 0; n < 180 && h.w.onlineApp.latest.state !== 'complete'; ++n) {
      await step(h, g, (actions, actor, prompt) => {
        if (prompt) return actions.find(x => /Done/.test(x.label)) || actions[0];
        const leader = actions.find(x => x.kind === 'leader');
        if (leader && !usedLeaders.has(actor)) { usedLeaders.add(actor); return leader; }
        const play = actions.find(x => x.kind === 'play');
        if (play && plays++ < 60) return play;
        return actions.find(x => x.kind === 'pass');
      });
      ++count;
    }
    await wait(() => h.w.onlineApp.latest.state === 'complete', 'complete match');
    await wait(() => g.w.onlineApp.latest?.state === 'complete', 'guest receives completion');
    assert.deepEqual(JSON.parse(JSON.stringify(g.w.onlineApp.latest.history)), JSON.parse(JSON.stringify(e.view(1).history)));
    assert.ok(e.view(1).history.length >= 2); assert.ok(plays > 0);
    console.log('PASS: two clients, lobby, validated decks, human decisions, complete match (' + count + ' actions), hidden views, illegal actions, pause, credential recovery and state resync.');
  } finally { p.close(); }
  // Exercise all five factions with the same real rules.
  for (const decks of [[4, 6], [8, 0]]) {
    const q = await pair(...decks);
    try {
      for (let n = 0; n < 150 && q.host.w.onlineApp.latest?.state !== 'complete'; n++) {
        await step(q.host, q.guest, (actions, actor, prompt) => prompt ? actions.find(x => /Done/.test(x.label)) || actions[0] : actions.find(x => x.kind === 'play') || actions.find(x => x.kind === 'pass'));
      }
      await wait(() => q.host.w.onlineApp.latest.state === 'complete', 'faction match completed');
      console.log('PASS: faction match ' + decks.join(' vs ') + ' completed.');
    } finally { q.close(); }
  }
  const solo = client();
  try {
    solo.run('dm.loadPlayerDeck(JSON.parse(premade_deck[0]), false); dm.startNewGame()');
    await wait(() => solo.run('!!Carousel.curr'), 'single-player mulligan');
    solo.run('Carousel.curr.cancel()');
    await wait(() => solo.run('game.roundCount > 0'), 'single-player begins');
    await wait(() => solo.run('game.currPlayer === player_me'), 'AI gives human a turn');
    assert.equal(solo.run('player_op.controller instanceof ControllerAI'), true);
    for (let n = 0; n < 6 && !solo.run('game.state === GameState.END_SCREEN'); n++) {
      await wait(() => solo.run('game.state === GameState.END_SCREEN || (game.currPlayer === player_me && !player_me.passed && !document.querySelector("main").classList.contains("noclick"))'), 'single player human decision', 15000);
      if (solo.run('game.state === GameState.END_SCREEN')) break;
      const round = solo.run('game.roundCount'); solo.run('player_me.passRound()');
      await wait(() => solo.run('game.state === GameState.END_SCREEN || game.roundCount > ' + round), 'AI finishes round', 15000);
    }
    assert.equal(solo.run('game.state === GameState.END_SCREEN'), true);
    console.log('PASS: complete single-player match with original AI and mulligan.');
  } finally { solo.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
