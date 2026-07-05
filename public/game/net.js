import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env.js';

// One seam, three adapters. The game code never knows which one is live:
//   LocalNet    — offline solo (host is you; bots are simulated by the host)
//   BCNet       — BroadcastChannel; real multiplayer across tabs of one browser
//   SupabaseNet — Supabase Realtime; real online rooms with join codes
//
// Contract: join() resolves once connected; send(type, data) fans out to
// EVERYONE INCLUDING SELF (loopback), so all clients (host included) process
// events through the same single code path.

export function makeId() { return Math.random().toString(36).slice(2, 10); }

export function onlineAvailable() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); }

class BaseNet {
  constructor() {
    this.id = makeId();
    this.handlers = [];
    this.rosterHandlers = [];
    this.roster = []; // [{id, name, role, joinedAt}]
  }
  onEvent(cb) { this.handlers.push(cb); }
  onRoster(cb) { this.rosterHandlers.push(cb); }
  emit(ev) { for (const h of this.handlers) h(ev); }
  emitRoster() { for (const h of this.rosterHandlers) h(this.roster.slice()); }
  isHost() {
    if (!this.roster.length) return true;
    const sorted = this.roster.slice().sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    return sorted[0].id === this.id;
  }
  loopback(type, data) {
    // synchronous echo: our own events apply in-order, immediately
    const ev = { type, data, from: this.id, t: Date.now() };
    this.emit(ev);
    return ev;
  }
  // emit an event as if it came from another participant (used to drive bots
  // in solo mode — the host simulates them through the same event pipeline).
  sendAs(fromId, type, data) {
    const ev = { type, data, from: fromId, t: Date.now() };
    this.emit(ev);
    return ev;
  }
}

export class LocalNet extends BaseNet {
  async join(_code, name, role, skin) {
    this.roster = [{ id: this.id, name, role, skin, joinedAt: Date.now() }];
    this.emitRoster();
  }
  // add AI participants to the roster (solo vs bots). The human joined first,
  // so isHost() stays true for the human and they simulate the bots.
  addBots(bots) {
    for (const b of bots) this.roster.push(b);
    this.emitRoster();
  }
  send(type, data) { this.loopback(type, data); }
  leave() {}
}

export class BCNet extends BaseNet {
  async join(code, name, role, skin) {
    this.me = { id: this.id, name, role, skin, joinedAt: Date.now() };
    this.ch = new BroadcastChannel('exam-' + code);
    this.peers = new Map([[this.id, { ...this.me, seen: Infinity }]]);
    this.ch.onmessage = ({ data: msg }) => {
      if (msg.kind === 'ping') {
        const known = this.peers.has(msg.who.id);
        this.peers.set(msg.who.id, { ...msg.who, seen: Date.now() });
        if (!known) { this.refreshRoster(); this.ping(); }
      } else if (msg.kind === 'bye') {
        this.peers.delete(msg.who); this.refreshRoster();
      } else {
        this.emit(msg.ev);
      }
    };
    this.ping();
    this.pinger = setInterval(() => {
      this.ping();
      const cut = Date.now() - 4000;
      let changed = false;
      for (const [id, p] of this.peers) if (p.seen < cut) { this.peers.delete(id); changed = true; }
      if (changed) this.refreshRoster();
    }, 1200);
    await new Promise(r => setTimeout(r, 350)); // let existing tabs announce
    this.refreshRoster();
  }
  ping() { this.ch.postMessage({ kind: 'ping', who: this.me }); }
  refreshRoster() {
    this.roster = [...this.peers.values()].map(({ seen, ...p }) => p);
    this.emitRoster();
  }
  send(type, data) {
    const ev = this.loopback(type, data);
    this.ch.postMessage({ kind: 'ev', ev });
  }
  leave() {
    clearInterval(this.pinger);
    try { this.ch.postMessage({ kind: 'bye', who: this.id }); this.ch.close(); } catch { /* closing */ }
  }
}

export class SupabaseNet extends BaseNet {
  async join(code, name, role, skin) {
    // window.supabase is provided by vendor/supabase.umd.js
    this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.me = { id: this.id, name, role, skin, joinedAt: Date.now() };
    this.chan = this.client.channel('exam:' + code, {
      config: { presence: { key: this.id }, broadcast: { self: false } },
    });
    this.chan.on('presence', { event: 'sync' }, () => {
      const state = this.chan.presenceState();
      this.roster = Object.values(state).map(metas => metas[0])
        .map(m => ({ id: m.id, name: m.name, role: m.role, skin: m.skin, joinedAt: m.joinedAt }));
      this.emitRoster();
    });
    this.chan.on('broadcast', { event: 'e' }, ({ payload }) => this.emit(payload));
    await new Promise((resolve, reject) => {
      this.chan.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.chan.track(this.me);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error('Could not join online room (' + status + ')'));
        }
      });
    });
  }
  send(type, data) {
    const ev = this.loopback(type, data);
    this.chan.send({ type: 'broadcast', event: 'e', payload: ev });
  }
  leave() { try { this.chan.unsubscribe(); } catch { /* leaving */ } }
}

export function makeNet(mode) {
  if (mode === 'bc') return new BCNet();
  if (mode === 'online') return new SupabaseNet();
  return new LocalNet();
}
