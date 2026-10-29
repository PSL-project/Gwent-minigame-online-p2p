'use strict';
const onlineApp = window.onlineApp = {
  session: null, engine: null, role: null, playing: false, paused: true,
  decks: [null, null], localReady: false, latest: null,
  init() {
    this.root = document.getElementById('online-menu');
    this.banner = document.getElementById('online-banner');
    this.native = new NativeOnlineUI(this);
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
    document.getElementById('online-retry').onclick = () => this.retry();
    document.querySelectorAll('[data-online-abandon]').forEach(e => e.onclick = () => this.abandon());
    EventManager.gameOpened.bind(() => document.getElementById('mode-menu').hidden = true);
    EventManager.customizationOpened.bind(() => document.getElementById('mode-menu').hidden = !!this.session);
    const singleStart = dm.startNewGame.bind(dm);
    dm.startNewGame = () => this.session ? this.setReady() : singleStart();
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
          this.paused = false; this.pendingRevision = null; this.status('Connected — private ' + (role === 'host' ? 'host' : 'guest') + ' session');
          this.engine?.resume();
          if (role === 'host') this.sendLobby();
          else if (this.localReady && !this.playing) this.session.send('ready', { deck: this.decks[1] });
          this.refresh();
        },
        pause: () => { this.paused = true; this.pendingRevision = null; this.status('Disconnected — match paused. Attempting to reconnect…'); this.engine?.sync(); this.refresh(); },
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
          if (this.latest && msg.view.revision < this.latest.revision) return;
          if (!this.playing) {
            EventManager.gameOpened.dispatch(); Carousel.curr = null;
            document.getElementById('carousel').classList.add('hide');
          }
          this.playing = true; this.latest = msg.view;
          this.root.hidden = true; document.body.classList.add('online-playing');
          document.getElementById('deck-customization').classList.add('hide');
          this.refresh();
        } else if (msg.type === 'notice' && typeof msg.message === 'string') { this.pendingRevision = null; this.status(msg.message.slice(0, 200)); }
      }
    } catch (err) { this.status(err.message); }
  },
  maybeStart() {
    if (this.role !== 'host' || this.playing || !this.session.connected || !this.decks.every(Boolean)) return;
    EventManager.gameOpened.dispatch();
    this.playing = true; this.root.hidden = true; document.body.classList.add('online-playing');
    document.getElementById('carousel').classList.add('hide'); Carousel.curr = null;
    this.createAuthority().then(authority => {
      if (!this.playing) return;
      this.engine = authority.createOnlineEngine((host, guest) => {
        this.latest = host; this.session.send('state', { view: guest }); this.refresh();
      }, () => this.session.connected && !this.paused);
      this.engine.start(this.decks).catch(e => this.engine.fail(e));
    }).catch(e => this.status('Unable to start host rules: ' + e.message));
  },
  createAuthority() {
    // The legacy engine is DOM-backed. Keep its document separate from the visible
    // projection so rendering and clicks can never mutate authoritative objects.
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.hidden = true; frame.title = 'Host rules'; frame.src = 'index.html?authority=1';
      this.authorityFrame = frame;
      frame.onload = () => frame.contentWindow.createOnlineEngine ? resolve(frame.contentWindow) : reject(Error('Rules document did not load'));
      frame.onerror = () => reject(Error('Rules document unavailable'));
      document.body.append(frame);
    });
  },
  validateView(v) {
    if (v?.uiSchema !== 1) throw Error('Incompatible gameplay interface. Both players need the native multiplayer UI build.');
    const int = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
    const card = c => c && GwentProtocol.isToken(c.uid) && Number.isInteger(c.index) && !!card_dict[c.index] && Number.isFinite(c.power) && Math.abs(c.power) < 1000000;
    const cards = a => Array.isArray(a) && a.length <= 500 && a.every(card);
    if (!v || !int(v.revision) || !['playing', 'complete'].includes(v.state) || !int(v.round) || ![0, 1, null].includes(v.turn) || !Array.isArray(v.players) || v.players.length !== 2 || !Array.isArray(v.rows) || v.rows.length !== 6 || !cards(v.weather) || !Array.isArray(v.history) || v.history.length > 10 || !Array.isArray(v.actions) || v.actions.length > 2048) throw Error('Invalid host state');
    for (let i = 0; i < 2; i++) {
      const p = v.players[i];
      if (p.id !== i || !Object.hasOwn(factions, p.faction) || !int(p.health) || !int(p.total) || !int(p.handCount) || !int(p.deckCount) || !card(p.leader) || !cards(p.grave) || (i === 0 ? p.hand !== null : !cards(p.hand))) throw Error('Invalid player view');
    }
    if (!v.rows.every(r => [0, 1].includes(r.owner) && ['close', 'ranged', 'siege'].includes(r.type) && int(r.total) && cards(r.cards) && (!r.special || card(r.special)))) throw Error('Invalid board view');
    const destination = d => !d || (d.type === 'weather' || d.type === 'any-row') || (d.type === 'card' && GwentProtocol.isToken(d.uid)) || (d.type === 'row' && [0, 1].includes(d.owner) && ['close', 'ranged', 'siege'].includes(d.row));
    if (!v.actions.every(a => a && GwentProtocol.isToken(a.id) && ['play', 'pass', 'leader', 'choice'].includes(a.kind) && typeof a.label === 'string' && a.label.length < 300 && (!a.card || card(a.card)) && (a.kind !== 'play' || a.card && a.destination) && destination(a.destination))) throw Error('Invalid actions');
    if (v.choiceCard && !card(v.choiceCard)) throw Error('Invalid choice preview');
    if (!v.history.every(r => r && [0, 1, null].includes(r.winner) && Array.isArray(r.scores) && r.scores.length === 2 && r.scores.every(int))) throw Error('Invalid round history');
    if (v.prompt !== null && (typeof v.prompt !== 'string' || v.prompt.length > 1000) || v.fault !== null && (typeof v.fault !== 'string' || v.fault.length > 1000)) throw Error('Invalid state message');
  },
  refresh() {
    if (!this.session) return;
    const summary = this.role === 'guest' ? this.remoteLobby || [null, null] : this.decks;
    document.getElementById('online-players').textContent = summary.map((d, i) => (i ? 'Guest' : 'Host') + ': ' + (d ? factions[d.faction].name + ' — Ready' : 'choosing deck')).join('  |  ');
    document.getElementById('online-ready').disabled = this.localReady || this.playing;
    document.getElementById('online-unready').disabled = !this.localReady || this.playing;
    document.getElementById('online-customize').disabled = this.localReady || this.playing;
    this.banner.classList.toggle('disconnected', this.paused);
    document.getElementById('online-lobby-open').hidden = this.playing;
    if (this.latest && this.pendingRevision !== this.latest.revision) this.pendingRevision = null;
    if (this.playing) this.native.render(this.latest);
  },
  act(revision, id) {
    if (this.paused || !this.session.connected || this.pendingRevision === revision) return;
    const action = this.latest?.actions.find(a => a.id === id);
    if (!action || this.latest.revision !== revision) return;
    this.pendingRevision = revision;
    this.native.lock();
    if (this.role === 'host') this.engine.act(0, revision, id).catch(e => {
      this.pendingRevision = null; this.status(e.message); this.engine.sync();
    });
    else this.session.send('action', { revision, id });
  },
  abandon(ask = true) {
    if (ask && !confirm('Leave this session? The match cannot be recovered after leaving.')) return;
    this.playing = false; this.engine?.stop(); this.session?.send('leave'); this.session?.close(); location.reload();
  }
};
if (!new URLSearchParams(location.search).has('authority')) onlineApp.init();
