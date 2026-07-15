// One seam, four adapters — the game never knows which is live:
//   LocalNet    solo vs bots (host simulates bots through the same event pipe)
//   BCNet       real multiplayer across tabs of one browser (BroadcastChannel)
//   MQTTNet     online rooms over the internet, ZERO setup — a free public
//               MQTT-over-WebSocket broker relays events; no account, no keys
//   SupabaseNet online rooms with 4-letter codes (Supabase Realtime), used
//               when a project is configured (more robust/private than the
//               shared public broker)
// Contract: send() echoes to self synchronously, so every client (host included)
// processes events through one code path. sendAs() lets the host speak for bots.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../env.js';

export const makeId = () => Math.random().toString(36).slice(2, 10);
export const onlineAvailable = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
// Zero-config online works as long as the vendored MQTT client loaded; the
// broker itself is a free shared public one, so no credentials are needed.
export const p2pAvailable = () => !!window.mqtt;
// Free public brokers (WSS, reachable from an https page). We namespace topics
// so unrelated demos on the same broker never collide with our rooms.
const MQTT_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081'];

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

// Zero-setup internet play. Events fan out through a free public MQTT broker
// over WebSocket (no account, no keys). Presence reuses BCNet's proven
// ping/timeout scheme — each client heartbeats its identity on a presence
// topic and peers that go quiet are dropped. Broadcast mirrors SupabaseNet:
// send() loops back locally and publishes; the broker's echo of our own
// message is ignored (matched by `from`).
export class MQTTNet extends BaseNet {
  async join(code, me, brokerIdx = 0) {
    if (!window.mqtt) throw new Error('Online client failed to load');
    this.me = { ...me, id: this.id, joinedAt: Date.now() };
    this.peers = new Map([[this.id, { ...this.me, seen: Infinity }]]);
    const base = 'exam25x/' + code;                 // namespaced so we never clash with other broker users
    this.evTopic = base + '/e';
    this.presTopic = base + '/p';
    const url = MQTT_BROKERS[brokerIdx];
    this.client = window.mqtt.connect(url, {
      clientId: 'exam-' + this.id, clean: true, keepalive: 30,
      reconnectPeriod: 3000, connectTimeout: 8000,
    });
    try {
      await new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error('timeout')), 9000);
        this.client.once('connect', () => {
          clearTimeout(to);
          this.client.subscribe([this.evTopic, this.presTopic], { qos: 0 }, e => e ? rej(e) : res());
        });
        this.client.once('error', e => { clearTimeout(to); rej(e); });
      });
    } catch (e) {
      try { this.client.end(true); } catch { /* closing */ }
      // try the backup broker once before giving up
      if (brokerIdx + 1 < MQTT_BROKERS.length) return this.join(code, me, brokerIdx + 1);
      throw new Error('Could not reach the online room server');
    }
    this.client.on('message', (t, payload) => {
      let m; try { m = JSON.parse(payload.toString()); } catch { return; }
      if (t === this.evTopic) { if (m.from !== this.id) this.emit(m); }   // ignore our own echoed events (already looped back)
      else if (t === this.presTopic) {
        if (m.who && m.who.id === this.id) return;                        // ignore our own presence
        if (m.k === 'ping') {
          const known = this.peers.has(m.who.id);
          this.peers.set(m.who.id, { ...m.who, seen: Date.now() });
          if (!known) { this.refresh(); this.ping(); }                    // greet a newcomer so it learns of us fast
        } else if (m.k === 'bye') { this.peers.delete(m.who); this.refresh(); }
      }
    });
    this.ping();
    this.pinger = setInterval(() => {
      this.ping();
      const cut = Date.now() - 7000; let ch = false;
      for (const [id, p] of this.peers) if (p.seen < cut) { this.peers.delete(id); ch = true; }
      if (ch) this.refresh();
    }, 2200);
    await new Promise(r => setTimeout(r, 450));
    this.refresh();
  }
  ping() { this.pub(this.presTopic, { k: 'ping', who: this.me }); }
  refresh() { this.roster = [...this.peers.values()].map(({ seen, ...p }) => p); this.emitRoster(); }
  pub(topic, obj) { try { this.client.publish(topic, JSON.stringify(obj), { qos: 0 }); } catch { /* not connected */ } }
  send(type, data) { const ev = this.loopback(type, data); this.pub(this.evTopic, ev); }
  leave() {
    clearInterval(this.pinger);
    try { this.pub(this.presTopic, { k: 'bye', who: this.id }); this.client.end(true); } catch { /* leaving */ }
  }
}

export function makeNet(mode) {
  if (mode === 'online') return new SupabaseNet();
  if (mode === 'p2p') return new MQTTNet();
  if (mode === 'bc') return new BCNet();
  return new LocalNet();
}
