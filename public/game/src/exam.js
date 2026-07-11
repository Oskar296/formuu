// The un-Googleable exam: every round invents a fictional country on the spot.
// Facts exist only inside this match, so no second phone can help you.

export function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYL = ['va','zor','mel','tok','rin','dra','sev','ku','lo','phor','ath','wen','gru','sil','mor','tan','esk','bri','nu','quen','ol','fim','dar','pol'];
const ADJ = ['Glass','Iron','Silent','Amber','Crimson','Hollow','Salt','Moonlit','Frozen','Great','Endless','Whistling'];
const THING = ['Spoon','Umbrella','Goose','Lantern','Pickle','Kettle','Sock','Turnip','Accordion','Broom','Teacup','Radish'];
const EVENT = ['Uprising','Truce','Famine','Festival','Reform','Scandal','Blizzard','Parade','Rebellion','Treaty'];
const COLORS = ['teal','ochre','violet','crimson','sage','indigo','rust','mustard'];
const DISH = ['dumpling','fig loaf','sour pie','kelp stew','honey brick','reed cake','ash bread','pickled turnip'];
const ANIMAL = ['heron','lynx','newt','raven','stag','carp','moth','boar','owl','toad'];

const word = (r, n = 2) => {
  let w = '';
  for (let i = 0; i < n; i++) w += SYL[(r() * SYL.length) | 0];
  return w[0].toUpperCase() + w.slice(1);
};
const pick = (r, a) => a[(r() * a.length) | 0];
const shuffle = (r, a) => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};

export const N_QUESTIONS = 8;
export const LETTERS = ['A', 'B', 'C', 'D'];

export function generateExam(seed) {
  const r = rng(seed);
  const country = word(r) + (r() < 0.4 ? 'ia' : r() < 0.5 ? 'stan' : '');
  const capital = word(r), river = word(r), founder = (r() < 0.5 ? 'Queen ' : 'King ') + word(r, 1);
  const year = 800 + ((r() * 900) | 0);
  const spoonWar = `the ${pick(r, ADJ)} ${pick(r, THING)} ${pick(r, EVENT)}`;
  const currency = word(r, 1) + pick(r, ['ok', 'en', 'ar', 'im']);
  const flag = pick(r, COLORS), dish = pick(r, DISH), bird = pick(r, ADJ).toLowerCase() + ' ' + pick(r, ANIMAL);
  const mountain = word(r) + ' Peak', pop = (2 + (r() * 40 | 0)) + ' million';

  const bank = [
    { q: `What is the capital of ${country}?`, a: capital, alt: () => word(r) },
    { q: `Which river runs through the capital of ${country}?`, a: river, alt: () => word(r) },
    { q: `Who founded ${country}?`, a: founder, alt: () => (r() < 0.5 ? 'Queen ' : 'Lord ') + word(r, 1) },
    { q: `In which year did ${spoonWar} end?`, a: '' + year, alt: () => '' + (800 + ((r() * 900) | 0)) },
    { q: `What is the currency of ${country}?`, a: currency, alt: () => word(r, 1) + pick(r, ['ok', 'en', 'ar']) },
    { q: `What colour dominates the flag of ${country}?`, a: flag, alt: () => pick(r, COLORS) },
    { q: `What is the national dish of ${country}?`, a: dish, alt: () => pick(r, DISH) },
    { q: `What is the national bird of ${country}?`, a: bird, alt: () => pick(r, ADJ).toLowerCase() + ' ' + pick(r, ANIMAL) },
    { q: `What is the tallest mountain in ${country}?`, a: mountain, alt: () => word(r) + ' Peak' },
    { q: `What is the population of ${country}?`, a: pop, alt: () => (2 + (r() * 40 | 0)) + ' million' },
  ];

  const qs = shuffle(r, bank).slice(0, N_QUESTIONS).map((b, id) => {
    const opts = new Set([b.a]);
    while (opts.size < 4) opts.add(b.alt());
    const options = shuffle(r, [...opts]);
    return { id, text: b.q, options, correct: options.indexOf(b.a) };
  });
  return { country, questions: qs };
}

// Deal knowledge: each student "studied" 2 answers; every question is known by
// someone, so 100% is possible — but ONLY by smuggling answers around the room.
export function dealKnowledge(seed, playerIds) {
  const r = rng(seed ^ 0x9e3779b9);
  const deal = {}; playerIds.forEach(p => (deal[p] = new Set()));
  let order = shuffle(r, [...Array(N_QUESTIONS).keys()]);
  let qi = 0;
  const next = () => { if (qi >= order.length) { order = shuffle(r, order); qi = 0; } return order[qi++]; };
  for (let round = 0; round < 2; round++)
    for (const p of shuffle(r, playerIds)) {
      let q = next(), tries = 0;
      while (deal[p].has(q) && tries++ < 12) q = next();
      deal[p].add(q);
    }
  const out = {};
  for (const p of playerIds) out[p] = [...deal[p]];
  return out;
}

export function score(answers, exam) {
  let n = 0;
  for (const q of exam.questions) if (answers && answers[q.id] === q.correct) n++;
  return n;
}
