// The "social" layer: an always-on presence that runs on the MENU (independent
// of any game room) so friends can find each other, send friend requests, and
// peek at each other's all-time stats — all over the same free public MQTT
// broker the game uses, with no account server.
//
// Each user listens on a personal inbox topic  exam25x/u/<myCode>  and talks to
// a friend by publishing to  exam25x/u/<theirCode>.  Everything degrades safely:
// if the broker never connects, the friends UI still renders (just offline).
//
// Delivery is best-effort: a friend must be online to receive a request, but we
// re-send pending outgoing requests on a timer (and persist them), so they land
// as soon as both people are online at the same time.

import { MQTT_BROKERS } from './net.js';
import { profile, validCode } from './profile.js';

const inbox = code => 'exam25x/u/' + code;
const PKEY = 'exam2-social';   // persisted pending requests (outgoing + incoming)

export function makeSocial() {
  let client = null, connected = false, brokerIdx = 0;
  const listeners = {};                    // event -> [cb]
  const lastSeen = new Map();              // friendCode -> ts (presence)
  const statWaiters = new Map();           // friendCode -> resolve fn
  let store = { out: [], in: [] };         // out: codes we requested; in: [{code,name,color}]
  try { const s = JSON.parse(localStorage.getItem(PKEY)); if (s && typeof s === 'object') store = { out: s.out || [], in: s.in || [] }; } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(PKEY, JSON.stringify(store)); } catch { /* private mode */ } };

  const on = (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); };
  const fire = ev => { for (const cb of listeners[ev] || []) { try { cb(); } catch { /* ignore */ } } };
  const me = () => ({ code: profile.uid, name: profile.name || 'Player', color: profile.color });
  const pub = (code, obj) => { if (client && connected) { try { client.publish(inbox(code), JSON.stringify(obj), { qos: 0 }); } catch { /* offline */ } } };

  function handle(msg) {
    if (!msg || !validCode(msg.from && msg.from.code || msg.from)) return;
    const fromCode = msg.from.code || msg.from;
    switch (msg.k) {
      case 'freq': {                        // someone wants to be my friend
        lastSeen.set(fromCode, Date.now());
        if (profile.isFriend(fromCode)) { profile.addFriend(msg.from); pub(fromCode, { k: 'fack', from: me() }); fire('friends'); break; }
        if (!store.in.some(r => r.code === fromCode)) { store.in.push({ code: fromCode, name: msg.from.name, color: msg.from.color }); persist(); fire('requests'); }
        else { const r = store.in.find(r => r.code === fromCode); r.name = msg.from.name; r.color = msg.from.color; persist(); }
        break;
      }
      case 'fack': {                        // my request was accepted
        lastSeen.set(fromCode, Date.now());
        profile.addFriend(msg.from);
        store.out = store.out.filter(c => c !== fromCode); persist();
        fire('friends'); fire('requests');
        break;
      }
      case 'sreq': { lastSeen.set(fromCode, Date.now()); pub(fromCode, { k: 'sres', from: profile.publicProfile() }); break; }
      case 'sres': {                        // a friend's shared stats came back
        lastSeen.set(fromCode, Date.now());
        const w = statWaiters.get(fromCode); if (w) { statWaiters.delete(fromCode); w(msg.from); }
        break;
      }
      case 'ping': lastSeen.set(fromCode, Date.now()); fire('presence'); break;
    }
  }

  function pingFriends() {                   // announce I'm online to my friends + retry pending requests
    for (const f of profile.friends) pub(f.code, { k: 'ping', from: me() });
    for (const c of store.out) pub(c, { k: 'freq', from: me() });
  }

  function connect(idx = 0) {
    if (!window.mqtt) return;                // client failed to load — stay offline
    brokerIdx = idx;
    client = window.mqtt.connect(MQTT_BROKERS[idx], {
      clientId: 'exam-soc-' + profile.uid, clean: true, keepalive: 30, reconnectPeriod: 4000, connectTimeout: 8000,
    });
    client.on('connect', () => {
      connected = true;
      client.subscribe(inbox(profile.uid), { qos: 0 });
      pingFriends();
      fire('presence');
    });
    client.on('message', (_t, payload) => { let m; try { m = JSON.parse(payload.toString()); } catch { return; } handle(m); });
    client.on('error', () => {               // hop to the backup broker once
      if (!connected && idx + 1 < MQTT_BROKERS.length) { try { client.end(true); } catch { /* */ } connect(idx + 1); }
    });
  }

  const api = {
    start() { connect(0); this.pinger = setInterval(pingFriends, 10000); },
    onFriends(cb) { on('friends', cb); },
    onRequests(cb) { on('requests', cb); },
    onPresence(cb) { on('presence', cb); },
    get online() { return connected; },
    get incoming() { return store.in.slice(); },
    get outgoing() { return store.out.slice(); },
    isOnline(code) { return Date.now() - (lastSeen.get(code) || 0) < 26000; },
    myCode() { return profile.uid; },
    // send (or re-send) a friend request by code
    request(code) {
      code = String(code || '').toUpperCase();
      if (!validCode(code) || code === profile.uid || profile.isFriend(code)) return false;
      if (!store.out.includes(code)) { store.out.push(code); persist(); }
      pub(code, { k: 'freq', from: me() });
      fire('requests');
      return true;
    },
    accept(code) {
      const r = store.in.find(x => x.code === code); if (!r) return;
      profile.addFriend(r);
      store.in = store.in.filter(x => x.code !== code); persist();
      pub(code, { k: 'fack', from: me() });
      pub(code, { k: 'ping', from: me() });
      fire('friends'); fire('requests');
    },
    decline(code) { store.in = store.in.filter(x => x.code !== code); persist(); fire('requests'); },
    unfriend(code) { profile.removeFriend(code); fire('friends'); },
    // ask a friend for their current stats; resolves null if they don't answer
    viewStats(code, timeout = 2500) {
      return new Promise(res => {
        if (!connected) return res(null);
        statWaiters.set(code, res);
        pub(code, { k: 'sreq', from: profile.uid });
        setTimeout(() => { if (statWaiters.get(code) === res) { statWaiters.delete(code); res(null); } }, timeout);
      });
    },
  };
  return api;
}
