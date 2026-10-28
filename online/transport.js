/* PeerJS transport: public signaling, invitation authentication, bound recovery. */
(function (root) {
  'use strict';
  const P = root.GwentProtocol || require('./protocol.js');
  class Session {
    constructor(PeerClass, callbacks = {}, timing = {}) {
      this.Peer = PeerClass; this.callbacks = callbacks; this.role = null;
      this.connected = false; this.closed = false; this.lastSeen = 0;
      this.interval = timing.interval || 2000; this.timeout = timing.timeout || 12000;
      this.pending = new Set(); this.credential = P.token();
    }
    emit(name, ...args) { this.callbacks[name]?.(...args); }
    async host() {
      this.role = 'host'; this.hostId = 'gc-' + P.token(); this.secret = P.token();
      await this.openPeer(this.hostId);
      return 'GC1-' + this.hostId.slice(3) + '-' + this.secret;
    }
    async join(code) {
      this.role = 'guest'; const data = P.invitation(code);
      this.hostId = data.id; this.secret = data.secret;
      await this.openPeer('gc-' + P.token()); this.dial();
    }
    openPeer(id) {
      this.peerId = id;
      return new Promise((resolve, reject) => {
        const peer = this.peer = new this.Peer(id, { secure: true, debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } });
        const deadline = setTimeout(() => reject(Error('Signaling timed out. Check your internet connection and retry.')), 20000);
        peer.on('open', () => { clearTimeout(deadline); resolve(); });
        peer.on('connection', conn => this.role === 'host' ? this.attach(conn) : conn.close());
        peer.on('disconnected', () => this.emit('status', 'Signaling interrupted; reconnecting…'));
        peer.on('error', error => { this.emit('error', new Error('Connection: ' + (error.type || error.message))); if (!peer.open) { clearTimeout(deadline); reject(error); } });
        if (!this.timer) this.timer = setInterval(() => this.tick(), this.interval);
      });
    }
    dial() {
      if (this.closed || !this.peer?.open || this.connected || this.dialing) return;
      this.dialing = true;
      this.attach(this.peer.connect(this.hostId, { reliable: true, serialization: 'json', label: 'gwent-v1' }));
    }
    attach(conn) {
      if (this.closed || this.pending.size >= 4 || (this.role === 'host' && this.connected)) { conn.close(); return; }
      this.pending.add(conn);
      let authenticated = false, count = 0, windowStart = Date.now();
      const deadline = setTimeout(() => { if (!authenticated) { drop(); conn.close(); } }, 15000);
      const drop = () => {
        clearTimeout(deadline); this.pending.delete(conn);
        if (this.conn === conn) { this.conn = null; this.connected = false; this.emit('pause'); }
        if (this.role === 'guest') this.dialing = false;
      };
      let nonce, authenticating = false;
      conn.on('open', async () => {
        if (this.role === 'guest') {
          try {
            nonce = P.token();
            this.raw(conn, 'hello', { nonce, credential: this.credential, proof: await P.proof(this.secret, nonce + this.credential + 'guest') });
          } catch (error) { this.emit('error', error); drop(); conn.close(); }
        }
      });
      let inbox = Promise.resolve(), queued = 0;
      const receive = async value => {
        try {
          if (Date.now() - windowStart > 1000) { count = 0; windowStart = Date.now(); }
          if (++count > 100) throw Error('Message rate exceeded');
          const msg = P.envelope(value);
          if (!authenticated) {
            if (authenticating) throw Error('Authentication already in progress');
            authenticating = true;
            if (this.role === 'host') {
              if (this.connected || msg.type !== 'hello' || !P.isToken(msg.nonce) || !P.isToken(msg.credential) || (this.guestCredential && msg.credential !== this.guestCredential)) throw Error('Invitation or recovery credential rejected');
              if (msg.proof !== await P.proof(this.secret, msg.nonce + msg.credential + 'guest') || this.connected) throw Error('Invitation authentication failed');
              this.guestCredential = msg.credential;
              this.raw(conn, 'welcome', { proof: await P.proof(this.secret, msg.nonce + msg.credential + 'host') });
            } else if (msg.type !== 'welcome' || conn.peer !== this.hostId || msg.proof !== await P.proof(this.secret, nonce + this.credential + 'host')) throw Error('Host authentication failed');
            if (this.closed || !conn.open) { drop(); conn.close(); return; }
            authenticated = true; clearTimeout(deadline); this.pending.delete(conn);
            const old = this.conn; this.conn = conn; this.connected = true; this.dialing = false;
            this.lastSeen = Date.now(); if (old && old !== conn) old.close();
            this.emit('connected'); return;
          }
          if (conn !== this.conn) return;
          this.lastSeen = Date.now();
          if (msg.type === 'ping') { this.send('pong'); return; }
          if (msg.type === 'pong') return;
          this.emit('message', msg);
        } catch (error) { this.emit('error', error); conn.close(); }
      };
      conn.on('data', value => {
        if (this.closed || !conn.open) return;
        if (++queued > 128) { this.emit('error', Error('Message queue limit exceeded')); drop(); conn.close(); return; }
        inbox = inbox.then(() => conn.open && receive(value)).finally(() => --queued);
      });
      conn.on('close', drop); conn.on('error', drop);
    }
    raw(conn, type, data = {}) { conn.send({ ...data, type, protocol: P.PROTOCOL, version: P.VERSION }); }
    send(type, data = {}) { if (this.connected && this.conn?.open) this.raw(this.conn, type, data); }
    tick() {
      if (this.closed) return;
      if (this.connected) {
        if (Date.now() - this.lastSeen > this.timeout) { const c = this.conn; this.conn = null; this.connected = false; this.emit('pause'); c?.close(); }
        else this.send('ping');
      }
      if (this.peer?.destroyed && !this.reopening) {
        this.reopening = true;
        this.openPeer(this.peerId).catch(e => this.emit('error', e)).finally(() => { this.reopening = false; });
      }
      if (this.peer?.disconnected && !this.peer.destroyed) { try { this.peer.reconnect(); } catch {} }
      if (!this.connected && this.role === 'guest') this.dial();
    }
    retry() { this.tick(); this.emit('status', 'Retrying connection…'); }
    close() { this.closed = true; clearInterval(this.timer); this.pending.forEach(c => c.close()); this.conn?.close(); this.peer?.destroy(); }
  }
  if (typeof module !== 'undefined') module.exports = Session; else root.GwentSession = Session;
})(globalThis);
