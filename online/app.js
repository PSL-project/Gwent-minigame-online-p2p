'use strict';
const onlineApp = window.onlineApp = {
  session: null, engine: null, role: null, playing: false, paused: true,
  decks: [null, null], localReady: false, latest: null,
  init() {
    this.root = document.getElementById('online-menu');
    this.banner = document.getElementById('online-banner');
    this.dock = document.getElementById('online-dock');
    document.getElementById('mode-single').onclick = () => { this.root.hidden = true; document.getElementById('mode-menu').hidden = false; };
    document.getElementById('mode-menu').onclick = () => { this.root.hidden = false; };
    document.getElementById('mode-host').onclick = () => this.connect('host');
    document.getElementById('mode-join').onclick = () => this.connect('guest');
    document.getElementById('online-copy').onclick = async () => {
      const input = document.getElementById('online-invitation');
      try { await navigator.clipboard.writeText(input.value); this.status('Invitation copied. Share it privately with your friend.'); }
      catch { input.select(); this.status('Select the invitation and press Ctrl+C to copy.'); }
    };
    document.getElementById('online-customize').onclick = () => { this.root.hidden = true; this.banner.hidden = false; };
    document.getElementById('online-lobby-open').onclick = () => { this.root.hidden = false; };
    document.getElementById('online-ready').onclick = () => this.setReady();
    document.getElementById('online-unready').onclick = () => this.unready();
    document.getElementById('online-inspect').onclick = () => this.inspect();
    document.getElementById('online-inspect-close').onclick = () => document.getElementById('online-inspector').hidden = true;
    document.getElementById('online-retry').onclick = () => this.retry();
    document.querySelectorAll('[data-online-abandon]').forEach(e => e.onclick = () => this.abandon());
    EventManager.gameOpened.bind(() => document.getElementById('mode-menu').hidden = true);
    EventManager.customizationOpened.bind(() => document.getElementById('mode-menu').hidden = !!this.session);
    const singleStart = dm.startNewGame.bind(dm);
    dm.startNewGame = () => this.session ? this.setReady() : singleStart();
    // Online controls are outside main. Block legacy click handlers without changing AI mode.
    document.querySelector('main').addEventListener('click', event => {
      if (this.playing) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    window.addEventListener('beforeunload', event => {
      if (this.playing && this.latest?.state !== 'complete') { event.preventDefault(); event.returnValue = ''; }
    });
    // External music loads only when requested. Single player itself works offline.
    const toggleMusic = ui.toggleMusic.bind(ui);
    ui.toggleMusic = () => {
      if (!window.YT) {
        if (!document.getElementById('youtube-api')) {
          const script = document.createElement('script'); script.id = 'youtube-api'; script.src = 'https://www.youtube.com/iframe_api';
          script.onerror = () => this.status('Music is unavailable. Gameplay and local sound effects remain available.');
          document.head.append(script);
        }
        this.status('Loading optional online music…');
      } else if (ui.youtube) toggleMusic();
    };
  },
  status(message) {
    document.getElementById('online-status').textContent = message;
    document.getElementById('online-connection').textContent = message;
  },
  async connect(role) {
    if (this.session) return;
    const code = document.getElementById('online-code').value.trim();
    try {
      if (role === 'guest') GwentProtocol.invitation(code);
      this.role = role; this.paused = true;
      this.session = new GwentSession(Peer, {
        connected: () => {
          this.paused = false; this.status('Connected — private ' + (role === 'host' ? 'host' : 'guest') + ' session');
          this.engine?.resume();
          if (role === 'host') this.sendLobby();
          else if (this.localReady && !this.playing) this.session.send('ready', { deck: this.decks[1] });
          this.refresh();
        },
        pause: () => { this.paused = true; this.status('Disconnected — match paused. Attempting to reconnect…'); this.engine?.sync(); this.refresh(); },
        message: msg => this.receive(msg),
        status: msg => this.status(msg),
        error: err => this.status(err.message)
      });
      document.getElementById('online-modes').hidden = true;
      document.getElementById('online-lobby').hidden = false;
      document.getElementById('mode-menu').hidden = true;
      this.banner.hidden = false;
      document.getElementById('start-game').textContent = 'Confirm deck & Ready';
      document.getElementById('opponent-preview').hidden = true;
      this.status(role === 'host' ? 'Creating invitation…' : 'Connecting to host…');
      if (role === 'host') {
        const invitation = await this.session.host();
        document.getElementById('online-invitation').value = invitation;
        document.getElementById('online-invite-box').hidden = false;
        this.status('Waiting for your friend. Copy and share the invitation.');
      } else await this.session.join(code);
      this.refresh();
    } catch (err) { this.status(err.message); }
  },
  retry() {
    if (this.session?.peer?.destroyed || !this.session?.peer?.open && !this.session?.peer?.disconnected && !this.playing) {
      const role = this.role; this.session?.close(); this.session = null; this.connect(role);
    } else this.session?.retry();
  },
  setReady() {
    if (!this.session || this.playing) return;
    try {
      const deck = GwentProtocol.deck(JSON.parse(dm.deckToJSON()), card_dict, factions);
      const actor = this.role === 'host' ? 0 : 1;
      this.decks[actor] = deck; this.localReady = true;
      if (actor === 1) this.session.send('ready', { deck });
      else { this.sendLobby(); this.maybeStart(); }
      this.root.hidden = false; this.refresh();
    } catch (err) { this.status(err.message); }
  },
  unready() {
    if (this.playing) return;
    this.localReady = false; this.decks[this.role === 'host' ? 0 : 1] = null;
    if (this.role === 'guest') this.session.send('unready'); else this.sendLobby();
    this.refresh();
  },
  sendLobby() {
    this.session.send('lobby', { players: this.decks.map(d => d ? { faction: d.faction, leader: d.leader } : null) });
  },
  receive(msg) {
    try {
      if (msg.type === 'leave') { this.paused = true; this.status('Opponent abandoned the session. Return to the menu to start a new game.'); this.session.close(); this.engine?.sync(); this.refresh(); return; }
      if (this.role === 'host') {
        if (msg.type === 'ready' && !this.playing) {
          this.decks[1] = GwentProtocol.deck(msg.deck, card_dict, factions); this.sendLobby(); this.refresh(); this.maybeStart();
        } else if (msg.type === 'unready' && !this.playing) { this.decks[1] = null; this.sendLobby(); this.refresh(); }
        else if (msg.type === 'action' && this.engine) {
          if (!Number.isSafeInteger(msg.revision) || !GwentProtocol.isToken(msg.id)) throw Error('Invalid action');
          this.engine.act(1, msg.revision, msg.id).catch(e => { this.session.send('notice', { message: e.message }); this.engine.sync(); });
        }
      } else {
        if (msg.type === 'lobby' && !this.playing) {
          if (!Array.isArray(msg.players) || msg.players.length !== 2) throw Error('Invalid lobby');
          this.remoteLobby = msg.players.map(d => d && Object.hasOwn(factions, d.faction) && Number.isInteger(d.leader) && card_dict[d.leader]?.row === 'leader' ? { faction: d.faction, leader: d.leader } : null);
          this.refresh();
        } else if (msg.type === 'state') {
          this.validateView(msg.view);
          if (!this.playing) EventManager.gameOpened.dispatch();
          this.playing = true; this.latest = msg.view;
          this.root.hidden = true; document.body.classList.add('online-playing');
          document.getElementById('deck-customization').classList.add('hide');
          document.getElementById('carousel').classList.add('hide');
          this.renderGuest(msg.view); this.refresh();
        } else if (msg.type === 'notice' && typeof msg.message === 'string') this.status(msg.message.slice(0, 200));
      }
    } catch (err) { this.status(err.message); }
  },
  maybeStart() {
    if (this.role !== 'host' || this.playing || !this.session.connected || !this.decks.every(Boolean)) return;
    this.playing = true; this.root.hidden = true; document.body.classList.add('online-playing');
    document.getElementById('carousel').classList.add('hide');
    this.engine = new OnlineEngine((host, guest) => {
      this.latest = host; this.session.send('state', { view: guest }); this.refresh();
    }, () => this.session.connected && !this.paused);
    this.engine.start(this.decks).catch(e => this.engine.fail(e));
  },
  validateView(v) {
    const int = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
    const card = c => c && Number.isInteger(c.index) && !!card_dict[c.index] && Number.isFinite(c.power) && Math.abs(c.power) < 1000000;
    const cards = a => Array.isArray(a) && a.length <= 500 && a.every(card);
    if (!v || !int(v.revision) || !['playing', 'complete'].includes(v.state) || !int(v.round) || ![0, 1, null].includes(v.turn) || !Array.isArray(v.players) || v.players.length !== 2 || !Array.isArray(v.rows) || v.rows.length !== 6 || !cards(v.weather) || !Array.isArray(v.history) || v.history.length > 10 || !Array.isArray(v.actions) || v.actions.length > 2048) throw Error('Invalid host state');
    for (let i = 0; i < 2; i++) {
      const p = v.players[i];
      if (p.id !== i || !Object.hasOwn(factions, p.faction) || !int(p.health) || !int(p.total) || !int(p.handCount) || !int(p.deckCount) || !card(p.leader) || !cards(p.grave) || (i === 0 ? p.hand !== null : !cards(p.hand))) throw Error('Invalid player view');
    }
    if (!v.rows.every(r => [0, 1].includes(r.owner) && ['close', 'ranged', 'siege'].includes(r.type) && int(r.total) && cards(r.cards) && (!r.special || card(r.special)))) throw Error('Invalid board view');
    if (!v.actions.every(a => a && GwentProtocol.isToken(a.id) && typeof a.label === 'string' && a.label.length < 300 && (!a.card || card(a.card)))) throw Error('Invalid actions');
    if (!v.history.every(r => r && [0, 1, null].includes(r.winner) && Array.isArray(r.scores) && r.scores.length === 2 && r.scores.every(int))) throw Error('Invalid round history');
    if (v.prompt !== null && typeof v.prompt !== 'string' || v.fault !== null && typeof v.fault !== 'string') throw Error('Invalid state message');
  },
  refresh() {
    if (!this.session) return;
    const summary = this.role === 'guest' ? this.remoteLobby || [null, null] : this.decks;
    document.getElementById('online-players').textContent = summary.map((d, i) => (i ? 'Guest' : 'Host') + ': ' + (d ? factions[d.faction].name + ' — Ready' : 'choosing deck')).join('  |  ');
    document.getElementById('online-ready').disabled = this.localReady || this.playing;
    document.getElementById('online-unready').disabled = !this.localReady || this.playing;
    document.getElementById('online-customize').disabled = this.localReady || this.playing;
    this.dock.hidden = !this.playing;
    this.banner.classList.toggle('disconnected', this.paused);
    document.getElementById('online-lobby-open').hidden = this.playing;
    document.getElementById('online-inspect').hidden = !this.playing;
    if (!this.playing) return;
    const v = this.latest;
    this.dock.replaceChildren();
    const title = document.createElement('strong'); this.dock.append(title);
    if (this.paused) { title.textContent = 'Match paused — waiting for authenticated reconnection'; return; }
    if (!v) { title.textContent = 'Preparing match…'; return; }
    const actor = this.role === 'host' ? 0 : 1;
    title.textContent = v.fault ? 'Match stopped: ' + v.fault : v.state === 'complete' ? (v.players[actor].health === 0 ? v.players[1 - actor].health === 0 ? 'Match drawn' : 'Defeat' : 'Victory') : 'Round ' + v.round + ' · You ' + v.players[actor].total + ' – ' + v.players[1 - actor].total + ' Opponent · ' + (v.prompt || (v.turn === actor ? 'Your turn — select a card or action' : 'Opponent’s turn'));
    if (v.state === 'complete') {
      const result = document.createElement('p'); result.textContent = v.history.map((r, i) => 'Round ' + (i + 1) + ': ' + r.scores[actor] + ' – ' + r.scores[1 - actor]).join(' | '); this.dock.append(result);
      const again = this.button('Return to menu', () => this.abandon(false)); this.dock.append(again); return;
    }
    const actions = document.createElement('div'); actions.className = 'online-actions'; this.dock.append(actions);
    // Group play destinations by card to avoid flooding the action bar.
    const grouped = new Map();
    for (const a of v.actions) {
      const key = a.kind === 'play' ? a.card.index : a.id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(a);
    }
    for (const group of grouped.values()) {
      const a = group[0], label = a.card ? card_dict[a.card.index].name : a.label;
      const button = this.button(a.kind === 'play' ? label : a.label, () => {
        if (group.length === 1) this.act(v.revision, a.id);
        else {
          actions.replaceChildren();
          actions.append(this.button('← Back', () => this.refresh()));
          for (const item of group) actions.append(this.button(item.label, () => this.act(v.revision, item.id)));
        }
      });
      if (a.card) {
        const data = card_dict[a.card.index];
        button.title = data.name + ' · ' + data.strength + ' · ' + data.ability;
        const img = document.createElement('img'); img.src = 'img/lg/' + data.deck + '_' + data.filename + '.jpg'; img.alt = ''; img.onerror = () => img.remove(); button.prepend(img);
      }
      actions.append(button);
    }
  },
  button(text, fn) { const e = document.createElement('button'); e.textContent = text; e.onclick = fn; return e; },
  act(revision, id) {
    if (this.paused || !this.session.connected) return;
    this.dock.querySelectorAll('button').forEach(b => b.disabled = true);
    if (this.role === 'host') this.engine.act(0, revision, id).catch(e => { this.status(e.message); this.engine.sync(); });
    else this.session.send('action', { revision, id });
  },
  renderGuest(v) {
    const make = c => {
      const data = card_dict[c.index];
      const visual = new Card(data, null); if (['close', 'ranged', 'siege', 'agile'].includes(visual.row)) visual.setPower(c.power);
      // No guest rules/controller handlers. Rendering only.
      return visual.elem.cloneNode(true);
    };
    const fill = (node, cards) => { node.replaceChildren(...cards.map(make)); };
    for (const p of v.players) {
      const tag = p.id === 1 ? 'me' : 'op';
      document.querySelector('#stats-' + tag + ' .profile-img > div > div').style.backgroundImage = iconURL('deck_shield_' + p.faction);
      document.getElementById('name-' + tag).textContent = p.id === 1 ? 'You (Guest)' : 'Host';
      document.getElementById('deck-name-' + tag).textContent = factions[p.faction].name;
      document.getElementById('hand-count-' + tag).textContent = p.handCount;
      document.getElementById('score-total-' + tag).firstElementChild.textContent = p.total;
      document.getElementById('stats-' + tag).classList.toggle('current-turn', v.turn === p.id);
      document.getElementById('passed-' + tag).classList.toggle('passed', p.passed);
      for (const n of [1, 2]) document.getElementById('gem' + n + '-' + tag).classList.toggle('gem-on', p.health >= n);
      fill(document.querySelector('#leader-' + tag + ' .leader-container'), [p.leader]);
      document.querySelector('#leader-' + tag + ' .leader-container').classList.toggle('fade', !p.leaderAvailable);
      document.querySelector('#leader-' + tag + ' .leader-active').classList.toggle('hide', !p.leaderAvailable);
      fill(document.getElementById('grave-' + tag), p.grave.slice(0, 1));
      const pile = document.getElementById('deck-' + tag); pile.replaceChildren();
      const back = document.createElement('div'); back.className = 'deck-card'; back.style.backgroundImage = iconURL('deck_back_' + p.faction, 'jpg'); pile.append(back);
      const counter = document.createElement('div'); counter.className = 'deck-counter center'; counter.textContent = p.deckCount; pile.append(counter);
      if (p.hand) fill(document.getElementById('hand-row'), p.hand);
    }
    for (const r of v.rows) {
      const tag = r.owner === 1 ? 'me' : 'op';
      const row = document.querySelector('#field-' + tag + ' [data-row="' + r.type + '"]');
      fill(row.querySelector('.row-cards'), r.cards); fill(row.querySelector('.row-special'), r.special ? [r.special] : []);
      row.querySelector('.row-score').textContent = r.total;
      const overlay = row.querySelector('.row-weather');
      overlay.className = 'row-weather ' + (r.effects?.weather ? ({ close: 'frost', ranged: 'fog', siege: 'rain' })[r.type] : '');
      overlay.style.opacity = r.effects?.weather ? '1' : '0';
    }
    fill(document.getElementById('weather'), v.weather);
  },
  inspect() {
    const v = this.latest;
    if (!v) return;
    const area = document.getElementById('online-inspect-cards'); area.replaceChildren();
    const actor = this.role === 'host' ? 0 : 1;
    const groups = [['Your hand', v.players[actor].hand], ['Weather', v.weather]];
    for (const r of v.rows) groups.push([(r.owner === actor ? 'Your ' : 'Opponent’s ') + r.type + ' row', [...r.cards, ...(r.special ? [r.special] : [])]]);
    for (const p of v.players) groups.push([p.id === actor ? 'Your discards' : 'Opponent’s discards', p.grave]);
    for (const p of v.players) groups.push([p.id === actor ? 'Your leader' : 'Opponent’s leader', [p.leader]]);
    for (const [label, cards] of groups) {
      if (!cards?.length) continue;
      const heading = document.createElement('h3'); heading.textContent = label; area.append(heading);
      for (const c of cards) {
        const data = card_dict[c.index], visual = new Card(data, null);
        const description = data.name + ' · Current strength: ' + c.power + (visual.desc ? ' · ' + visual.desc : '');
        const button = this.button(data.name, () => document.getElementById('online-inspect-description').textContent = description);
        button.title = description;
        const image = document.createElement('img'); image.src = 'img/lg/' + data.deck + '_' + data.filename + '.jpg'; image.alt = data.name; button.prepend(image); area.append(button);
      }
    }
    document.getElementById('online-inspector').hidden = false;
  },
  abandon(ask = true) {
    if (ask && !confirm('Leave this session? The match cannot be recovered after leaving.')) return;
    this.playing = false; this.engine?.stop(); this.session?.send('leave'); this.session?.close(); location.reload();
  }
};
onlineApp.init();
