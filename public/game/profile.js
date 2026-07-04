import { defaultLook } from './scene.js';

// Local player profile: username, Chalk (currency), owned + equipped skins.

export const SKIN_CATALOG = [
  { id: 'newkid', name: 'New Kid', cost: 0, emoji: '🙂', look: {} },
  { id: 'sunny', name: 'Sunny', cost: 100, emoji: '🌻', look: { shirt: '#e8c33a', hair: 'fringe', hairColor: '#b8862e' } },
  { id: 'nerd', name: 'Top of Class', cost: 150, emoji: '🤓', look: { shirt: '#4e86c7', acc: 'glasses', hair: 'fringe' } },
  { id: 'skater', name: 'Skater', cost: 150, emoji: '🛹', look: { shirt: '#56a05c', acc: 'beanie', accColor: '#c05050', hair: 'none' } },
  { id: 'capkid', name: 'Benchwarmer', cost: 200, emoji: '🧢', look: { shirt: '#d95d4c', acc: 'cap', accColor: '#2e5a8a', hair: 'none' } },
  { id: 'punk', name: 'Detention Regular', cost: 250, emoji: '🎸', look: { shirt: '#20242c', acc: 'mohawk', accColor: '#d94a9a', hair: 'none' } },
  { id: 'ninja', name: 'Silent Type', cost: 300, emoji: '🥷', look: { shirt: '#2a2a36', acc: 'mask', hair: 'none', hairColor: '#171310' } },
  { id: 'robot', name: 'Calculator', cost: 400, emoji: '🤖', look: { shirt: '#8a94a4', skin: '#b8bec8', acc: 'antenna', hair: 'none' } },
  { id: 'zombie', name: 'Monday Morning', cost: 400, emoji: '🧟', look: { shirt: '#5c6a4a', skin: '#9ab87a', sleepy: true, hair: 'spikes', hairColor: '#2c3a20' } },
  { id: 'angel', name: 'Teacher\'s Pet', cost: 550, emoji: '😇', look: { shirt: '#f0ede0', acc: 'halo', hair: 'fringe', hairColor: '#e8d9a0' } },
  { id: 'royal', name: 'Valedictorian', cost: 800, emoji: '👑', look: { shirt: '#7a3a8a', acc: 'crown' } },
];

const KEY = 'exam-profile';
let P = null;

function load() {
  if (P) return P;
  try { P = JSON.parse(localStorage.getItem(KEY)); } catch { P = null; }
  if (!P || typeof P !== 'object') P = {};
  P.name = P.name || '';
  P.coins = P.coins | 0;
  P.owned = Array.isArray(P.owned) ? P.owned : ['newkid'];
  if (!P.owned.includes('newkid')) P.owned.push('newkid');
  P.equipped = P.owned.includes(P.equipped) ? P.equipped : 'newkid';
  return P;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* private mode */ } }

export const profile = {
  get name() { return load().name; },
  set name(v) { load().name = String(v).slice(0, 14); save(); },
  get coins() { return load().coins; },
  get owned() { return load().owned.slice(); },
  get equipped() { return load().equipped; },
  addCoins(n) { load().coins = Math.max(0, P.coins + n); save(); },
  buy(id) {
    load();
    const s = SKIN_CATALOG.find(x => x.id === id);
    if (!s || P.owned.includes(id) || P.coins < s.cost) return false;
    P.coins -= s.cost;
    P.owned.push(id);
    save();
    return true;
  },
  equip(id) {
    load();
    if (!P.owned.includes(id)) return false;
    P.equipped = id;
    save();
    return true;
  },
};

// resolve a skin id into a concrete avatar look (seat idx varies the defaults)
export function lookFor(skinId, seatIdx = 0) {
  const base = defaultLook(seatIdx);
  const s = SKIN_CATALOG.find(x => x.id === skinId);
  return s ? { ...base, ...s.look } : base;
}
