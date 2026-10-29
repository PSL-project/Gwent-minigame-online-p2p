const assert = require('node:assert/strict');
async function clickAction(page, a, actor) {
  const row = d => page.locator('#field-' + (d.owner === actor ? 'me' : 'op') + ' [data-row="' + d.row + '"] .row-cards');
  if (a.kind === 'play') {
    await page.locator('#hand-row [data-native-card="' + a.card.uid + '"]').click();
    assert.equal(await page.locator('#hand-row .native-selected').count(), 1);
    if (a.destination.type === 'card') await page.locator('.field [data-native-card="' + a.destination.uid + '"]').click();
    else if (a.destination.type === 'weather') await page.locator('#weather').click({ position: { x: 4, y: 4 } });
    else if (a.destination.type === 'any-row') await page.locator('#field-me .row-cards').first().click({ position: { x: 4, y: 4 } });
    else await row(a.destination).click({ position: { x: 4, y: 4 } });
  } else if (a.kind === 'pass') await page.locator('#pass-button').click();
  else if (a.kind === 'leader') {
    await page.locator('#leader-me').click();
    await page.locator('#carousel > div:first-child > .card-lg').nth(2).click();
  } else if (a.card) {
    const index = await page.evaluate(id => onlineApp.latest.actions.filter(a => a.card).findIndex(a => a.id === id), a.id);
    for (let i = 0; i < index; i++) await page.locator('#carousel > div:first-child > .card-lg').nth(3).click();
    await page.locator('#carousel > div:first-child > .card-lg').nth(2).click();
  } else if (a.destination) await row(a.destination).click({ position: { x: 4, y: 4 } });
  else {
    const done = page.locator('#native-choice-done:not([hidden])');
    if (await done.count() && await done.isVisible()) await done.click();
    else await page.locator('#popup').getByRole('button', { name: a.label, exact: true }).click();
  }
}
// A test-only fixture runs in the real isolated rules iframe. No production hooks.
async function stage(host, actor, code) {
  await host.evaluate(async ({ actor, code }) => {
    const w = onlineApp.authorityFrame.contentWindow;
    await w.eval(`(async () => {
      const adapter = onlineApp.engine;
      adapter.ready = false; adapter.caps.clear(); adapter.actions = [[], []]; adapter.prompt = null;
      game.reset();
      for (const p of [player_me, player_op]) { p.hand.reset(); p.grave.reset(); p.deck.reset(); p.health = 2; p.total = 0; p.setPassed(false); p.disableLeader(); }
      game.roundCount = 1; game.setState(GameState.PLAYING);
      game.currPlayer = ${actor} ? player_op : player_me;
      const p = game.currPlayer, other = p.opponent();
      const unit = (name, holder = p) => new Card(card_dict.find(c => c.name === name), holder);
      const hand = (name, holder = p) => { const c = unit(name, holder); holder.hand.addCard(c); return c; };
      const place = async (name, type = 'close', holder = p) => { const c = unit(name, holder); await board.moveTo(c, board.getRow(c, type, holder)); return c; };
      hand('Triss Merigold', other);
      ${code}
      adapter.ready = true; adapter.rebuild(); adapter.sync();
    })()`);
  }, { actor, code });
}
async function next(host, guest, actor, predicate) {
  await host.waitForFunction(() => onlineApp.engine.actions.some(a => a.length) || onlineApp.engine.fault);
  const decision = await host.evaluate(({ actor, predicate }) => {
    if (onlineApp.engine.fault) throw Error(onlineApp.engine.fault);
    const action = onlineApp.engine.actions[actor].find(new Function('a', 'return ' + predicate));
    if (!action) throw Error('Expected action: ' + predicate);
    return { action, revision: onlineApp.engine.caps.revision };
  }, { actor, predicate });
  const page = actor ? guest : host;
  await page.waitForFunction(r => onlineApp.latest?.revision === r, decision.revision);
  await clickAction(page, decision.action, actor);
  await host.waitForFunction(r => onlineApp.engine.caps.revision !== r && (onlineApp.engine.actions.some(a => a.length) || onlineApp.latest.state === 'complete' || onlineApp.engine.fault), decision.revision);
  return decision;
}
async function rules(host, expression) {
  return host.evaluate(expression => onlineApp.authorityFrame.contentWindow.eval(expression), expression);
}
async function specialScenarios(host, guest) {
  for (const actor of [0, 1]) {
    const page = actor ? guest : host, opponent = actor ? host : guest;
    await stage(host, actor, "hand('Prince Stennis'); p.deck.addCard(unit('Blue Stripes Commando')); p.deck.addCard(unit('Blue Stripes Commando'));");
    await next(host, guest, actor, "a.kind === 'play'");
    assert.equal(await rules(host, `board.row.filter((r,i) => ${actor} ? i >= 3 : i < 3).some(r => r.cards.some(c => c.name === 'Prince Stennis'))`), true);
    assert.equal(await rules(host, `${actor} ? player_op.hand.cards.length : player_me.hand.cards.length`), 2);
    // Graphical inspection out of turn cannot play a card or consume a permission.
    const revision = await host.evaluate(() => onlineApp.engine.caps.revision);
    await page.locator('#hand-row .card').first().click();
    await page.locator('#pass-button').click();
    assert.equal(await host.evaluate(() => onlineApp.engine.caps.revision), revision);
    assert.equal(await page.locator('.card-preview.hide').count(), 0);
    await page.keyboard.press('Escape');
    await stage(host, actor, "await place('Blue Stripes Commando'); hand('Decoy');");
    await next(host, guest, actor, "a.kind === 'play'");
    assert.equal(await rules(host, `${actor} ? player_op.hand.cards.some(c=>c.name === 'Blue Stripes Commando') : player_me.hand.cards.some(c=>c.name === 'Blue Stripes Commando')`), true);
    await stage(host, actor, "p.grave.addCard(unit('Olgierd von Everec')); hand('Yennefer of Vengerberg');");
    await next(host, guest, actor, "a.kind === 'play'");
    // Disconnect while a mandatory medic choice is open and restore the carousel.
    if (!actor) {
      await page.locator('#carousel:not(.hide)').waitFor();
      await guest.evaluate(() => { clearInterval(onlineApp.session.timer); onlineApp.session.conn.close(); });
      await host.waitForFunction(() => onlineApp.paused);
      assert.equal(await host.locator('#carousel.hide').count(), 1);
      await guest.locator('#online-retry').click();
      await host.waitForFunction(() => !onlineApp.paused);
      await page.locator('#carousel:not(.hide)').waitFor();
    }
    await next(host, guest, actor, "a.kind === 'choice' && !!a.card");
    await next(host, guest, actor, "a.destination?.row === 'ranged'");
    assert.equal(await rules(host, `board.row[${actor ? 1 : 4}].cards.some(c=>c.name === 'Olgierd von Everec')`), true);
    await stage(host, actor, "await place('Blue Stripes Commando'); hand('Biting Frost'); hand('Clear Weather');");
    await next(host, guest, actor, "a.kind === 'play' && card_dict[a.card.index].name === 'Biting Frost'");
    assert.equal(await rules(host, `board.row[${actor ? 2 : 3}].total`), 1);
    await rules(host, `game.currPlayer = ${actor} ? player_op : player_me; onlineApp.engine.ready = true; onlineApp.engine.rebuild(); onlineApp.engine.sync()`);
    await next(host, guest, actor, "a.kind === 'play' && card_dict[a.card.index].name === 'Clear Weather'");
    assert.equal(await rules(host, `board.row[${actor ? 2 : 3}].total`), 4);
    await stage(host, actor, "hand(\"Commander's Horn\");");
    await next(host, guest, actor, "a.destination?.row === 'siege'");
    assert.equal(await rules(host, `!!board.row[${actor ? 0 : 5}].special`), true);
    await stage(host, actor, "hand('Olgierd von Everec');");
    await next(host, guest, actor, "a.destination?.row === 'ranged'");
    assert.equal(await rules(host, `board.row[${actor ? 1 : 4}].cards.length`), 1);
    await stage(host, actor, "await place('Blue Stripes Commando'); hand('Scorch');");
    await next(host, guest, actor, "a.kind === 'play'");
    assert.equal(await rules(host, `board.row[${actor ? 2 : 3}].cards.length`), 0);
    await stage(host, actor, "p.leader = new Card(card_dict.find(d=>d.ability === 'eredin_bringer_of_death'), p); p.enableLeader(); p.grave.addCard(unit('Blue Stripes Commando'));");
    await next(host, guest, actor, "a.kind === 'leader'");
    await next(host, guest, actor, "a.kind === 'choice' && !!a.card");
    assert.equal(await rules(host, `${actor} ? player_op.hand.cards.length : player_me.hand.cards.length`), 1);
    // The same original Pass button works, with the passed badge confirmed by host.
    await stage(host, actor, "hand('Blue Stripes Commando');");
    const pass = await next(host, guest, actor, "a.kind === 'pass'");
    await host.evaluate(async ({ actor, pass }) => {
      try { await onlineApp.engine.act(actor, pass.revision, pass.action.id); throw Error('Duplicate accepted'); }
      catch (e) { if (!/illegal/.test(e.message)) throw e; }
    }, { actor, pass });
    await page.waitForFunction(() => document.querySelector('#passed-me').classList.contains('passed'));
    assert.equal(await opponent.evaluate(() => onlineApp.latest.players[onlineApp.role === 'host' ? 1 : 0].hand), null);
    assert.equal(await page.locator('#online-dock, .online-actions').count(), 0);
    for (const client of [host, guest]) assert.equal(await client.evaluate(() => {
      const v = onlineApp.latest, actor = onlineApp.role === 'host' ? 0 : 1;
      return v.players.every(p => Number(document.querySelector('#score-total-' + (p.id === actor ? 'me' : 'op') + ' > div').textContent) === p.total) &&
        v.rows.every(r => Number(document.querySelector('#field-' + (r.owner === actor ? 'me' : 'op') + ' [data-row="' + r.type + '"] .row-score').textContent) === r.total);
    }), true, 'original score graphics reflect the authoritative projection');
  }
  // Restart a fresh normal match using the same rules adapter after controlled fixtures.
  await host.evaluate(() => { onlineApp.engine.start(onlineApp.decks).catch(e => onlineApp.engine.fail(e)); });
  for (const actor of [0, 1]) await next(host, guest, actor, "a.kind === 'choice' && !a.card");
}
module.exports = { clickAction, specialScenarios };
