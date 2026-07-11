// One seam, three adapters — the game never knows which is live:
//   LocalNet    solo vs bots (host simulates bots through the same event pipe)
//   BCNet       real multiplayer across tabs of one browser (BroadcastChannel)
//   SupabaseNet online rooms with 4-letter codes (Supabase Realtime)
// Contract: send() echoes to self synchronously, so every client (host included)
// processes events through one code path. sendAs() lets the host speak for bots.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../env.js';

export const makeId = () => Math.random().toString(36).slice(2, 10);
export const onlineAvailable = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);

class BaseNet {
  constructor() { this.id = makeId(); this.handlers = []; this.rosterHandlers = []; this.roster = []; }
  onEvent(cb) { this.handlers.push(cb); }
  onRoster(cb) { this.rosterHandlers.push(cb); }
  emit(ev) { for (const h of this.handlers) h(ev); }
  emitRoster() { for (const h of this.rosterHandlers) h(this.roster.slice()); }
  isHost() {
    if (!this.roster.length) return true;
    const s = this.roster.slice().sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    return s[0].id === this.id;
  }
  loopback(type, data, from = this.id) { const ev = { type, data, from, t: Date.now() }; this.emit(ev); return ev; }
  sendAs(fromId, type, data) { return this.loopback(type, data, fromId); }
}

export class LocalNet extends BaseNet {
  async join(_code, me) { this.roster = [{ ...me, id: this.id, joinedAt: Date.now() }]; this.emitRoster(); }
  addBots(bots) { this.roster.push(...bots); this.emitRoster(); }
  send(type, data) { this.loopback(type, data); }
  leave() {}
}

export class BCNet extends BaseNet {
  async join(code, me) {
    this.me = { ...me, id: this.id, joinedAt: Date.now() };
    this.ch = new BroadcastChannel('exam-' + code);
    this.peers = new Map([[this.id, { ...this.me, seen: Infinity }]]);
    this.ch.onmessage = ({ data: m }) => {
      if (m.k === 'ping') {
        const known = this.peers.has(m.who.id);
        this.peers.set(m.who.id, { ...m.who, seen: Date.now() });
        if (!known) { this.refresh(); this.ping(); }
      } else if (m.k === 'bye') { this.peers.delete(m.who); this.refresh(); }
      else this.emit(m.ev);
    };
    this.ping();
    this.pinger = setInterval(() => {
      this.ping();
      const cut = Date.now() - 4000; let ch = false;
      for (const [id, p] of this.peers) if (p.seen < cut) { this.peers.delete(id); ch = true; }
      if (ch) this.refresh();
    }, 1200);
    await new Promise(r => setTimeout(r, 350));
    this.refresh();
  }
  ping() { this.ch.postMessage({ k: 'ping', who: this.me }); }
  refresh() { this.roster = [...this.peers.values()].map(({ seen, ...p }) => p); this.emitRoster(); }
  send(type, data) { const ev = this.loopback(type, data); this.ch.postMessage({ k: 'ev', ev }); }
  leave() { clearInterval(this.pinger); try { this.ch.postMessage({ k: 'bye', who: this.id }); this.ch.close(); } catch { /* closing */ } }
}

export class SupabaseNet extends BaseNet {
  async join(code, me) {
    this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.me = { ...me, id: this.id, joinedAt: Date.now() };
    this.chan = this.client.channel('exam:' + code, { config: { presence: { key: this.id }, broadcast: { self: false } } });
    this.chan.on('presence', { event: 'sync' }, () => {
      this.roster = Object.values(this.chan.presenceState()).map(m => m[0])
        .map(({ id, name, role, skin, joinedAt }) => ({ id, name, role, skin, joinedAt }));
      this.emitRoster();
    });
    this.chan.on('broadcast', { event: 'e' }, ({ payload }) => this.emit(payload));
    await new Promise((res, rej) => {
      this.chan.subscribe(async s => {
        if (s === 'SUBSCRIBED') { await this.chan.track(this.me); res(); }
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') rej(new Error('Could not join the online room (' + s + ')'));
      });
    });
  }
  send(type, data) { const ev = this.loopback(type, data); this.chan.send({ type: 'broadcast', event: 'e', payload: ev }); }
  leave() { try { this.chan.unsubscribe(); } catch { /* leaving */ } }
}

export function makeNet(mode) {
  if (mode === 'online') return new SupabaseNet();
  if (mode === 'bc') return new BCNet();
  return new LocalNet();
}
