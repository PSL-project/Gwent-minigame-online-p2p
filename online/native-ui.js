/* Presentation and input only. Never calls Player/Board gameplay methods. */
'use strict';
class NativeOnlineUI {
  constructor(app) {
    this.app = app; this.selected = null; this.revision = null; this.dialog = null;
    this.main = document.querySelector('main');
    this.main.addEventListener('click', event => {
      if (!app.playing) return;
      // Stop legacy handlers, including capture handlers on engine row objects.
      event.preventDefault(); event.stopImmediatePropagation();
      this.click(event);
    }, true);
    document.addEventListener('keydown', event => {
      if (app.playing && event.key === 'Escape') this.cancel();
    });
  }
  get actor() { return this.app.role === 'host' ? 0 : 1; }
  get actions() { return this.app.latest?.actions || []; }
  get enabled() {
    return !this.app.paused && this.app.session?.connected && this.app.pendingRevision !== this.app.latest?.revision && !this.app.latest?.fault;
  }
  visual(c) {
    const card = new Card(card_dict[c.index], null);
    if (['close', 'ranged', 'siege', 'agile'].includes(card.row)) card.setPower(c.power);
    return card;
  }
  make(c) {
    const elem = this.visual(c).elem.cloneNode(true);
    elem.dataset.nativeCard = c.uid; elem.setAttribute('role', 'button');
    elem.setAttribute('aria-label', card_dict[c.index].name);
    // Original hover, artwork and inspection presentation are reused.
    return elem;
  }
  fill(node, cards, hand = false) {
    const existing = new Map([...node.children].map(e => [e.dataset.nativeCard, e]));
    const next = cards.map(c => {
      const fresh = this.make(c), old = existing.get(c.uid);
      if (old && old.innerHTML === fresh.innerHTML) return old;
      if (!old) fresh.classList.add('native-arriving');
      return fresh;
    });
    node.replaceChildren(...next);
    if (node.classList.contains('card-container')) {
      const container = new CardContainer(node);
      container.resizeCardContainer(hand ? 11 : 10, 0.075, hand ? 0.00225 : 0.00325);
    }
  }
  card(uid) {
    const v = this.app.latest;
    return [...v.players.flatMap(p => [p.leader, ...(p.hand || []), ...p.grave]), ...v.weather,
      ...v.rows.flatMap(r => [...r.cards, ...(r.special ? [r.special] : [])]),
      ...this.actions.filter(a => a.card).map(a => a.card)].find(c => c.uid === uid);
  }
  closePreview() {
    ui.preview.classList.add('hide'); ui.previewCard = null;
    document.getElementById('click-background').classList.add('noclick');
  }
  closeDialog() {
    if (this.dialog === 'carousel') { document.getElementById('carousel').classList.add('hide'); Carousel.curr = null; }
    if (this.dialog === 'popup') { document.getElementById('popup').classList.add('hide'); Popup.curr = null; }
    this.dialog = null; this.choiceActions = null;
  }
  cancel() {
    if (this.actions.some(a => a.kind === 'choice' && a.destination)) return;
    if (this.dialog === 'carousel' && this.choiceActions?.some(a => a.kind === 'choice')) {
      const done = this.actions.find(a => a.kind === 'choice' && !a.card && !a.destination);
      if (done) this.submit(done);
      return;
    }
    this.closeDialog(); this.selected = null; this.closePreview(); this.highlight();
  }
  inspect(cards, title) {
    if (!cards.length) return;
    this.closePreview(); this.showCarousel(cards, null, title);
  }
  showCarousel(cards, actions, title) {
    this.closeDialog();
    const container = new CardContainer(); container.cards = cards.map(c => this.visual(c));
    const carousel = new Carousel(container, 1, () => {}, null, false, false);
    // Navigation uses the original carousel; selection submits a capability only.
    carousel.select = event => {
      event.stopPropagation();
      if (actions) this.submit(actions[carousel.index]);
      else this.cancel();
    };
    carousel.cancel = () => this.cancel();
    this.choiceActions = actions; this.dialog = 'carousel'; carousel.start();
    carousel.title_elem.textContent = title || 'Card details'; carousel.title_elem.classList.remove('hide');
    let done = document.getElementById('native-choice-done');
    if (!done) {
      done = document.createElement('button'); done.id = 'native-choice-done';
      document.getElementById('carousel').append(done);
    }
    const optional = this.actions.find(a => a.kind === 'choice' && !a.card && !a.destination);
    done.textContent = actions ? optional?.label || '' : 'Close';
    done.hidden = !!actions && !optional;
  }
  popup(actions, title) {
    this.closeDialog(); this.dialog = 'popup';
    new Popup('Continue', () => this.submit(actions[0]),
      'Cancel', () => actions[1] ? this.submit(actions[1]) : this.cancel(), 'Choose', '');
    document.querySelector('#popup h3').textContent = title || 'Choose';
    const buttons = document.querySelectorAll('#popup button');
    buttons[0].textContent = actions[0]?.label || 'Continue'; buttons[1].textContent = actions[1]?.label || 'Cancel';
    buttons[1].hidden = actions.length < 2;
  }
  submit(action) {
    if (!action || !this.enabled) return;
    this.selected = null; this.closePreview(); this.closeDialog();
    this.app.act(this.app.latest.revision, action.id);
  }
  lock() {
    this.closeDialog(); this.selected = null; this.closePreview(); this.highlight();
    document.getElementById('online-turn-status').textContent = 'Waiting for the host…';
  }
  click(event) {
    const target = event.target;
    if (target.closest('#exit-game')) { this.app.abandon(); return; }
    if (target.closest('#end-screen button')) { this.app.abandon(false); return; }
    if (target.closest('#popup button')) {
      if (!this.enabled) return;
      [...document.querySelectorAll('#popup button')].indexOf(target.closest('button')) ? Popup.curr?.selectNo() : Popup.curr?.selectYes();
      return;
    }
    if (target.closest('#carousel')) {
      if (target.closest('#native-choice-done')) { this.cancel(); return; }
      const cards = [...document.querySelectorAll('#carousel > div:first-child > .card-lg')];
      const elem = target.closest('.card-lg'), i = cards.indexOf(elem);
      if (i >= 0) { if (i === 2) Carousel.curr?.select(event); else Carousel.curr?.shift(event, i - 2); }
      else this.cancel();
      return;
    }
    if (this.dialog) return;
    if (target.closest('#pass-button')) { this.submit(this.actions.find(a => a.kind === 'pass')); return; }
    if (target.closest('#click-background')) { this.cancel(); return; }
    const leader = target.closest('.leader-box');
    if (leader) {
      const own = leader.id === 'leader-me', p = this.app.latest.players[own ? this.actor : 1 - this.actor];
      const action = own && this.actions.find(a => a.kind === 'leader');
      if (action && this.enabled) this.showCarousel([p.leader], [action], 'Use leader ability');
      else this.inspect([p.leader], 'Leader');
      return;
    }
    const elem = target.closest('[data-native-card]');
    if (elem) {
      const uid = elem.dataset.nativeCard;
      const decoy = this.selected && this.actions.find(a => a.card?.uid === this.selected && a.destination?.type === 'card' && a.destination.uid === uid);
      if (decoy) { this.submit(decoy); return; }
      if (target.closest('#hand-row')) {
        if (this.selected === uid) { this.cancel(); return; }
        const playable = this.actions.some(a => a.kind === 'play' && a.card.uid === uid);
        this.closePreview(); this.selected = playable && this.enabled ? uid : null;
        ui.showPreviewVisuals(this.visual(this.card(uid)));
        document.getElementById('click-background').classList.remove('noclick');
        this.highlight(); return;
      }
    }
    const row = target.closest('.field-row'), weather = target.closest('#weather');
    if ((row || weather) && this.enabled) {
      const action = this.actions.find(a => {
        if (a.kind === 'play' ? a.card.uid !== this.selected : a.kind !== 'choice') return false;
        const d = a.destination;
        return d?.type === 'any-row' && row || d?.type === 'weather' && weather ||
          d?.type === 'row' && row && row.dataset.row === d.row && row.closest('.field').id === 'field-' + (d.owner === this.actor ? 'me' : 'op');
      });
      if (action) { this.submit(action); return; }
    }
    if (this.selected) return; // Invalid target does not replace the selected card.
    const grave = target.closest('.grave');
    if (grave) { this.inspect(this.app.latest.players[grave.id === 'grave-me' ? this.actor : 1 - this.actor].grave, 'Discard pile'); return; }
    if (elem) { this.inspect([this.card(elem.dataset.nativeCard)], 'Card details'); return; }
    if (weather) this.inspect(this.app.latest.weather, 'Weather');
    else if (row) {
      const r = this.app.latest.rows.find(r => r.type === row.dataset.row && r.owner === (row.closest('.field').id === 'field-me' ? this.actor : 1 - this.actor));
      this.inspect([...r.cards, ...(r.special ? [r.special] : [])], 'Battlefield');
    }
  }
  highlight() {
    this.main.classList.remove('noclick');
    this.main.querySelectorAll('.noclick').forEach(e => e.classList.remove('noclick'));
    this.main.querySelectorAll('.row-selectable, .native-target, .native-selected').forEach(e => e.classList.remove('row-selectable', 'native-target', 'native-selected'));
    document.getElementById('pass-button').setAttribute('aria-disabled', String(!this.enabled || !this.actions.some(a => a.kind === 'pass')));
    for (const e of document.querySelectorAll('#hand-row > .card')) {
      e.classList.toggle('native-playable', this.enabled && this.actions.some(a => a.kind === 'play' && a.card.uid === e.dataset.nativeCard));
      e.classList.toggle('native-selected', e.dataset.nativeCard === this.selected);
    }
    if (!this.enabled) return;
    const actions = this.actions.filter(a => a.kind === 'play' ? a.card.uid === this.selected : a.kind === 'choice');
    for (const a of actions) {
      const d = a.destination;
      if (!d) continue;
      if (d.type === 'card') document.querySelector('[data-native-card="' + d.uid + '"]')?.classList.add('native-target');
      if (d.type === 'weather') document.getElementById('weather').classList.add('row-selectable');
      for (const row of document.querySelectorAll('.field-row')) {
        if (d.type === 'any-row' || d.type === 'row' && row.dataset.row === d.row && row.closest('.field').id === 'field-' + (d.owner === this.actor ? 'me' : 'op')) {
          (a.card && card_dict[a.card.index].deck === 'special' ? row.querySelector('.row-special') : row.querySelector('.row-cards')).classList.add('row-selectable');
        }
      }
    }
  }
  render(v) {
    const status = document.getElementById('online-turn-status'); status.hidden = false;
    if (!v) { status.textContent = 'Preparing match…'; return; }
    const changed = this.revision !== v.revision;
    if (changed || !this.enabled) { this.closeDialog(); this.selected = null; this.closePreview(); }
    this.revision = v.revision;
    this.main.classList.remove('noclick');
    for (const p of v.players) {
      const tag = p.id === this.actor ? 'me' : 'op';
      document.querySelector('#stats-' + tag + ' .profile-img > div > div').style.backgroundImage = iconURL('deck_shield_' + p.faction);
      document.getElementById('name-' + tag).textContent = p.id === this.actor ? 'You' : 'Opponent';
      document.getElementById('deck-name-' + tag).textContent = factions[p.faction].name;
      document.getElementById('hand-count-' + tag).textContent = p.handCount;
      document.getElementById('score-total-' + tag).firstElementChild.textContent = p.total;
      document.getElementById('score-total-' + tag).classList.toggle('score-leader', p.total > v.players[1 - p.id].total);
      document.getElementById('stats-' + tag).classList.toggle('current-turn', v.turn === p.id);
      document.getElementById('passed-' + tag).classList.toggle('passed', p.passed);
      for (const n of [1, 2]) document.getElementById('gem' + n + '-' + tag).classList.toggle('gem-on', p.health >= n);
      this.fill(document.querySelector('#leader-' + tag + ' .leader-container'), [p.leader]);
      document.querySelector('#leader-' + tag + ' .leader-container').classList.toggle('fade', !p.leaderAvailable);
      document.querySelector('#leader-' + tag + ' .leader-active').classList.toggle('hide', !p.leaderAvailable);
      this.fill(document.getElementById('grave-' + tag), p.grave.slice(0, 1));
      const pile = document.getElementById('deck-' + tag); pile.replaceChildren();
      const back = document.createElement('div'); back.className = 'deck-card'; back.style.backgroundImage = iconURL('deck_back_' + p.faction, 'jpg'); pile.append(back);
      const counter = document.createElement('div'); counter.className = 'deck-counter center'; counter.textContent = p.deckCount; pile.append(counter);
      if (p.hand) this.fill(document.getElementById('hand-row'), p.hand, true);
    }
    for (const r of v.rows) {
      const row = document.querySelector('#field-' + (r.owner === this.actor ? 'me' : 'op') + ' [data-row="' + r.type + '"]');
      this.fill(row.querySelector('.row-cards'), r.cards); this.fill(row.querySelector('.row-special'), r.special ? [r.special] : []);
      row.querySelector('.row-score').textContent = r.total;
      const overlay = row.querySelector('.row-weather');
      overlay.className = 'row-weather ' + (r.effects?.weather ? ({ close: 'frost', ranged: 'fog', siege: 'rain' })[r.type] : '');
      overlay.style.opacity = r.effects?.weather ? '1' : '0';
    }
    this.fill(document.getElementById('weather'), v.weather);
    this.highlight();
    this.effects(v);
    status.textContent = this.app.paused ? 'Match paused — waiting for authenticated reconnection' : v.fault ? 'Match stopped: ' + v.fault :
      v.state === 'complete' ? 'Match complete' : 'Round ' + v.round + ' · ' + (v.prompt || (v.turn === this.actor ? 'Your turn' : 'Opponent’s turn'));
    if (v.state === 'complete') { this.results(v); return; }
    document.getElementById('end-screen').classList.add('hide');
    if (this.enabled && !this.dialog) {
      const choices = this.actions.filter(a => a.kind === 'choice');
      const cards = choices.filter(a => a.card);
      if (cards.length) this.showCarousel(cards.map(a => a.card), cards, v.prompt);
      else if (choices.some(a => a.destination) && v.choiceCard) ui.showPreviewVisuals(this.visual(v.choiceCard));
      else if (choices.length) this.popup(choices, v.prompt);
    }
  }
  effects(v) {
    const previous = this.previous;
    this.previous = v;
    if (!previous || previous === v) return;
    if (v.state === 'complete' && previous.state !== 'complete') {
      AudioManager.playSFX(v.players[this.actor].health && !v.players[1 - this.actor].health ? 'game_win' : 'game_lose');
    } else if (v.history.length > previous.history.length) {
      const won = v.history.at(-1).winner === this.actor;
      AudioManager.playSFX(won ? 'round_win' : 'round_lose');
      ui.notification(v.history.at(-1).winner === null ? 'draw-round' : won ? 'win-round' : 'lose-round');
    } else if (v.turn !== previous.turn && v.turn !== null) AudioManager.playSFX(v.turn === this.actor ? 'turn_me' : 'turn_op');
    if (v.players.some((p, i) => p.passed && !previous.players[i].passed)) AudioManager.playSFX('pass');
    const oldBoard = new Set([...previous.weather, ...previous.rows.flatMap(r => [...r.cards, ...(r.special ? [r.special] : [])])].map(c => c.uid));
    for (const c of [...v.weather, ...v.rows.flatMap(r => [...r.cards, ...(r.special ? [r.special] : [])])]) {
      if (oldBoard.has(c.uid)) continue;
      const visual = this.visual(c), elem = this.main.querySelector('[data-native-card="' + c.uid + '"]');
      if (!elem) continue;
      const effect = visual.abilities.find(a => ['medic', 'spy', 'muster', 'bond', 'morale', 'horn', 'mardroeme'].includes(a));
      if (effect) { visual.elem = elem; visual.animate(effect); }
      else AudioManager.playSFX(visual.audio || (visual.hero ? 'hero' : 'common_' + (visual.row === 'agile' ? 'close' : visual.row)));
    }
  }
  results(v) {
    const screen = document.getElementById('end-screen'); screen.classList.remove('hide');
    const own = v.players[this.actor], other = v.players[1 - this.actor];
    screen.firstElementChild.className = own.health && !other.health ? 'end-win' : !own.health && !other.health ? 'end-draw' : 'end-lose';
    const rows = screen.querySelectorAll('tr');
    rows[1].children[0].textContent = 'You'; rows[2].children[0].textContent = 'Opponent';
    for (let i = 1; i < 4; i++) for (let p = 0; p < 2; p++) {
      const id = p ? 1 - this.actor : this.actor, r = v.history[i - 1];
      rows[p + 1].children[i].textContent = r?.scores[id] ?? 0;
      rows[p + 1].children[i].style.color = r?.winner === id ? 'goldenrod' : '';
    }
    screen.querySelector('p').classList.add('hide');
    screen.querySelectorAll('button').forEach((b, i) => { b.hidden = i !== 0; if (!i) b.textContent = 'Return to menu'; });
  }
}
