// Player profile: name, Chalk (currency) and skins. Each skin tints the clay
// figure and may add a small accessory parented to the head bone.

export const SKINS = [
  { id: 'chalk', name: 'Plain Chalk', cost: 0, emoji: '⬜', color: '#eef0f2', acc: null },
  { id: 'mint', name: 'Fresh Mint', cost: 80, emoji: '🌿', color: '#9fd8b4', acc: null },
  { id: 'skater', name: 'Skater', cost: 150, emoji: '🛹', color: '#7fb069', acc: 'beanie' },
  { id: 'bench', name: 'Benchwarmer', cost: 200, emoji: '🧢', color: '#d95d4c', acc: 'cap' },
  { id: 'calc', name: 'Calculator', cost: 300, emoji: '🤖', color: '#9aa4b4', acc: 'glasses' },
  { id: 'detention', name: 'Detention Regular', cost: 350, emoji: '🎸', color: '#3a3a46', acc: 'mohawk' },
  { id: 'signal', name: 'Antenna Head', cost: 450, emoji: '📡', color: '#c8d0dc', acc: 'antenna' },
  { id: 'valedict', name: 'Valedictorian', cost: 700, emoji: '👑', color: '#b58cd8', acc: 'crown' },
];

const KEY = 'exam2-profile';
let P = null;
function load() {
  if (P) return P;
  try { P = JSON.parse(localStorage.getItem(KEY)); } catch { P = null; }
  if (!P || typeof P !== 'object') P = {};
  P.name = P.name || '';
  P.chalk = P.chalk | 0;
  P.owned = Array.isArray(P.owned) ? P.owned : ['chalk'];
  if (!P.owned.includes('chalk')) P.owned.push('chalk');
  P.skin = P.owned.includes(P.skin) ? P.skin : 'chalk';
  return P;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* private mode */ } };

export const profile = {
  get name() { return load().name; },
  set name(v) { load().name = String(v).slice(0, 14); save(); },
  get chalk() { return load().chalk; },
  get owned() { return load().owned.slice(); },
  get skin() { return load().skin; },
  earn(n) { load().chalk = Math.max(0, P.chalk + n); save(); },
  buy(id) {
    load();
    const s = SKINS.find(x => x.id === id);
    if (!s || P.owned.includes(id) || P.chalk < s.cost) return false;
    P.chalk -= s.cost; P.owned.push(id); save(); return true;
  },
  equip(id) { load(); if (!P.owned.includes(id)) return false; P.skin = id; save(); return true; },
};

export const skinById = id => SKINS.find(s => s.id === id) || SKINS[0];
