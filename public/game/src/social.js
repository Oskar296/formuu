// The "social" layer: an always-on presence that runs on the MENU (independent
// of any game room) so friends can find each other, send friend requests, and
// view each other's all-time stats — all over the same free public MQTT broker
// the game uses, with no account server.
//
// Persistence without a database comes from MQTT *retained* messages: the broker
// keeps the last retained message on a topic and hands it to whoever subscribes
// next. So a friend request published (retained) to the recipient's request
// topic is waiting for them the next time they connect — even if the sender has
// since gone offline. The same trick makes a player's stats readable by friends
// while that player is offline. Everything degrades safely: if the broker never
// connects, the friends UI still renders (just offline).
//
// Topic map (all under exam25x/u/<code>):
//   <me>/rq/<sender>   retained  — an incoming friend request (empty = cleared)
//   <me>/ak/<sender>   retained  — an incoming "request accepted" (empty = cleared)
//   <me>/st            retained  — my public stats snapshot, for friends to read
//   <me>               live      — presence pings + on-demand stat requests

import { MQTT_BROKERS } from './net.js';
import { profile, validCode } from './profile.js';

const U = code => 'exam25x/u/' + code;
const PKEY = 'exam2-social';   // persisted pending requests (outgoing + incoming)

export function makeSocial() {
  let client = null, connected = false;
  const listeners = {};                    // event -> [cb]
  const lastSeen = new Map();              // friendCode -> ts (presence)
  const statCache = new Map();             // friendCode -> last stats blob seen
  const statWaiters = new Map();           // friendCode -> [resolve fns]
  let store = { out: [], in: [] };         // out: codes we requested; in: [{code,name,color}]
  try { const s = JSON.parse(localStorage.getItem(PKEY)); if (s && typeof s === 'object') store = { out: s.out || [], in: s.in || [] }; } catch { /* fresh */ }
  const persist = () => { try { localStorage.setItem(PKEY, JSON.stringify(store)); } catch { /* private mode */ } };

  const on = (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); };
  const fire = ev => { for (const cb of listeners[ev] || []) { try { cb(); } catch { /* ignore */ } } };
  const me = () => ({ code: profile.uid, name: profile.name || 'Player', color: profile.color });
  const send = (topic, obj, retain = false) => {
    if (client && connected) { try { client.publish(topic, obj == null ? '' : JSON.stringify(obj), { qos: 0, retain }); } catch { /* offline */ } }
  };
  const seg = (topic, i) => topic.split('/')[i];   // exam25x[0]/u[1]/<code>[2]/<kind>[3]/<sender>[4]
  // private, token-gated topic holding THIS account's friends list, so only your
  // own linked devices (which know the token) can read/write it
  const privF = () => U(profile.uid) + '/' + profile.token + '/f';
  let adopting = false, adoptTimer = null;   // true right after linking a device, until cloud state is pulled
  // Defer finishing adoption a beat so ALL retained state (stats + friends,
  // delivered synchronously in one subscribe batch) is merged before we
  // re-publish — otherwise an early re-publish clobbers not-yet-read topics.
  function scheduleFinishAdopt() { if (!adopting) return; clearTimeout(adoptTimer); adoptTimer = setTimeout(finishAdopt, 350); }

  function handle(topic, raw) {
    if (topic === privF()) {                // this account's friends list from another of my devices
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m && Array.isArray(m.friends)) profile.mergeFriends(m.friends);
      if (m && Array.isArray(m.out)) for (const c of m.out) if (!store.out.includes(c) && !profile.isFriend(c)) store.out.push(c);
      persist(); fire('friends'); fire('requests');
      if (adopting) scheduleFinishAdopt();
      return;
    }
    const kind = seg(topic, 3);
    if (kind === 'rq') {                    // an incoming friend request (retained or live)
      const from = seg(topic, 4);
      if (!validCode(from) || from === profile.uid) return;
      if (!raw) { store.in = store.in.filter(r => r.code !== from); persist(); fire('requests'); return; }   // cleared
      let m; try { m = JSON.parse(raw); } catch { return; }
      lastSeen.set(from, Date.now());
      if (profile.isFriend(from)) { profile.addFriend({ code: from, name: m.name, color: m.color }); send(U(from) + '/ak/' + profile.uid, me(), true); fire('friends'); return; }
      if (!store.in.some(r => r.code === from)) store.in.push({ code: from, name: m.name, color: m.color });
      else { const r = store.in.find(r => r.code === from); r.name = m.name; r.color = m.color; }
      persist(); fire('requests');
      return;
    }
    if (kind === 'ak') {                    // someone accepted my request (retained or live)
      const from = seg(topic, 4);
      if (!validCode(from)) return;
      if (raw) { let m; try { m = JSON.parse(raw); } catch { m = {}; } profile.addFriend({ code: from, name: m.name, color: m.color }); }
      store.out = store.out.filter(c => c !== from); persist();
      send(U(profile.uid) + '/ak/' + from, null, true);     // clear the retained ack so we don't reprocess it
      send(U(from) + '/rq/' + profile.uid, null, true);     // and clear our now-answered outgoing request
      lastSeen.set(from, Date.now());
      fire('friends'); fire('requests');
      return;
    }
    if (kind === 'st') {                    // a retained stats snapshot
      const from = seg(topic, 2);
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (!m || !m.code) return;
      if (from === profile.uid) {           // my OWN account's stats (from another device)
        if (adopting && m.stats) { profile.setStats(m.stats); scheduleFinishAdopt(); }
        return;
      }
      lastSeen.set(from, Date.now());
      statCache.set(from, m);
      const ws = statWaiters.get(from); if (ws) { statWaiters.delete(from); ws.forEach(r => r(m)); }
      return;
    }
    // live inbox: presence + on-demand stat requests
    let m; try { m = JSON.parse(raw); } catch { return; }
    const from = m.from && (m.from.code || m.from);
    if (!validCode(from) || from === profile.uid) return;
    if (m.k === 'ping') { lastSeen.set(from, Date.now()); fire('presence'); }
    else if (m.k === 'sreq') { lastSeen.set(from, Date.now()); publishStats(); }   // refresh my retained stats so they can read it
  }

  function publishStats() { send(U(profile.uid) + '/st', profile.publicProfile(), true); }
  // the account's friends list, kept retained on the token-gated topic so every
  // linked device converges on the same list
  function publishFriends() { send(privF(), { friends: profile.friends, out: store.out }, true); }

  function announce() {                     // (re)assert my presence + retained state
    if (adopting) return;                   // don't overwrite cloud state before we've pulled it
    publishStats(); publishFriends();
    for (const c of store.out) send(U(c) + '/rq/' + profile.uid, me(), true);   // keep outgoing requests alive on the broker
    for (const f of profile.friends) send(U(f.code), { k: 'ping', from: me() });
  }
  // finish adopting a linked account: stop suppressing, then publish our now-
  // merged state so this device is fully in sync
  function finishAdopt() { if (!adopting) return; adopting = false; announce(); fire('friends'); fire('requests'); }

  function connect(idx = 0) {
    if (!window.mqtt) return;               // client failed to load — stay offline
    client = window.mqtt.connect(MQTT_BROKERS[idx], {
      clientId: 'exam-soc-' + profile.uid + '-' + ((Math.random() * 1e4) | 0), clean: true, keepalive: 30, reconnectPeriod: 4000, connectTimeout: 8000,
    });
    client.on('connect', () => {
      connected = true;
      // wildcards pick up every retained request/accept waiting for us; own /st
      // and the private friends topic carry this account's cloud state
      client.subscribe([U(profile.uid), U(profile.uid) + '/rq/+', U(profile.uid) + '/ak/+', U(profile.uid) + '/st', privF()], { qos: 0 });
      if (adopting) setTimeout(finishAdopt, 1800);   // fallback if the account has no cloud snapshot yet
      else announce();
      fire('presence');
    });
    client.on('message', (t, payload) => handle(t, payload ? payload.toString() : ''));
    client.on('error', () => { if (!connected && idx + 1 < MQTT_BROKERS.length) { try { client.end(true); } catch { /* */ } connect(idx + 1); } });
  }

  const api = {
    start() { connect(0); this.pinger = setInterval(announce, 12000); },
    onFriends(cb) { on('friends', cb); },
    onRequests(cb) { on('requests', cb); },
    onPresence(cb) { on('presence', cb); },
    get online() { return connected; },
    get incoming() { return store.in.slice(); },
    get outgoing() { return store.out.slice(); },
    isOnline(code) { return Date.now() - (lastSeen.get(code) || 0) < 30000; },
    myCode() { return profile.uid; },
    publishStats,
    // send (or re-send) a friend request by code — waits on the broker for them
    request(code) {
      code = String(code || '').toUpperCase();
      if (!validCode(code) || code === profile.uid || profile.isFriend(code)) return false;
      if (!store.out.includes(code)) { store.out.push(code); persist(); }
      send(U(code) + '/rq/' + profile.uid, me(), true);
      publishFriends();
      fire('requests');
      return true;
    },
    accept(code) {
      const r = store.in.find(x => x.code === code); if (!r) return;
      profile.addFriend(r);
      store.in = store.in.filter(x => x.code !== code); persist();
      send(U(code) + '/ak/' + profile.uid, me(), true);       // durable "accepted" for them
      send(U(profile.uid) + '/rq/' + code, null, true);       // clear the retained request we just answered
      send(U(code), { k: 'ping', from: me() });
      publishFriends();                                        // sync the new friend to my other devices
      fire('friends'); fire('requests');
    },
    decline(code) {
      store.in = store.in.filter(x => x.code !== code); persist();
      send(U(profile.uid) + '/rq/' + code, null, true);       // clear it so it doesn't come back on reconnect
      fire('requests');
    },
    unfriend(code) { profile.removeFriend(code); publishFriends(); fire('friends'); },
    // ---- cross-device account linking ----------------------------------------
    myAccount() { return profile.account; },
    // sign this device in as an existing account (from its account code); the
    // account's friends + stats then sync in from the cloud
    relink(uid, token) {
      if (!profile.setAccount(uid, token)) return false;
      store = { out: [], in: [] }; persist();     // old identity's pending items don't carry over
      statCache.clear(); lastSeen.clear();
      adopting = true;
      try { if (client) client.end(true); } catch { /* */ }
      connected = false; connect(0);
      return true;
    },
    // view a friend's stats: prefer their retained snapshot (works while they're
    // offline); fall back to cache, and nudge them for a fresh copy if online.
    viewStats(code, timeout = 3000) {
      if (statCache.has(code)) { send(U(code), { k: 'sreq', from: me() }); return Promise.resolve(statCache.get(code)); }
      return new Promise(res => {
        if (!connected) return res(null);
        if (!statWaiters.has(code)) statWaiters.set(code, []);
        statWaiters.get(code).push(res);
        if (client) { try { client.subscribe(U(code) + '/st', { qos: 0 }); } catch { /* */ } }
        send(U(code), { k: 'sreq', from: me() });
        setTimeout(() => { const ws = statWaiters.get(code); if (ws && ws.includes(res)) { statWaiters.set(code, ws.filter(r => r !== res)); res(statCache.get(code) || null); } }, timeout);
      });
    },
  };
  return api;
}
