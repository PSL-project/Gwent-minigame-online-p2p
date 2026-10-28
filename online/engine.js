/* Adapter over the original engine. Only the host executes game rules. */
'use strict';
class OnlineEngine {
  constructor(publish, connected) {
    this.publish = publish; this.connected = connected;
    this.caps = new GwentProtocol.Capabilities();
    this.actions = [[], []]; this.ready = false; this.active = true;
    this.decisionPlayer = null; this.prompt = null;
    this.waiters = []; this.install();
  }
  fail(error) { this.fault = error.message || String(error); this.ready = false; this.sync(); console.error(error); }
  async gate() {
    if (!this.active) throw Error('Match abandoned');
    if (!this.connected()) await new Promise(resolve => this.waiters.push(resolve));
    if (!this.active) throw Error('Match abandoned');
  }
  resume() { this.waiters.splice(0).forEach(resolve => resolve()); this.sync(); }
  stop() { this.active = false; this.waiters.splice(0).forEach(resolve => resolve()); }
  wrap(object, name, handler) {
    const original = object[name];
    object[name] = (...args) => handler(original.bind(object), ...args);
  }
  install() {
    // Original callbacks do not always return promises. Catch every transition here.
    for (const name of ['startRound', 'endRound', 'endTurn']) {
      this.wrap(game, name, async (original, ...args) => {
        try { this.ready = false; this.caps.clear(); this.actions = [[], []]; await this.gate(); return await original(...args); }
        catch (e) { if (this.active) this.fail(e); }
      });
    }
    this.wrap(game, 'startTurn', async original => {
      try {
        await this.gate(); await original(); this.ready = true; this.rebuild(); this.sync();
      } catch (e) { if (this.active) this.fail(e); }
    });
    this.wrap(game, 'endGame', async original => {
      await this.gate(); await original(); this.ready = false; this.caps.clear(); this.actions = [[], []]; this.sync();
    });
    this.wrap(board, 'moveTo', async (original, ...args) => { await this.gate(); return original(...args); });
    this.wrap(ui, 'queueCarousel', async (original, container, count, action, predicate, sort, quit, title) => {
      const actor = (this.decisionPlayer || game.currPlayer || player_me).id;
      for (let i = 0; i < count; ++i) {
        const cards = container.cards.filter(predicate || (() => true));
        if (!cards.length) return;
        const options = cards.map(c => ({ label: c.name, card: this.card(c), value: c }));
        if (quit) options.push({ label: 'Done / keep remaining cards', value: null });
        const selected = await this.choose(actor, title || 'Choose a card', options);
        if (!selected) return;
        await action(container, container.cards.indexOf(selected));
      }
    });
    this.wrap(ui, 'viewCardsInContainer', async (original, container, action) => {
      return ui.queueCarousel(container, 1, action || (() => {}), () => true, false, true, 'View cards / choose to continue');
    });
    this.wrap(ui, 'waitForRowSelection', async (original, card) => {
      const rows = ['close', 'ranged'].map(type => board.getRow(card, type, card.holder));
      return this.choose(card.holder.id, 'Choose a row for ' + card.name, rows.map(row => ({ label: row.type, value: row })));
    });
    // Online startup uses the same mulligan rules, with an independent choice per player.
    game.initialRedraw = async () => {
      for (const player of [player_me, player_op]) {
        this.decisionPlayer = player;
        await ui.queueCarousel(player.hand, 2, (c, i) => player.deck.swap(c, c.cards[i]), () => true, false, true, 'Redraw up to two cards');
      }
      this.decisionPlayer = null;
    };
  }
  card(c) {
    // Only explicit public properties. Never serialize engine objects, holders or closures.
    const index = card_dict.findIndex(d => d.filename === c.filename && d.deck === c.faction);
    return { index, power: c.power };
  }
  choose(actor, title, options) {
    return new Promise(resolve => {
      const build = () => {
        this.caps.clear(); this.actions = [[], []];
        this.prompt = { actor, title };
        this.actions[actor] = options.map(option => this.caps.add(actor, { label: option.label, card: option.card || null, kind: 'choice' }, async () => {
          this.prompt = null; this.actions = [[], []]; this.sync(); resolve(option.value);
        }));
        this.sync();
      };
      build();
    });
  }
  rowsFor(card) {
    const p = card.holder;
    if (card.faction === 'weather') return [weather];
    if (card.name === 'Scorch' || card.name === 'Decoy') return [];
    if (card.isSpecial()) return board.row.filter((r, i) => (p === player_me ? i >= 3 : i < 3) && !r.special);
    return (card.row === 'agile' ? ['close', 'ranged'] : [card.row]).map(type => board.getRow(card, type, p)).filter(Boolean);
  }
  rebuild() {
    this.caps.clear(); this.actions = [[], []];
    if (!this.ready || game.state !== GameState.PLAYING || this.fault) return;
    const p = game.currPlayer, actor = p.id;
    const add = (description, run) => this.actions[actor].push(this.caps.add(actor, description, run));
    add({ kind: 'pass', label: 'Pass round' }, () => p.passRound());
    if (p.leaderAvailable) add({ kind: 'leader', label: 'Use leader: ' + p.leader.name }, () => p.activateLeader());
    for (const c of p.hand.cards) {
      const description = { kind: 'play', card: this.card(c) };
      if (c.name === 'Scorch') {
        add({ ...description, label: c.name }, () => p.playScorch(c));
      } else if (c.name === 'Decoy') {
        for (const row of board.row.filter((r, i) => p === player_me ? i >= 3 : i < 3)) {
          for (const target of row.cards.filter(c => c.isUnit())) {
            add({ ...description, label: 'Decoy → ' + target.name + ' (' + row.type + ')' }, async () => {
              await board.toHand(target, row); await board.moveTo(c, row, p.hand); p.endTurn();
            });
          }
        }
      } else {
        for (const row of this.rowsFor(c)) add({ ...description, label: c.name + ' → ' + (row.type || 'weather') }, () => p.playCardToRow(c, row));
      }
    }
  }
  async act(actor, revision, id) {
    if (!this.active || !this.connected()) throw Error('Match paused');
    const run = this.caps.take(actor, revision, id);
    this.ready = false; this.actions = [[], []]; this.sync();
    try { await run(); } catch (e) { this.fail(e); }
  }
  view(actor) {
    const players = [player_me, player_op];
    return {
      revision: this.caps.revision,
      state: game.state === GameState.END_SCREEN ? 'complete' : 'playing',
      round: game.roundCount, turn: game.currPlayer?.id ?? null,
      fault: this.fault || null,
      prompt: this.prompt ? (this.prompt.actor === actor ? this.prompt.title : 'Opponent is choosing…') : null,
      actions: this.connected() ? this.actions[actor] : [],
      players: players.map((p, id) => ({
        id, faction: p.deck.faction, health: p.health, total: p.total, passed: p.passed,
        leader: this.card(p.leader), leaderAvailable: p.leaderAvailable,
        handCount: p.hand.cards.length, deckCount: p.deck.cards.length,
        hand: id === actor ? p.hand.cards.map(c => this.card(c)) : null,
        grave: p.grave.cards.map(c => this.card(c))
      })),
      rows: board.row.map((r, i) => ({ owner: i < 3 ? 1 : 0, type: r.type, total: r.total, effects: { weather: r.effects.weather, horn: r.effects.horn }, cards: r.cards.map(c => this.card(c)), special: r.special ? this.card(r.special) : null })),
      weather: weather.cards.map(c => this.card(c)),
      history: game.roundHistory.map(r => ({ winner: r.winner?.id ?? null, scores: [r.score_me, r.score_op] }))
    };
  }
  sync() { if (player_me && player_op && this.active) this.publish(this.view(0), this.view(1)); }
  async start(decks) {
    const expand = deck => ({ faction: deck.faction, leader: card_dict[deck.leader], cards: deck.cards.map(([index, count]) => ({ index, count })) });
    game.reset();
    document.querySelectorAll('.leader-container').forEach(e => e.replaceChildren());
    for (const tag of ['me', 'op']) for (const kind of ['deck', 'grave']) document.getElementById(kind + '-' + tag).replaceChildren();
    player_me = new Player(0, 'Host', expand(decks[0]));
    player_op = new Player(1, 'Guest', expand(decks[1]));
    player_op.controller = new Controller(); // Human decisions are serviced through capabilities.
    document.getElementById('deck-customization').classList.add('hide');
    document.getElementById('end-screen').classList.add('hide');
    // Avoid legacy preview lifecycle dependencies in leader effects.
    Carousel.curr = null;
    await game.startGame();
  }
}
